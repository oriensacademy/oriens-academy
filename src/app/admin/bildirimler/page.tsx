"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@/lib/data/query-store";
import {
  EMAIL_HISTORY_KIND_LABEL,
  emailHistoryBody,
  listAdminEmailHistory,
  retryAdminNotification,
  type EmailHistoryKind,
  type EmailHistoryRow,
  type EmailHistoryStatus,
} from "@/lib/admin/notifications";
import { foldTurkish, formatTrListDate, formatTrShortListDate } from "@/lib/format/turkish";
import { toast } from "@/components/ui/toast";
import pages from "@/components/admin/admin-pages.module.css";

// Referans "E-posta Geçmişi" (#view-bildirim). Yalnız okuma; "Tekrar gönder"
// yalnız başarısız teslimatlarda görünür ve mevcut admin_retry_email_notification
// akışını kullanır.

const EMPTY_ROWS: EmailHistoryRow[] = [];
const KIND_ORDER: EmailHistoryKind[] = ["rapor", "odeme", "paket", "hosgeldin", "otp"];
const KIND_COLOR: Record<EmailHistoryKind, string> = { rapor: "g", odeme: "y", paket: "b", hosgeldin: "p", otp: "n", diger: "n" };
const SENDER = "Oriens Academy <info@oriens-academy.com>";

const STATUS_TAG: Record<EmailHistoryStatus, { label: string; className: string }> = {
  ok: { label: "Gönderildi", className: "fx-tag ok" },
  fail: { label: "Başarısız", className: "fx-tag warn" },
  wait: { label: "Bekliyor", className: "fx-tag star" },
};

function inPeriod(iso: string, period: string, now: Date) {
  if (!period) return true;
  const date = new Date(iso);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (period === "bugun") return date >= today;
  if (period === "ay") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const from = new Date(today);
  from.setDate(from.getDate() - (Number(period) - 1));
  return date >= from;
}

function StatusIcon({ status }: { status: EmailHistoryStatus }) {
  if (status === "ok") {
    return <span className="bn-ic ok" title="Gönderildi" aria-label="Gönderildi"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg></span>;
  }
  if (status === "fail") {
    return <span className="bn-ic fail" title="Başarısız" aria-label="Başarısız"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></span>;
  }
  return <span className="bn-ic wait" title="Bekliyor" aria-label="Bekliyor"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2 2" /></svg></span>;
}

function studentHref(studentId: string) {
  return `/admin/ogrenciler/detay?student=${encodeURIComponent(studentId)}`;
}

function EmailDialog({ row, onClose, onRetried }: { row: EmailHistoryRow; onClose: () => void; onRetried: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  async function resend() {
    setSending(true);
    const result = await retryAdminNotification(row.id);
    setSending(false);
    if (!result.success) {
      toast.error(`E-posta tekrar gönderilemedi: ${result.error || "bilinmeyen hata"}`);
      return;
    }
    toast.success(`E-posta tekrar gönderilmek üzere sıraya alındı: ${row.recipient}`);
    onRetried();
    onClose();
  }

  const when = formatTrListDate(row.at);
  const tag = STATUS_TAG[row.status];
  return (
    <div className={pages.root} style={{ display: "contents" }}>
      <dialog
        ref={dialogRef}
        className="fx-dlg"
        id="bn-dialog"
        onCancel={(event) => { event.preventDefault(); onClose(); }}
        onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      >
        <div className="m-modal" role="dialog" aria-modal="true" aria-labelledby="bnd-title">
          <div className="m-head">
            <div className="m-hicon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></svg></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <h2 id="bnd-title" className="m-htitle">{row.subject}</h2>
              <span className="m-hsub">{EMAIL_HISTORY_KIND_LABEL[row.kind]}</span>
            </div>
            <button type="button" className="m-close" aria-label="Kapat" onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
          </div>
          <div className="m-body fx-body">
            <dl className="fx-dl">
              {row.person ? (
                <>
                  <dt>Kişi</dt>
                  <dd>
                    {row.person.studentId ? <Link className="fx-ogr" href={studentHref(row.person.studentId)}>{row.person.name}</Link> : row.person.name}
                    {row.person.studentName ? <small className="il-dd2">Öğrenci: {row.person.studentName}</small> : null}
                  </dd>
                </>
              ) : null}
              <dt>Durum</dt><dd><span className={tag.className}>{tag.label}</span></dd>
              <dt>Gönderim</dt><dd>{when.primary}<small className="il-dd2">{when.secondary}</small></dd>
              <dt>Mesaj ID</dt><dd className="fx-mono">{row.messageId || "—"}</dd>
            </dl>
            <div className="fx-mail">
              <div className="fx-mail-h"><span>Kimden: {SENDER}</span><span>Kime: {row.recipient}</span></div>
              <div className="fx-mail-b">{emailHistoryBody(row.raw)}</div>
            </div>
          </div>
          <div className="m-foot">
            <button type="button" className="m-cancel" onClick={onClose}>Kapat</button>
            {row.status === "fail" ? (
              <button
                type="button"
                className="m-save"
                disabled={sending || !row.canRetry}
                title={row.canRetry ? undefined : "Bu teslimatın şablon kaydı olmadığı için tekrar gönderilemez."}
                onClick={() => void resend()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
                {sending ? "Gönderiliyor…" : "Tekrar gönder"}
              </button>
            ) : null}
          </div>
        </div>
      </dialog>
    </div>
  );
}

export default function AdminEmailHistoryPage() {
  const [refresh, setRefresh] = useState(0);
  const { data: result, loading } = useQuery(`admin:email-history|${refresh}`, listAdminEmailHistory, { staleTime: 30_000 });
  const rows = result?.rows ?? EMPTY_ROWS;
  const loadError = result?.error || "";

  const [q, setQ] = useState("");
  const [durum, setDurum] = useState("");
  const [zaman, setZaman] = useState("");
  const [tur, setTur] = useState<EmailHistoryKind | "">("");
  const [openId, setOpenId] = useState<string | null>(null);

  const base = useMemo(() => {
    const query = foldTurkish(q.trim());
    const now = new Date();
    return rows.filter((row) => {
      if (durum && row.status !== durum) return false;
      if (!inPeriod(row.at, zaman, now)) return false;
      if (!query) return true;
      return foldTurkish([row.subject, row.recipient, row.messageId || "", row.person?.name || "", row.person?.studentName || ""].join(" ")).includes(query);
    });
  }, [rows, q, durum, zaman]);

  const counts = useMemo(() => {
    const map: Partial<Record<EmailHistoryKind, number>> = {};
    base.forEach((row) => { map[row.kind] = (map[row.kind] || 0) + 1; });
    return map;
  }, [base]);

  const visible = useMemo(() => base.filter((row) => !tur || row.kind === tur), [base, tur]);

  const weekReports = useMemo(() => {
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return rows.filter((row) => row.kind === "rapor" && new Date(row.at) >= monday).length;
  }, [rows]);

  const kinds: EmailHistoryKind[] = counts.diger ? [...KIND_ORDER, "diger"] : KIND_ORDER;
  const failCount = result?.failCount ?? 0;
  const openRow = openId ? rows.find((row) => row.id === openId) ?? null : null;
  const showTable = visible.length > 0;
  const emptyTitle = loadError ? "E-posta geçmişi yüklenemedi" : rows.length ? "Sonuç bulunamadı" : "Henüz e-posta gönderilmedi";
  const emptyText = loadError ? loadError : rows.length ? "Aramayı veya filtreleri değiştirmeyi deneyin." : "Sistem e-posta gönderdiğinde burada görünür.";

  return (
    <div id="view-bildirim" className={`pgv ${pages.root}`}>
      {openRow ? <EmailDialog row={openRow} onClose={() => setOpenId(null)} onRetried={() => setRefresh((n) => n + 1)} /> : null}
      <div className="page"><div className="wrap">
        <div className="head"><div><h1>E-posta Geçmişi</h1><p>Sistemin gönderdiği tüm e-postaların teslim durumu ve içerikleri.</p></div></div>
        <div className="stats fx-stats3">
          <div className="stat bn-k g"><span className="l">Gönderildi</span><b data-n="ok">{result?.okCount ?? 0}</b><span className="s">başarıyla teslim edildi</span></div>
          <div className={`stat bn-k ${failCount ? "r" : "g"}`} data-bn-failk=""><span className="l">Başarısız</span><b data-n="fail">{failCount}</b><span className="s" data-n="fail-s">{failCount ? "tekrar gönderilmesi gerekiyor" : "sorun yok"}</span></div>
          <div className="stat bn-k"><span className="l">Bu hafta ders raporu</span><b data-n="hafta">{weekReports}</b><span className="s">pazartesiden bu yana</span></div>
        </div>
        <section className="card">
          <div className="tools">
            <label className="search">
              <span className="sr">Ara</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input type="search" id="bn-q" placeholder="Alıcı, konu veya mesaj ID ara…" value={q} onChange={(event) => setQ(event.target.value)} />
            </label>
            <label><span className="sr">Durum</span><select className="sel" id="bn-durum" value={durum} onChange={(event) => setDurum(event.target.value)}><option value="">Tüm durumlar</option><option value="ok">Gönderildi</option><option value="fail">Başarısız</option><option value="wait">Bekliyor</option></select></label>
            <label><span className="sr">Zaman</span><select className="sel" id="bn-zaman" value={zaman} onChange={(event) => setZaman(event.target.value)}><option value="">Tüm zamanlar</option><option value="bugun">Bugün</option><option value="7">Son 7 gün</option><option value="ay">Bu ay</option><option value="30">Son 30 gün</option></select></label>
          </div>
          <div className="bn-chips" id="bn-chips" role="group" aria-label="E-posta türü">
            <button type="button" aria-pressed={!tur} onClick={() => setTur("")}>Tümü<small>{base.length}</small></button>
            {kinds.map((kind) => (
              <button key={kind} type="button" className={`c-${KIND_COLOR[kind]}`} aria-pressed={tur === kind} disabled={!counts[kind]} onClick={() => setTur(kind)}>
                <i />{EMAIL_HISTORY_KIND_LABEL[kind]}<small>{counts[kind] || 0}</small>
              </button>
            ))}
          </div>
          <table className="fx-table" id="bn-table" aria-label="E-posta bildirimleri" hidden={!showTable}>
            <colgroup><col style={{ width: "24%" }} /><col style={{ width: "20%" }} /><col /><col style={{ width: 84 }} /><col style={{ width: "17%" }} /><col style={{ width: 44 }} /></colgroup>
            <thead><tr><th>Alıcı</th><th>Tür</th><th>Konu</th><th>Durum</th><th>Tarih</th><th><span className="sr">Aç</span></th></tr></thead>
            <tbody id="bn-rows">
              {visible.map((row) => {
                const when = formatTrShortListDate(row.at);
                return (
                  <tr
                    key={row.id}
                    data-bn={row.id}
                    tabIndex={0}
                    onClick={(event) => { if ((event.target as HTMLElement).closest("a")) return; setOpenId(row.id); }}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpenId(row.id); } }}
                  >
                    <td className="bn-kisi">{row.person ? <b>{row.person.name}</b> : <b className="bn-yalniz">Kayıtlı olmayan alıcı</b>}</td>
                    <td><span className={`bn-tag ${KIND_COLOR[row.kind]}`}>{EMAIL_HISTORY_KIND_LABEL[row.kind]}</span></td>
                    <td className="bn-konu" title={row.subject}>{row.subject}</td>
                    <td><StatusIcon status={row.status} /></td>
                    <td className="fx-date">{when.primary}<small>{when.secondary}</small></td>
                    <td className="il-chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loading && !rows.length ? (
            <div className="fx-empty" id="bn-empty"><b>E-postalar yükleniyor…</b></div>
          ) : (
            <div className="fx-empty" id="bn-empty" hidden={showTable}>
              <span className="fx-empty-ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg></span>
              <b>{emptyTitle}</b>
              <span>{emptyText}</span>
            </div>
          )}
          <div className="foot"><span id="bn-shown">{visible.length} / {result?.total ?? rows.length} e-posta gösteriliyor</span><span>Satıra tıklayarak e-posta ayrıntılarını açın</span></div>
        </section>
      </div></div>
    </div>
  );
}
