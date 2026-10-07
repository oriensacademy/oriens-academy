"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@/lib/data/query-store";
import { listAdminLoginEvents, type AdminLoginEvent } from "@/lib/admin/logins";
import { listAdminPanelActions, type PanelAction, type PanelActionKind } from "@/lib/admin/panel-actions";
import { AUDIT_PAGE_SIZE, fetchAuditFeed, fetchAuditStats, type AuditFeedRow } from "@/lib/admin/audit-center";
import {
  AUDIT_CATEGORIES,
  AUDIT_CATEGORY_LABELS,
  AUDIT_ROLE_LABELS,
  AUDIT_STATUS_LABELS,
  auditEntityLabel,
  auditSentence,
  auditTitle,
  formatAuditListDate,
  maskEmail,
  type AuditCategory,
  type AuditStatus,
} from "@/lib/admin/audit-catalog";
import { foldTurkish, formatTrShortListDate } from "@/lib/format/turkish";
import { AuditCategoryIcon } from "@/components/admin/AuditCategoryIcon";
import { AuditEventDrawer } from "@/components/admin/AuditEventDrawer";
import pages from "@/components/admin/admin-pages.module.css";

// Denetim merkezi (#view-denetim): Olay akışı sunucuda filtrelenir, aranır ve
// 50'şer sayfalanır (admin_audit_feed); satıra tıklayınca ayrıntı çekmecesi
// açılır (?log=<id>, yenilemede ve geri tuşunda korunur). Girişler ve Panel
// işlemleri sekmeleri önceki gibi. Yalnız okuma; IP adresi tutulmaz/gösterilmez.

const EMPTY_LOGINS: AdminLoginEvent[] = [];
const EMPTY_ACTIONS: PanelAction[] = [];
const EMPTY_ROWS: AuditFeedRow[] = [];
const KIND_COLOR: Record<PanelActionKind, string> = { ders: "g", paket: "b", fiyat: "y", yorum: "p", arsiv: "n", diger: "n" };
const STATUS_OPTIONS: AuditStatus[] = ["success", "error", "pending", "warning", "info"];

type Zaman = "bugun" | "24s" | "7" | "30" | "ay" | "tum" | "ozel";
type Seg = "akis" | "giris" | "islem";

function dayStart(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Zaman filtresi → [from, to) (yerel gün sınırları). */
function periodRange(zaman: Zaman, anchor: number, customFrom: string, customTo: string): { from: Date | null; to: Date | null } {
  const now = new Date(anchor);
  const today = dayStart(now);
  switch (zaman) {
    case "bugun": return { from: today, to: null };
    case "24s": return { from: new Date(anchor - 86_400_000), to: null };
    case "7": return { from: new Date(today.getTime() - 6 * 86_400_000), to: null };
    case "30": return { from: new Date(today.getTime() - 29 * 86_400_000), to: null };
    case "ay": return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null };
    case "ozel": {
      const from = customFrom ? new Date(`${customFrom}T00:00:00`) : null;
      const toDay = customTo ? new Date(`${customTo}T00:00:00`) : null;
      return {
        from: from && !Number.isNaN(from.getTime()) ? from : null,
        to: toDay && !Number.isNaN(toDay.getTime()) ? new Date(toDay.getTime() + 86_400_000) : null,
      };
    }
    default: return { from: null, to: null };
  }
}

function inRange(iso: string, range: { from: Date | null; to: Date | null }) {
  const date = new Date(iso);
  return (!range.from || date >= range.from) && (!range.to || date < range.to);
}

function studentHref(studentId: string) {
  return `/admin/ogrenciler/detay?student=${encodeURIComponent(studentId)}`;
}

function OkIcon() {
  return <span className="bn-ic ok"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg></span>;
}

function FailIcon() {
  return <span className="bn-ic fail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></span>;
}

function DateCell({ iso }: { iso: string }) {
  const when = formatTrShortListDate(iso);
  return <td className="fx-date">{when.primary}<small>{when.secondary}</small></td>;
}

/** KİŞİ sütunu: gerçek ad + maskeli e-posta; çözülemiyorsa işlemi yapan veya "Sistem". */
function personOf(row: AuditFeedRow) {
  if (row.subject_name || row.subject_email) {
    return {
      name: row.subject_name ?? (row.subject_user_id ? "Ad kaydı yok" : "Kaydı olmayan alıcı"),
      email: maskEmail(row.subject_email),
      role: row.subject_role ? AUDIT_ROLE_LABELS[row.subject_role] : null,
      muted: !row.subject_name,
    };
  }
  if (row.actor_name || row.actor_email) {
    return { name: row.actor_name ?? "Kullanıcı", email: maskEmail(row.actor_email), role: AUDIT_ROLE_LABELS[row.actor_role] ?? null, muted: false };
  }
  return { name: "Sistem", email: null, role: null, muted: true };
}

function FeedRowItem({ row, onOpen }: { row: AuditFeedRow; onOpen: (id: string) => void }) {
  const person = personOf(row);
  const date = formatAuditListDate(row.created_at);
  const entity = auditEntityLabel(row);
  const sentence = auditSentence(row);
  return (
    <li className={`ak-tr ak-s-${row.feed_status}`}>
      <button type="button" onClick={() => onOpen(row.event_id)} aria-label={`${auditTitle(row.action, row.severity)} — ayrıntıyı aç`}>
        <span className="ak-td ak-td-who">
          <AuditCategoryIcon category={row.feed_category} />
          <span className="ak-who2">
            <b className={person.muted ? "ak-mute" : undefined}>{person.name}</b>
            {person.email || person.role ? <small>{person.email ? <span>{person.email}</span> : null}{person.role ? <i className="ak-rol">{person.role}</i> : null}</small> : null}
          </span>
        </span>
        <span className="ak-td ak-td-act">
          <b>{auditTitle(row.action, row.severity)}</b>
          <small>{sentence}</small>
        </span>
        <span className="ak-td ak-td-cat"><span className={`ak-b ak-cat ak-cat-${row.feed_category}`}><i />{AUDIT_CATEGORY_LABELS[row.feed_category]}</span></span>
        <span className="ak-td ak-td-st"><span className={`ak-b ak-st-${row.feed_status}`}>{AUDIT_STATUS_LABELS[row.feed_status]}</span></span>
        <span className="ak-td ak-td-date"><time dateTime={row.created_at}>{date.date}<small>{date.day} · {date.time}</small></time></span>
        <span className="ak-td ak-td-ent">{entity ?? <span className="ak-mute">—</span>}</span>
        <span className="ak-td ak-td-go" aria-hidden="true">→</span>
      </button>
    </li>
  );
}

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function AuditCenter() {
  const searchParams = useSearchParams();
  const openId = searchParams.get("log");
  const pushDepth = useRef(0);

  const [seg, setSeg] = useState<Seg>("akis");
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim(), 300);
  const [kategori, setKategori] = useState<AuditCategory | "">("");
  const [durum, setDurum] = useState<AuditStatus | "">("");
  const [zaman, setZaman] = useState<Zaman>("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [anchor, setAnchor] = useState(() => Date.now());
  const [person, setPerson] = useState<{ value: string; label: string } | null>(null);
  const [sonuc, setSonuc] = useState("");
  const [rol, setRol] = useState("");

  const range = useMemo(() => periodRange(zaman, anchor, customFrom, customTo), [zaman, anchor, customFrom, customTo]);

  // Filtre değişince ilk sayfaya dön: sayfa, ait olduğu filtre imzasıyla tutulur.
  const filterSig = JSON.stringify([query, kategori, durum, zaman, customFrom, customTo, person?.value ?? ""]);
  const [pager, setPager] = useState({ sig: filterSig, page: 0 });
  if (pager.sig !== filterSig) setPager({ sig: filterSig, page: 0 });
  const page = pager.sig === filterSig ? pager.page : 0;
  const setPage = useCallback((update: (value: number) => number) => {
    setPager((prev) => ({ sig: filterSig, page: update(prev.sig === filterSig ? prev.page : 0) }));
  }, [filterSig]);

  const feedParams = useMemo(() => ({
    search: query,
    category: kategori,
    status: durum,
    from: range.from?.toISOString() ?? null,
    to: range.to?.toISOString() ?? null,
    person: person?.value ?? null,
    limit: AUDIT_PAGE_SIZE,
    offset: page * AUDIT_PAGE_SIZE,
  }), [query, kategori, durum, range, person, page]);

  const feedKey = seg === "akis" ? `admin:audit:feed:${JSON.stringify(feedParams)}` : null;
  const feedQuery = useQuery(feedKey, () => fetchAuditFeed(feedParams), { staleTime: 30_000 });
  const statsQuery = useQuery(seg === "akis" ? "admin:audit:stats" : null, fetchAuditStats, { staleTime: 30_000 });
  const loginsQuery = useQuery(seg !== "akis" ? "admin:denetim:giris" : null, listAdminLoginEvents, { staleTime: 30_000 });
  const actionsQuery = useQuery(seg === "islem" ? "admin:denetim:islem" : null, listAdminPanelActions, { staleTime: 30_000 });

  // Sayfa/filtre değişirken önceki liste ekranda kalır (titreme yok).
  const [keptFeed, setKeptFeed] = useState<{ rows: AuditFeedRow[]; total: number; error: string | null } | null>(null);
  if (feedQuery.data && feedQuery.data !== keptFeed) setKeptFeed(feedQuery.data);
  const feed = feedQuery.data ?? keptFeed;
  const rows = feed?.rows ?? EMPTY_ROWS;
  const total = feed?.total ?? 0;
  const feedStale = !feedQuery.data && Boolean(keptFeed);
  const stats = statsQuery.data?.data ?? null;

  const logins = loginsQuery.data?.data ?? EMPTY_LOGINS;
  const actions = actionsQuery.data?.data ?? EMPTY_ACTIONS;
  const guardianCount = loginsQuery.data?.guardianCount ?? 0;

  // ---- Ayrıntı çekmecesi (?log=<id>) -------------------------------------
  const urlWith = useCallback((id: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (id) params.set("log", id);
    else params.delete("log");
    const text = params.toString();
    return `${window.location.pathname}${text ? `?${text}` : ""}`;
  }, []);

  const openEvent = useCallback((id: string) => {
    window.history.pushState(null, "", urlWith(id));
    pushDepth.current += 1;
  }, [urlWith]);

  const closeEvent = useCallback(() => {
    if (pushDepth.current > 0) {
      const depth = pushDepth.current;
      pushDepth.current = 0;
      window.history.go(-depth);
    } else {
      window.history.replaceState(null, "", urlWith(null));
    }
  }, [urlWith]);

  useEffect(() => {
    const onPop = () => {
      const hasLog = new URLSearchParams(window.location.search).has("log");
      pushDepth.current = hasLog ? Math.max(pushDepth.current - 1, 0) : 0;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const filterPerson = useCallback((value: string, label: string) => {
    setPerson({ value, label });
    setSeg("akis");
    setKategori("");
    setDurum("");
    setQ("");
    closeEvent();
  }, [closeEvent]);

  const preview = openId ? rows.find((row) => row.event_id === openId) ?? null : null;

  // ---- Girişler / Panel işlemleri (istemci filtreleri) ---------------------
  const localQuery = foldTurkish(q.trim());
  const visibleLogins = useMemo(() => logins.filter((row) => {
    if (sonuc && row.result !== sonuc) return false;
    if (rol && row.role !== rol) return false;
    if (!inRange(row.at, range)) return false;
    return !localQuery || foldTurkish([row.name ?? "", row.email, row.device ?? "", row.studentName ?? ""].join(" ")).includes(localQuery);
  }), [logins, sonuc, rol, range, localQuery]);

  const visibleActions = useMemo(
    () => actions.filter((row) => inRange(row.at, range) && (!localQuery || foldTurkish([row.title, row.detail, row.actor].join(" ")).includes(localQuery))),
    [actions, range, localQuery],
  );

  const kpi = useMemo(() => {
    const today = dayStart(new Date(anchor));
    const week = new Date(today.getTime() - 6 * 86_400_000);
    const todaySet = new Set<string>();
    const active = new Set<string>();
    let fails = 0;
    for (const row of logins) {
      const at = new Date(row.at);
      if (row.result === "ok" && at >= today) todaySet.add(row.userId ?? row.email);
      if (row.result === "ok" && row.role === "veli" && at >= week) active.add(row.userId ?? row.email);
      if (row.result === "fail" && at >= week) fails += 1;
    }
    return { today: todaySet.size, active: active.size, fails };
  }, [logins, anchor]);

  const isFeed = seg === "akis";
  const isLogin = seg === "giris";
  const firstShown = total ? page * AUDIT_PAGE_SIZE + 1 : 0;
  const lastShown = Math.min((page + 1) * AUDIT_PAGE_SIZE, total);
  const pageCount = Math.max(Math.ceil(total / AUDIT_PAGE_SIZE), 1);
  const localList = isLogin ? visibleLogins : visibleActions;
  const localTotal = isLogin ? logins.length : actions.length;
  const localLoading = isLogin ? loginsQuery.loading && !loginsQuery.data : actionsQuery.loading && !actionsQuery.data;
  const localError = (isLogin ? loginsQuery.data?.error : actionsQuery.data?.error) || "";
  const filtersActive = Boolean(query || kategori || durum || person || zaman !== "30");

  const applyStat = (next: { durum?: AuditStatus | ""; kategori?: AuditCategory | ""; q?: string }) => {
    setZaman("bugun");
    setAnchor(Date.now());
    setDurum(next.durum ?? "");
    setKategori(next.kategori ?? "");
    setQ(next.q ?? "");
  };

  return (
    <div id="view-denetim" className={`pgv ${pages.root}`}>
      <div className="page"><div className="wrap">
        <div className="head">
          <div><h1>Denetim Kayıtları</h1><p>Kim, ne zaman, ne yaptı: giriş, ödeme, mail, öğrenci, ders ve paket hareketleri. Satıra tıklayınca tüm ayrıntı açılır.</p></div>
          <div className="seg" role="group" aria-label="Kayıt türü">
            <button type="button" aria-pressed={isFeed} onClick={() => setSeg("akis")}>Olay akışı{isFeed && feed ? <small>{total}</small> : null}</button>
            <button type="button" aria-pressed={isLogin} onClick={() => setSeg("giris")}>Girişler{loginsQuery.data ? <small>{logins.length}</small> : null}</button>
            <button type="button" aria-pressed={seg === "islem"} onClick={() => setSeg("islem")}>Panel işlemleri{actionsQuery.data ? <small>{actions.length}</small> : null}</button>
          </div>
        </div>

        {isFeed ? (
          <div className="stats ak-stats" aria-label="Bugünün özeti">
            <button type="button" className="stat btn dn-k g" onClick={() => applyStat({})}>
              <span className="l">Bugün</span><b>{stats ? stats.total : "–"}</b><span className="s">işlem kaydı</span>
            </button>
            <button type="button" className={`stat btn dn-k ${stats?.failed ? "y" : ""}`} onClick={() => applyStat({ durum: "error" })}>
              <span className="l">Başarısız</span><b>{stats ? stats.failed : "–"}</b><span className="s">{stats?.failed ? "bugün · kontrol edin" : "bugün · sorun yok"}</span>
            </button>
            <button type="button" className="stat btn dn-k" onClick={() => applyStat({ kategori: "payment" })}>
              <span className="l">Ödemeler</span><b>{stats ? stats.payments_paid : "–"}</b><span className="s">başarılı · {stats?.payment_events ?? 0} ödeme olayı</span>
            </button>
            <button type="button" className="stat btn dn-k" onClick={() => applyStat({ kategori: "auth", q: "giriş" })}>
              <span className="l">Giriş</span><b>{stats ? stats.logins : "–"}</b><span className="s">{stats?.login_failures ? `${stats.login_failures} başarısız deneme` : "başarısız deneme yok"}</span>
            </button>
            <button type="button" className="stat btn dn-k" onClick={() => applyStat({ kategori: "mail" })}>
              <span className="l">Mail</span><b>{stats ? stats.mails_sent : "–"}</b><span className="s">{stats?.mails_failed ? `gönderildi · ${stats.mails_failed} başarısız` : "gönderildi"}</span>
            </button>
          </div>
        ) : (
          <div className="stats fx-stats3">
            <div className="stat dn-k g"><span className="l">Bugün giriş yapan</span><b>{kpi.today}</b><span className="s">farklı kişi</span></div>
            <div className="stat dn-k"><span className="l">Son 7 günde aktif veli</span><b>{kpi.active}</b><span className="s">{guardianCount} kayıtlı veliden</span></div>
            <div className={`stat dn-k ${kpi.fails ? "y" : "g"}`}><span className="l">Hatalı giriş denemesi</span><b>{kpi.fails}</b><span className="s">{kpi.fails ? "son 7 gün · kontrol edin" : "son 7 gün · sorun yok"}</span></div>
          </div>
        )}

        <section className="card">
          <div className="tools">
            <label className="search">
              <span className="sr">Ara</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input
                type="search"
                id="dn-q"
                placeholder={isFeed ? "Ad, e-posta, öğrenci, ödeme no, paket, ders veya işlem ara…" : "Kişi, cihaz veya işlem ara…"}
                value={q}
                maxLength={200}
                onChange={(event) => setQ(event.target.value)}
              />
            </label>
            {isFeed ? (
              <label>
                <span className="sr">Durum</span>
                <select className={`sel${durum ? " is-set" : ""}`} id="dn-durum" value={durum} onChange={(event) => setDurum(event.target.value as AuditStatus | "")}>
                  <option value="">Tüm durumlar</option>
                  {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{AUDIT_STATUS_LABELS[status]}</option>)}
                </select>
              </label>
            ) : null}
            {isLogin ? (
              <label>
                <span className="sr">Sonuç</span>
                <select className="sel" id="dn-sonuc" value={sonuc} onChange={(event) => setSonuc(event.target.value)}>
                  <option value="">Tüm girişler</option><option value="ok">Başarılı</option><option value="fail">Başarısız</option>
                </select>
              </label>
            ) : null}
            {isLogin ? (
              <label>
                <span className="sr">Kişi türü</span>
                <select className="sel" id="dn-rol" value={rol} onChange={(event) => setRol(event.target.value)}>
                  <option value="">Tüm kişiler</option><option value="veli">Yalnızca veliler</option><option value="yonetici">Yalnızca yönetici</option>
                </select>
              </label>
            ) : null}
            <label>
              <span className="sr">Zaman</span>
              <select className={`sel${zaman !== "30" ? " is-set" : ""}`} id="dn-zaman" value={zaman} onChange={(event) => { setZaman(event.target.value as Zaman); setAnchor(Date.now()); }}>
                <option value="bugun">Bugün</option>
                <option value="24s">Son 24 saat</option>
                <option value="7">Son 7 gün</option>
                <option value="30">Son 30 gün</option>
                <option value="ay">Bu ay</option>
                <option value="tum">Tüm zamanlar</option>
                <option value="ozel">Tarih aralığı…</option>
              </select>
            </label>
            {zaman === "ozel" ? (
              <span className="ak-range">
                <label><span className="sr">Başlangıç</span><input type="date" className="sel ak-date" value={customFrom} max={customTo || undefined} onChange={(event) => setCustomFrom(event.target.value)} /></label>
                <span aria-hidden="true">–</span>
                <label><span className="sr">Bitiş</span><input type="date" className="sel ak-date" value={customTo} min={customFrom || undefined} onChange={(event) => setCustomTo(event.target.value)} /></label>
              </span>
            ) : null}
          </div>

          {isFeed ? (
            <div className="bn-chips ak-chips" role="group" aria-label="Kategori">
              <button type="button" aria-pressed={!kategori} onClick={() => setKategori("")}>Tümü</button>
              {AUDIT_CATEGORIES.map((category) => (
                <button key={category} type="button" className={`ak-chip-${category}`} aria-pressed={kategori === category} onClick={() => setKategori(kategori === category ? "" : category)}>
                  <i />{AUDIT_CATEGORY_LABELS[category]}
                </button>
              ))}
              {person ? (
                <span className="ak-person">
                  Kişi: <b>{person.label}</b>
                  <button type="button" aria-label="Kişi filtresini kaldır" onClick={() => setPerson(null)}>×</button>
                </span>
              ) : null}
            </div>
          ) : null}

          {isFeed && rows.length ? (
            <div className={`ak-feed${feedStale ? " is-stale" : ""}`} aria-busy={feedStale}>
              <div className="ak-th" aria-hidden="true">
                <span>Kişi</span><span>İşlem</span><span>Kategori</span><span>Durum</span><span>Tarih</span><span>Varlık</span><span />
              </div>
              <ol className="ak-rows" aria-label="Olay akışı">
                {rows.map((row) => <FeedRowItem key={row.event_id} row={row} onOpen={openEvent} />)}
              </ol>
            </div>
          ) : null}

          {isFeed && total > AUDIT_PAGE_SIZE ? (
            <nav className="ak-pager" aria-label="Sayfalar">
              <button type="button" className="btn btn-sm" disabled={page === 0 || feedStale} onClick={() => setPage((value) => Math.max(value - 1, 0))}>← Önceki</button>
              <span>{firstShown}–{lastShown} / {total} kayıt · sayfa {page + 1}/{pageCount}</span>
              <button type="button" className="btn btn-sm" disabled={page + 1 >= pageCount || feedStale} onClick={() => setPage((value) => value + 1)}>Sonraki →</button>
            </nav>
          ) : null}

          {!isFeed ? (
            <>
              <table className="fx-table dn-table" id="dn-giris" aria-label="Giriş kayıtları" hidden={!isLogin || !visibleLogins.length}>
                <colgroup><col style={{ width: "32%" }} /><col style={{ width: "26%" }} /><col /><col style={{ width: "17%" }} /></colgroup>
                <thead><tr><th>Kişi</th><th>Cihaz</th><th>Sonuç</th><th>Tarih</th></tr></thead>
                <tbody>
                  {visibleLogins.map((row) => {
                    const name = row.name || row.email;
                    return (
                      <tr key={row.id} className={row.result === "fail" ? "dn-fail" : undefined}>
                        <td className="bn-kisi">
                          <b title={row.email}>
                            {row.studentId ? <Link className="fx-ogr" href={studentHref(row.studentId)} title={row.studentName ? `Öğrenci: ${row.studentName}` : undefined}>{name}</Link> : name}
                            {row.role === "yonetici" ? <span className="dn-rol">Yönetici</span> : null}
                          </b>
                        </td>
                        <td className="dn-cihaz">{row.device || "Bilinmeyen cihaz"}</td>
                        <td><span className="dn-son">{row.result === "ok" ? <><OkIcon />Başarılı</> : <><FailIcon />Başarısız</>}</span></td>
                        <DateCell iso={row.at} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <table className="fx-table dn-table" id="dn-islem" aria-label="Panel işlemleri" hidden={seg !== "islem" || !visibleActions.length}>
                <colgroup><col style={{ width: "26%" }} /><col /><col style={{ width: "16%" }} /><col style={{ width: "17%" }} /></colgroup>
                <thead><tr><th>İşlem</th><th>Ayrıntı</th><th>Yapan</th><th>Tarih</th></tr></thead>
                <tbody>
                  {visibleActions.map((row) => (
                    <tr key={row.id}>
                      <td><span className={`bn-tag ${KIND_COLOR[row.kind]}`}>{row.title}</span></td>
                      <td className="bn-konu" title={row.detail}>{row.studentId && row.kind !== "fiyat" ? <Link className="fx-ogr" href={studentHref(row.studentId)}>{row.detail}</Link> : row.detail}</td>
                      <td className="dn-cihaz">{row.actor}</td>
                      <DateCell iso={row.at} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          {isFeed ? (
            !feed ? (
              <div className="fx-empty" id="dn-empty"><b>Kayıtlar yükleniyor…</b></div>
            ) : !rows.length ? (
              <div className="fx-empty" id="dn-empty">
                <span className="fx-empty-ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg></span>
                <b>{feed.error ? "Kayıtlar yüklenemedi" : "Kayıt bulunamadı"}</b>
                <span>{feed.error || (filtersActive ? "Aramayı veya filtreleri değiştirin." : "Bu dönemde olay kaydı yok.")}</span>
              </div>
            ) : null
          ) : localLoading ? (
            <div className="fx-empty" id="dn-empty"><b>Kayıtlar yükleniyor…</b></div>
          ) : !localList.length ? (
            <div className="fx-empty" id="dn-empty">
              <b>{localError ? "Kayıtlar yüklenemedi" : "Kayıt bulunamadı"}</b>
              <span>{localError || (localTotal ? "Aramayı veya filtreleri değiştirin." : isLogin ? "Henüz giriş kaydı yok." : "Henüz panel işlemi kaydı yok.")}</span>
            </div>
          ) : null}

          <div className="foot">
            <span id="dn-shown">{isFeed ? (total ? `${firstShown}–${lastShown} / ${total} kayıt` : "0 kayıt") : `${localList.length} / ${localTotal} kayıt gösteriliyor`}</span>
            <span>{isFeed ? "Sunucuda filtrelenir · sayfa başına 50 kayıt · IP adresi tutulmaz" : "Giriş kayıtları güvenlik amacıyla 1 yıl saklanır"}</span>
          </div>
        </section>
      </div></div>

      {openId ? (
        <AuditEventDrawer eventId={openId} preview={preview} onClose={closeEvent} onOpenEvent={openEvent} onFilterPerson={filterPerson} />
      ) : null}
    </div>
  );
}

export default function AdminAuditPage() {
  return (
    <Suspense fallback={null}>
      <AuditCenter />
    </Suspense>
  );
}
