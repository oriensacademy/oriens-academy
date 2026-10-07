"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { queryKeys, useQuery } from "@/lib/data/query-store";
import { listAdminCalendarMonth, type AdminCalendarEvent } from "@/lib/admin/topbar-calendar";
import { listAdminStudents } from "@/lib/admin/students";
import { listAdminPayments } from "@/lib/admin/payments";
import { listAdminContactRequests } from "@/lib/admin/contacts";
import { listAdminBlogPosts } from "@/lib/admin/blog";
import { listAdminTestimonials } from "@/lib/admin/content";
import { packageDisplayName } from "@/lib/packages/display";
import { foldTurkish } from "@/lib/format/turkish";
import { ensureTrailingSlash } from "@/lib/routes";

// Üst çubuk — referans: Oriens/src/markup/oriens-admin.body.html (header.tb)
// ve oriens-admin.js (saat, üst çubuk takvimi, GENEL ARAMA). Sınıflar
// admin-frame.module.css içindeki :global() kurallarıyla çizilir.

const AYL = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
/** getDay() sırası */
const GNL = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
/** Pazartesi başlangıçlı sıra */
const GUN = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const DW = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fxTL = (n: number) => `₺${n.toLocaleString("tr-TR")}`;
const adBuyuk = (a: string) => a.split(" ").map((w) => (w ? w.charAt(0).toLocaleUpperCase("tr") + w.slice(1) : w)).join(" ");
const dateLabel = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())} ${AYL[d.getMonth()]} ${d.getFullYear()}`;
};

// ---- Saat: referanstaki gibi 5 sn'de bir güncellenir; sunucuda boş çizilir ----
let clockNow = 0;
let clockTimer: number | null = null;
const clockListeners = new Set<() => void>();

function subscribeClock(onChange: () => void) {
  clockListeners.add(onChange);
  if (clockTimer === null) {
    clockNow = Date.now();
    clockTimer = window.setInterval(() => {
      clockNow = Date.now();
      clockListeners.forEach((listener) => listener());
    }, 5000);
  }
  return () => {
    clockListeners.delete(onChange);
    if (!clockListeners.size && clockTimer !== null) {
      window.clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

function getClock() {
  if (!clockNow) clockNow = Date.now();
  return clockNow;
}

function useClock(): Date | null {
  const now = useSyncExternalStore(subscribeClock, getClock, () => 0);
  return now ? new Date(now) : null;
}

// ---- Tarih kutusu + takvim ----
type DayEvents = { d: AdminCalendarEvent[]; o: AdminCalendarEvent[] };

function TopbarWhen() {
  const now = useClock();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ y: 0, m: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { data } = useQuery(
    open ? `admin:calendar:${view.y}-${view.m}` : null,
    () => listAdminCalendarMonth(view.y, view.m),
    { staleTime: 60_000, enabled: open }
  );

  const events = useMemo(() => {
    const map = new Map<string, DayEvents>();
    const add = (kind: "d" | "o", event: AdminCalendarEvent) => {
      const key = dayKey(new Date(event.t));
      const entry = map.get(key) ?? { d: [], o: [] };
      entry[kind].push(event);
      map.set(key, entry);
    };
    data?.lessons.forEach((event) => add("d", event));
    data?.payments.forEach((event) => add("o", event));
    return map;
  }, [data]);

  const toggle = () => {
    if (!open) {
      const n = new Date();
      setView({ y: n.getFullYear(), m: n.getMonth() });
      setSelected(null);
    }
    setOpen(!open);
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (wrapRef.current && !event.composedPath().includes(wrapRef.current)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shiftMonth = (step: number) => {
    if (!step) {
      const n = new Date();
      setView({ y: n.getFullYear(), m: n.getMonth() });
      return;
    }
    setView(({ y, m }) => {
      const next = m + step;
      if (next < 0) return { y: y - 1, m: 11 };
      if (next > 11) return { y: y + 1, m: 0 };
      return { y, m: next };
    });
  };

  const weekend = now ? now.getDay() === 0 || now.getDay() === 6 : false;

  const cells: ReactNode[] = [];
  let info = "";
  let isCurrentMonth = true;
  if (open) {
    const { y, m } = view;
    const today = new Date();
    const first = new Date(y, m, 1);
    const start = (first.getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();
    const total = Math.ceil((start + days) / 7) * 7;
    for (let i = 0; i < total; i++) {
      let day: number;
      let out = false;
      let date: Date;
      if (i < start) {
        day = prevDays - start + i + 1;
        out = true;
        date = new Date(y, m - 1, day);
      } else if (i >= start + days) {
        day = i - start - days + 1;
        out = true;
        date = new Date(y, m + 1, day);
      } else {
        day = i - start + 1;
        date = new Date(y, m, day);
      }
      const isToday = date.toDateString() === today.toDateString();
      const we = i % 7 > 4;
      const key = dayKey(date);
      const ev = events.get(key);
      const hasLesson = Boolean(ev?.d.length);
      const hasPayment = Boolean(ev?.o.length);
      const title = `${pad(date.getDate())} ${AYL[date.getMonth()]} ${date.getFullYear()} ${GUN[(date.getDay() + 6) % 7]}${
        ev ? ` · ${hasLesson ? `${ev.d.length} ders` : ""}${hasLesson && hasPayment ? ", " : ""}${hasPayment ? `${ev.o.length} ödeme` : ""}` : ""
      }`;
      cells.push(
        <span
          key={key}
          className={`d${out ? " o" : ""}${we ? " we" : ""}${isToday ? " t" : ""}${ev ? " ev" : ""}${key === selected ? " sel" : ""}`}
          data-k={key}
          title={title}
          aria-current={isToday ? "date" : undefined}
          onClick={() => setSelected((current) => (current === key ? null : key))}
        >
          {day}
          {ev ? (
            <em>
              {hasLesson ? <i className="l" /> : null}
              {hasPayment ? <i className="o" /> : null}
            </em>
          ) : null}
        </span>
      );
    }
    isCurrentMonth = y === today.getFullYear() && m === today.getMonth();
    info = isCurrentMonth
      ? `Bugün: ${pad(today.getDate())} ${AYL[today.getMonth()]} ${GUN[(today.getDay() + 6) % 7]}`
      : `${days} gün`;
  }

  let detail: ReactNode = null;
  if (open && selected) {
    const d = new Date(`${selected}T00:00:00`);
    const ev = events.get(selected);
    const row = (event: AdminCalendarEvent, kind: "l" | "o", index: number) => {
      const t = new Date(event.t);
      return (
        <li key={`${kind}${index}`}>
          <i className={kind} />
          <span>
            <b>{event.a}</b>
            <small>{event.b}</small>
          </span>
          <time>{`${pad(t.getHours())}:${pad(t.getMinutes())}`}</time>
        </li>
      );
    };
    detail = (
      <>
        <div className="tw-evh">{`${pad(d.getDate())} ${AYL[d.getMonth()]} ${GUN[(d.getDay() + 6) % 7]}`}</div>
        {ev ? (
          <ul>
            {ev.d.map((event, index) => row(event, "l", index))}
            {ev.o.map((event, index) => row(event, "o", index))}
          </ul>
        ) : (
          <p>Bu gün için ders veya ödeme kaydı yok.</p>
        )}
      </>
    );
  }

  return (
    <div className={`tb-when${weekend ? " hs" : ""}`} aria-live="off">
      <div className="tw-calw" ref={wrapRef}>
        <button
          ref={buttonRef}
          type="button"
          className="tw-cal"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="tw-pop"
          title="Takvimi aç"
          onClick={toggle}
        >
          <span className="tw-tile" aria-hidden="true">
            <small>{now ? AYL[now.getMonth()].slice(0, 3).toLocaleUpperCase("tr-TR") : ""}</small>
            <b>{now ? pad(now.getDate()) : ""}</b>
          </span>
          <span className="tw-txt">
            <b>{now ? `${pad(now.getDate())} ${AYL[now.getMonth()]} ${now.getFullYear()}` : ""}</b>
            <span>{now ? GNL[now.getDay()] : ""}</span>
          </span>
        </button>
        <div className="tw-pop" id="tw-pop" role="dialog" aria-label="Takvim" hidden={!open}>
          <div className="tw-ph">
            <button type="button" className="tw-nav" aria-label="Önceki ay" onClick={() => shiftMonth(-1)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <b id="tw-title">{open ? `${AYL[view.m]} ${view.y}` : ""}</b>
            <button type="button" className="tw-nav" aria-label="Sonraki ay" onClick={() => shiftMonth(1)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
          <div className="tw-grid" id="tw-grid">
            {DW.map((label, index) => (
              <span key={label} className={`dw${index > 4 ? " we" : ""}`}>{label}</span>
            ))}
            {cells}
          </div>
          <div className="tw-leg">
            <span><i className="l" />Ders</span>
            <span><i className="o" />Ödeme</span>
          </div>
          <div className="tw-ev" id="tw-ev" hidden={!detail}>{detail}</div>
          <div className="tw-pf">
            <span id="tw-info">{info}</span>
            <button type="button" className="tw-today" hidden={isCurrentMonth} onClick={() => shiftMonth(0)}>Bugün</button>
          </div>
        </div>
      </div>
      <span className="tw-sep" aria-hidden="true" />
      <span className="tw-clock" aria-label="Saat">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        <b>{now ? <>{pad(now.getHours())}<i>:</i>{pad(now.getMinutes())}</> : null}</b>
      </span>
    </div>
  );
}

// ---- Genel arama (Ctrl/Cmd+O) ----
type SearchIcon = "sayfa" | "ogr" | "od" | "il" | "blog" | "yor";

const searchSvg = (children: ReactNode) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

const SEARCH_ICONS: Record<SearchIcon, ReactNode> = {
  sayfa: searchSvg(<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></>),
  ogr: searchSvg(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  od: searchSvg(<><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>),
  il: searchSvg(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />),
  blog: searchSvg(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>),
  yor: searchSvg(<path d="m12 2 3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.3 3.2L7 14.2 2 9.4l7-.9z" />),
};

const SEARCH_PAGES: [string, string][] = [
  ["/admin", "Genel Bakış"],
  ["/admin/ogrenciler", "Öğrenciler"],
  ["/admin/fiyatlandirma", "Fiyatlandırma"],
  ["/admin/indirim-kuponlari", "İndirim Kuponları"],
  ["/admin/odemeler", "Ödemeler"],
  ["/admin/mali-akis", "Gelir İstatistikleri"],
  ["/admin/blog", "Blog"],
  ["/admin/blog/editor", "Yeni blog yazısı"],
  ["/admin/degerlendirmeler", "Değerlendirmeler"],
  ["/admin/iletisim-destek", "İletişim Talepleri"],
  ["/admin/bildirimler", "E-posta Geçmişi"],
  ["/admin/denetim", "Denetim Kayıtları"],
  ["/admin/ayarlar", "Ayarlar"],
];

const CONTACT_STATUS: Record<string, string> = { new: "Yeni", in_progress: "İşlemde", resolved: "Çözüldü", spam: "Spam" };
const CONTACT_FORM: Record<string, string> = { contact_form: "İletişim formu", quick_contact: "Hızlı iletişim", consultation: "Danışmanlık formu" };

interface SearchItem {
  id: string;
  g: string;
  ic: SearchIcon;
  c: string;
  b: string;
  s: string;
  r?: string;
  k: string;
  href: string;
  archived?: boolean;
}

function highlight(text: string, q: string): ReactNode {
  const index = q ? foldTurkish(text).indexOf(q) : -1;
  // Katlama karakter sayısını değiştirmediğinde konum metinle örtüşür.
  if (index < 0 || foldTurkish(text).length !== text.length) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + q.length)}</mark>
      {text.slice(index + q.length)}
    </>
  );
}

function GlobalSearch({ openSignal }: { openSignal: number }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const options = { staleTime: 60_000, enabled: active };
  const studentsActive = useQuery(`${queryKeys.adminStudents}:active`, () => listAdminStudents({ archived: false }), options);
  const studentsArchive = useQuery(`${queryKeys.adminStudents}:archive`, () => listAdminStudents({ archived: true }), options);
  const payments = useQuery(`${queryKeys.adminPayments}:search`, () => listAdminPayments(), options);
  const contactsActive = useQuery(`${queryKeys.adminContacts}:search:active`, () => listAdminContactRequests({ archived: false }), options);
  const contactsArchive = useQuery(`${queryKeys.adminContacts}:search:archive`, () => listAdminContactRequests({ archived: true }), options);
  const blog = useQuery(`${queryKeys.adminBlog}:active`, () => listAdminBlogPosts({ archived: false }), options);
  const reviews = useQuery("admin:testimonials:all", () => listAdminTestimonials({}), options);

  const sources = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = SEARCH_PAGES.map(([href, label]) => ({
      id: `p:${href}`, g: "Sayfalar", ic: "sayfa", c: "", b: label, s: "Sayfaya git", k: label, href,
    }));

    const students = [...(studentsActive.data?.data ?? []), ...(studentsArchive.data?.data ?? [])];
    const studentNames = new Map<string, string>();
    for (const o of students) {
      if (o.userId) studentNames.set(o.userId, o.fullName);
      items.push({
        id: `s:${o.id}`,
        g: "Öğrenciler",
        ic: "ogr",
        c: "g",
        b: o.fullName,
        s: [o.archived ? "Arşivde" : "", o.school, o.gradeLevel, o.guardianName && `Veli: ${o.guardianName}`].filter(Boolean).join(" · "),
        r: o.activePackage ? `${Math.max(0, o.activePackage.lessonCount - o.activePackage.lessonsUsed)} ders kaldı` : "Paket yok",
        k: [o.fullName, o.school, o.gradeLevel, o.educationProgram, o.examsTaken.join(" "), o.email, o.phone, o.guardianName, o.guardianEmail, o.guardianPhone].filter(Boolean).join(" "),
        href: `/admin/ogrenciler/detay?student=${encodeURIComponent(o.userId || o.id)}`,
        archived: o.archived,
      });
    }

    for (const o of payments.data?.data ?? []) {
      const owner = o.package_owner_student_id ?? o.student_user_id ?? null;
      const studentName = owner ? studentNames.get(owner) : undefined;
      const payer = o.payer_name?.trim() || o.payer_email || "";
      const pkg = packageDisplayName({ package_id: o.package_id, metadata: o.metadata });
      const coupon = o.metadata?.coupon_code ?? "";
      items.push({
        id: `o:${o.id}`,
        g: "Ödemeler",
        ic: "od",
        c: "y",
        b: `${adBuyuk(payer)} · ${fxTL(Number(o.amount) || 0)}`,
        s: `${pkg} · ${dateLabel(o.created_at)}${o.public_reference ? ` · ${o.public_reference}` : ""}`,
        r: studentName ? `Öğrenci: ${studentName}` : "",
        k: [o.payer_name, studentName, o.payer_email, o.payer_phone, o.public_reference, coupon, pkg].filter(Boolean).join(" "),
        href: `/admin/odemeler?search=${encodeURIComponent(o.public_reference || payer)}`,
      });
    }

    for (const x of [...(contactsActive.data?.data ?? []), ...(contactsArchive.data?.data ?? [])]) {
      items.push({
        id: `i:${x.id}`,
        g: "İletişim talepleri",
        ic: "il",
        c: "b",
        b: `${x.full_name || x.email}${x.subject ? ` · ${x.subject}` : ""}`,
        s: `${CONTACT_FORM[x.source] ?? x.source} · ${dateLabel(x.created_at)}${x.is_archived ? " · Arşivde" : ""}`,
        r: CONTACT_STATUS[x.status] ?? x.status,
        k: [x.full_name, x.email, x.phone, x.subject, CONTACT_FORM[x.source] ?? x.source, x.message].filter(Boolean).join(" "),
        href: `/admin/iletisim-destek?id=${encodeURIComponent(x.id)}`,
      });
    }

    // Üretimde zamanlanmış yayın durumu yok (draft | published | archived).
    for (const x of blog.data?.data ?? []) {
      items.push({
        id: `b:${x.id}`,
        g: "Blog",
        ic: "blog",
        c: "p",
        b: x.title || "Başlıksız yazı",
        s: `${x.status === "published" ? "Yayında" : "Taslak"} · /blog/${x.slug}`,
        k: [x.title, x.slug].filter(Boolean).join(" "),
        href: `/admin/blog/editor?id=${encodeURIComponent(x.id)}`,
      });
    }

    for (const y of reviews.data?.data ?? []) {
      const topic = y.source_topic?.trim();
      items.push({
        id: `y:${y.id}`,
        g: "Değerlendirmeler",
        ic: "yor",
        c: "y",
        b: topic ? `${y.name} · ${topic}` : y.name,
        s: [y.context || "Genel Takviye", (y.locale || "").toUpperCase(), y.featured ? "Ana sayfada" : ""].filter(Boolean).join(" · "),
        k: [y.name, topic, y.context, y.exam_code, y.quote].filter(Boolean).join(" "),
        href: `/admin/degerlendirmeler?id=${encodeURIComponent(y.id)}`,
      });
    }
    return items;
  }, [studentsActive.data, studentsArchive.data, payments.data, contactsActive.data, contactsArchive.data, blog.data, reviews.data]);

  const q = foldTurkish(query.trim());
  const results = useMemo(() => {
    if (!q) {
      return [
        ...sources.filter((x) => x.g === "Sayfalar"),
        ...sources.filter((x) => x.g === "Öğrenciler" && !x.archived).slice(0, 5),
      ];
    }
    const parts = q.split(/\s+/);
    const perGroup = new Map<string, number>();
    return sources
      .filter((x) => {
        const haystack = foldTurkish(`${x.k} ${x.b}`);
        return parts.every((part) => haystack.includes(part));
      })
      .filter((x) => {
        const count = (perGroup.get(x.g) ?? 0) + 1;
        perGroup.set(x.g, count);
        return count <= 6;
      });
  }, [q, sources]);

  const current = Math.min(selectedIndex, Math.max(0, results.length - 1));

  const open = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialog.open) {
      inputRef.current?.select();
      return;
    }
    document.querySelectorAll("dialog[open]").forEach((other) => {
      if (other !== dialog) (other as HTMLDialogElement).close();
    });
    setQuery("");
    setSelectedIndex(0);
    setActive(true);
    dialog.showModal();
    inputRef.current?.focus();
  }, []);

  // Başlıktaki arama düğmesi
  const lastSignal = useRef(openSignal);
  useEffect(() => {
    if (openSignal !== lastSignal.current) {
      lastSignal.current = openSignal;
      open();
    }
  }, [openSignal, open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && (event.key === "o" || event.key === "O")) {
        event.preventDefault();
        open();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const select = (index: number) => {
    if (!results.length) return;
    const next = (index + results.length) % results.length;
    setSelectedIndex(next);
    listRef.current?.querySelector(`[data-i="${next}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const go = (index: number) => {
    const item = results[index];
    if (!item) return;
    dialogRef.current?.close();
    router.push(ensureTrailingSlash(item.href));
  };

  const firstPart = q.split(/\s+/)[0] ?? "";
  let lastGroup = "";

  return (
    <dialog
      ref={dialogRef}
      className="gs-dlg"
      id="gs-dialog"
      aria-label="Panelde ara"
      onClose={() => setActive(false)}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <div className="gs-box">
        <div className="gs-in">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            ref={inputRef}
            id="gs-q"
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Öğrenci, veli, ödeme referansı, talep, yorum veya sayfa ara…"
            aria-controls="gs-list"
            aria-activedescendant={results.length ? `gs-o${current}` : undefined}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                select(current + 1);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                select(current - 1);
              } else if (event.key === "Enter") {
                event.preventDefault();
                go(current);
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="gs-list" id="gs-list" role="listbox" ref={listRef}>
          {results.length === 0 ? (
            <div className="gs-empty">{`“${query.trim()}” için sonuç bulunamadı.`}</div>
          ) : (
            results.map((item, index) => {
              const heading = item.g !== lastGroup ? (q || item.g !== "Öğrenciler" ? item.g : "Son öğrenciler") : null;
              lastGroup = item.g;
              return (
                <SearchRow
                  key={item.id}
                  heading={heading}
                  item={item}
                  index={index}
                  selected={index === current}
                  mark={firstPart}
                  onHover={() => {
                    if (index !== current) select(index);
                  }}
                  onOpen={() => go(index)}
                />
              );
            })
          )}
        </div>
        <div className="gs-f">
          <span><kbd>↑</kbd><kbd>↓</kbd> gezin</span>
          <span><kbd>Enter</kbd> aç</span>
          <span><kbd>Esc</kbd> kapat</span>
        </div>
      </div>
    </dialog>
  );
}

function SearchRow({ heading, item, index, selected, mark, onHover, onOpen }: {
  heading: string | null;
  item: SearchItem;
  index: number;
  selected: boolean;
  mark: string;
  onHover: () => void;
  onOpen: () => void;
}) {
  return (
    <>
      {heading ? <div className="gs-sec">{heading}</div> : null}
      <div className="gs-it" role="option" id={`gs-o${index}`} data-i={index} aria-selected={selected} onMouseMove={onHover} onClick={onOpen}>
        <span className={`gi ${item.c}`}>{SEARCH_ICONS[item.ic]}</span>
        <span>
          <b>{highlight(item.b, mark)}</b>
          <small>{item.s}</small>
        </span>
        <span className="gr">{item.r ?? ""}</span>
      </div>
    </>
  );
}

// ---- Üst çubuk ----
export function AdminHeader() {
  const { user, signOut } = useAdminAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [searchSignal, setSearchSignal] = useState(0);

  const confirmSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    router.replace("/tr/");
  };

  const email = user?.email ?? "";

  return (
    <>
      <header className="tb">
        <TopbarWhen />
        <button type="button" className="tb-search" data-gs-open aria-label="Panelde ara" title="Panelde ara" onClick={() => setSearchSignal((n) => n + 1)}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <span>Öğrenci, veli, ödeme, talep veya sayfa ara…</span>
        </button>
        <div className="tb-right">
          <div className="tb-user" title={email ? `Oriens Admin · ${email}` : "Oriens Admin"}>
            <span className="tb-av" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><circle cx="12" cy="10.5" r="2.5" /><path d="M8.2 16.6a4.2 4.2 0 0 1 7.6 0" /></svg>
            </span>
            <span className="tb-who"><b>Oriens Admin</b></span>
          </div>
          <button className="tb-btn tb-out" type="button" onClick={() => void confirmSignOut()} disabled={signingOut} aria-busy={signingOut}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            <span>Çıkış Yap</span>
          </button>
        </div>
      </header>

      <GlobalSearch openSignal={searchSignal} />
    </>
  );
}

export default AdminHeader;
