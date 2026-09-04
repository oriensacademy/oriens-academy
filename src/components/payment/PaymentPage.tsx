"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole, Tag, X } from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { getPaymentCopy } from "@/content/payment";
import { getPublicPricingPackages, type PublicPricingPackage } from "@/lib/admin/pricing";
import { validateCoupon } from "@/lib/coupons/client";
import type { CouponValidationSuccess } from "@/lib/coupons/types";
import { localizedPath, unifiedLoginPath } from "@/lib/routes";
import { formatCurrency } from "@/lib/format/currency";
import { useAccount } from "@/lib/auth/account-context";
import { useCart } from "@/lib/cart/cart-context";
import { usePublicSettings } from "@/lib/settings/public-settings-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { validateStudentPhone } from "@/lib/student/auth";
import type { Tables } from "@/types/database.types";
import { AccountWaveLoader } from "@/components/auth/AccountWaveLoader";
import { ButtonLink } from "@/components/ui/button";
import { HostedCardPanel } from "./HostedCardPanel";
import { LegalModal, type LegalOrderSnapshot } from "@/components/legal/LegalModal";
import type { LegalDocKey } from "@/config/legal";

type Guardian = Tables<"guardian_accounts">;
type Learner = Tables<"student_profiles">;
type GuardianLink = Tables<"guardian_students">;

export function PaymentPage() {
  const locale = useLocale();
  const isTr = locale === "tr";
  const copy = getPaymentCopy(locale);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accountType, user, isInitializing, refreshAccount } = useAccount();
  const { items: cartItems, isHydrated: cartHydrated } = useCart();
  const { showPricing, loading: settingsLoading } = usePublicSettings();
  const [packages, setPackages] = useState<PublicPricingPackage[]>([]);
  const [directPackageId, setDirectPackageId] = useState("");
  const [dataLoading, setDataLoading] = useState(true);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [links, setLinks] = useState<GuardianLink[]>([]);
  const [guardianId, setGuardianId] = useState("");
  const [learnerId, setLearnerId] = useState("");
  const [activeModal, setActiveModal] = useState<LegalDocKey | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationSuccess | null>(null);

  // Transient checkout-only 3D Secure phone (never persisted to a profile)
  const [paymentPhone, setPaymentPhone] = useState("");

  const initializedForUserRef = useRef("");

  // Reactive Cart Mode determination (compatible with static export)
  const sourceParam = searchParams.get("source");
  const packageParam = searchParams.get("package");
  const isDirectPackageMode = Boolean(packageParam) && sourceParam !== "cart";
  const isCartCheckout = sourceParam === "cart" || (!isDirectPackageMode && cartItems.length > 0);

  const refreshGuardianData = useCallback(async () => {
    if (!user?.id) return;
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("guardian_accounts").select("*").eq("user_id", user.id).maybeSingle();
    if (data) {
      setGuardians((prev) => {
        const exists = prev.some((g) => g.user_id === data.user_id);
        return exists ? prev.map((g) => (g.user_id === data.user_id ? data : g)) : [...prev, data];
      });
      if (!guardianId) {
        setGuardianId(data.user_id);
      }
    }
  }, [user, guardianId]);

  useEffect(() => {
    if (isInitializing) return;
    if (accountType !== "student" && accountType !== "admin") {
      const search = new URLSearchParams(window.location.search);
      if (isCartCheckout || sourceParam === "cart" || (!isDirectPackageMode && cartItems.length > 0)) {
        search.set("source", "cart");
      }
      const qs = search.toString();
      const next = `${localizedPath("payment", locale)}${qs ? `?${qs}` : ""}`;
      router.replace(`${unifiedLoginPath(locale)}?next=${encodeURIComponent(next)}&source=checkout`);
    }
  }, [accountType, isInitializing, locale, router, isCartCheckout, sourceParam, isDirectPackageMode, cartItems.length]);

  useEffect(() => {
    if ((accountType !== "student" && accountType !== "admin") || !user?.id) return;
    if (initializedForUserRef.current === user.id) return;
    initializedForUserRef.current = user.id;
    const supabase = getSupabaseClient();
    const requested = packageParam ?? "";
    void Promise.all([
      getPublicPricingPackages(),
      supabase.from("guardian_accounts").select("*").eq("active", true),
      supabase.from("guardian_students").select("*").eq("active", true),
    ]).then(async ([packageRows, guardianResult, linkResult]) => {
      const purchasable = packageRows.filter((row) => row.purchase_mode === "purchasable" && row.active);
      const guardianRows = guardianResult.data ?? [];
      const linkRows = linkResult.data ?? [];
      const ids = [...new Set(linkRows.map((row) => row.student_id))];
      const learnerResult = ids.length ? await supabase.from("student_profiles").select("*").in("id", ids).eq("active", true) : { data: [] as Learner[] };
      setPackages(purchasable);
      setDirectPackageId(purchasable.some((row) => row.id === requested) ? requested : purchasable[0]?.id ?? "");
      setGuardians(guardianRows);
      setLinks(linkRows);
      setLearners(learnerResult.data ?? []);
      if (accountType === "student") {
        const ownGuardian = guardianRows.find((row) => row.user_id === user.id);
        setGuardianId(ownGuardian?.user_id ?? "");
        const ownLinks = linkRows.filter((row) => row.guardian_user_id === user.id);
        const saved = localStorage.getItem("oriens.selectedLearnerId");
        setLearnerId(ownLinks.some((row) => row.student_id === saved) ? saved! : ownLinks.find((row) => row.is_primary)?.student_id ?? ownLinks[0]?.student_id ?? "");
      }
      setDataLoading(false);
    });
  }, [accountType, user?.id, packageParam]);

  // Listen to window focus & visibilitychange to refresh guardian state if verified in another tab/device
  useEffect(() => {
    const handleCheck = () => {
      if (document.visibilityState === "visible") {
        void refreshGuardianData();
        void refreshAccount();
      }
    };
    window.addEventListener("focus", handleCheck);
    document.addEventListener("visibilitychange", handleCheck);
    return () => {
      window.removeEventListener("focus", handleCheck);
      document.removeEventListener("visibilitychange", handleCheck);
    };
  }, [refreshGuardianData, refreshAccount]);

  const selectedGuardian = guardians.find((item) => item.user_id === guardianId) ?? null;

  const availableLearners = useMemo(() => {
    const allowed = new Set(links.filter((row) => row.guardian_user_id === guardianId).map((row) => row.student_id));
    return learners.filter((row) => allowed.has(row.id));
  }, [guardianId, learners, links]);
  const selectedLearner = availableLearners.find((item) => item.id === learnerId) ?? null;
  const checkoutPackages = useMemo(() => isCartCheckout
    ? cartItems.map((item) => packages.find((pkg) => pkg.id === item.packageId)).filter((pkg): pkg is PublicPricingPackage => Boolean(pkg))
    : packages.filter((pkg) => pkg.id === directPackageId), [cartItems, directPackageId, isCartCheckout, packages]);
  const packageIds = useMemo(() => checkoutPackages.map((pkg) => pkg.id), [checkoutPackages]);
  const cartMismatch = isCartCheckout && checkoutPackages.length !== cartItems.length;
  const basePrice = checkoutPackages.reduce((sum, pkg) => sum + Number(pkg.current_total ?? pkg.price_amount ?? 0), 0);
  const discountAmount = Number(appliedCoupon?.discount_amount ?? 0);
  const finalPrice = Math.max(0, basePrice - discountAmount);
  const currency = checkoutPackages[0]?.currency || "TRY";
  const money = (value: number, code = "TRY") => formatCurrency(value, { currency: code, locale });
  const emailVerified = accountType === "admin" || Boolean(selectedGuardian?.email_verified_at);
  const phoneCheck = validateStudentPhone(paymentPhone, isTr);
  const isPhoneValid = paymentPhone.trim().length > 0 && phoneCheck.valid;
  const contextReady = Boolean(selectedGuardian && selectedLearner && emailVerified && packageIds.length && !cartMismatch && isPhoneValid);

  async function applyCoupon() {
    if (!couponInput.trim() || !packageIds.length) return;
    for (const packageId of packageIds) {
      const result = await validateCoupon(couponInput, packageId, learnerId || undefined);
      if (result.valid) { setAppliedCoupon(result); setCouponError(""); return; }
    }
    setAppliedCoupon(null);
    setCouponError(isTr ? "Kupon kodu geçersiz veya bu sipariş için kullanılamıyor." : "The coupon is invalid or cannot be used for this order.");
  }

  const orderSnapshot: LegalOrderSnapshot = {
    packageName: checkoutPackages.map((pkg) => (isTr ? pkg.name_tr : pkg.name_en) || pkg.id).join(", ") || (isTr ? "Eğitim Paketi" : "Lesson Package"),
    lessonCount: checkoutPackages.reduce((sum, pkg) => sum + (pkg.lesson_count || 0), 0), baseAmount: basePrice,
    discountAmount: discountAmount || undefined, couponCode: appliedCoupon?.code, finalAmount: finalPrice, currency,
    payerName: selectedGuardian?.full_name, payerEmail: selectedGuardian?.email, paymentMethod: "card",
  };

  if (isInitializing || settingsLoading || dataLoading || (accountType !== "student" && accountType !== "admin")) return <AccountWaveLoader />;
  if (!showPricing && accountType !== "admin") return <section className="pt-32 pb-24"><div className="mx-auto max-w-xl px-6 text-center"><h1 className="font-heading text-3xl text-ink">{isTr ? "Ödeme Sistemi Geçici Olarak Kapalı" : "Payment System Temporarily Unavailable"}</h1><ButtonLink href={localizedPath("home", locale)} className="mt-8">{isTr ? "Ana Sayfa" : "Home"}</ButtonLink></div></section>;

  // Extra bottom padding below `lg` clears the fixed mobile contact dock
  // (SocialLinks, bottom-6 right-6, ~88px tall) so it never sits on top of
  // the payment phone / Ödemeye Geç area when scrolled to the bottom.
  return <section className="pt-24 pb-32 md:pt-32 md:pb-28 lg:pb-20"><div className="mx-auto max-w-[1120px] px-4 sm:px-6">
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary"><LockKeyhole className="size-3.5" />{isTr ? "Güvenli Ödeme" : "Secure Checkout"}</div>
    <h1 className="mt-4 font-heading text-3xl font-bold text-ink sm:text-4xl">{copy.title}</h1>
    {/* Explicit grid-cols-1 (minmax(0,1fr) track) instead of relying on the
        implicit auto-sized single-column default -- see the matching fix and
        comment in StudentPortal.tsx for why this is load-bearing on mobile. */}
    <div className="mt-9 grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
      <aside className="rounded-3xl border border-border bg-surface p-6 shadow-editorial">
        <h2 className="font-heading text-xl text-ink">{isTr ? "Sipariş Özeti" : "Order Summary"}</h2>
        
        {/* Only show package select if not cart checkout AND direct package is not yet chosen */}
        {!isCartCheckout && !directPackageId && !checkoutPackages.length ? (
          <label className="mt-5 block text-xs font-semibold text-ink">
            {isTr ? "Eğitim Paketi" : "Package"}
            <select
              value={directPackageId}
              onChange={(event) => { setDirectPackageId(event.target.value); setAppliedCoupon(null); }}
              className="mt-2 min-h-12 w-full rounded-xl border border-input bg-surface px-3"
            >
              <option value="">{isTr ? "Paket seçin" : "Select package"}</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {isTr ? pkg.name_tr : pkg.name_en} — {money(Number(pkg.current_total ?? pkg.price_amount), pkg.currency)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="mt-5 space-y-3">
          {checkoutPackages.map((pkg) => {
            const regularTotal = Number(pkg.old_total ?? pkg.price_amount ?? 0);
            const currentTotal = Number(pkg.current_total ?? pkg.price_amount ?? 0);
            const hasDiscount = regularTotal > currentTotal;
            const discountPct = pkg.discount_percentage || (hasDiscount ? Math.round(((regularTotal - currentTotal) / regularTotal) * 100) : 0);

            return (
              <div key={pkg.id} className="rounded-2xl border border-border bg-surface-muted p-3.5 text-xs space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink text-sm">{isTr ? pkg.name_tr : pkg.name_en}</h3>
                    {pkg.lesson_count ? (
                      <span className="text-[11px] text-muted-foreground">
                        {pkg.lesson_count} {isTr ? "Ders" : "Lessons"}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-right">
                    {hasDiscount && (
                      <span className="block text-[11px] text-muted-foreground line-through">
                        {money(regularTotal, pkg.currency)}
                      </span>
                    )}
                    <span className="text-sm font-bold text-ink">
                      {money(currentTotal, pkg.currency)}
                    </span>
                  </div>
                </div>

                {hasDiscount && discountPct > 0 && (
                  <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      %{discountPct} {isTr ? "İndirim" : "Discount"}
                    </span>
                    <span className="text-[11px] text-emerald-800 font-medium">
                      {money(regularTotal - currentTotal, pkg.currency)} {isTr ? "avantaj" : "savings"}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {cartMismatch || (isCartCheckout && cartHydrated && !cartItems.length) || (!isCartCheckout && !checkoutPackages.length) ? (
          <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {isCartCheckout && !cartItems.length
              ? (isTr ? "Sepetiniz boş. Paket seçmek için eğitim paketlerimize göz atabilirsiniz." : "Your cart is empty. You can browse our pricing packages to add items.")
              : (isTr ? "Paket seçimi bulunamadı. Lütfen bir paket seçiniz." : "No package found. Please select a package.")}
          </p>
        ) : null}

        <div className="mt-5 rounded-2xl bg-surface-muted p-4 text-sm space-y-2">
          {checkoutPackages.some((pkg) => Number(pkg.old_total ?? 0) > Number(pkg.current_total ?? 0)) && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{isTr ? "Paket Liste Fiyatı" : "Package Regular Price"}</span>
              <span className="line-through">
                {money(
                  checkoutPackages.reduce((sum, pkg) => sum + Number(pkg.old_total ?? pkg.price_amount ?? 0), 0),
                  currency
                )}
              </span>
            </div>
          )}
          <div className="flex justify-between font-medium">
            <span>{isTr ? "Ara Toplam" : "Subtotal"}</span>
            <span>{money(basePrice, currency)}</span>
          </div>
          {appliedCoupon ? (
            <div className="flex justify-between text-emerald-800 text-xs font-semibold">
              <span>{isTr ? `Kupon İndirimi (${appliedCoupon.code})` : `Coupon Discount (${appliedCoupon.code})`}</span>
              <span>-{money(discountAmount, currency)}</span>
            </div>
          ) : null}
          <div className="pt-2 border-t border-border/80 flex justify-between text-base">
            <span className="font-bold text-ink">{isTr ? "Ödenecek Tutar" : "Total Amount"}</span>
            <strong className="text-primary font-bold">{money(finalPrice, currency)}</strong>
          </div>
        </div>

        <form className="mt-5 flex gap-2" onSubmit={(event) => { event.preventDefault(); void applyCoupon(); }}>
          <input value={couponInput} onChange={(event) => { setCouponInput(event.target.value.toUpperCase()); if (appliedCoupon) setAppliedCoupon(null); }} className="min-h-11 min-w-0 flex-1 rounded-xl border border-input px-3 text-xs uppercase" placeholder={isTr ? "Kupon kodu" : "Coupon code"} />
          {appliedCoupon ? <button type="button" aria-label={isTr ? "Kuponu kaldır" : "Remove coupon"} onClick={() => { setAppliedCoupon(null); setCouponInput(""); }} className="rounded-xl border px-3"><X className="size-4" /></button> : <button type="submit" className="rounded-xl bg-ink px-4 text-xs font-semibold text-white"><Tag className="mr-1 inline size-3" />{isTr ? "Uygula" : "Apply"}</button>}
        </form>
        {couponError ? <p role="alert" className="mt-2 text-xs text-red-700">{couponError}</p> : null}
      </aside>
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-editorial sm:p-8"><h2 className="font-heading text-2xl text-ink">{isTr ? "Kart ile Ödeme" : "Pay by Card"}</h2>
        {accountType === "admin" ? <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-900">{isTr ? "Yönetici işlemi için hesap sahibi ve öğrenci bağlamını seçin." : "Select the account holder and learner for this admin-assisted payment."}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><select value={guardianId} onChange={(event) => { setGuardianId(event.target.value); setLearnerId(""); }} className="min-h-11 rounded-xl border bg-white px-3 text-xs"><option value="">{isTr ? "Hesap sahibi seçin" : "Select account holder"}</option>{guardians.map((item) => <option key={item.user_id} value={item.user_id}>{item.full_name} — {item.email}</option>)}</select><select value={learnerId} onChange={(event) => setLearnerId(event.target.value)} disabled={!guardianId} className="min-h-11 rounded-xl border bg-white px-3 text-xs disabled:opacity-50"><option value="">{isTr ? "Öğrenci seçin" : "Select learner"}</option>{availableLearners.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></div></div> : null}
        <div className="mt-6 border-t border-border pt-6"><h3 className="text-sm font-semibold text-ink">{isTr ? "İletişim Bilgileri" : "Contact Information"}</h3><dl className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border bg-surface-muted p-3"><dt className="text-[10px] text-muted-foreground">{isTr ? "Ad Soyad" : "Full Name"}</dt><dd className="mt-1 text-xs font-semibold">{selectedGuardian?.full_name || "—"}</dd></div><div className="rounded-xl border bg-surface-muted p-3"><dt className="text-[10px] text-muted-foreground">{isTr ? "E-posta" : "Email"}</dt><dd className="mt-1 break-all text-xs font-semibold">{selectedGuardian?.email || "—"}</dd></div></dl></div>
        
        {!emailVerified ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
            <p className="text-xs font-bold text-amber-900 tracking-wider uppercase">
              {isTr ? "E-posta Doğrulaması Gereklidir" : "Email Verification Required"}
            </p>
            <p className="mt-1.5 text-xs text-amber-800">
              {isTr
                ? "Ödeme yapabilmek için önce hesabınızdan e-posta adresinizi doğrulayınız."
                : "Please verify your email address from your account before making a payment."}
            </p>
            <ButtonLink href={localizedPath("studentAccount", locale)} className="mt-3.5">
              {isTr ? "Hesabıma Git" : "Go to My Account"}
            </ButtonLink>
          </div>
        ) : (
          <div className="mt-6">
            <label className="block text-xs font-semibold text-ink" htmlFor="payment-phone">
              {isTr ? "Ödeme Telefonu" : "Payment Phone"}
              <input
                id="payment-phone"
                type="tel"
                required
                autoComplete="tel"
                value={paymentPhone}
                onChange={(event) => setPaymentPhone(event.target.value)}
                placeholder={isTr ? "+90 5xx xxx xx xx" : "+1 xxx xxx xxxx"}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {isTr
                ? "PayTR ödeme işlemi için gereklidir. 3D Secure doğrulaması bankanız tarafından, bankanızda kayıtlı iletişim kanalına gönderilir."
                : "Required for the PayTR payment. Your bank sends 3D Secure verification to the contact channel registered with the bank."}
            </p>
            {paymentPhone.trim() && !isPhoneValid ? (
              <p role="alert" className="mt-1.5 text-xs text-red-700">{phoneCheck.error}</p>
            ) : null}
          </div>
        )}

        <div className="mt-6">
          <HostedCardPanel
            locale={locale}
            packageIds={packageIds}
            couponCode={appliedCoupon?.code}
            learnerId={learnerId}
            guardianUserId={accountType === "admin" ? guardianId : undefined}
            paymentPhone={phoneCheck.normalized}
            contextReady={contextReady}
            emailVerified={emailVerified}
            onOpenLegalDoc={setActiveModal}
          />
        </div>
      </div>
    </div>
  </div>{activeModal ? <LegalModal isOpen onClose={() => setActiveModal(null)} docKey={activeModal} locale={locale} orderSnapshot={orderSnapshot} /> : null}</section>;
}
