"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  LockKeyhole,
  Receipt,
  ShieldCheck,
  Tag,
  X,
} from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { getPaymentCopy } from "@/content/payment";
import { getPublicPricingPackages, type PublicPricingPackage } from "@/lib/admin/pricing";
import { getPublicBankTransferDetails } from "@/lib/payments/client";
import { processStudentCheckout, type StudentCheckoutResult } from "@/lib/payments/checkout";
import { validateCoupon } from "@/lib/coupons/client";
import type { CouponValidationSuccess } from "@/lib/coupons/types";
import type { BankTransferDetails, PaymentMethod } from "@/lib/payments/types";
import { localizedPath, unifiedLoginPath } from "@/lib/routes";
import { formatCurrency } from "@/lib/format/currency";
import { useAccount } from "@/lib/auth/account-context";
import { usePublicSettings } from "@/lib/settings/public-settings-context";
import { AccountWaveLoader } from "@/components/auth/AccountWaveLoader";
import { ButtonLink } from "@/components/ui/button";
import { TurnstileWidget, type TurnstileWidgetRef } from "@/components/security/TurnstileWidget";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { HostedCardPanel } from "./HostedCardPanel";
import { BankTransferPanel } from "./BankTransferPanel";
import { LegalModal, type LegalOrderSnapshot } from "@/components/legal/LegalModal";
import type { LegalDocKey } from "@/config/legal";

export function PaymentPage() {
  const locale = useLocale();
  const copy = getPaymentCopy(locale);
  const isTr = locale === "tr";
  const router = useRouter();
  const { accountType, user, isInitializing } = useAccount();
  const { showPricing, loading: settingsLoading } = usePublicSettings();

  const [packages, setPackages] = useState<PublicPricingPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [bankDetails, setBankDetails] = useState<BankTransferDetails | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [payerName, setPayerName] = useState(user?.user_metadata?.full_name || "");
  const [payerEmail, setPayerEmail] = useState(user?.email || "");
  const [payerPhone, setPayerPhone] = useState(user?.user_metadata?.phone || "");

  // Required Commercial & Legal Acceptance Checkboxes (Neither preselected)
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [refundPolicyAccepted, setRefundPolicyAccepted] = useState(false);

  // Legal Modal Dialog state
  const [activeModal, setActiveModal] = useState<LegalDocKey | null>(null);

  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationSuccess | null>(null);

  // Completed order view
  const [completedOrder, setCompletedOrder] = useState<StudentCheckoutResult | null>(null);
  const [copiedIban, setCopiedIban] = useState(false);

  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const redirectedRef = useRef(false);
  const idempotencyKeyRef = useRef("");

  const onVerify = useCallback((token: string) => setTurnstileToken(token), []);
  const onTurnstileReset = useCallback(() => setTurnstileToken(""), []);

  // Auth protection: redirect unauthenticated users to login with next return
  useEffect(() => {
    if (isInitializing || redirectedRef.current) return;
    if (accountType !== "student" && accountType !== "admin") {
      redirectedRef.current = true;
      const currentQuery = window.location.search;
      const nextPath = `${localizedPath("payment", locale)}${currentQuery}`;
      router.replace(`${unifiedLoginPath(locale)}?next=${encodeURIComponent(nextPath)}&source=checkout`);
    }
  }, [accountType, isInitializing, locale, router]);

  // Load packages and bank details
  useEffect(() => {
    if (accountType === "student" || accountType === "admin") {
      const requested = new URLSearchParams(window.location.search).get("package") ?? "";
      Promise.all([getPublicPricingPackages(), getPublicBankTransferDetails()]).then(([rows, details]) => {
        const purchasable = rows.filter((row) => row.purchase_mode === "purchasable" && row.active);
        setPackages(purchasable);
        setSelectedPackageId(purchasable.some((row) => row.id === requested) ? requested : purchasable[0]?.id ?? "");
        setBankDetails(details);
      });
    }
  }, [accountType]);

  const selectedPackage = useMemo(
    () => packages.find((item) => item.id === selectedPackageId) ?? null,
    [packages, selectedPackageId]
  );

  const money = (value: number, currency = "TRY") => {
    return formatCurrency(value, { currency, locale });
  };

  const basePrice = Number(selectedPackage?.current_total ?? selectedPackage?.price_amount ?? 0);
  const discountAmount = appliedCoupon ? appliedCoupon.discount_amount : 0;
  const finalPrice = Math.max(0, basePrice - discountAmount);

  // Apply Coupon
  async function handleApplyCoupon(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!couponInput.trim() || !selectedPackage) return;
    setValidatingCoupon(true);
    setCouponError("");

    const res = await validateCoupon(couponInput, selectedPackage.id, user?.id);
    setValidatingCoupon(false);

    if (res.valid) {
      setAppliedCoupon(res);
      setCouponError("");
    } else {
      setAppliedCoupon(null);
      setCouponError(res.message || (locale === "tr" ? "Geçersiz indirim kuponu." : "Invalid discount coupon."));
    }
  }

  // Remove Coupon
  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  }

  // Submit Bank Transfer Checkout
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (
      !selectedPackage ||
      !turnstileToken ||
      !termsAccepted ||
      !refundPolicyAccepted ||
      submitting ||
      !bankDetails
    ) {
      return;
    }

    setSubmitting(true);
    setError("");

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = `chk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    const result = await processStudentCheckout({
      packageId: selectedPackage.id,
      paymentMethod: method,
      couponCode: appliedCoupon ? appliedCoupon.code : undefined,
      payerName,
      payerPhone,
      locale,
      idempotencyKey: idempotencyKeyRef.current,
    });

    setSubmitting(false);

    if (!result.success) {
      setError(result.message || (locale === "tr" ? "Ödeme işlemi gerçekleştirilemedi." : "Payment could not be processed."));
      setTurnstileToken("");
      turnstileRef.current?.reset();
      return;
    }

    // If card payment has a 3D Secure redirect URL
    if (method === "card" && result.redirectUrl) {
      try {
        const redirect = new URL(result.redirectUrl);
        if (redirect.protocol === "https:") {
          window.location.assign(redirect.toString());
          return;
        }
      } catch {
        /* invalid provider redirect */
      }
    }

    // Show order confirmation screen
    setCompletedOrder(result);
  }

  const orderSnapshot: LegalOrderSnapshot = {
    packageName: (isTr ? selectedPackage?.name_tr : selectedPackage?.name_en) || selectedPackage?.id || "Eğitim Paketi",
    lessonCount: selectedPackage?.lesson_count || 1,
    baseAmount: basePrice,
    discountAmount: discountAmount || undefined,
    couponCode: appliedCoupon?.code,
    finalAmount: finalPrice,
    currency: selectedPackage?.currency || "TRY",
    payerName: payerName || undefined,
    payerEmail: payerEmail || undefined,
    paymentMethod: method === "bank_transfer" ? "bank_transfer" : "card",
  };

  if (isInitializing || settingsLoading || (accountType !== "student" && accountType !== "admin")) {
    return <AccountWaveLoader />;
  }

  if (!showPricing && accountType !== "admin") {
    return (
      <section className="pt-28 pb-20 md:pt-36 md:pb-28">
        <div className="mx-auto max-w-[700px] px-6 text-center">
          <h1 className="font-heading text-3xl font-normal text-ink">
            {locale === "tr" ? "Ödeme Sistemi Geçici Olarak Kapalı" : "Payment System Temporarily Unavailable"}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {locale === "tr"
              ? "Çevrim içi ödeme sistemi şu anda güncellenmektedir. Lütfen daha sonra tekrar deneyiniz."
              : "The online payment portal is undergoing scheduled maintenance. Please try again later."}
          </p>
          <div className="mt-8 flex justify-center">
            <ButtonLink href={localizedPath("home", locale)} variant="default">
              {locale === "tr" ? "Ana Sayfaya Dön" : "Back to Home"}
            </ButtonLink>
          </div>
        </div>
      </section>
    );
  }

  // Completed Bank Transfer Confirmation Screen
  if (completedOrder) {
    const isEft = completedOrder.paymentMethod === "bank_transfer";
    const refCode = completedOrder.publicReference || "";

    return (
      <section className="pt-28 pb-20 md:pt-36 md:pb-28">
        <div className="mx-auto max-w-[760px] px-4 sm:px-6">
          <div className="rounded-3xl border border-border bg-surface p-6 shadow-editorial sm:p-10">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-8" />
            </div>

            <h1 className="mt-6 font-heading text-2xl text-ink sm:text-3xl">
              {isEft
                ? locale === "tr"
                  ? "Banka Havalesi / EFT Talebiniz Alındı"
                  : "Bank Transfer Order Created"
                : locale === "tr"
                  ? "Ödemeniz Başarıyla Alındı"
                  : "Payment Successful"}
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {isEft
                ? locale === "tr"
                  ? "Ödeme bildiriminiz sisteme kaydedildi. Lütfen aşağıdaki banka hesabına, açıklama kısmına referans numaranızı yazarak transferinizi gerçekleştirin. Havaleniz muhasebe ekibimizce doğrulandığında ders paketiniz otomatik olarak aktif edilecektir."
                  : "Your transfer order has been recorded. Please complete the bank transfer using the reference code in the payment description."
                : locale === "tr"
                  ? "Ödemeniz onaylandı ve ders paketiniz öğrenci hesabınıza tanımlandı. Detayları aşağıda bulabilirsiniz."
                  : "Your payment was confirmed and lessons have been credited to your account."}
            </p>

            <div className="mt-6 rounded-2xl border border-border bg-surface-muted/60 p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{locale === "tr" ? "İşlem Referansı" : "Transaction Reference"}</span>
                <span className="font-mono font-bold text-ink">{refCode}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{locale === "tr" ? "Öğrenci" : "Student"}</span>
                <span className="font-semibold text-ink">{payerName || user?.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{locale === "tr" ? "Paket" : "Package"}</span>
                <span className="font-semibold text-ink">
                  {selectedPackage ? (locale === "tr" ? selectedPackage.name_tr : selectedPackage.name_en) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border/80 pt-3">
                <span className="font-semibold text-ink">{locale === "tr" ? "Ödenen Tutar" : "Paid Amount"}</span>
                <span className="text-base font-bold text-ink">{money(finalPrice, selectedPackage?.currency)}</span>
              </div>
            </div>

            {isEft && bankDetails && (
              <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
                <h3 className="font-semibold text-ink text-sm flex items-center gap-2">
                  <Receipt className="size-4 text-primary" />
                  {locale === "tr" ? "Havale / EFT Hesap Bilgileri" : "Bank Transfer Account Information"}
                </h3>
                <div className="grid gap-2 text-xs text-ink/80 pt-1">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">{locale === "tr" ? "Banka" : "Bank"}</span>
                    <strong>{bankDetails.bankName}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">{locale === "tr" ? "Alıcı / Unvan" : "Account Holder"}</span>
                    <strong>{bankDetails.accountHolder}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">IBAN</span>
                    <div className="mt-1 flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 font-mono text-xs text-ink">
                      <span>{bankDetails.iban}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(bankDetails.iban.replace(/\s+/g, ""));
                          setCopiedIban(true);
                          setTimeout(() => setCopiedIban(false), 2000);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-forest cursor-pointer"
                      >
                        {copiedIban ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                        <span>{copiedIban ? (locale === "tr" ? "Kopyalandı" : "Copied") : (locale === "tr" ? "Kopyala" : "Copy")}</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">{locale === "tr" ? "Açıklama (Zorunlu)" : "Payment Description"}</span>
                    <div className="mt-1 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 font-mono text-xs font-bold text-amber-950">
                      <span>{refCode}</span>
                      <span className="text-[10px] text-amber-800 font-sans font-normal">
                        {locale === "tr" ? "Referansı açıklamaya yazınız" : "Include reference in description"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <ButtonLink href={localizedPath("studentAccount", locale)} variant="default">
                {locale === "tr" ? "Öğrenci Paneline Git" : "Go to Student Portal"}
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-24 pb-20 md:pt-32 md:pb-28">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
            <LockKeyhole className="size-3.5" />
            <span>{locale === "tr" ? "256-Bit SSL Güvenli Ödeme" : "256-Bit SSL Secure Checkout"}</span>
          </div>
          <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {copy.lead}
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[400px_1fr]">
          {/* LEFT COLUMN: PACKAGE SUMMARY & COUPON */}
          <aside className="order-2 lg:order-1 rounded-3xl border border-border bg-surface p-6 shadow-editorial sm:p-7">
            <h2 className="font-heading text-lg text-ink">
              {isTr ? "Sipariş Özeti" : "Order Summary"}
            </h2>

            {/* Package Selector */}
            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold text-ink">
                {locale === "tr" ? "Eğitim Paketi Seçin" : "Select Package"}
              </label>
              <select
                id="checkout-package-select"
                value={selectedPackageId}
                onChange={(e) => setSelectedPackageId(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-input bg-surface px-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {locale === "tr" ? pkg.name_tr : pkg.name_en} ({pkg.lesson_count} {locale === "tr" ? "Ders" : "Lessons"}) — {money(Number(pkg.price_amount ?? 0), pkg.currency)}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Breakdown */}
            <div className="mt-6 rounded-2xl border border-border bg-surface-muted/60 p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{locale === "tr" ? "Paket:" : "Package:"}</span>
                <strong className="text-ink">
                  {selectedPackage ? (locale === "tr" ? selectedPackage.name_tr : selectedPackage.name_en) : "—"}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{locale === "tr" ? "Ders Saati:" : "Lessons:"}</span>
                <span className="font-semibold text-ink">{selectedPackage?.lesson_count ?? 0} {locale === "tr" ? "Ders" : "Lessons"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{locale === "tr" ? "Liste Fiyatı:" : "List Price:"}</span>
                <span className="font-semibold text-ink">{money(basePrice, selectedPackage?.currency)}</span>
              </div>
              {appliedCoupon && (
                <div className="flex items-center justify-between text-emerald-800 font-semibold pt-1 border-t border-border/60">
                  <span className="flex items-center gap-1">
                    <Tag className="size-3" />
                    <span>{appliedCoupon.code}</span>
                  </span>
                  <span>-{money(discountAmount, selectedPackage?.currency)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                <strong className="text-ink">{isTr ? "Toplam Tutar" : "Total Amount"}</strong>
                <strong className="text-base font-bold text-ink">
                  {money(finalPrice, selectedPackage?.currency)}
                </strong>
              </div>
            </div>

            {/* Coupon Box */}
            <div className="mt-6 border-t border-border pt-5">
              <label htmlFor="checkout-coupon-code" className="block text-xs font-semibold text-ink">
                {locale === "tr" ? "İndirim Kuponu" : "Discount Coupon"}
              </label>
              {appliedCoupon ? (
                <div className="mt-2 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900">
                  <div className="flex items-center gap-1.5 font-mono font-semibold">
                    <Tag className="size-3.5 text-emerald-700" />
                    <span>{appliedCoupon.code}</span>
                    <span className="text-emerald-700">(-{money(discountAmount, selectedPackage?.currency)})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
                    aria-label="Kuponu Kaldır"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="mt-2 flex gap-2">
                  <input
                    id="checkout-coupon-code"
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder={locale === "tr" ? "Kupon kodunu girin" : "Enter coupon code"}
                    className="min-h-11 flex-1 rounded-xl border border-input bg-surface px-3 font-mono text-xs uppercase outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                  <button
                    type="submit"
                    disabled={!couponInput.trim() || validatingCoupon || !selectedPackage}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-4 text-xs font-semibold text-white transition-colors hover:bg-forest disabled:opacity-40 cursor-pointer"
                  >
                    {validatingCoupon ? <Loader2 className="size-3.5 animate-spin" /> : locale === "tr" ? "Uygula" : "Apply"}
                  </button>
                </form>
              )}
              {couponError && (
                <p role="alert" className="mt-2 text-xs text-red-700">
                  {couponError}
                </p>
              )}
            </div>

            {/* Factual Security Guarantee */}
            <div className="mt-6 border-t border-border pt-5 text-xs text-muted-foreground space-y-2">
              <p className="flex items-center gap-1.5 font-semibold text-ink">
                <ShieldCheck className="size-4 text-primary" />
                {locale === "tr" ? "Güvenli İşlem Garantisi" : "Secure Transaction Guarantee"}
              </p>
              <p className="leading-relaxed text-[11px] text-muted-foreground">
                {locale === "tr"
                  ? "Kart bilgileriniz PayTR’ın güvenli ödeme altyapısı üzerinden işlenir ve Oriens Academy sunucularında saklanmaz."
                  : "Your card information is processed through PayTR's secure payment infrastructure and is not stored on Oriens Academy servers."}
              </p>
            </div>
          </aside>

          {/* RIGHT COLUMN: PAYMENT CONTROLS */}
          <div className="order-1 lg:order-2">
            <form onSubmit={handleSubmit} className="rounded-3xl border border-border bg-surface p-6 shadow-editorial sm:p-8 space-y-6">
              <div>
                <h2 className="font-heading text-2xl text-ink">
                  {locale === "tr" ? "Ödeme Bilgileri" : "Payment Details"}
                </h2>
                <div className="mt-5">
                  <PaymentMethodSelector locale={locale} value={method} onChange={setMethod} />
                </div>
              </div>

              {/* Contact & Billing Information */}
              <div className="border-t border-border pt-6">
                <h3 className="font-semibold text-ink text-sm">
                  {locale === "tr" ? "Fatura / İletişim Bilgileri" : "Contact & Billing Information"}
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-ink">
                    {copy.fullName} <span className="text-red-500">*</span>
                    <input
                      required
                      value={payerName}
                      onChange={(event) => setPayerName(event.target.value)}
                      autoComplete="name"
                      placeholder="Ad Soyad"
                      className="mt-1.5 min-h-12 w-full rounded-xl border border-input bg-surface px-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                  <label className="text-xs font-semibold text-ink">
                    {copy.email} <span className="text-red-500">*</span>
                    <input
                      required
                      type="email"
                      value={payerEmail}
                      onChange={(event) => setPayerEmail(event.target.value)}
                      autoComplete="email"
                      placeholder="ornek@alanadi.com"
                      className="mt-1.5 min-h-12 w-full rounded-xl border border-input bg-surface px-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                  <label className="text-xs font-semibold text-ink sm:col-span-2">
                    {copy.phone} <span className="text-red-500">*</span>
                    <input
                      required
                      type="tel"
                      value={payerPhone}
                      onChange={(event) => setPayerPhone(event.target.value)}
                      autoComplete="tel"
                      placeholder="05XX XXX XX XX"
                      className="mt-1.5 min-h-12 w-full rounded-xl border border-input bg-surface px-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                </div>
              </div>

              {/* TWO MANDATORY LEGAL ACCEPTANCE CHECKBOXES */}
              <div className="rounded-2xl border border-[#DDE4DC] bg-[#F9FAF8] p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-ink">
                  <ShieldCheck className="size-4 text-primary" />
                  <span>{isTr ? "Yasal Bilgilendirme ve Onaylar" : "Legal Terms & Acceptance"}</span>
                </div>

                {/* Checkbox 1 */}
                <label className="flex items-start gap-3 text-xs leading-relaxed text-[#10271B] cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 size-4 rounded-sm border-gray-300 text-primary accent-primary focus:ring-primary/20 cursor-pointer"
                  />
                  <span>
                    {isTr ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setActiveModal("preInformation");
                          }}
                          className="font-semibold text-primary underline hover:text-forest transition-colors cursor-pointer"
                        >
                          Ön Bilgilendirme Formu
                        </button>
                        {" "}ve{" "}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setActiveModal("salesAgreement");
                          }}
                          className="font-semibold text-primary underline hover:text-forest transition-colors cursor-pointer"
                        >
                          Mesafeli Satış Sözleşmesi
                        </button>
                        ’ni okudum ve kabul ediyorum.
                      </>
                    ) : (
                      <>
                        I have read and agree to the{" "}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setActiveModal("preInformation");
                          }}
                          className="font-semibold text-primary underline hover:text-forest transition-colors cursor-pointer"
                        >
                          Pre-Information Form
                        </button>
                        {" "}and{" "}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setActiveModal("salesAgreement");
                          }}
                          className="font-semibold text-primary underline hover:text-forest transition-colors cursor-pointer"
                        >
                          Distance Sales Agreement
                        </button>
                        .
                      </>
                    )}
                  </span>
                </label>

                {/* Checkbox 2 */}
                <label className="flex items-start gap-3 text-xs leading-relaxed text-[#10271B] cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={refundPolicyAccepted}
                    onChange={(e) => setRefundPolicyAccepted(e.target.checked)}
                    className="mt-0.5 size-4 rounded-sm border-gray-300 text-primary accent-primary focus:ring-primary/20 cursor-pointer"
                  />
                  <span>
                    {isTr ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setActiveModal("refundPolicy");
                          }}
                          className="font-semibold text-primary underline hover:text-forest transition-colors cursor-pointer"
                        >
                          İptal ve İade Koşulları
                        </button>
                        ’nı okudum ve kabul ediyorum.
                      </>
                    ) : (
                      <>
                        I have read and agree to the{" "}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setActiveModal("refundPolicy");
                          }}
                          className="font-semibold text-primary underline hover:text-forest transition-colors cursor-pointer"
                        >
                          Cancellation & Refund Policy
                        </button>
                        .
                      </>
                    )}
                  </span>
                </label>

                {/* Checkbox-Free Informational Notice */}
                <div className="pt-2 border-t border-[#EAEFEA] text-[11px] text-[#68756C] leading-relaxed">
                  {isTr ? (
                    <>
                      Kişisel verileriniz,{" "}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setActiveModal("privacy");
                        }}
                        className="font-medium text-primary underline hover:text-forest transition-colors cursor-pointer"
                      >
                        Gizlilik Politikası
                      </button>{" "}
                      ve{" "}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setActiveModal("kvkk");
                        }}
                        className="font-medium text-primary underline hover:text-forest transition-colors cursor-pointer"
                      >
                        KVKK Aydınlatma Metni
                      </button>{" "}
                      kapsamında işlenmektedir.
                    </>
                  ) : (
                    <>
                      Your personal data is processed in accordance with the{" "}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setActiveModal("privacy");
                        }}
                        className="font-medium text-primary underline hover:text-forest transition-colors cursor-pointer"
                      >
                        Privacy Policy
                      </button>{" "}
                      and{" "}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setActiveModal("kvkk");
                        }}
                        className="font-medium text-primary underline hover:text-forest transition-colors cursor-pointer"
                      >
                        Personal Data / KVKK Notice
                      </button>
                      .
                    </>
                  )}
                </div>
              </div>

              {/* METHOD-SPECIFIC PANELS */}
              {method === "card" ? (
                <div className="pt-2">
                  <HostedCardPanel
                    locale={locale}
                    packageId={selectedPackage?.id ?? ""}
                    couponCode={appliedCoupon?.code}
                    payerName={payerName}
                    payerPhone={payerPhone}
                    termsAccepted={termsAccepted}
                    refundPolicyAccepted={refundPolicyAccepted}
                  />
                </div>
              ) : (
                <div className="pt-2 space-y-6">
                  <BankTransferPanel locale={locale} details={bankDetails} />

                  <div className="mt-4">
                    <TurnstileWidget
                      ref={turnstileRef}
                      action="payment_create"
                      locale={locale}
                      onVerify={onVerify}
                      onExpire={onTurnstileReset}
                      onError={onTurnstileReset}
                    />
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800"
                    >
                      <AlertCircle className="size-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={
                      !selectedPackage ||
                      !termsAccepted ||
                      !refundPolicyAccepted ||
                      !turnstileToken ||
                      submitting ||
                      !bankDetails ||
                      !payerName.trim() ||
                      !payerEmail.trim()
                    }
                    className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-forest disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {locale === "tr" ? "İşleniyor…" : "Processing…"}
                      </>
                    ) : (
                      <>
                        <LockKeyhole className="size-4" />
                        {locale === "tr" ? "Havale Bildirimi Oluştur" : "Create Bank Transfer Order"}
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Checkout Legal Modal Dialog */}
      {activeModal && (
        <LegalModal
          isOpen={Boolean(activeModal)}
          onClose={() => setActiveModal(null)}
          docKey={activeModal}
          locale={locale}
          orderSnapshot={orderSnapshot}
        />
      )}
    </section>
  );
}
