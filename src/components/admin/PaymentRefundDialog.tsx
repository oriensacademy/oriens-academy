"use client";

import { useEffect, useRef, useState } from "react";
import { getAdminRefundContext, type AdminRefundContext, type AdminPaymentRow } from "@/lib/admin/payments";
import { formatTrLira, formatTrListDate } from "@/lib/format/turkish";
import pages from "./admin-pages.module.css";

export interface RefundReviewRequest {
  context: AdminRefundContext;
  refundAmount: number;
  lessonsToRevoke: number;
  reason: string;
  idempotencyKey: string;
  sendNotification: boolean;
}

// Referans "İade başlat" penceresi (#od-iade): özet, İade türü, (kısmi iadede)
// İade tutarı, isteğe bağlı Açıklama ve sabit bilgi notu; başka görünür alan yok.
// Sunucu kuralları aynen korunur: iade bağlamı admin_get_payment_refund_context'ten
// gelir, işlem tek idempotency anahtarıyla mevcut paytr-refund ucuna gider.
//  - Tam iadede kalan tüm ders hakları iptal edilir.
//  - Kısmi iadede iptal edilecek hak, referans notundaki gibi iade tutarına
//    göre hesaplanır (oransal, en az 1, pakette en az 1 hak kalır).
//  - paytr-refund en az 3 karakterlik neden ister; Açıklama boş bırakılırsa
//    sabit "Panelden iade" nedeni gönderilir.
//  - Bilgilendirme e-postası gönderilmez (önceki varsayılan).
export const REFUND_DEFAULT_REASON = "Panelden iade";

export function partialLessonsForAmount(context: Pick<AdminRefundContext, "refundable_amount" | "remaining_lessons">, refundAmount: number): number {
  const remaining = context.remaining_lessons;
  if (remaining < 2 || !(context.refundable_amount > 0) || !(refundAmount > 0)) return 0;
  const proportional = Math.round((refundAmount / context.refundable_amount) * remaining);
  return Math.min(remaining - 1, Math.max(1, proportional));
}

export function refundReasonFromNote(note: string): string {
  const clean = note.trim().replace(/\s+/g, " ");
  if (clean.length >= 3) return clean;
  return clean ? `${REFUND_DEFAULT_REASON}: ${clean}` : REFUND_DEFAULT_REASON;
}

export function PaymentRefundDialog({ row, subtitle, busy, onClose, onSubmit }: {
  row: AdminPaymentRow;
  subtitle: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (request: RefundReviewRequest) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [context, setContext] = useState<AdminRefundContext | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"partial" | "full">("full");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [idempotencyKey] = useState(() => `admin-refund-${crypto.randomUUID()}`);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  useEffect(() => {
    let active = true;
    getAdminRefundContext(row.id).then((result) => {
      if (!active) return;
      if (result.error || !result.data) setError(result.error || "İade bilgileri yüklenemedi.");
      else setContext(result.data);
    });
    return () => { active = false; };
  }, [row.id]);

  function selectMode(next: "partial" | "full") {
    setMode(next);
    setShowErrors(false);
    setSubmitError("");
    if (next === "partial") setAmount("");
  }

  const refundAmount = context ? (mode === "full" ? context.refundable_amount : Number(amount)) : 0;
  const lessonsToRevoke = context ? (mode === "full" ? context.remaining_lessons : partialLessonsForAmount(context, refundAmount)) : 0;
  const amountValid = Boolean(context && Number.isFinite(refundAmount) && refundAmount > 0 && refundAmount <= context.refundable_amount && (mode === "full" || refundAmount < context.refundable_amount));

  function submit() {
    if (!context || busy) return;
    if (!amountValid) { setShowErrors(true); return; }
    if (context.remaining_lessons < 1) { setSubmitError("Bu pakette iptal edilecek kullanılmamış ders hakkı yok."); return; }
    if (mode === "partial" && lessonsToRevoke < 1) { setSubmitError("Kısmi iade için pakette en az iki kullanılmamış ders hakkı olmalı."); return; }
    onSubmit({ context, refundAmount, lessonsToRevoke, reason: refundReasonFromNote(reason), idempotencyKey, sendNotification: false });
  }

  function requestClose() {
    if (!busy) onClose();
  }

  const paidAt = context ? formatTrListDate(row.paid_at || row.created_at).primary : "";

  return (
    <div className={pages.root} style={{ display: "contents" }}>
      <dialog
        ref={dialogRef}
        className="arc"
        id="od-iade"
        onCancel={(event) => { event.preventDefault(); requestClose(); }}
        onClick={(event) => { if (event.target === event.currentTarget) requestClose(); }}
      >
        <div className="m-modal" role="dialog" aria-modal="true" aria-labelledby="odi-title">
          <div className="m-head">
            <div className="m-hicon" style={{ background: "#FBECEA", color: "#9A3324" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <h2 id="odi-title" className="m-htitle">İade başlat</h2>
              <span className="m-hsub">{subtitle}</span>
            </div>
            <button type="button" className="m-close" aria-label="Kapat" onClick={requestClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="m-body" style={{ padding: "20px 24px 8px", gap: 14 }}>
            {!context && !error ? <p className="arc-note">İade bilgileri yükleniyor…</p> : null}
            {error ? <p role="alert" className="arc-note" style={{ color: "#9A3324" }}>{error}</p> : null}
            {context ? (
              <>
                <div className="fx-sum">
                  <span>Ödenen<b>{formatTrLira(context.paid_amount)}</b></span>
                  <span>Tarih<b>{paidAt}</b></span>
                  <span>Referans<b className="fx-mono" style={{ fontSize: 12, wordBreak: "break-all" }}>{context.reference}</b></span>
                </div>
                <div className="m-field">
                  <span className="m-lab" id="odi-tur-l">İade türü</span>
                  <div className="m-dur" role="radiogroup" aria-labelledby="odi-tur-l">
                    <label><input type="radio" name="odi-tur" value="kismi" checked={mode === "partial"} onChange={() => selectMode("partial")} /><span>Kısmi iade</span></label>
                    <label><input type="radio" name="odi-tur" value="tam" checked={mode === "full"} onChange={() => selectMode("full")} /><span>Tam iade</span></label>
                  </div>
                </div>
                <div className={`m-field${showErrors && !amountValid ? " fx-err" : ""}`} hidden={mode !== "partial"}>
                  <label htmlFor="odi-tutar" className="m-lab">İade tutarı</label>
                  <div className="m-suffix">
                    <input id="odi-tutar" type="number" min="1" step="0.01" max={context.refundable_amount} className="m-input" value={amount} onChange={(event) => { setAmount(event.target.value); setShowErrors(false); setSubmitError(""); }} />
                    <span className="m-unit">₺</span>
                  </div>
                </div>
                <div className="m-field">
                  <label htmlFor="odi-not" className="m-lab">Açıklama <span className="m-opt">(isteğe bağlı)</span></label>
                  <input id="odi-not" className="m-input" placeholder="Örn. Öğrenci kaydı bıraktı" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
                </div>
                <p className="arc-note">İade, ödemenin yapıldığı kredi kartına yapılır. Öğrencinin paketindeki ders hakları iade tutarına göre güncellenmelidir.</p>
                {submitError ? <p role="alert" className="arc-note" style={{ color: "#9A3324" }}>{submitError}</p> : null}
              </>
            ) : null}
          </div>
          <div className="m-foot">
            <button type="button" className="m-cancel" onClick={requestClose} disabled={busy}>Vazgeç</button>
            <button type="button" className="m-delok" onClick={submit} disabled={!context || busy}>
              {busy ? "İşleniyor…" : "İadeyi başlat"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
