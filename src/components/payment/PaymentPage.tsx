"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, LockKeyhole } from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { getPaymentCopy } from "@/content/payment";
import { getPublicPricingPackages, type PublicPricingPackage } from "@/lib/admin/pricing";
import { createPayment, getPublicBankTransferDetails } from "@/lib/payments/client";
import type { BankTransferDetails, PaymentMethod } from "@/lib/payments/types";
import { pendingBankCapabilities } from "@/lib/payments/bank-provider";
import { localizedPath, paymentResultPath } from "@/lib/routes";
import { TurnstileWidget, type TurnstileWidgetRef } from "@/components/security/TurnstileWidget";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { HostedCardPanel } from "./HostedCardPanel";
import { BankTransferPanel } from "./BankTransferPanel";

export function PaymentPage() {
  const locale = useLocale();
  const copy = getPaymentCopy(locale);
  const [packages, setPackages] = useState<PublicPricingPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [bankDetails, setBankDetails] = useState<BankTransferDetails | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [terms, setTerms] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const onVerify = useCallback((token: string) => setTurnstileToken(token), []);
  const onTurnstileReset = useCallback(() => setTurnstileToken(""), []);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("package") ?? "";
    Promise.all([getPublicPricingPackages(), getPublicBankTransferDetails()]).then(([rows, details]) => {
      const purchasable = rows.filter((row) => row.purchase_mode === "purchasable" && row.active);
      setPackages(purchasable);
      setSelectedPackageId(purchasable.some((row) => row.id === requested) ? requested : purchasable[0]?.id ?? "");
      setBankDetails(details);
    });
  }, []);

  const selectedPackage = useMemo(() => packages.find((item) => item.id === selectedPackageId) ?? null, [packages, selectedPackageId]);
  const canSubmitCard = pendingBankCapabilities.configured && (pendingBankCapabilities.hostedPayment || pendingBankCapabilities.tokenizedPayment);
  const money = (value: number, currency: string) => new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedPackage || !turnstileToken || !terms || (method === "card" ? !canSubmitCard : !bankDetails)) return;
    setSubmitting(true); setError("");
    const result = await createPayment({ packageId: selectedPackage.id, paymentMethod: method, payerName, payerEmail, payerPhone, locale, termsAccepted: terms, turnstileToken });
    setSubmitting(false);
    if (!result.success) { setError(result.message); setTurnstileToken(""); turnstileRef.current?.reset(); return; }
    if (method === "card" && result.redirectUrl) {
      try {
        const redirect = new URL(result.redirectUrl);
        if (redirect.protocol === "https:") { window.location.assign(redirect.toString()); return; }
      } catch { /* invalid provider redirect */ }
      setError(locale === "tr" ? "Banka ödeme yönlendirmesi doğrulanamadı." : "The bank payment redirect could not be validated.");
      return;
    }
    window.location.assign(paymentResultPath(locale, result.reference, result.statusToken));
  }

  return <section className="min-h-screen bg-background pt-28 pb-20 md:pt-36 md:pb-28">
    <div className="public-container"><div className="mx-auto max-w-5xl">
      <header className="max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{copy.eyebrow}</p><h1 className="mt-4 text-[clamp(2.7rem,6vw,5rem)] leading-[1.02] text-ink">{copy.title}</h1><p className="mt-5 text-base leading-7 text-muted-foreground md:text-lg">{copy.lead}</p></header>
      <div className="mt-10 grid gap-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,.65fr)]">
        <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-5 shadow-editorial sm:p-8">
          <PaymentMethodSelector locale={locale} value={method} onChange={setMethod} />
          <div className="mt-7">{method === "card" ? <HostedCardPanel locale={locale} /> : <BankTransferPanel locale={locale} details={bankDetails} />}</div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-ink">{copy.fullName}<input required value={payerName} onChange={(event) => setPayerName(event.target.value)} autoComplete="name" className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm" /></label><label className="text-xs font-semibold text-ink">{copy.email}<input required type="email" value={payerEmail} onChange={(event) => setPayerEmail(event.target.value)} autoComplete="email" className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm" /></label><label className="text-xs font-semibold text-ink sm:col-span-2">{copy.phone}<input value={payerPhone} onChange={(event) => setPayerPhone(event.target.value)} autoComplete="tel" className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm" /></label></div>
          <label className="mt-5 flex cursor-pointer items-start gap-3 text-xs leading-5 text-muted-foreground"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} className="mt-1 size-4 accent-[var(--primary)]" /><span>{copy.terms}</span></label>
          <TurnstileWidget ref={turnstileRef} action="payment_create" locale={locale} onVerify={onVerify} onExpire={onTurnstileReset} onError={onTurnstileReset} />
          {error && <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"><AlertCircle className="size-4 shrink-0" />{error}</div>}
          <button type="submit" disabled={!selectedPackage || !terms || !turnstileToken || submitting || (method === "card" ? !canSubmitCard : !bankDetails)} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-semibold text-white hover:bg-forest disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"><LockKeyhole className="size-4" />{method === "card" ? copy.continuePayment : copy.createTransfer}<ArrowRight className="size-4" /></button>
        </form>
        <aside className="h-fit rounded-2xl border border-border bg-surface-muted p-5 sm:p-6"><h2 className="text-xl text-ink">{copy.package}</h2>{packages.length > 0 ? <><select value={selectedPackageId} onChange={(event) => setSelectedPackageId(event.target.value)} className="mt-4 min-h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm text-ink">{packages.map((item) => <option key={item.id} value={item.id}>{locale === "tr" ? item.name_tr : item.name_en}</option>)}</select>{selectedPackage && <div className="mt-5 border-t border-border pt-5"><p className="font-heading text-2xl text-ink">{locale === "tr" ? selectedPackage.name_tr : selectedPackage.name_en}</p><p className="mt-2 text-2xl font-bold text-ink">{money(Number(selectedPackage.current_total ?? selectedPackage.price_amount), selectedPackage.currency)}</p></div>}</> : <><p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.noPackage}</p><Link href={localizedPath("pricing", locale)} className="mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-ink underline decoration-primary underline-offset-4">{copy.backPricing}<ArrowRight className="size-4" /></Link></>}
          <div className="mt-6 border-t border-border pt-5 text-xs leading-5 text-muted-foreground"><p className="font-semibold text-ink">{copy.eyebrow}</p><p className="mt-2">{copy.secureText}</p></div>
        </aside>
      </div>
    </div></div>
  </section>;
}
