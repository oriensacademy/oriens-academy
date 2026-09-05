"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, RotateCcw, X } from "lucide-react";
import { getPaymentRefundCopy } from "@/content/payment-refund";
import { formatCurrency } from "@/lib/format/currency";
import { getAdminRefundContext, type AdminRefundContext, type AdminPaymentRow } from "@/lib/admin/payments";
import { lockBodyScroll } from "@/lib/dom/body-scroll-lock";

export interface RefundReviewRequest {
  context: AdminRefundContext;
  refundAmount: number;
  lessonsToRevoke: number;
  reason: string;
  idempotencyKey: string;
}

export function PaymentRefundDialog({ row, onClose, onReview }: {
  row: AdminPaymentRow;
  onClose: () => void;
  onReview: (request: RefundReviewRequest) => void;
}) {
  const copy = getPaymentRefundCopy("tr");
  const [context, setContext] = useState<AdminRefundContext | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"remaining" | "partial" | "full">("remaining");
  const [amount, setAmount] = useState("");
  const [lessons, setLessons] = useState("");
  const [reason, setReason] = useState("");
  const [idempotencyKey] = useState(() => `admin-refund-${crypto.randomUUID()}`);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    getAdminRefundContext(row.id).then((result) => {
      if (!active) return;
      if (result.error || !result.data) setError(result.error || "İade bilgileri yüklenemedi.");
      else {
        setContext(result.data);
        const defaults = refundDefaults(result.data, "remaining");
        setLessons(String(defaults.lessons));
        setAmount(defaults.amount.toFixed(2));
      }
    });
    return () => { active = false; };
  }, [row.id]);

  function selectMode(nextMode: "remaining" | "partial" | "full") {
    setMode(nextMode);
    if (!context) return;
    const defaults = refundDefaults(context, nextMode);
    setLessons(String(defaults.lessons));
    setAmount(defaults.amount.toFixed(2));
  }

  useEffect(() => {
    const unlockBodyScroll = lockBodyScroll();
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); unlockBodyScroll(); };
  }, [onClose]);

  const refundAmount = Number(amount);
  const lessonsToRevoke = Number(lessons);
  const valid = Boolean(context && Number.isFinite(refundAmount) && refundAmount > 0 && refundAmount <= context.refundable_amount && Number.isInteger(lessonsToRevoke) && lessonsToRevoke > 0 && lessonsToRevoke <= context.remaining_lessons && reason.trim().length >= 3);
  const money = (value: number) => formatCurrency(value, { currency: context?.currency || row.currency, locale: "tr" });

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6">
      <button type="button" aria-label="İade penceresini kapat" onClick={onClose} className="absolute inset-0 bg-ink/45 backdrop-blur-sm" />
      <section role="dialog" aria-modal="true" aria-labelledby="refund-dialog-title" className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-white p-5 shadow-2xl sm:p-7">
        <button ref={closeRef} type="button" aria-label="Kapat" onClick={onClose} className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        <div className="flex size-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-700"><RotateCcw className="size-5" /></div>
        <h2 id="refund-dialog-title" className="mt-4 pr-12 font-heading text-2xl text-ink">{copy.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{row.public_reference} · {row.payer_name || row.payer_email}</p>

        {!context && !error ? <div className="flex min-h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div> : null}
        {error ? <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p> : null}
        {context ? <>
          <div className="mt-5 grid gap-3 rounded-2xl bg-surface-muted p-4 sm:grid-cols-3">
            <Metric label={copy.paidAmount} value={money(context.paid_amount)} />
            <Metric label={copy.refundedAmount} value={money(context.refunded_amount)} />
            <Metric label={copy.refundableAmount} value={money(context.refundable_amount)} />
            <Metric label={copy.completedLessons} value={String(context.completed_lessons)} />
            <Metric label={copy.remainingLessons} value={String(context.remaining_lessons)} />
            <Metric label="Paket / Öğrenci" value={context.learner ? `${context.package_id} · ${context.learner}` : context.package_id} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3" role="group" aria-label="İade türü">
            {([['remaining',copy.remainingRefund],['partial',copy.partialRefund],['full',copy.fullRefund]] as const).map(([value,label]) => <button key={value} type="button" onClick={() => selectMode(value)} className={`min-h-11 rounded-xl border px-3 text-xs font-semibold ${mode === value ? "border-purple-600 bg-purple-50 text-purple-900" : "border-border text-ink hover:bg-muted"}`}>{label}</button>)}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-ink">{copy.refundAmount}<input type="number" min="0.01" step="0.01" max={context.refundable_amount} value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-input px-3 text-sm" /></label>
            <label className="text-xs font-semibold text-ink">{copy.lessonsToRevoke}<input type="number" min="1" step="1" max={context.remaining_lessons} value={lessons} onChange={(event) => setLessons(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-input px-3 text-sm" /></label>
            <label className="text-xs font-semibold text-ink sm:col-span-2">{copy.refundReason}<textarea required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-24 w-full resize-y rounded-xl border border-input p-3 text-sm" /></label>
          </div>

          {context.refunds.length ? <div className="mt-5 rounded-2xl border border-border p-4"><h3 className="text-xs font-semibold text-ink">İade Geçmişi</h3><div className="mt-3 space-y-2">{context.refunds.map((item) => <div key={item.id} className="grid gap-1 border-t border-border pt-2 text-[11px] text-muted-foreground sm:grid-cols-3"><span>{money(Number(item.amount))} · -{item.lessons} ders</span><span>{item.status} · {item.provider_reference}</span><span>{new Date(item.finalized_at || item.created_at).toLocaleString("tr-TR")} · {item.reason} · Yönetici: {item.admin_actor}</span></div>)}</div></div> : null}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-border px-5 text-sm font-semibold text-ink">{copy.cancel}</button><button type="button" disabled={!valid} onClick={() => valid && onReview({ context, refundAmount, lessonsToRevoke, reason: reason.trim(), idempotencyKey })} className="min-h-11 rounded-xl bg-purple-700 px-5 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-45">{copy.continue}</button></div>
        </> : null}
      </section>
    </div>,
    document.body
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-[10px] text-muted-foreground">{label}</span><strong className="mt-1 block text-xs text-ink">{value}</strong></div>;
}

function refundDefaults(context: AdminRefundContext, mode: "remaining" | "partial" | "full") {
  const previouslyRevoked = context.refunds.filter((item) => item.status === "refund_succeeded").reduce((sum, item) => sum + Number(item.lessons || 0), 0);
  const originalLessons = context.total_lessons + previouslyRevoked;
  const effectiveUnit = originalLessons > 0 ? context.paid_amount / originalLessons : 0;
  const suggested = Math.min(context.refundable_amount, Math.round(context.remaining_lessons * effectiveUnit * 100) / 100);
  return { lessons: context.remaining_lessons, amount: mode === "full" ? context.refundable_amount : suggested };
}
