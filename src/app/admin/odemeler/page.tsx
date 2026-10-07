"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { queryKeys, useQuery } from "@/lib/data/query-store";
import { useAdminNotifications } from "@/lib/admin/admin-notifications-context";
import {
  canRefundLedgerRow,
  listAdminPaymentLedger,
  processPaytrRefund,
  type AdminLedgerSource,
  type AdminLedgerStatus,
  type AdminPaymentLedgerRow,
} from "@/lib/admin/payments";
import { PaymentRefundDialog, type RefundReviewRequest } from "@/components/admin/PaymentRefundDialog";
import { getPaymentRefundCopy } from "@/content/payment-refund";
import { formatTrPhoneDisplay } from "@/lib/format/phone";
import { foldTurkish, formatTrLira, formatTrShortListDate } from "@/lib/format/turkish";
import { packageDisplayName } from "@/lib/packages/display";
import { toast } from "@/components/ui/toast";
import pages from "@/components/admin/admin-pages.module.css";

const EMPTY_LEDGER: AdminPaymentLedgerRow[] = [];
const PACKAGE_ORDER = ["single", "package5", "package10", "package20", "package30"];

const SOURCE_LABEL: Record<AdminLedgerSource, string> = {
  paytr: "Kredi Kartı",
  banka: "Banka Transferi",
  ucretsiz: "Ücretsiz tanımlandı",
};

const STATUS_TAG: Record<AdminLedgerStatus, { label: string; className: string }> = {
  odendi: { label: "Ödendi", className: "fx-tag ok" },
  iade: { label: "İade edildi", className: "fx-tag grey" },
  bekliyor: { label: "Bekliyor", className: "fx-tag star" },
  basarisiz: { label: "Başarısız", className: "fx-tag warn" },
};

function ledgerPackageLabel(source: { package_id: string; custom_package_name?: string | null; metadata?: unknown }) {
  return packageDisplayName(source);
}

/** Referans: "murat küçükarslan" → "Murat Küçükarslan". */
function titleCaseTr(value: string) {
  return value.split(" ").map((word) => (word ? word.charAt(0).toLocaleUpperCase("tr") + word.slice(1) : word)).join(" ");
}

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

export default function AdminPaymentsPage() {
  const refundCopy = getPaymentRefundCopy("tr");
  const { markPaymentsSeen } = useAdminNotifications();

  // Opening this page is what marks payments as read, so the sidebar badge
  // counts genuinely new payments instead of every transaction that exists.
  useEffect(() => {
    void markPaymentsSeen();
  }, [markPaymentsSeen]);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { data: result, loading } = useQuery(
    `${queryKeys.adminPayments}:ledger|${refreshTrigger}`,
    () => listAdminPaymentLedger(ledgerPackageLabel),
    { staleTime: 30_000 }
  );
  const rows = result?.data ?? EMPTY_LEDGER;
  const loadError = result?.error || "";

  const [q, setQ] = useState("");
  const [durum, setDurum] = useState("");
  const [paket, setPaket] = useState("");
  const [kaynak, setKaynak] = useState("");
  const [zaman, setZaman] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [refundRow, setRefundRow] = useState<AdminPaymentLedgerRow | null>(null);
  const [refunding, setRefunding] = useState(false);

  const packageOptions = useMemo(() => {
    const ids = new Set(PACKAGE_ORDER);
    rows.forEach((row) => ids.add(row.packageId));
    const ordered = Array.from(ids).sort((a, b) => {
      const ia = PACKAGE_ORDER.indexOf(a);
      const ib = PACKAGE_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "tr");
    });
    return ordered.map((id) => ({ id, label: rows.find((row) => row.packageId === id)?.packageLabel || packageDisplayName({ package_id: id }) }));
  }, [rows]);

  const filtered = useMemo(() => {
    const query = foldTurkish(q.trim());
    const digits = q.replace(/\D/g, "");
    const now = new Date();
    return rows.filter((row) => {
      if (durum && row.status !== durum) return false;
      if (paket && row.packageId !== paket) return false;
      if (kaynak && row.source !== kaynak) return false;
      if (!inPeriod(row.at, zaman, now)) return false;
      if (!query) return true;
      const haystack = foldTurkish([row.payerName, row.studentName || "", row.email || "", row.phone || "", row.reference || "", row.couponCode || ""].join(" "));
      if (haystack.includes(query)) return true;
      return digits.length >= 3 && (row.phone || "").replace(/\D/g, "").includes(digits);
    });
  }, [rows, q, durum, paket, kaynak, zaman]);

  function toggle(key: string) {
    setOpen((current) => ({ ...current, [key]: !current[key] }));
  }

  async function copyReference(reference: string) {
    try {
      await navigator.clipboard.writeText(reference);
    } catch {
      // Pano erişimi yoksa da bilgi metni gösterilir (referans davranışı).
    }
    toast.success("Referans kopyalandı");
  }

  async function submitRefund(request: RefundReviewRequest) {
    const { context, refundAmount, lessonsToRevoke, reason, idempotencyKey, sendNotification } = request;
    setRefunding(true);
    const outcome = await processPaytrRefund({ transactionId: context.transaction_id, refundAmount, lessonsToRevoke, reason, idempotencyKey, sendNotification, locale: "tr" });
    setRefunding(false);
    if (!outcome.success) {
      toast.error(outcome.error || refundCopy.failed);
      return;
    }
    setRefundRow(null);
    toast.success(`${formatTrLira(refundAmount)} iade başlatıldı`);
    setRefreshTrigger((count) => count + 1);
  }

  const emptyTitle = loadError ? "Ödemeler yüklenemedi" : rows.length ? "Sonuç bulunamadı" : "Henüz ödeme yok";
  const emptyText = loadError ? loadError : rows.length ? "Aramayı veya filtreleri değiştirmeyi deneyin." : "Paket satın alındığında burada görünür.";
  const showTable = filtered.length > 0;

  return (
    <div id="view-odeme" className={`pgv ${pages.root}`}>
      {refundRow?.transaction ? (
        <PaymentRefundDialog
          row={refundRow.transaction}
          subtitle={`${titleCaseTr(refundRow.payerName)} · ${refundRow.packageLabel}`}
          busy={refunding}
          onClose={() => setRefundRow(null)}
          onSubmit={submitRefund}
        />
      ) : null}
      <div className="page"><div className="wrap">
        <div className="head"><div><h1>Ödemeler</h1><p>Veli ve öğrencilerin paket satın alma işlemleri. Satıra tıklayınca iletişim ve ödeme ayrıntıları açılır.</p></div></div>
        <section className="card">
          <div className="tools">
            <label className="search">
              <span className="sr">Ara</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input type="search" id="od-q" placeholder="İsim, e-posta veya referans ara…" value={q} onChange={(event) => setQ(event.target.value)} />
            </label>
            <label><span className="sr">Durum</span><select className="sel" id="od-durum" value={durum} onChange={(event) => setDurum(event.target.value)}><option value="">Tüm durumlar</option><option value="odendi">Ödendi</option><option value="iade">İade edildi</option><option value="bekliyor">Bekliyor</option><option value="basarisiz">Başarısız</option></select></label>
            <label><span className="sr">Paket</span><select className="sel" id="od-paket" value={paket} onChange={(event) => setPaket(event.target.value)}><option value="">Tüm paketler</option>{packageOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
            <label><span className="sr">Ödeme şekli</span><select className="sel" id="od-kaynak" value={kaynak} onChange={(event) => setKaynak(event.target.value)}><option value="">Tüm yöntemler</option><option value="banka">Banka Transferi</option><option value="paytr">Kredi Kartı</option><option value="ucretsiz">Ücretsiz tanımlandı</option></select></label>
            <label><span className="sr">Zaman</span><select className="sel" id="od-zaman" value={zaman} onChange={(event) => setZaman(event.target.value)}><option value="">Tüm zamanlar</option><option value="bugun">Bugün</option><option value="7">Son 7 gün</option><option value="ay">Bu ay</option><option value="30">Son 30 gün</option></select></label>
          </div>
          <table className="fx-table" id="od-table" aria-label="Ödemeler" hidden={!showTable}>
            <colgroup><col style={{ width: "25%" }} /><col style={{ width: "18%" }} /><col style={{ width: "23%" }} /><col style={{ width: "12%" }} /><col style={{ width: "18%" }} /><col style={{ width: 56 }} /></colgroup>
            <thead><tr><th>Ad Soyad</th><th>Paket</th><th>Tutar</th><th>Durum</th><th>Tarih</th><th><span className="sr">Ayrıntı</span></th></tr></thead>
            <tbody id="od-rows">
              {filtered.map((row) => {
                const when = formatTrShortListDate(row.at);
                const expanded = Boolean(open[row.key]);
                const tag = STATUS_TAG[row.status];
                const partialRefund = row.refundedAmount > 0 ? row.refundedAmount : 0;
                return (
                  <Fragment key={row.key}>
                    <tr
                      className={`od-row${row.status === "iade" ? " off" : ""}`}
                      data-od={row.key}
                      aria-expanded={expanded}
                      tabIndex={0}
                      onClick={(event) => { if ((event.target as HTMLElement).closest("button, a")) return; toggle(row.key); }}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(row.key); } }}
                    >
                      <td className="fx-who">
                        <b>{titleCaseTr(row.payerName)}</b>
                        {row.studentName ? (
                          <small>Öğrenci: {row.studentId ? <Link className="fx-ogr" href={`/admin/ogrenciler/detay?student=${encodeURIComponent(row.studentId)}`}>{row.studentName}</Link> : row.studentName}</small>
                        ) : null}
                      </td>
                      <td>{row.packageLabel}</td>
                      <td className="fx-amt">
                        <b>{row.source === "ucretsiz" ? <span className="fx-tag ok">Ücretsiz</span> : formatTrLira(row.netAmount)}</b>
                        {row.couponCode ? (
                          <>
                            <small>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
                              {row.couponCode} (−{formatTrLira(row.baseAmount - row.netAmount)})
                            </small>
                            {row.baseAmount > row.netAmount ? <s>{formatTrLira(row.baseAmount)}</s> : null}
                          </>
                        ) : null}
                        {partialRefund ? <small style={{ color: "#9A3324" }}>−{formatTrLira(partialRefund)} iade</small> : null}
                      </td>
                      <td><span className={tag.className}>{tag.label}</span></td>
                      <td className="fx-date">{when.primary}<small>{when.secondary}</small></td>
                      <td className="od-c"><svg className="od-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></td>
                    </tr>
                    <tr className="od-det" hidden={!expanded}>
                      <td colSpan={6}>
                        <div className="od-box">
                          <dl className="od-dl">
                            <div><dt>E-posta</dt><dd>{row.email || <span className="fx-muted">—</span>}</dd></div>
                            <div><dt>Telefon</dt><dd>{row.phone ? formatTrPhoneDisplay(row.phone) : <span className="fx-muted">—</span>}</dd></div>
                            <div><dt>Ödeme şekli</dt><dd>{SOURCE_LABEL[row.source]}</dd></div>
                            <div className="od-wide">
                              <dt>Referans</dt>
                              <dd>
                                {row.reference ? (
                                  <span className="fx-ref">
                                    <code>{row.reference}</code>
                                    <button type="button" className="fx-copy" title="Kopyala" aria-label="Referansı kopyala" onClick={() => void copyReference(row.reference as string)}>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                    </button>
                                  </span>
                                ) : <span className="fx-muted">Elle tanımlandı</span>}
                              </dd>
                            </div>
                            {row.transaction?.last_refunded_at && row.refundedAmount > 0 ? (
                              <div className="od-wide"><dt>İade</dt><dd>{formatTrLira(row.refundedAmount)} · {formatTrShortListDate(row.transaction.last_refunded_at).primary}{row.transaction.last_refund_reason ? ` · ${row.transaction.last_refund_reason}` : ""}</dd></div>
                            ) : null}
                            {row.adminNote ? <div className="od-wide"><dt>Yönetici notu</dt><dd>{row.adminNote}</dd></div> : null}
                          </dl>
                          {canRefundLedgerRow(row) ? (
                            <button type="button" className="fx-refund" disabled={refunding} onClick={() => setRefundRow(row)}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
                              İade başlat
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {loading && !rows.length ? (
            <div className="fx-empty" id="od-empty"><b>Ödemeler yükleniyor…</b></div>
          ) : (
            <div className="fx-empty" id="od-empty" hidden={showTable}>
              <span className="fx-empty-ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg></span>
              <b>{emptyTitle}</b>
              <span>{emptyText}</span>
            </div>
          )}
          <div className="foot"><span id="od-shown">{filtered.length} / {rows.length} ödeme gösteriliyor</span><span>Satıra tıklayarak iletişim, ödeme şekli ve referans bilgisini açın</span></div>
        </section>
      </div></div>
    </div>
  );
}
