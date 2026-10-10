"use client";

// Hesabım — "Oriens/src/vanilla/hesabim.js" + "src/next/markup.html" referansının
// üretim verisiyle çizilmiş hali. İşaretleme referansla birebir (sınıflar hb-
// önekli, CSS Module içinde :global). Ödeme, paket tanımlama, auth ve mail
// mantığı değişmez; Hesap sekmesi mevcut auth fonksiyonlarını çağırır.
// Admin notları (student_admin_notes) ve teacher_note hiçbir koşulda gösterilmez.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { localizedPath } from "@/lib/routes";
import { packageDisplayName } from "@/lib/packages/display";
import { getPublicPricingPackages, selectPurchasablePackages, type PublicPricingPackage } from "@/lib/admin/pricing";
import { getLocalizedPackageDisplayPrice } from "@/lib/pricing/package-display";
import { usePublicSettings } from "@/lib/settings/public-settings-context";
import { getPaymentRefundCopy } from "@/content/payment-refund";
import { useSiteContact } from "@/lib/contact-settings";
import { compareTr } from "@/lib/format/turkish";
import { deleteOwnAccount, requestEmailChange, updateGuardianProfile, updateStudentPassword, verifyEmailChangeOtp } from "@/lib/student/auth";
import { localizeErrorMessage } from "@/lib/utils/error-messages";
import { formatTrPhoneInput, isCompleteTrPhone, trPhoneInputDigits } from "@/lib/format/phone";
import type { StudentLessonRow, StudentPayment, StudentPortalData, StudentPurchase } from "@/lib/student/data";
import type { Tables } from "@/types/database.types";
import styles from "./hesabim.module.css";

type Locale = "tr" | "en";
type TabKey = "genel" | "dersler" | "paket" | "profil";
type Guardian = Tables<"guardian_accounts">;

const SEKME: TabKey[] = ["genel", "dersler", "paket", "profil"];
const SEKME_AD: Record<TabKey, [string, string]> = {
  genel: ["Genel", "Overview"],
  dersler: ["Dersler", "Lessons"],
  paket: ["Ödemeler", "Payments"],
  profil: ["Hesap", "Account"],
};
const DEFAULT_TZ = "Europe/Istanbul";
const HASH_EVENT = "hb-hashchange";

const AYLAR = {
  tr: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const GUNLER = {
  tr: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

// ---------------------------------------------------------------------------
// SVG — referanstaki svg(p, w, sw) yardımcısı ve P yolları
// ---------------------------------------------------------------------------

const P = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  chevR: <path d="m9 18 6-6-6-6" />,
  chevD: <path d="m6 9 6 6 6-6" />,
  book: (
    <>
      <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2Z" />
      <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7Z" />
    </>
  ),
  card: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </>
  ),
  stack: (
    <>
      <rect x="3" y="15" width="18" height="5" rx="1" />
      <rect x="5" y="10" width="15" height="5" rx="1" />
      <rect x="4" y="5" width="13" height="5" rx="1" />
      <path d="M7 15v5M9 10v5M7 5v5" />
    </>
  ),
  school: <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />,
  cap: (
    <>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c3 2 9 2 12 0v-5" />
    </>
  ),
  prog: <path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5a2.5 2.5 0 0 0 0 5H20" />,
  exam: (
    <>
      <path d="M9 11l3 3 8-8" />
      <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />
    </>
  ),
  cal: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  sort: <path d="M3 6h13M3 12h9M3 18h5M18 20V8M15 11l3-3 3 3" />,
};
const SEKME_IKON: Record<TabKey, ReactNode> = {
  genel: P.stack,
  dersler: P.book,
  paket: P.card,
  profil: P.user,
};

function Svg({ p, w = 18, sw = 1.8, className }: { p: ReactNode; w?: number; sw?: number; className?: string }) {
  return (
    <svg className={className} width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sekme durumu: hash tek doğruluk kaynağı (#genel/#dersler/#paket/#profil).
// ---------------------------------------------------------------------------

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  window.addEventListener(HASH_EVENT, onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(HASH_EVENT, onChange);
  };
}

function useActiveTab(): TabKey {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const key = hash.slice(1) as TabKey;
  return SEKME.includes(key) ? key : "genel";
}

// ---------------------------------------------------------------------------
// Biçim yardımcıları (tarih, dersin kendi saat diliminde)
// ---------------------------------------------------------------------------

type Parts = { y: number; m: number; d: number; hh: string; mm: string; wd: number };
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dparts(value: string | null | undefined, timeZone: string = DEFAULT_TZ): Parts | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" };
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", { ...options, timeZone: timeZone || DEFAULT_TZ }).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", { ...options, timeZone: DEFAULT_TZ }).formatToParts(date);
  }
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { y: Number(get("year")), m: Number(get("month")) - 1, d: Number(get("day")), hh: get("hour"), mm: get("minute"), wd: WD.indexOf(get("weekday")) };
}

const iki = (n: number) => `0${n}`.slice(-2);

function fmt(locale: Locale) {
  const ay = AYLAR[locale];
  return {
    tarih: (p: Parts) => `${p.d} ${ay[p.m]} ${p.y}`,
    noktali: (p: Parts) => `${iki(p.d)}.${iki(p.m + 1)}.${p.y}`,
    saat: (p: Parts) => `${p.hh}:${p.mm}`,
    gun: (p: Parts) => GUNLER[locale][p.wd] ?? "",
    ayYil: (p: Parts) => `${ay[p.m]} ${p.y}`,
    kisaAy: (p: Parts) => ay[p.m].slice(0, 3).toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-GB"),
  };
}

function tl(amount: number, currency: string | null | undefined) {
  const value = Number(amount) || 0;
  if (!currency || currency === "TRY") return `₺${value.toLocaleString("tr-TR")}`;
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency, maximumFractionDigits: Number.isInteger(value) ? 0 : 2 }).format(value);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

// telefon: +90 sabit, 10 hane saklanır, (XXX) XXX XX XX biçiminde gösterilir
// (kanonik yardımcılar: src/lib/format/phone.ts)
const telNo = trPhoneInputDigits;
const telFmt = formatTrPhoneInput;

// ---------------------------------------------------------------------------
// Paket durumu
// ---------------------------------------------------------------------------

type PackageState =
  | { kind: "active"; name: string; total: number; used: number; remaining: number; startDate: string | null; purchase: StudentPurchase }
  | { kind: "finished"; name: string; total: number; startDate: string | null; purchase: StudentPurchase }
  | { kind: "none" };

function resolvePackageState(data: StudentPortalData, locale: Locale): PackageState {
  const entitlement = data.entitlement;
  const active = entitlement?.activePackages ?? [];
  if (active.length > 0) {
    const total = sum(active.map((p) => p.lesson_count));
    const used = sum(active.map((p) => p.lessons_used));
    const remaining = entitlement.totalRemainingLessons > 0 ? entitlement.totalRemainingLessons : Math.max(0, total - used);
    return {
      kind: "active",
      name: active.map((p) => packageDisplayName(p, locale)).join(" + "),
      total,
      used,
      remaining,
      startDate: active[0].start_date || active[0].created_at,
      purchase: active[0],
    };
  }
  const finished = (entitlement?.pastPackages ?? []).find(
    (p) => !["refunded", "cancelled"].includes(String(p.status)) && p.payment_status !== "refunded" && (p.lesson_count || 0) > 0
  );
  if (finished) {
    return {
      kind: "finished",
      name: packageDisplayName(finished, locale),
      total: finished.lesson_count || 0,
      startDate: finished.start_date || finished.created_at,
      purchase: finished,
    };
  }
  return { kind: "none" };
}

function completedLessons(data: StudentPortalData): StudentLessonRow[] {
  return data.lessons
    .filter((lesson) => lesson.status === "completed" && !lesson.is_archived)
    .sort((a, b) => (b.lesson_date || "").localeCompare(a.lesson_date || ""));
}

// ---------------------------------------------------------------------------
// Ana görünüm
// ---------------------------------------------------------------------------

type Toast = (message: string) => void;

interface Ctx {
  locale: Locale;
  t: (tr: string, en: string) => string;
  f: ReturnType<typeof fmt>;
  pricingVisible: boolean;
  git: (key: TabKey, odak?: string) => void;
}

export interface HesabimViewProps {
  locale: Locale;
  data: StudentPortalData;
  guardian: Guardian | null;
  learners: Tables<"student_profiles">[];
  selectedLearnerId: string;
  onSelectLearner: (id: string) => void;
  onLogout: () => void;
  /** Hesap sahibi kaydı/e-posta değişikliği sonrası başlığı günceller. */
  onGuardianChange: (patch: Partial<Guardian>) => void;
  onReload: () => void;
  onAccountDeleted: () => void;
}

export function HesabimView({ locale, data, guardian, learners, selectedLearnerId, onSelectLearner, onLogout, onGuardianChange, onReload, onAccountDeleted }: HesabimViewProps) {
  const t = (tr: string, en: string) => (locale === "tr" ? tr : en);
  const f = fmt(locale);
  const tab = useActiveTab();
  const { showPricing, loading: settingsLoading } = usePublicSettings();
  const pricingVisible = showPricing && !settingsLoading;
  const pkg = useMemo(() => resolvePackageState(data, locale), [data, locale]);
  const wrapRef = useRef<HTMLElement>(null);
  const hdRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // toast
  const [toastMsg, setToastMsg] = useState("");
  const [toastOn, setToastOn] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const toast: Toast = (message) => {
    setToastMsg(message);
    setToastOn(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastOn(false), 2600);
  };
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // üyelik silme diyaloğu (her açılışta alanlar sıfırlanır)
  const dlgRef = useRef<HTMLDialogElement>(null);
  const [silKey, setSilKey] = useState(0);
  const openSil = () => {
    flushSync(() => setSilKey((k) => k + 1));
    dlgRef.current?.showModal();
  };

  const sekme = (key: TabKey, odak?: string, tasi?: boolean) => {
    window.history.replaceState(window.history.state, "", `#${key}`);
    flushSync(() => window.dispatchEvent(new Event(HASH_EVENT)));
    const ak = document.getElementById(`t-${key}`);
    if (ak && tasi) ak.focus();
    const nav = navRef.current;
    if (ak && nav && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: ak.offsetLeft - 16, behavior: "smooth" });
    const hedef = odak ? document.getElementById(odak) : null;
    if (hedef) window.setTimeout(() => window.scrollTo({ top: hedef.getBoundingClientRect().top + window.scrollY - 84, behavior: "smooth" }), 30);
    else if (hdRef.current && wrapRef.current && hdRef.current.getBoundingClientRect().top < 0) window.scrollTo({ top: wrapRef.current.offsetTop - 70, behavior: "smooth" });
  };

  const ctx: Ctx = { locale, t, f, pricingVisible, git: (key, odak) => sekme(key, odak) };

  const durum =
    pkg.kind === "none"
      ? { cls: "hb-warn", txt: t("Aktif paket yok", "No active package") }
      : pkg.kind === "finished" || pkg.remaining <= 0
        ? { cls: "hb-warn", txt: t("Ders hakkı bitti", "No lessons left") }
        : { cls: "hb-ok", txt: t("Aktif öğrenci", "Active student") };

  const sortedLearners = [...learners].sort((a, b) => compareTr(a.full_name, b.full_name));
  const remaining = pkg.kind === "active" ? pkg.remaining : 0;

  return (
    <div className={`oriens-hesabim ${styles.root}`}>
      <main className="hb-wrap" ref={wrapRef}>
        <header className="hb-hd" ref={hdRef}>
          <div className="hb-hd-top">
            <div className="hb-hd-l">
              <h1 id="selam">{`${t("Hoş geldiniz", "Welcome")}, ${guardian?.full_name || data.profile.full_name}`}</h1>
              <div className="hb-hd-meta" id="hd-meta">
                <span className="hb-chip">
                  <Svg p={P.user} w={15} sw={1.9} />
                  {data.profile.full_name}
                </span>
                <span className={`hb-pill hb-dotted ${durum.cls}`}>{durum.txt}</span>
              </div>
            </div>
            <div className="hb-hd-r">
              <div className="hb-ogr-sel" id="ogr-sel" hidden={learners.length < 2}>
                <label htmlFor="ogr">{t("Öğrenci", "Student")}</label>
                <select id="ogr" value={selectedLearnerId} onChange={(event) => onSelectLearner(event.target.value)}>
                  {sortedLearners.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <a
                className="hb-btn2"
                href={localizedPath("home", locale)}
                id="cikis"
                aria-label={t("Çıkış yap", "Log out")}
                onClick={(event) => {
                  event.preventDefault();
                  onLogout();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                {t("Çıkış yap", "Log out")}
              </a>
            </div>
          </div>
          <nav className="hb-tabs" role="tablist" aria-label={t("Hesap bölümleri", "Account sections")} ref={navRef}>
            {SEKME.map((key, index) => (
              <button
                key={key}
                className="hb-tab"
                role="tab"
                id={`t-${key}`}
                aria-controls={`p-${key}`}
                aria-selected={tab === key}
                tabIndex={tab === key ? undefined : -1}
                data-tab={key}
                onClick={() => sekme(key)}
                onKeyDown={(event) => {
                  let next: TabKey | null = null;
                  if (event.key === "ArrowRight") next = SEKME[(index + 1) % 4];
                  else if (event.key === "ArrowLeft") next = SEKME[(index + 3) % 4];
                  else if (event.key === "Home") next = SEKME[0];
                  else if (event.key === "End") next = SEKME[3];
                  if (next) {
                    event.preventDefault();
                    sekme(next, undefined, true);
                  }
                }}
              >
                <Svg p={SEKME_IKON[key]} w={16} sw={1.8} />
                {t(...SEKME_AD[key])}
              </button>
            ))}
          </nav>
        </header>

        <section className="hb-panel" role="tabpanel" id="p-genel" aria-labelledby="t-genel" data-panel="genel" hidden={tab !== "genel"}>
          <GenelTab data={data} pkg={pkg} ctx={ctx} />
        </section>
        <section className="hb-panel" role="tabpanel" id="p-dersler" aria-labelledby="t-dersler" data-panel="dersler" hidden={tab !== "dersler"}>
          <DerslerTab data={data} ctx={ctx} />
        </section>
        <section className="hb-panel" role="tabpanel" id="p-paket" aria-labelledby="t-paket" data-panel="paket" hidden={tab !== "paket"}>
          <PaketTab data={data} pkg={pkg} ctx={ctx} />
        </section>
        <section className="hb-panel" role="tabpanel" id="p-profil" aria-labelledby="t-profil" data-panel="profil" hidden={tab !== "profil"}>
          <ProfilTab
            key={guardian?.user_id ?? "veli"}
            guardian={guardian}
            fallbackEmail={data.profile.email}
            fallbackPhone={data.profile.phone}
            ctx={ctx}
            toast={toast}
            onGuardianChange={onGuardianChange}
            onReload={onReload}
            onDelete={openSil}
          />
        </section>
      </main>

      <SilDialog key={silKey} dlgRef={dlgRef} remaining={remaining} ctx={ctx} toast={toast} onDeleted={onAccountDeleted} />

      <div className={toastOn ? "hb-toast hb-on" : "hb-toast"} id="toast" role="status" aria-live="polite">
        {toastMsg}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parçalar
// ---------------------------------------------------------------------------

function Dte({ children }: { children: ReactNode }) {
  return (
    <span className="hb-dte">
      <Svg p={P.cal} w={14} />
      <span>{children}</span>
    </span>
  );
}

function TarihKaro({ p, ctx }: { p: Parts | null; ctx: Ctx }) {
  return (
    <span className="hb-dt" aria-hidden="true">
      <b>{p ? iki(p.d) : "—"}</b>
      <small>{p ? ctx.f.kisaAy(p) : ""}</small>
    </span>
  );
}

function lessonParts(lesson: StudentLessonRow) {
  return dparts(lesson.lesson_date, lesson.lesson_timezone);
}

function lessonTopic(lesson: StudentLessonRow) {
  return lesson.subject || lesson.exam_code || "—";
}

function Dmeta({ lesson, ctx }: { lesson: StudentLessonRow; ctx: Ctx }) {
  const p = lessonParts(lesson);
  return (
    <span className="hb-dmeta">
      <span>
        <Svg p={P.book} w={15} />
        <i>{lessonTopic(lesson)}</i>
      </span>
      <span>
        <Svg p={P.cal} w={15} />
        <i>{p ? ctx.f.tarih(p) : "—"}</i>
      </span>
    </span>
  );
}

function RaporKutu({ lesson, ctx }: { lesson: StudentLessonRow; ctx: Ctx }) {
  const report = lesson.completion_report?.trim() || "";
  if (!report) return null;
  const sent = dparts(lesson.report_email_sent_at);
  return (
    <div className="hb-rep">
      <div className="hb-rep-h">
        <span className="hb-rl">{ctx.t("Ders sonu raporu", "Lesson report")}</span>
        {sent ? (
          <span className="hb-rl">
            <Dte>{`${ctx.t("Gönderildi", "Sent")} ${ctx.f.noktali(sent)}, ${ctx.f.saat(sent)}`}</Dte>
          </span>
        ) : null}
      </div>
      <p>{report}</p>
    </div>
  );
}

function Segs({ total, used, light = false }: { total: number; used: number; light?: boolean }) {
  if (total <= 0) return null;
  const u = Math.min(total, Math.max(0, used));
  if (total > 30) {
    return (
      <div className={light ? "hb-lbar" : "hb-bar"} aria-hidden="true">
        <i style={{ width: `${Math.round((u / total) * 100)}%` }} />
      </div>
    );
  }
  return (
    <div className={light ? "hb-lsegs" : "hb-segs"} aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <i key={index} className={index < u ? "hb-u" : undefined} />
      ))}
    </div>
  );
}

function SatinAlLink({ ctx, children }: { ctx: Ctx; children: ReactNode }) {
  return (
    <a
      href="#paketler"
      data-git="paket"
      data-odak="paketler"
      onClick={(event) => {
        event.preventDefault();
        ctx.git("paket", "paketler");
      }}
    >
      {children}
    </a>
  );
}

function PaketKarti({ pkg, ctx }: { pkg: PackageState; ctx: Ctx }) {
  const { t, f } = ctx;
  if (pkg.kind !== "active" || pkg.remaining <= 0) {
    const bitti = pkg.kind !== "none";
    const total = pkg.kind === "none" ? 0 : pkg.total;
    return (
      <section className={bitti ? "hb-pkg hb-done" : "hb-pkg"}>
        <div className="hb-pkg-top">
          <div>
            <span className="hb-pkg-lab">{bitti ? t("Paket tamamlandı", "Package completed") : t("Eğitim paketi", "Education package")}</span>
            <span className="hb-pkg-name">{pkg.kind !== "none" ? pkg.name : t("Aktif paket yok", "No active package")}</span>
          </div>
          <span className="hb-pkg-ic">
            <Svg p={P.stack} w={24} sw={1.7} />
          </span>
        </div>
        <div className="hb-pkg-big">
          <b>0</b>
          <span>{bitti ? t(`/ ${total} ders hakkı kaldı`, `/ ${total} lessons left`) : t("ders hakkı", "lessons")}</span>
        </div>
        {bitti ? <Segs total={total} used={total} /> : null}
        <p className="hb-pkg-p">
          {bitti
            ? t("Tüm ders hakları kullanıldı. Derslerin aksamaması için yeni paket alabilirsiniz.", "All lessons have been used. You can buy a new package to keep lessons going.")
            : t("Paket satın alabilirsiniz.", "You can buy a package.")}
        </p>
        {ctx.pricingVisible ? (
          <div className="hb-pkg-btns">
            <a
              className="hb-p"
              href="#paketler"
              data-git="paket"
              data-odak="paketler"
              onClick={(event) => {
                event.preventDefault();
                ctx.git("paket", "paketler");
              }}
            >
              {t("Paket satın al", "Buy package")} <Svg p={P.arrow} w={16} sw={2} />
            </a>
          </div>
        ) : null}
      </section>
    );
  }
  const start = dparts(pkg.startDate);
  return (
    <section className="hb-pkg" aria-label={t("Aktif paket", "Active package")}>
      <div className="hb-pkg-top">
        <div>
          <span className="hb-pkg-lab">{t("Aktif Paket", "Active Package")}</span>
          <span className="hb-pkg-name">{pkg.name}</span>
        </div>
        <span className="hb-pkg-ic">
          <Svg p={P.stack} w={24} sw={1.7} />
        </span>
      </div>
      <div className="hb-pkg-big">
        <b>{pkg.remaining}</b>
        <span>{t(`/ ${pkg.total} ders hakkı kaldı`, `/ ${pkg.total} lessons left`)}</span>
      </div>
      <Segs total={pkg.total} used={pkg.total - pkg.remaining} />
      <div className="hb-pkg-f">
        <span>{t(`${pkg.used} ders hakkı kullanıldı`, `${pkg.used} lessons used`)}</span>
        {start ? <Dte>{`${t("Başlangıç", "Start")}: ${f.tarih(start)}`}</Dte> : null}
      </div>
      {pkg.remaining <= 2 ? (
        <div className="hb-pkg-warn">
          <span>
            {pkg.remaining === 1 ? t("Son ders hakkınız kaldı.", "You have one lesson left.") : t(`Yalnızca ${pkg.remaining} ders hakkı kaldı.`, `Only ${pkg.remaining} lessons left.`)}{" "}
            {t("Derslerin aksamaması için yeni paket alabilirsiniz.", "You can buy a new package to keep lessons going.")}
          </span>
          {ctx.pricingVisible ? <SatinAlLink ctx={ctx}>{t("Paket satın al", "Buy package")}</SatinAlLink> : null}
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Genel
// ---------------------------------------------------------------------------

function GenelTab({ data, pkg, ctx }: { data: StudentPortalData; pkg: PackageState; ctx: Ctx }) {
  const { t } = ctx;
  const son = completedLessons(data)[0];
  const profile = data.profile;
  const exams = [...(profile.exams_taken ?? [])].map((item) => item.trim()).filter(Boolean).sort(compareTr);
  const tile = (key: string, ic: ReactNode, label: string, value: string | null | undefined) => (
    <div className="hb-tile" key={key}>
      <Svg p={ic} w={20} />
      <span className="hb-l">{label}</span>
      <span className={value?.trim() ? "hb-v" : "hb-v hb-none"}>{value?.trim() || "—"}</span>
    </div>
  );

  return (
    <div className="hb-cols">
      <div className="hb-col">
        {son ? (
          <section className="hb-card hb-pad">
            <div className="hb-h-row">
              <h2>{t("Son Ders Raporu", "Latest Lesson Report")}</h2>
              <button className="hb-link" data-git="dersler" onClick={() => ctx.git("dersler")}>
                {t("Tüm dersler", "All lessons")} <Svg p={P.chevR} w={16} sw={2} />
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <TarihKaro p={lessonParts(son)} ctx={ctx} />
              <div className="hb-dk">
                <b>{son.title}</b>
                <Dmeta lesson={son} ctx={ctx} />
              </div>
            </div>
            <RaporKutu lesson={son} ctx={ctx} />
          </section>
        ) : (
          <section className="hb-card hb-pad">
            <h2>{t("Son Ders Raporu", "Latest Lesson Report")}</h2>
            <div className="hb-empty" style={{ padding: "24px 12px" }}>
              <span className="hb-ei">
                <Svg p={P.book} w={28} sw={1.6} />
              </span>
              <b>{t("Henüz ders yapılmadı", "No lessons yet")}</b>
              <span>{t("İlk dersten sonra eğitmenin raporu burada ve e-postanızda olacak.", "After the first lesson, the instructor's report will appear here and in your email.")}</span>
            </div>
          </section>
        )}
        <section className="hb-card hb-pad">
          <h2>{t("Öğrenci Profili", "Student Profile")}</h2>
          <div className="hb-g4 hb-tiles">
            {tile("okul", P.school, t("Okul", "School"), profile.school)}
            {tile("sinif", P.cap, t("Sınıf", "Grade"), profile.grade_level)}
            {tile("program", P.prog, t("Eğitim Programı", "Education Program"), profile.education_program)}
            <div className="hb-tile hb-ex">
              <Svg p={P.exam} w={20} />
              <span className="hb-l">{t("Aldığı Sınavlar", "Exams Taken")}</span>
              {exams.length ? (
                <ul className="hb-exl">
                  {exams.map((exam) => (
                    <li key={exam}>{exam}</li>
                  ))}
                </ul>
              ) : (
                <span className="hb-v hb-none">—</span>
              )}
            </div>
          </div>
        </section>
      </div>
      <aside className="hb-col">
        <PaketKarti pkg={pkg} ctx={ctx} />
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dersler
// ---------------------------------------------------------------------------

function Bolum({ baslik, sag, children }: { baslik: ReactNode; sag?: ReactNode; children: ReactNode }) {
  return (
    <section className="hb-card hb-flush">
      <div className="hb-sc-h">
        <div className="hb-t">{baslik}</div>
        {sag}
      </div>
      {children}
    </section>
  );
}

function DerslerTab({ data, ctx }: { data: StudentPortalData; ctx: Ctx }) {
  const { t, f } = ctx;
  const lessons = useMemo(() => completedLessons(data), [data]);
  const [openId, setOpenId] = useState<string | null>(null);

  const groups: { key: string; items: StudentLessonRow[] }[] = [];
  for (const lesson of lessons) {
    const p = lessonParts(lesson);
    const key = p ? f.ayYil(p) : "—";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(lesson);
    else groups.push({ key, items: [lesson] });
  }

  const packageName = (lesson: StudentLessonRow) => {
    const purchase = data.purchases.find((item) => item.id === lesson.package_purchase_id);
    return purchase ? packageDisplayName(purchase, ctx.locale) : "—";
  };

  return (
    <Bolum
      baslik={
        <>
          <h2>{t("Yapılan Dersler", "Completed Lessons")}</h2>
          {lessons.length ? <span className="hb-cnt">{lessons.length}</span> : null}
        </>
      }
      sag={
        lessons.length ? (
          <span className="hb-hint" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Svg p={P.sort} w={15} />
            {t("En yeni ders üstte", "Newest first")}
          </span>
        ) : null
      }
    >
      {!lessons.length ? (
        <div className="hb-empty">
          <span className="hb-ei">
            <Svg p={P.book} w={28} sw={1.6} />
          </span>
          <b>{t("Henüz ders kaydı yok", "No lesson records yet")}</b>
          <span>{t("Yapılan her ders; konusu, süresi ve eğitmenin raporuyla birlikte burada listelenir.", "Every completed lesson is listed here with its topic, duration and the instructor's report.")}</span>
        </div>
      ) : (
        <div className="hb-sc-b" style={{ gap: 10 }}>
          {groups.map((group) => (
            <Fragmentless key={group.key}>
              <div className="hb-ay">{group.key}</div>
              <ul className="hb-ders-l">
                {group.items.map((lesson) => {
                  const acik = openId === lesson.id;
                  const p = lessonParts(lesson);
                  const rows: [string, ReactNode][] = [
                    [t("Ders", "Lesson"), lesson.title],
                    [t("Konu / Alan", "Topic / Area"), lessonTopic(lesson)],
                    // Eğitmen adı dar kapsamlı RPC'den gelir (get_guardian_lesson_instructor_names).
                    [t("Eğitmen", "Instructor"), (lesson.instructor_id && data.instructorNames[lesson.instructor_id]) || "—"],
                    [t("Tarih", "Date"), p ? <Dte>{`${f.noktali(p)}, ${f.gun(p)}`}</Dte> : "—"],
                    [t("Saat", "Time"), p ? `${f.saat(p)} (${lesson.lesson_timezone_label || "TR"})` : "—"],
                    [t("Süre", "Duration"), `${lesson.duration_minutes || 60} ${t("dk", "min")}`],
                    [t("Paket", "Package"), packageName(lesson)],
                  ];
                  return (
                    <li key={lesson.id} className={acik ? "hb-ders hb-open" : "hb-ders"}>
                      <button className="hb-ders-h" aria-expanded={acik} onClick={() => setOpenId(acik ? null : lesson.id)}>
                        <TarihKaro p={p} ctx={ctx} />
                        <span className="hb-dk">
                          <b>{lesson.title}</b>
                          <Dmeta lesson={lesson} ctx={ctx} />
                        </span>
                        <Svg className="hb-chev" p={P.chevD} w={18} sw={2} />
                      </button>
                      <div className="hb-ders-b" hidden={!acik}>
                        <dl className="hb-dl">
                          {rows.map(([dt, dd]) => (
                            <div key={dt}>
                              <dt>{dt}</dt>
                              <dd>{dd}</dd>
                            </div>
                          ))}
                        </dl>
                        <RaporKutu lesson={lesson} ctx={ctx} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Fragmentless>
          ))}
        </div>
      )}
    </Bolum>
  );
}

function Fragmentless({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Ödemeler
// ---------------------------------------------------------------------------

function methodLabel(payment: StudentPayment, ctx: Ctx) {
  if (payment.status === "waived" || payment.payment_method === "waived" || payment.payment_method === "free") return ctx.t("Ücretsiz", "Free");
  if (payment.payment_method === "bank_transfer") return ctx.t("Banka Transferi", "Bank Transfer");
  return ctx.t("Kredi Kartı", "Credit Card");
}

type PayDurum = "ok" | "wait" | "no" | "free";

function payDurum(payment: StudentPayment): PayDurum {
  if (payment.status === "paid" || payment.status === "refunded") return "ok";
  if (payment.status === "waived") return "free";
  if (payment.status === "failed") return "no";
  return "wait";
}

function payPill(payment: StudentPayment, durum: PayDurum, ctx: Ctx): [string, string] {
  // İade edilmiş ödemeler gerçek durumlarını gösterir (rapor: C7).
  const refund = getPaymentRefundCopy(ctx.locale);
  if (payment.refund_status === "full" || payment.status === "refunded") return ["hb-mute", refund.refunded];
  if (payment.refund_status === "partial") return ["hb-mute", refund.partiallyRefunded];
  return {
    ok: ["hb-ok", ctx.t("Ödendi", "Paid")],
    wait: ["hb-warn", ctx.t("Bekliyor", "Pending")],
    no: ["hb-no", ctx.t("Başarısız", "Failed")],
    free: ["hb-mute", ctx.t("Ücretsiz", "Free")],
  }[durum] as [string, string];
}

function PaketTab({ data, pkg, ctx }: { data: StudentPortalData; pkg: PackageState; ctx: Ctx }) {
  const { t, f } = ctx;
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [packages, setPackages] = useState<PublicPricingPackage[]>([]);

  useEffect(() => {
    let alive = true;
    getPublicPricingPackages().then((rows) => {
      if (alive) setPackages(rows);
    });
    return () => {
      alive = false;
    };
  }, []);

  const options = selectPurchasablePackages(packages);

  // Tanışma görüşmesi ödeme listesinde yer almaz; başarısız ödemeler gösterilir.
  const payments = data.payments
    .filter((p) => !/consult|tanisma|discovery/i.test(p.package_id ?? ""))
    .sort((a, b) => (b.paid_at || b.created_at || "").localeCompare(a.paid_at || a.created_at || ""));

  const aktif = pkg.kind === "none" ? null : pkg;
  const odeme = (() => {
    if (!aktif) return null;
    if (aktif.purchase.payment_status === "waived") return t("Ücretsiz", "Free");
    const match = payments.find((p) => p.package_id === aktif.purchase.package_id && p.status === "paid");
    return match ? methodLabel(match, ctx) : null;
  })();

  return (
    <>
      {aktif ? (
        (() => {
          const kalan = aktif.kind === "active" ? aktif.remaining : 0;
          const used = aktif.total - kalan;
          const start = dparts(aktif.startDate);
          return (
            <Bolum baslik={<h2>{t("Aktif Paket", "Active Package")}</h2>}>
              <div className="hb-sc-b">
                <div className="hb-h-row">
                  <div className="hb-t">
                    <span className="hb-serif" style={{ fontSize: 22, fontWeight: 600 }}>
                      {aktif.name}
                    </span>
                    <span className={`hb-pill hb-sm ${kalan ? "hb-ok" : "hb-warn"}`}>{kalan ? t("Aktif", "Active") : t("Tamamlandı", "Completed")}</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="hb-prog-h">
                    <span>
                      {t("Kullanılan", "Used")} <b>{`${used} / ${aktif.total}`}</b> {t("ders", "lessons")}
                    </span>
                    <strong>{kalan ? t(`${kalan} ders kaldı`, `${kalan} lessons left`) : t("Ders hakkı bitti", "No lessons left")}</strong>
                  </div>
                  <Segs total={aktif.total} used={used} light />
                </div>
                <div className="hb-kv">
                  <Dte>
                    <span>
                      {t("Başlangıç", "Start")}: <b>{start ? f.tarih(start) : "—"}</b>
                    </span>
                  </Dte>
                  {odeme ? (
                    <span>
                      {t("Ödeme şekli", "Payment method")}: <b>{odeme}</b>
                    </span>
                  ) : null}
                </div>
              </div>
            </Bolum>
          );
        })()
      ) : (
        <PaketKarti pkg={pkg} ctx={ctx} />
      )}

      {ctx.pricingVisible ? (
        <section className="hb-card hb-pad" id="paketler">
          <div className="hb-h-row">
            <div>
              <h2>{t("Paket Satın Al", "Buy a Package")}</h2>
              <p className="hb-sub">{t("Kredi kartı ile ödeme. Banka transferi için WhatsApp'tan yazın.", "Pay by credit card. For bank transfer, message us on WhatsApp.")}</p>
            </div>
          </div>
          <div className="hb-paketler">
            {options.map((row) => {
              const count = row.lesson_count || 1;
              const price = getLocalizedPackageDisplayPrice({ locale: ctx.locale, tryAmount: row.current_total ?? row.price_amount, eurAmount: row.price_eur });
              const fy = price.currency === "TRY" && price.amount != null ? `${Number(price.amount).toLocaleString("tr-TR")} TL` : price.formatted;
              const name = (ctx.locale === "tr" ? row.name_tr : row.name_en) || row.name_tr || "";
              return (
                <Link
                  key={row.id}
                  className="hb-pk"
                  href={`${localizedPath("payment", ctx.locale)}?package=${encodeURIComponent(row.id)}`}
                  aria-label={t(`${name} satın al, ${fy}`, `Buy ${name}, ${fy}`)}
                >
                  <span className="hb-n">
                    <b>{count}</b>
                    <span>{count > 1 ? t("derslik", "lessons") : t("ders", "lesson")}</span>
                  </span>
                  <span className="hb-fy">{fy}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <Bolum
        baslik={
          <>
            <h2>{t("Ödeme Geçmişi", "Payment History")}</h2>
            {payments.length ? <span className="hb-cnt">{payments.length}</span> : null}
          </>
        }
      >
        {!payments.length ? (
          <div className="hb-empty">
            <span className="hb-ei">
              <Svg p={P.card} w={28} sw={1.6} />
            </span>
            <b>{t("Henüz ödeme yok", "No payments yet")}</b>
            <span>{t("Paket satın aldığınızda ödemeleriniz burada listelenir.", "Your payments will be listed here once you buy a package.")}</span>
          </div>
        ) : (
          payments.map((payment) => {
            const durum = payDurum(payment);
            const [cls, label] = payPill(payment, durum, ctx);
            const acik = openIds.has(payment.id);
            const meta = (payment.metadata ?? {}) as Record<string, unknown>;
            const name = packageDisplayName({ package_id: payment.package_id, metadata: meta }, ctx.locale);
            const when = dparts(payment.paid_at || payment.created_at);
            const ic = durum === "no" ? " hb-no" : durum === "free" ? " hb-free" : "";
            const rows: [string, ReactNode][] = [
              [t("Tarih ve saat", "Date and time"), when ? <Dte>{`${f.noktali(when)}, ${f.saat(when)}`}</Dte> : "—"],
              [t("Ödeme şekli", "Payment method"), methodLabel(payment, ctx)],
              [t("Durum", "Status"), label],
              [t("Öğrenci", "Student"), data.profile.full_name || "—"],
            ];
            return (
              <div key={payment.id} className={acik ? "hb-pay hb-open" : "hb-pay"}>
                <button
                  className="hb-pay-h"
                  aria-expanded={acik}
                  onClick={() =>
                    setOpenIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(payment.id)) next.delete(payment.id);
                      else next.add(payment.id);
                      return next;
                    })
                  }
                >
                  <span className={`hb-ic${ic}`}>
                    <Svg p={durum === "free" ? P.gift : P.card} w={19} />
                  </span>
                  <span className="hb-m">
                    <b style={durum === "no" ? { color: "var(--muted)" } : undefined}>{name}</b>
                    <span>{when ? <Dte>{f.tarih(when)}</Dte> : "—"}</span>
                  </span>
                  <span className={durum === "no" ? "hb-amt hb-x" : "hb-amt"}>{payment.amount ? tl(payment.amount, payment.currency) : "₺0"}</span>
                  <span className={`hb-pill hb-sm hb-dotted ${cls}`}>{label}</span>
                  <Svg className="hb-chev" p={P.chevD} w={18} sw={2} />
                </button>
                <div className="hb-pay-b" hidden={!acik}>
                  <dl className="hb-dl">
                    {rows.map(([dt, dd]) => (
                      <div key={dt}>
                        <dt>{dt}</dt>
                        <dd>{dd}</dd>
                      </div>
                    ))}
                    {payment.public_reference ? (
                      <div style={{ gridColumn: "1/-1" }}>
                        <dt>{t("Referans no", "Reference no")}</dt>
                        <dd>{payment.public_reference}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              </div>
            );
          })
        )}
      </Bolum>
    </>
  );
}

// ---------------------------------------------------------------------------
// Hesap (profil)
// ---------------------------------------------------------------------------

const SIFRE_KURALLARI: { r: string; tr: string; en: string; test: (v: string) => boolean }[] = [
  { r: "len", tr: "En az 8 karakter", en: "At least 8 characters", test: (v) => v.length >= 8 },
  { r: "up", tr: "Büyük harf", en: "Uppercase letter", test: (v) => /[A-ZÇĞİÖŞÜ]/.test(v) },
  { r: "low", tr: "Küçük harf", en: "Lowercase letter", test: (v) => /[a-zçğıöşü]/.test(v) },
  { r: "num", tr: "Rakam", en: "Number", test: (v) => /\d/.test(v) },
];

function ProfilTab({
  guardian,
  fallbackEmail,
  fallbackPhone,
  ctx,
  toast,
  onGuardianChange,
  onReload,
  onDelete,
}: {
  guardian: Guardian | null;
  fallbackEmail: string | null;
  fallbackPhone: string | null;
  ctx: Ctx;
  toast: Toast;
  onGuardianChange: (patch: Partial<Guardian>) => void;
  onReload: () => void;
  onDelete: () => void;
}) {
  const { t, locale } = ctx;
  // Veli kaydı varsa yalnız velinin telefonu (silinmiş telefon öğrenci telefonuyla geri dolmaz).
  const storedTel = telNo(guardian ? guardian.phone : fallbackPhone);
  const [ad, setAd] = useState(guardian?.full_name || "");
  const [tel, setTel] = useState(storedTel);
  const [savedTel, setSavedTel] = useState(storedTel);
  const [bilgiBusy, setBilgiBusy] = useState(false);

  const [acik, setAcik] = useState({ ep: false, sifre: false });
  const epRef = useRef<HTMLInputElement>(null);
  const sifreRef = useRef<HTMLInputElement>(null);

  const [yeniEp, setYeniEp] = useState("");
  const [epBusy, setEpBusy] = useState(false);
  const [kodAdim, setKodAdim] = useState<{ email: string; masked: string } | null>(null);
  const [kod, setKod] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const [sifre, setSifre] = useState("");
  const [sifreBusy, setSifreBusy] = useState(false);
  const kurallar = SIFRE_KURALLARI.map((rule) => ({ ...rule, ok: rule.test(sifre) }));
  const sifreOk = kurallar.every((rule) => rule.ok);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const email = guardian?.email || fallbackEmail || "";
  const dogrulandi = Boolean(guardian?.email_verified_at);
  const hata = (error: unknown, fallback: string) => toast(localizeErrorMessage(error, locale, fallback));

  const ac = (key: "ep" | "sifre") => {
    const on = !acik[key];
    flushSync(() => setAcik((prev) => ({ ...prev, [key]: on })));
    if (on) (key === "ep" ? epRef : sifreRef).current?.focus();
  };

  async function kaydetBilgi() {
    if (bilgiBusy) return;
    // Boş bırakılabilir; yazıldıysa 10 hane olmalı.
    if (tel && !isCompleteTrPhone(tel)) {
      toast(t("Telefon numarasını eksiksiz yazın", "Enter the full phone number"));
      document.getElementById("v-tel")?.focus();
      return;
    }
    const name = ad.trim().replace(/\s+/g, " ");
    if (!name) {
      toast(t("Ad soyad boş bırakılamaz", "Full name cannot be empty"));
      document.getElementById("v-ad")?.focus();
      return;
    }
    if (name.length < 2 || name.length > 100) {
      toast(t("Ad soyad 2–100 karakter olmalıdır.", "Full name must be 2–100 characters."));
      document.getElementById("v-ad")?.focus();
      return;
    }
    setBilgiBusy(true);
    // Değişmediyse gönderilmez (kayıtlı değer korunur); silindiyse "" -> NULL.
    const phoneChanged = tel !== savedTel;
    const phone = phoneChanged ? tel : undefined;
    const result = await updateGuardianProfile({ fullName: name, preferredLanguage: locale, phone });
    setBilgiBusy(false);
    if (result.error) {
      hata(result.error, t("Hesap bilgileri güncellenemedi.", "Account details could not be updated."));
      return;
    }
    if (phoneChanged) setSavedTel(tel);
    onGuardianChange(phoneChanged ? { full_name: name, phone: tel || null } : { full_name: name });
    toast(t("Bilgileriniz kaydedildi", "Your details have been saved"));
  }

  async function kodGonder(target: string) {
    setEpBusy(true);
    try {
      const r = await requestEmailChange(target, locale);
      if (!r.success) {
        hata(r.message || r.error_code, t("E-posta değişikliği başlatılamadı.", "Email change could not be initiated."));
        return false;
      }
      setKodAdim({ email: target, masked: r.masked_new_email || target });
      setCooldown(60);
      toast(t("Doğrulama kodu yeni adresinize gönderildi", "A verification code was sent to your new address"));
      return true;
    } catch (error) {
      hata(error, t("E-posta güncellenemedi.", "Email could not be updated."));
      return false;
    } finally {
      setEpBusy(false);
    }
  }

  async function kaydetEposta() {
    if (epBusy) return;
    const target = yeniEp.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(target)) {
      toast(t("Geçerli bir e-posta adresi yazın", "Enter a valid email address"));
      epRef.current?.focus();
      return;
    }
    if (target === email.toLowerCase()) {
      toast(t("Yeni adres mevcut adresinizle aynı", "The new address matches your current one"));
      epRef.current?.focus();
      return;
    }
    if (await kodGonder(target)) setKod("");
  }

  async function dogrula() {
    if (epBusy || !kodAdim || kod.trim().length !== 6) return;
    setEpBusy(true);
    try {
      const r = await verifyEmailChangeOtp(kod.trim(), locale);
      if (!r.success) {
        hata(r.message || r.error_code, t("Doğrulama kodu hatalı.", "Verification code incorrect."));
        return;
      }
      onGuardianChange({ email: kodAdim.email });
      setKodAdim(null);
      setKod("");
      setYeniEp("");
      setAcik((prev) => ({ ...prev, ep: false }));
      toast(t("E-posta adresiniz güncellendi", "Your email address has been updated"));
      onReload();
    } catch {
      toast(t("Doğrulama başarısız oldu.", "Verification failed."));
    } finally {
      setEpBusy(false);
    }
  }

  async function kaydetSifre() {
    if (sifreBusy || !sifreOk) return;
    setSifreBusy(true);
    try {
      const r = await updateStudentPassword(sifre);
      if (r.error) {
        hata(r.error, t("Şifre güncellenemedi.", "Password could not be updated."));
        return;
      }
      setSifre("");
      setAcik((prev) => ({ ...prev, sifre: false }));
      toast(t("Şifreniz güncellendi", "Your password has been updated"));
    } catch (error) {
      hata(error, t("Şifre güncellenemedi.", "Password could not be updated."));
    } finally {
      setSifreBusy(false);
    }
  }

  return (
    <>
      <section className="hb-card hb-pad">
        <h2>{t("Hesap Sahibi", "Account Holder")}</h2>
        <div className="hb-fgrid">
          <div className="hb-f">
            <label className="hb-lab" htmlFor="v-ad">
              {t("Ad soyad", "Full name")}
            </label>
            <input id="v-ad" className="hb-inp" value={ad} onChange={(event) => setAd(event.target.value)} autoComplete="name" />
          </div>
          <div className="hb-f">
            <label className="hb-lab" htmlFor="v-tel">
              <span>{t("Telefon", "Phone")}</span>
              <small>{t("WhatsApp bildirimleri için", "For WhatsApp notifications")}</small>
            </label>
            <div className="hb-tel">
              <span className="hb-cc" aria-hidden="true">
                +90
              </span>
              <input
                id="v-tel"
                className="hb-inp"
                value={telFmt(tel)}
                data-d={tel}
                placeholder="(5XX) XXX XX XX"
                inputMode="numeric"
                autoComplete="tel-national"
                aria-label={t("Telefon, +90 ile başlar", "Phone, starts with +90")}
                onChange={(event) => {
                  let d = telNo(event.target.value);
                  // parantez/boşluk silinince bir rakam sil
                  if ((event.nativeEvent as InputEvent).inputType === "deleteContentBackward" && d === tel) d = d.slice(0, -1);
                  setTel(d);
                }}
              />
            </div>
          </div>
        </div>
        <div className="hb-row-end">
          <button className="hb-btn" data-kaydet="bilgi" onClick={kaydetBilgi} aria-busy={bilgiBusy || undefined}>
            <Svg p={P.check} w={16} sw={2} />
            {t("Kaydet", "Save")}
          </button>
        </div>
      </section>

      <section className="hb-card hb-pad">
        <h2>{t("Giriş ve Güvenlik", "Sign-in and Security")}</h2>
        <div className="hb-sec">
          <div className="hb-srow">
            <span className="hb-k">{t("E-posta", "Email")}</span>
            <span className="hb-val">
              <span className="hb-em">{email}</span>
              {dogrulandi ? (
                <span className="hb-pill hb-sm hb-ok">
                  <Svg p={P.check} w={13} sw={2.4} />
                  {t("Doğrulandı", "Verified")}
                </span>
              ) : (
                <span className="hb-pill hb-sm hb-warn">{t("Doğrulanmadı", "Not verified")}</span>
              )}
            </span>
            <button className="hb-btn2 hb-sm" data-ac="ac-ep" aria-expanded={acik.ep} aria-controls="ac-ep" onClick={() => ac("ep")}>
              {acik.ep ? t("Vazgeç", "Cancel") : t("Değiştir", "Change")}
            </button>
          </div>
          <div className="hb-spanel" id="ac-ep" hidden={!acik.ep}>
            <label className="hb-lab" htmlFor="v-yeni-ep">
              {t("Yeni e-posta", "New email")}
            </label>
            <input
              id="v-yeni-ep"
              ref={epRef}
              className="hb-inp"
              type="email"
              placeholder="yeni@eposta.com"
              autoComplete="email"
              value={yeniEp}
              onChange={(event) => setYeniEp(event.target.value)}
            />
            <p className="hb-hint">{t("Yeni adrese 6 haneli doğrulama kodu gönderilir.", "A 6-digit verification code is sent to the new address.")}</p>
            <div>
              <button className="hb-btn" data-kaydet="eposta" onClick={kaydetEposta} disabled={epBusy}>
                {t("Doğrulama kodu gönder", "Send verification code")}
              </button>
            </div>
            {kodAdim ? (
              // Üretimde e-posta değişikliği kodla doğrulanır (rapor: C8).
              <>
                <label className="hb-lab" htmlFor="v-kod">
                  {t("Doğrulama kodu", "Verification code")}
                </label>
                <input
                  id="v-kod"
                  className="hb-inp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={kod}
                  onChange={(event) => setKod(event.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <p className="hb-hint">{t(`${kodAdim.masked} adresine gönderilen 6 haneli kodu yazın.`, `Enter the 6-digit code sent to ${kodAdim.masked}.`)}</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="hb-btn" onClick={dogrula} disabled={epBusy || kod.length !== 6}>
                    {t("Doğrula", "Verify")}
                  </button>
                  <button className="hb-btn2" onClick={() => void kodGonder(kodAdim.email)} disabled={epBusy || cooldown > 0}>
                    {cooldown > 0 ? t(`Tekrar gönder (${cooldown})`, `Resend (${cooldown})`) : t("Tekrar gönder", "Resend")}
                  </button>
                </div>
              </>
            ) : null}
          </div>
          <div className="hb-srow">
            <span className="hb-k">{t("Şifre", "Password")}</span>
            <span className="hb-val">
              <span className="hb-dots" aria-label={t("gizli", "hidden")}>
                ••••••••
              </span>
            </span>
            <button className="hb-btn2 hb-sm" data-ac="ac-sifre" aria-expanded={acik.sifre} aria-controls="ac-sifre" onClick={() => ac("sifre")}>
              {acik.sifre ? t("Vazgeç", "Cancel") : t("Değiştir", "Change")}
            </button>
          </div>
          <div className="hb-spanel" id="ac-sifre" hidden={!acik.sifre}>
            <label className="hb-lab" htmlFor="v-sifre">
              {t("Yeni şifre", "New password")}
            </label>
            <input
              id="v-sifre"
              ref={sifreRef}
              className="hb-inp"
              type="password"
              autoComplete="new-password"
              aria-describedby="rules"
              value={sifre}
              onChange={(event) => setSifre(event.target.value)}
            />
            <ul className="hb-rules" id="rules">
              {kurallar.map((rule) => (
                <li key={rule.r} data-r={rule.r} className={rule.ok ? "hb-ok" : undefined}>
                  {t(rule.tr, rule.en)}
                </li>
              ))}
            </ul>
            <div>
              <button className="hb-btn" data-kaydet="sifre" id="sifre-btn" disabled={!sifreOk || sifreBusy} onClick={kaydetSifre}>
                {t("Şifreyi güncelle", "Update password")}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="hb-del">
        <button id="sil-ac" onClick={onDelete}>
          {t("Üyeliğimi sil", "Delete my account")}
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Üyelik silme diyaloğu
// ---------------------------------------------------------------------------

function SilDialog({
  dlgRef,
  remaining,
  ctx,
  toast,
  onDeleted,
}: {
  dlgRef: React.RefObject<HTMLDialogElement | null>;
  remaining: number;
  ctx: Ctx;
  toast: Toast;
  onDeleted: () => void;
}) {
  const { t, locale } = ctx;
  const WA = useSiteContact().whatsappHref;
  const [onay, setOnay] = useState("");
  const [sifre, setSifre] = useState("");
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState("");
  const onayOk = onay.trim().toLocaleUpperCase("tr-TR") === t("SİL", "DELETE");

  async function sil() {
    if (busy || !onayOk || !sifre) return;
    setBusy(true);
    setHata("");
    const result = await deleteOwnAccount(sifre, locale);
    setBusy(false);
    if (!result.success) {
      setHata(result.message || t("Üyelik silme işlemi gerçekleştirilemedi.", "Account deletion could not be completed."));
      return;
    }
    dlgRef.current?.close();
    toast(t("Silme talebiniz alındı", "Your deletion request has been received"));
    window.setTimeout(onDeleted, 1500);
  }

  return (
    <dialog id="dlg-sil" aria-labelledby="sil-baslik" ref={dlgRef}>
      <div className="hb-dlg-h">
        <span className="hb-ic">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </span>
        <h3 id="sil-baslik">{t("Üyeliğinizi silmek istiyor musunuz?", "Do you want to delete your account?")}</h3>
      </div>
      <div className="hb-dlg-b">
        <p>
          {t(
            "Hesabınız ve profil bilgileriniz kalıcı olarak silinir, bu işlem geri alınamaz. Ders raporlarına artık erişemezsiniz. Yasal olarak saklanması gereken ödeme kayıtları ayrıca korunur.",
            "Your account and profile details are permanently deleted; this cannot be undone. You will no longer have access to lesson reports. Payment records that must be kept by law are retained separately."
          )}
        </p>
        <p id="sil-hak" hidden={!remaining}>
          {remaining ? (
            <>
              <b style={{ color: "var(--red)" }}>{t(`Kullanılmamış ${remaining} ders hakkınız var.`, `You have ${remaining} unused lessons.`)}</b> {t("Silmeden önce", "Before deleting, we recommend")}{" "}
              <a href={WA} target="_blank" rel="noopener">
                {t("bize yazmanızı", "messaging us")}
              </a>{" "}
              {t("öneririz.", "first.")}
            </>
          ) : null}
        </p>
        <div className="hb-f">
          <label className="hb-lab" htmlFor="sil-onay">
            <span>
              {t("Onaylamak için", "Type")} <b>{t("SİL", "DELETE")}</b> {t("yazın", "to confirm")}
            </span>
          </label>
          <input id="sil-onay" className="hb-inp" autoComplete="off" autoCapitalize="characters" value={onay} onChange={(event) => setOnay(event.target.value)} />
        </div>
        {/* Üretimde silme, hesabın şifresiyle yeniden doğrulanır (rapor: C4). */}
        <div className="hb-f">
          <label className="hb-lab" htmlFor="sil-sifre">
            <span>{t("Şifreniz", "Your password")}</span>
          </label>
          <input id="sil-sifre" className="hb-inp" type="password" autoComplete="current-password" value={sifre} onChange={(event) => setSifre(event.target.value)} />
        </div>
        {hata ? (
          <p role="alert" style={{ color: "var(--red)", fontWeight: 600 }}>
            {hata}
          </p>
        ) : null}
      </div>
      <div className="hb-dlg-f">
        <button className="hb-btn2" data-kapat onClick={() => dlgRef.current?.close()}>
          {t("Vazgeç", "Cancel")}
        </button>
        <button className="hb-btn-red" id="sil-btn" disabled={!onayOk || !sifre || busy} onClick={sil}>
          {t("Üyeliğimi sil", "Delete my account")}
        </button>
      </div>
    </dialog>
  );
}
