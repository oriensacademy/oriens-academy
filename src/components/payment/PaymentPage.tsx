"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LockKeyhole, Tag, X } from "lucide-react";
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
  const { accountType, user, isInitializing } = useAccount();
  const { items: cartItems } = useCart();
  const { showPricing, loading: settingsLoading } = usePublicSettings();
  const [packages, setPackages] = useState<PublicPricingPackage[]>([]);
  const [directPackageId, setDirectPackageId] = useState("");
  const [isCartCheckout, setIsCartCheckout] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [links, setLinks] = useState<GuardianLink[]>([]);
  const [guardianId, setGuardianId] = useState("");
  const [learnerId, setLearnerId] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [refundPolicyAccepted, setRefundPolicyAccepted] = useState(false);
  const [activeModal, setActiveModal] = useState<LegalDocKey | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationSuccess | null>(null);
  const initializedForUserRef = useRef("");

  useEffect(() => {
    if (isInitializing) return;
    if (accountType !== "student" && accountType !== "admin") {
      const next = `${localizedPath("payment", locale)}${window.location.search}`;
      router.replace(`${unifiedLoginPath(locale)}?next=${encodeURIComponent(next)}&source=checkout`);
    }
  }, [accountType, isInitializing, locale, router]);

  useEffect(() => {
    if ((accountType !== "student" && accountType !== "admin") || !user?.id) return;
    if (initializedForUserRef.current === user.id) return;
    initializedForUserRef.current = user.id;
    const supabase = getSupabaseClient();
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("package") ?? "";
    setIsCartCheckout(params.get("source") === "cart");
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
  }, [accountType, user?.id]);

  const selectedGuardian = guardians.find((item) => item.user_id === guardianId) ?? null;
  const availableLearners = useMemo(() => {
    const allowed = new Set(links.filter((row) => row.guardian_user_id === guardianId).map((row) => row.student_id));
    return learners.filter((row) => allowed.has(row.id));
  }, [guardianId, learners, links]);
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
  const emailVerified = Boolean(selectedGuardian?.email_verified_at);
  const contextReady = Boolean(selectedGuardian && learnerId && emailVerified && packageIds.length && !cartMismatch);

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

  return <section className="pt-24 pb-20 md:pt-32 md:pb-28"><div className="mx-auto max-w-[1120px] px-4 sm:px-6">
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary"><LockKeyhole className="size-3.5" />{isTr ? "Güvenli Ödeme" : "Secure Checkout"}</div>
    <h1 className="mt-4 font-heading text-3xl font-bold text-ink sm:text-4xl">{copy.title}</h1>
    <div className="mt-9 grid gap-8 lg:grid-cols-[380px_1fr]">
      <aside className="rounded-3xl border border-border bg-surface p-6 shadow-editorial"><h2 className="font-heading text-xl text-ink">{isTr ? "Sipariş Özeti" : "Order Summary"}</h2>
        {!isCartCheckout ? <label className="mt-5 block text-xs font-semibold text-ink">{isTr ? "Eğitim Paketi" : "Package"}<select value={directPackageId} onChange={(event) => { setDirectPackageId(event.target.value); setAppliedCoupon(null); }} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-surface px-3"><option value="">{isTr ? "Paket seçin" : "Select package"}</option>{packages.map((pkg) => <option key={pkg.id} value={pkg.id}>{isTr ? pkg.name_tr : pkg.name_en} — {money(Number(pkg.current_total ?? pkg.price_amount), pkg.currency)}</option>)}</select></label> : null}
        <div className="mt-5 space-y-3">{checkoutPackages.map((pkg) => <div key={pkg.id} className="flex items-start justify-between gap-4 rounded-xl border border-border bg-surface-muted p-3 text-xs"><span className="font-semibold text-ink">{isTr ? pkg.name_tr : pkg.name_en}</span><span>{money(Number(pkg.current_total ?? pkg.price_amount), pkg.currency)}</span></div>)}</div>
        {cartMismatch || !checkoutPackages.length ? <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{isTr ? "Sepetinizdeki paketlerin tamamı doğrulanamadı. Sepete dönüp paketleri kontrol edin." : "Not every package in your cart could be verified. Return to your cart and review it."}</p> : null}
        <div className="mt-5 rounded-2xl bg-surface-muted p-4 text-sm"><div className="flex justify-between"><span>{isTr ? "Toplam" : "Total"}</span><strong>{money(finalPrice, currency)}</strong></div>{appliedCoupon ? <div className="mt-2 flex justify-between text-emerald-800"><span>{appliedCoupon.code}</span><span>-{money(discountAmount, currency)}</span></div> : null}</div>
        <form className="mt-5 flex gap-2" onSubmit={(event) => { event.preventDefault(); void applyCoupon(); }}><input value={couponInput} onChange={(event) => { setCouponInput(event.target.value.toUpperCase()); if (appliedCoupon) setAppliedCoupon(null); }} className="min-h-11 min-w-0 flex-1 rounded-xl border border-input px-3 text-xs uppercase" placeholder={isTr ? "Kupon kodu" : "Coupon code"} />{appliedCoupon ? <button type="button" aria-label={isTr ? "Kuponu kaldır" : "Remove coupon"} onClick={() => { setAppliedCoupon(null); setCouponInput(""); }} className="rounded-xl border px-3"><X className="size-4" /></button> : <button type="submit" className="rounded-xl bg-ink px-4 text-xs font-semibold text-white"><Tag className="mr-1 inline size-3" />{isTr ? "Uygula" : "Apply"}</button>}</form>
        {couponError ? <p role="alert" className="mt-2 text-xs text-red-700">{couponError}</p> : null}
      </aside>
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-editorial sm:p-8"><h2 className="font-heading text-2xl text-ink">{isTr ? "Kart ile Ödeme" : "Pay by Card"}</h2>
        {accountType === "admin" ? <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-900">{isTr ? "Yönetici işlemi için hesap sahibi ve öğrenci bağlamını seçin." : "Select the account holder and learner for this admin-assisted payment."}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><select value={guardianId} onChange={(event) => { setGuardianId(event.target.value); setLearnerId(""); }} className="min-h-11 rounded-xl border bg-white px-3 text-xs"><option value="">{isTr ? "Hesap sahibi seçin" : "Select account holder"}</option>{guardians.map((item) => <option key={item.user_id} value={item.user_id}>{item.full_name} — {item.email}</option>)}</select><select value={learnerId} onChange={(event) => setLearnerId(event.target.value)} disabled={!guardianId} className="min-h-11 rounded-xl border bg-white px-3 text-xs disabled:opacity-50"><option value="">{isTr ? "Öğrenci seçin" : "Select learner"}</option>{availableLearners.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></div></div> : null}
        <div className="mt-6 border-t border-border pt-6"><h3 className="text-sm font-semibold text-ink">{isTr ? "İletişim Bilgileri" : "Contact Information"}</h3><dl className="mt-3 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-surface-muted p-3"><dt className="text-[10px] text-muted-foreground">{isTr ? "Ad Soyad" : "Full Name"}</dt><dd className="mt-1 text-xs font-semibold">{selectedGuardian?.full_name || "—"}</dd></div><div className="rounded-xl border bg-surface-muted p-3"><dt className="text-[10px] text-muted-foreground">{isTr ? "Telefon" : "Phone"}</dt><dd className="mt-1 text-xs font-semibold">{selectedGuardian?.phone || "—"}</dd></div><div className="rounded-xl border bg-surface-muted p-3"><dt className="text-[10px] text-muted-foreground">{isTr ? "E-posta" : "Email"}</dt><dd className="mt-1 break-all text-xs font-semibold">{selectedGuardian?.email || "—"}{emailVerified ? <span className="ml-1 inline-flex items-center gap-0.5 text-emerald-700"><Check className="size-3" />{isTr ? "Doğrulandı" : "Verified"}</span> : null}</dd></div></dl></div>
        {!emailVerified ? <div role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">{isTr ? "Satın alma işlemi için e-posta adresinizi doğrulamanız gerekir." : "You must verify your email address before purchasing."}</div> : !contextReady ? <div role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{isTr ? "Ödeme için hesap bilgileriniz tamamlanmalıdır." : "Complete your account information before payment."}</div> : null}
        <div className="mt-6 space-y-3 rounded-2xl border bg-[#F9FAF8] p-4 text-xs"><label className="flex gap-3"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-0.5 size-4 accent-primary" /><span><button type="button" onClick={() => setActiveModal("preInformation")} className="font-semibold text-primary underline">{isTr ? "Ön Bilgilendirme Formu" : "Pre-Information Form"}</button>{isTr ? " ve " : " and "}<button type="button" onClick={() => setActiveModal("salesAgreement")} className="font-semibold text-primary underline">{isTr ? "Mesafeli Satış Sözleşmesi" : "Distance Sales Agreement"}</button>{isTr ? " metinlerini kabul ediyorum." : "."}</span></label><label className="flex gap-3"><input type="checkbox" checked={refundPolicyAccepted} onChange={(event) => setRefundPolicyAccepted(event.target.checked)} className="mt-0.5 size-4 accent-primary" /><span><button type="button" onClick={() => setActiveModal("refundPolicy")} className="font-semibold text-primary underline">{isTr ? "İptal ve İade Koşulları" : "Cancellation & Refund Policy"}</button>{isTr ? " metnini kabul ediyorum." : "."}</span></label></div>
        <div className="mt-6"><HostedCardPanel locale={locale} packageIds={packageIds} couponCode={appliedCoupon?.code} learnerId={learnerId} guardianUserId={accountType === "admin" ? guardianId : undefined} contextReady={contextReady} termsAccepted={termsAccepted} refundPolicyAccepted={refundPolicyAccepted} /></div>
      </div>
    </div>
  </div>{activeModal ? <LegalModal isOpen onClose={() => setActiveModal(null)} docKey={activeModal} locale={locale} orderSnapshot={orderSnapshot} /> : null}</section>;
}
