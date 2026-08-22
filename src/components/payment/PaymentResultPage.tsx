"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, ShieldQuestion, XCircle } from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { getPaymentCopy } from "@/content/payment";
import { getPaymentStatus } from "@/lib/payments/client";
import type { VerifiedPaymentStatus } from "@/lib/payments/types";

export function PaymentResultPage() {
  const locale = useLocale();
  const copy = getPaymentCopy(locale);
  const [payment, setPayment] = useState<VerifiedPaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") ?? "";
    const token = params.get("token") ?? "";
    getPaymentStatus(reference, token).then(setPayment).finally(() => setLoading(false));
  }, []);
  const labels = locale === "tr" ? { pending: "Ödeme Bekleniyor", requires_action: "Doğrulama Gerekli", processing: "Ödeme İşleniyor", paid: "Ödeme Başarılı", failed: "Ödeme Başarısız", cancelled: "Ödeme İptal Edildi", refunded: "Ödeme İade Edildi" } : { pending: "Payment Pending", requires_action: "Verification Required", processing: "Payment Processing", paid: "Payment Successful", failed: "Payment Failed", cancelled: "Payment Cancelled", refunded: "Payment Refunded" };
  const referenceLabel = locale === "tr" ? "Referans" : "Reference";
  const Icon = payment?.status === "paid" ? CheckCircle2 : payment?.status === "failed" || payment?.status === "cancelled" ? XCircle : payment ? Clock3 : ShieldQuestion;
  return <section className="min-h-[70vh] bg-background pt-32 pb-24"><div className="public-container"><div className="mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-7 text-center shadow-editorial sm:p-10"><Icon className="mx-auto size-12 text-primary" /><p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">{copy.eyebrow}</p><h1 className="mt-3 text-4xl text-ink">{copy.resultTitle}</h1>{loading ? <p className="mt-5 text-sm text-muted-foreground">{copy.verifying}</p> : payment ? <div className="mt-6"><p className="font-heading text-2xl text-ink">{labels[payment.status]}</p><dl className="mx-auto mt-6 max-w-md divide-y divide-border border-y border-border text-left text-sm"><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">{referenceLabel}</dt><dd className="font-mono font-semibold text-ink">{payment.reference}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">{copy.package}</dt><dd className="font-semibold text-ink">{payment.packageId}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">{locale === "tr" ? "Tutar" : "Amount"}</dt><dd className="font-semibold text-ink">{new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { style: "currency", currency: payment.currency }).format(payment.amount)}</dd></div></dl>{payment.paymentMethod === "bank_transfer" && payment.status === "pending" && <p className="mx-auto mt-5 max-w-md rounded-lg border border-border bg-surface-muted p-3 text-left text-xs leading-5 text-muted-foreground">{copy.referenceNotice}</p>}</div> : <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm leading-6 text-amber-950"><div className="flex gap-2"><AlertCircle className="mt-1 size-4 shrink-0" /><p>{copy.verificationFailed}</p></div></div>}</div></div></section>;
}
