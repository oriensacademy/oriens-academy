"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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

export function PaymentPage() {
  const locale = useLocale();
  const copy = getPaymentCopy(locale);
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
  const [terms, setTerms] = useState(false);
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

  // Submit Checkout
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (
      !selectedPackage ||
      !turnstileToken ||
      !terms ||
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

  if (isInitializing || settingsLoading || (accountType !== "student" && accountType !== "admin")) {
    return <AccountWaveLoader />;
  }

  // When pricing is disabled and caller is not admin
  if (!showPricing && accountType !== "admin") {
    return (
      <section className="min-h-[70vh] bg-[#F6F8F3] pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-sage-soft text-primary shadow-xs">
            <AlertCircle className="size-8 text-[#819586]" />
          </div>
          <h1 className="mt-6 font-heading text-3xl text-[#10271B] sm:text-4xl">
            {locale === "tr" ? "Ödeme Sistemi Çevrim Dışıdır" : "Payment System is Currently Offline"}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#68756C]">
            {locale === "tr"
              ? "Yeni paket satın alma ve ödeme işlemleri şu anda çevrim dışıdır. Danışmanlık ve programlarımız hakkında bilgi almak için görüşme planlayabilirsiniz."
              : "New package purchases and payments are currently offline. You can schedule a consultation to discuss our programmes."}
          </p>
          <div className="mt-8 flex justify-center">
            <ButtonLink href={`${localizedPath("home", locale)}#consultation-form`} size="lg" className="h-12 px-6">
              {locale === "tr" ? "Görüşme Planla" : "Book a Consultation"}
              <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </section>
    );
  }

  // ORDER CONFIRMATION VIEW
  if (completedOrder) {
    const isCardPaid = completedOrder.paymentMethod === "card" && completedOrder.status === "paid";
    return (
      <section className="min-h-screen bg-background pt-28 pb-20 md:pt-36 md:pb-28">
        <div className="public-container">
          <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-editorial sm:p-10">
            <div className="text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="size-8" />
              </div>
              <h1 className="mt-4 font-heading text-3xl text-ink">
                {isCardPaid
                  ? locale === "tr"
                    ? "Ödemeniz Başarıyla Tamamlandı!"
                    : "Payment Successfully Completed!"
                  : locale === "tr"
                    ? "Siparişiniz Alındı"
                    : "Order Received"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {isCardPaid
                  ? locale === "tr"
                    ? "Eğitim paketiniz hesabınıza tanımlandı. Derslerinizi hemen planlamaya başlayabilirsiniz."
                    : "Your package is now active in your account. You may begin scheduling lessons."
                  : completedOrder.paymentMethod === "card"
                    ? locale === "tr"
                      ? "Kartlı ödeme talebiniz banka sanal POS sistemine iletilmiştir. Banka onayı tamamlandığında paketiniz aktif olacaktır."
                      : "Your card payment request has been submitted to the bank Virtual POS gateway. Your package will be activated upon bank confirmation."
                    : locale === "tr"
                      ? "Havale / EFT bildiriminiz kaydedildi. Banka transferiniz onaylandığında paketiniz otomatik olarak aktif olacaktır."
                      : "Your bank transfer request is registered. Once confirmed by our team, your package will be activated."}
              </p>
            </div>

            <div className="mt-8 space-y-4 rounded-2xl border border-border bg-surface-muted p-5 sm:p-6">
              <div className="flex items-center justify-between border-b border-border pb-3 text-sm">
                <span className="text-muted-foreground">{locale === "tr" ? "Referans Numarası" : "Reference No"}</span>
                <span className="font-mono font-bold text-ink">{completedOrder.publicReference}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-3 text-sm">
                <span className="text-muted-foreground">{locale === "tr" ? "Eğitim Paketi" : "Package"}</span>
                <span className="font-semibold text-ink">
                  {completedOrder.packageName || selectedPackage?.name_tr || selectedPackage?.name_en} (
                  {completedOrder.lessonCount || selectedPackage?.lesson_count} {locale === "tr" ? "Ders" : "Lessons"})
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-3 text-sm">
                <span className="text-muted-foreground">{locale === "tr" ? "Tutar" : "Amount"}</span>
                <span className="text-lg font-bold text-ink">
                  {money(completedOrder.finalAmount ?? finalPrice, completedOrder.currency || selectedPackage?.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{locale === "tr" ? "Ödeme Yöntemi" : "Payment Method"}</span>
                <span className="font-medium text-ink">
                  {completedOrder.paymentMethod === "bank_transfer"
                    ? locale === "tr"
                      ? "Banka Havalesi / EFT"
                      : "Bank Transfer"
                    : locale === "tr"
                      ? "Kredi / Banka Kartı (3D Secure)"
                      : "Credit / Debit Card (3D Secure)"}
                </span>
              </div>
            </div>

            {completedOrder.paymentMethod === "bank_transfer" && bankDetails && (
              <div className="mt-6 rounded-2xl border border-[#CAD5CB] bg-[#F7F9F6] p-5 sm:p-6">
                <h3 className="font-semibold text-[#10271B]">{locale === "tr" ? "Havale Yapılacak Banka Bilgileri" : "Bank Transfer Details"}</h3>
                <dl className="mt-3 space-y-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">{locale === "tr" ? "Hesap Sahibi" : "Account Holder"}</dt>
                    <dd className="font-semibold text-ink">{bankDetails.accountHolder}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{locale === "tr" ? "Banka" : "Bank"}</dt>
                    <dd className="font-semibold text-ink">{bankDetails.bankName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">IBAN</dt>
                    <dd className="break-all font-mono font-semibold text-ink">{bankDetails.iban}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(bankDetails.iban);
                      setCopiedIban(true);
                      window.setTimeout(() => setCopiedIban(false), 2000);
                    }}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-ink hover:bg-surface-muted"
                  >
                    {copiedIban ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    {copiedIban
                      ? locale === "tr"
                        ? "IBAN Kopyalandı"
                        : "IBAN Copied"
                      : locale === "tr"
                        ? "IBAN'ı Kopyala"
                        : "Copy IBAN"}
                  </button>
                </div>
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-4 text-amber-900">
                  <strong>{locale === "tr" ? "Önemli:" : "Important:"}</strong>{" "}
                  {locale === "tr"
                    ? `Havale açıklama alanına "${completedOrder.publicReference}" referans numaranızı yazmayı unutmayınız.`
                    : `Please include reference "${completedOrder.publicReference}" in your transfer description.`}
                </p>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={localizedPath("studentAccount", locale)}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-forest"
              >
                <Receipt className="size-4" />
                {locale === "tr" ? "Öğrenci Hesabıma Git" : "Go to My Account"}
              </Link>
              <Link
                href={localizedPath("pricing", locale)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border px-5 text-sm font-semibold text-ink hover:bg-surface-muted"
              >
                {locale === "tr" ? "Paketleri İncele" : "View Packages"}
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-background pt-28 pb-20 md:pt-36 md:pb-28">
      <div className="public-container">
        <div className="mx-auto max-w-6xl">
          <header className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              {locale === "tr" ? "Güvenli Ödeme & Kayıt" : "Secure Checkout & Enrollment"}
            </p>
            <h1 className="mt-3 font-heading text-[clamp(2.4rem,5vw,4.2rem)] leading-[1.05] text-ink">
              {locale === "tr" ? "Eğitim Satın Al" : "Purchase Package"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-base">
              {locale === "tr"
                ? "Seçtiğiniz eğitim paketini indirim kuponunuzu uygulayarak güvenle satın alabilirsiniz."
                : "Complete your package purchase securely with available discount codes."}
            </p>
          </header>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_1.4fr]">
            {/* LEFT COLUMN: ORDER SUMMARY */}
            <aside className="order-2 h-fit rounded-3xl border border-border bg-surface-muted p-6 sm:p-8 lg:order-1">
              <div className="flex items-center gap-2 border-b border-border pb-4">
                <Receipt className="size-5 text-primary" />
                <h2 className="font-heading text-xl text-ink">{locale === "tr" ? "Sipariş Özeti" : "Order Summary"}</h2>
              </div>

              {packages.length > 0 ? (
                <>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {locale === "tr" ? "Seçilen Paket" : "Selected Package"}
                    </span>
                    <Link
                      href={localizedPath("pricing", locale)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      {locale === "tr" ? "Paketi Değiştir" : "Change Package"}
                    </Link>
                  </div>

                  {selectedPackage && (
                    <div className="mt-6 space-y-4 rounded-2xl border border-border bg-surface p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-heading text-lg text-ink">
                            {locale === "tr" ? selectedPackage.name_tr : selectedPackage.name_en}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {selectedPackage.lesson_count} {locale === "tr" ? "Derslik Özel Birebir Eğitim" : "Private 1-on-1 Lessons"}
                          </p>
                        </div>
                        {selectedPackage.badge_tr && (
                          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                            {locale === "tr" ? selectedPackage.badge_tr : selectedPackage.badge_en}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 border-t border-border pt-4 text-sm">
                        {selectedPackage.old_total && selectedPackage.old_total > basePrice ? (
                          <>
                            <div className="flex justify-between text-muted-foreground">
                              <span>{locale === "tr" ? "Paket Tutarı / Liste Fiyatı" : "Package List Price"}</span>
                              <span>{money(selectedPackage.old_total, selectedPackage.currency)}</span>
                            </div>
                            <div className="flex justify-between font-medium text-emerald-800">
                              <span>
                                {locale === "tr"
                                  ? `Paket İndirimi (%${selectedPackage.discount_percentage || Math.round(((selectedPackage.old_total - basePrice) / selectedPackage.old_total) * 100)})`
                                  : `Package Discount (%${selectedPackage.discount_percentage || Math.round(((selectedPackage.old_total - basePrice) / selectedPackage.old_total) * 100)})`}
                              </span>
                              <span>-{money(selectedPackage.old_total - basePrice, selectedPackage.currency)}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground border-t border-border/60 pt-2">
                              <span>{locale === "tr" ? "Ara Toplam" : "Subtotal"}</span>
                              <span className="font-semibold text-ink">{money(basePrice, selectedPackage.currency)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between text-muted-foreground">
                            <span>{locale === "tr" ? "Paket Tutarı" : "Package Price"}</span>
                            <span>{money(basePrice, selectedPackage.currency)}</span>
                          </div>
                        )}

                        {appliedCoupon && (
                          <div className="flex items-center justify-between font-medium text-emerald-800">
                            <span className="flex items-center gap-1.5">
                              <Tag className="size-3.5" />
                              {locale === "tr" ? "Kupon İndirimi" : "Coupon Discount"} ({appliedCoupon.code}
                              {appliedCoupon.discount_type === "percentage"
                                ? ` · %${appliedCoupon.discount_value}`
                                : ` · -${money(appliedCoupon.discount_value, appliedCoupon.currency)}`}
                              )
                            </span>
                            <span className="font-semibold">-{money(discountAmount, selectedPackage.currency)}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between border-t border-border pt-3 font-heading text-xl text-ink">
                          <span>{locale === "tr" ? "Toplam Tutar" : "Total Amount"}</span>
                          <span className="font-bold">{money(finalPrice, selectedPackage.currency)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-4 text-sm text-muted-foreground">
                  {copy.noPackage}
                  <Link
                    href={localizedPath("pricing", locale)}
                    className="mt-3 inline-flex items-center gap-1 font-semibold text-ink underline"
                  >
                    {copy.backPricing}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              )}

              {/* COUPON INPUT INSIDE SUMMARY / CHECKOUT */}
              <div className="mt-6 border-t border-border pt-6">
                <label className="block text-xs font-semibold text-ink" htmlFor="checkout-coupon-code">
                  {locale === "tr" ? "İndirim Kuponu" : "Discount Coupon"}
                </label>
                {appliedCoupon ? (
                  <div className="mt-2 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50/80 p-3 text-xs text-emerald-900">
                    <div className="flex items-center gap-2">
                      <Tag className="size-4 text-emerald-700" />
                      <div>
                        <span className="font-bold font-mono tracking-wider">{appliedCoupon.code}</span>
                        <span className="ml-2 text-[11px] text-emerald-700">
                          ({money(appliedCoupon.discount_amount, appliedCoupon.currency)}{" "}
                          {locale === "tr" ? "indirim uygulandı" : "discount applied"})
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="rounded-lg p-1 text-emerald-800 hover:bg-emerald-100"
                      aria-label={locale === "tr" ? "Kuponu Kaldır" : "Remove Coupon"}
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
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-4 text-xs font-semibold text-white transition-colors hover:bg-forest disabled:opacity-40"
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

              <div className="mt-6 border-t border-border pt-5 text-xs text-muted-foreground space-y-2">
                <p className="flex items-center gap-1.5 font-semibold text-ink">
                  <ShieldCheck className="size-4 text-primary" />
                  {locale === "tr" ? "Güvenli İşlem Garantisi" : "Secure Transaction Guarantee"}
                </p>
                <p className="leading-relaxed">
                  {locale === "tr"
                    ? "Tüm ödeme ve sipariş işlemleri 256-bit SSL korumalıdır. Kart bilgileri sunucularımızda kesinlikle saklanmaz."
                    : "All transactions are secured with 256-bit SSL encryption. Card credentials are never stored on our servers."}
                </p>
              </div>
            </aside>

            {/* RIGHT COLUMN: PAYMENT CONTROLS */}
            <div className="order-1 lg:order-2">
              <form onSubmit={handleSubmit} className="rounded-3xl border border-border bg-surface p-6 shadow-editorial sm:p-8">
                <h2 className="font-heading text-2xl text-ink">
                  {locale === "tr" ? "Ödeme Bilgileri" : "Payment Details"}
                </h2>

                <div className="mt-5">
                  <PaymentMethodSelector locale={locale} value={method} onChange={setMethod} />
                </div>

                <div className="mt-6">
                  {method === "card" ? (
                    <HostedCardPanel
                      locale={locale}
                      packageId={selectedPackage?.id ?? ""}
                      couponCode={appliedCoupon?.code}
                      payerName={payerName}
                      payerPhone={payerPhone}
                    />
                  ) : (
                    <>
                      <BankTransferPanel locale={locale} details={bankDetails} />

                      <div className="mt-7 border-t border-border pt-6">
                        <h3 className="font-semibold text-ink text-sm">
                          {locale === "tr" ? "Fatura / İletişim Bilgileri" : "Contact & Billing Information"}
                        </h3>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <label className="text-xs font-semibold text-ink">
                            {copy.fullName}
                            <input
                              required
                              value={payerName}
                              onChange={(event) => setPayerName(event.target.value)}
                              autoComplete="name"
                              className="mt-1.5 min-h-12 w-full rounded-xl border border-input bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                            />
                          </label>
                          <label className="text-xs font-semibold text-ink">
                            {copy.email}
                            <input
                              required
                              type="email"
                              value={payerEmail}
                              onChange={(event) => setPayerEmail(event.target.value)}
                              autoComplete="email"
                              className="mt-1.5 min-h-12 w-full rounded-xl border border-input bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                            />
                          </label>
                          <label className="text-xs font-semibold text-ink sm:col-span-2">
                            {copy.phone}
                            <input
                              value={payerPhone}
                              onChange={(event) => setPayerPhone(event.target.value)}
                              autoComplete="tel"
                              className="mt-1.5 min-h-12 w-full rounded-xl border border-input bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                            />
                          </label>
                        </div>
                      </div>

                      <label className="mt-6 flex cursor-pointer items-start gap-3 text-xs leading-5 text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={terms}
                          onChange={(event) => setTerms(event.target.checked)}
                          className="mt-1 size-4 accent-[var(--primary)]"
                        />
                        <span>
                          {copy.terms}{" "}
                          <Link href={localizedPath("privacy", locale)} className="font-semibold underline">
                            {locale === "tr" ? "Gizlilik Politikası" : "Privacy Policy"}
                          </Link>{" "}
                          ve{" "}
                          <Link href={localizedPath("terms", locale)} className="font-semibold underline">
                            {locale === "tr" ? "Kullanım Koşulları" : "Terms"}
                          </Link>
                        </span>
                      </label>

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
                          !terms ||
                          !turnstileToken ||
                          submitting ||
                          !bankDetails
                        }
                        className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-forest disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer"
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
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
