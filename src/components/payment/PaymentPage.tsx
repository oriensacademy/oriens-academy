"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LockKeyhole, ShieldCheck, Tag, X } from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { getPaymentCopy } from "@/content/payment";
import { getPublicPricingPackages, type PublicPricingPackage } from "@/lib/admin/pricing";
import { validateCoupon } from "@/lib/coupons/client";
import type { CouponValidationSuccess } from "@/lib/coupons/types";
import { localizedPath, unifiedLoginPath } from "@/lib/routes";
import { formatCurrency } from "@/lib/format/currency";
import { useAccount } from "@/lib/auth/account-context";
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
type Link = Tables<"guardian_students">;

export function PaymentPage() {
  const locale = useLocale();
  const isTr = locale === "tr";
  const copy = getPaymentCopy(locale);
  const router = useRouter();
  const { accountType, user, isInitializing } = useAccount();
  const { showPricing, loading: settingsLoading } = usePublicSettings();
  const [packages, setPackages] = useState<PublicPricingPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [guardianId, setGuardianId] = useState("");
  const [learnerId, setLearnerId] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [refundPolicyAccepted, setRefundPolicyAccepted] = useState(false);
  const [activeModal, setActiveModal] = useState<LegalDocKey | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationSuccess | null>(null);
  const [paymentAddress, setPaymentAddress] = useState("");
  const [addressTouched, setAddressTouched] = useState(false);

  useEffect(() => {
    if (isInitializing) return;
    if (accountType !== "student" && accountType !== "admin") {
      const next = `${localizedPath("payment", locale)}${window.location.search}`;
      router.replace(`${unifiedLoginPath(locale)}?next=${encodeURIComponent(next)}&source=checkout`);
    }
  }, [accountType, isInitializing, locale, router]);

  useEffect(() => {
    if (accountType !== "student" && accountType !== "admin") return;
    const supabase = getSupabaseClient();
    const requested = new URLSearchParams(window.location.search).get("package") ?? "";
    Promise.all([
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
      setSelectedPackageId(purchasable.some((row) => row.id === requested) ? requested : purchasable[0]?.id ?? "");
      setGuardians(guardianRows);
      setLinks(linkRows);
      setLearners(learnerResult.data ?? []);

      if (accountType === "student" && user) {
        const ownGuardian = guardianRows.find((row) => row.user_id === user.id);
        setGuardianId(ownGuardian?.user_id ?? "");
        setPaymentAddress(ownGuardian?.contact_address ?? "");
        const ownLinks = linkRows.filter((row) => row.guardian_user_id === user.id);
        const saved = localStorage.getItem("oriens.selectedLearnerId");
        const selected = ownLinks.some((row) => row.student_id === saved) ? saved! : ownLinks.find((row) => row.is_primary)?.student_id ?? ownLinks[0]?.student_id ?? "";
        setLearnerId(selected);
      }
    });
  }, [accountType, user]);

  const selectedPackage = packages.find((item) => item.id === selectedPackageId) ?? null;
  const selectedGuardian = guardians.find((item) => item.user_id === guardianId) ?? null;
  const availableLearners = useMemo(() => {
    const allowed = new Set(links.filter((row) => row.guardian_user_id === guardianId).map((row) => row.student_id));
    return learners.filter((row) => allowed.has(row.id));
  }, [guardianId, learners, links]);
  const selectedLearner = learners.find((item) => item.id === learnerId) ?? null;
  const basePrice = Number(selectedPackage?.current_total ?? selectedPackage?.price_amount ?? 0);
  const discountAmount = appliedCoupon?.discount_amount ?? 0;
  const finalPrice = Math.max(0, basePrice - discountAmount);
  const money = (value: number, currency = "TRY") => formatCurrency(value, { currency, locale });
  const contextReady = Boolean(selectedGuardian && selectedLearner && selectedGuardian.email_verified_at);
  const normalizedPaymentAddress = paymentAddress.trim().replace(/\s+/g, " ");
  const paymentAddressValid = normalizedPaymentAddress.length >= 10 && normalizedPaymentAddress.length <= 300;

  const orderSnapshot: LegalOrderSnapshot = {
    packageName: (isTr ? selectedPackage?.name_tr : selectedPackage?.name_en) || selectedPackage?.id || "Eğitim Paketi",
    lessonCount: selectedPackage?.lesson_count || 1,
    baseAmount: basePrice,
    discountAmount: discountAmount || undefined,
    couponCode: appliedCoupon?.code,
    finalAmount: finalPrice,
    currency: selectedPackage?.currency || "TRY",
    payerName: selectedGuardian?.full_name,
    payerEmail: selectedGuardian?.email,
    paymentMethod: "card",
  };

  if (isInitializing || settingsLoading || (accountType !== "student" && accountType !== "admin")) return <AccountWaveLoader />;
  if (!showPricing && accountType !== "admin") {
    return <section className="pt-32 pb-24"><div className="mx-auto max-w-xl px-6 text-center"><h1 className="font-heading text-3xl text-ink">{isTr ? "Ödeme Sistemi Geçici Olarak Kapalı" : "Payment System Temporarily Unavailable"}</h1><ButtonLink href={localizedPath("home", locale)} className="mt-8">{isTr ? "Ana Sayfa" : "Home"}</ButtonLink></div></section>;
  }

  return (
    <section className="pt-24 pb-20 md:pt-32 md:pb-28">
      <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary"><LockKeyhole className="size-3.5" />{isTr ? "256-Bit SSL Güvenli Ödeme" : "256-Bit SSL Secure Checkout"}</div>
        <h1 className="mt-4 font-heading text-3xl font-bold text-ink sm:text-4xl">{copy.title}</h1>
        <div className="mt-9 grid gap-8 lg:grid-cols-[380px_1fr]">
          <aside className="rounded-3xl border border-border bg-surface p-6 shadow-editorial">
            <h2 className="font-heading text-xl text-ink">{isTr ? "Sipariş Özeti" : "Order Summary"}</h2>
            <label className="mt-5 block text-xs font-semibold text-ink">{isTr ? "Eğitim Paketi" : "Package"}<select value={selectedPackageId} onChange={(event) => { setSelectedPackageId(event.target.value); setAppliedCoupon(null); }} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-surface px-3"><option value="">{isTr ? "Paket seçin" : "Select package"}</option>{packages.map((item) => <option key={item.id} value={item.id}>{isTr ? item.name_tr : item.name_en} — {money(Number(item.current_total ?? item.price_amount), item.currency)}</option>)}</select></label>
            <div className="mt-5 rounded-2xl bg-surface-muted p-4 text-sm"><div className="flex justify-between"><span>{isTr ? "Toplam" : "Total"}</span><strong>{money(finalPrice, selectedPackage?.currency)}</strong></div>{appliedCoupon ? <div className="mt-2 flex justify-between text-emerald-800"><span>{appliedCoupon.code}</span><span>-{money(discountAmount, selectedPackage?.currency)}</span></div> : null}</div>
            <form className="mt-5 flex gap-2" onSubmit={async (event) => { event.preventDefault(); if (!selectedPackage || !couponInput.trim()) return; const result = await validateCoupon(couponInput, selectedPackage.id, learnerId || undefined); if (result.valid) { setAppliedCoupon(result); setCouponError(""); } else { setAppliedCoupon(null); setCouponError(isTr ? "Kupon kodu geçersiz veya bu paket için kullanılamıyor." : "The coupon is invalid for this package."); } }}>
              <input value={couponInput} onChange={(event) => setCouponInput(event.target.value.toUpperCase())} className="min-h-11 min-w-0 flex-1 rounded-xl border border-input px-3 text-xs uppercase" placeholder={isTr ? "Kupon kodu" : "Coupon code"} />
              {appliedCoupon ? <button type="button" aria-label={isTr ? "Kuponu kaldır" : "Remove coupon"} onClick={() => { setAppliedCoupon(null); setCouponInput(""); }} className="rounded-xl border px-3"><X className="size-4" /></button> : <button type="submit" className="rounded-xl bg-ink px-4 text-xs font-semibold text-white"><Tag className="mr-1 inline size-3" />{isTr ? "Uygula" : "Apply"}</button>}
            </form>
            {couponError ? <p role="alert" className="mt-2 text-xs text-red-700">{couponError}</p> : null}
          </aside>

          <div className="rounded-3xl border border-border bg-surface p-6 shadow-editorial sm:p-8">
            <h2 className="font-heading text-2xl text-ink">{isTr ? "Kart ile Ödeme" : "Pay by Card"}</h2>
            <p className="mt-2 text-xs text-muted-foreground">{isTr ? "Kart bilgileri yalnızca PayTR iframe içinde işlenir; Oriens Academy PAN/CVV bilgisi görmez veya saklamaz." : "Card details are processed only inside the PayTR iframe; Oriens Academy never sees or stores PAN/CVV data."}</p>

            {accountType === "admin" ? <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-900">{isTr ? "Yönetici işlemi için müşteri ve öğrenci bağlamını açıkça seçin. Yönetici hesabı ödeme sahibi olamaz." : "Explicitly select a customer and learner. The admin account cannot become the payer or package owner."}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><select value={guardianId} onChange={(event) => { const nextId=event.target.value; setGuardianId(nextId); setLearnerId(""); setPaymentAddress(guardians.find((item) => item.user_id === nextId)?.contact_address ?? ""); setAddressTouched(false); }} className="min-h-11 rounded-xl border bg-white px-3 text-xs"><option value="">{isTr ? "Veli seçin" : "Select guardian"}</option>{guardians.map((item) => <option key={item.user_id} value={item.user_id}>{item.full_name} — {item.email}</option>)}</select><select value={learnerId} onChange={(event) => setLearnerId(event.target.value)} disabled={!guardianId} className="min-h-11 rounded-xl border bg-white px-3 text-xs disabled:opacity-50"><option value="">{isTr ? "Öğrenci seçin" : "Select learner"}</option>{availableLearners.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></div></div> : null}

            {accountType === "student" && availableLearners.length > 1 ? <label className="mt-6 block text-xs font-semibold text-ink">{isTr ? "Paket sahibi öğrenci" : "Learner receiving the package"}<select value={learnerId} onChange={(event) => { setLearnerId(event.target.value); localStorage.setItem("oriens.selectedLearnerId", event.target.value); }} className="mt-2 min-h-11 w-full rounded-xl border border-input px-3">{availableLearners.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label> : null}

            <div className="mt-6 border-t border-border pt-6"><h3 className="text-sm font-semibold text-ink">{isTr ? "İletişim Bilgileri" : "Contact Information"}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border bg-surface-muted p-3"><span className="block text-[10px] text-muted-foreground">{isTr ? "Veli / Ödeyen" : "Guardian / Payer"}</span><strong className="text-xs">{selectedGuardian?.full_name || "—"}</strong></div><div className="rounded-xl border bg-surface-muted p-3"><span className="block text-[10px] text-muted-foreground">{isTr ? "Doğrulanmış e-posta" : "Verified email"}</span><strong className="text-xs">{selectedGuardian?.email || "—"}</strong>{selectedGuardian?.email_verified_at ? <Check className="ml-1 inline size-3 text-emerald-700" /> : null}</div><div className="rounded-xl border bg-surface-muted p-3 sm:col-span-2"><span className="block text-[10px] text-muted-foreground">{isTr ? "Paket sahibi öğrenci" : "Package owner learner"}</span><strong className="text-xs">{selectedLearner?.full_name || "—"}</strong></div></div></div>

            <label className="mt-6 block text-xs font-semibold text-ink" htmlFor="checkout-billing-address">
              {copy.billingAddress}
              <textarea
                id="checkout-billing-address"
                required
                minLength={10}
                maxLength={300}
                autoComplete="street-address"
                value={paymentAddress}
                onBlur={() => setAddressTouched(true)}
                onChange={(event) => setPaymentAddress(event.target.value)}
                aria-describedby="checkout-billing-address-hint checkout-billing-address-error"
                aria-invalid={addressTouched && !paymentAddressValid}
                className="mt-2 min-h-24 w-full resize-y rounded-xl border border-input bg-surface p-3 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <span id="checkout-billing-address-hint" className="mt-1.5 block text-[11px] font-normal leading-relaxed text-muted-foreground">{copy.billingAddressHint}</span>
              {addressTouched && !paymentAddressValid ? <span id="checkout-billing-address-error" role="alert" className="mt-1 block text-[11px] font-medium text-red-700">{copy.billingAddressError}</span> : null}
            </label>

            {!contextReady ? <div role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{accountType === "admin" ? (isTr ? "Ödeme için doğrulanmış hesap sahibi ve bağlı öğrenci seçilmelidir." : "Select a verified account holder and linked learner before payment.") : (isTr ? "Doğrulanmış hesap veya öğrenci bağlantısı bulunamadı. Profilinizi tamamlayın." : "A verified account or learner link is missing. Complete your profile.")}</div> : null}

            <div className="mt-6 space-y-3 rounded-2xl border bg-[#F9FAF8] p-4 text-xs"><label className="flex gap-3"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-0.5 size-4 accent-primary" /><span><button type="button" onClick={() => setActiveModal("preInformation")} className="font-semibold text-primary underline">{isTr ? "Ön Bilgilendirme Formu" : "Pre-Information Form"}</button>{isTr ? " ve " : " and "}<button type="button" onClick={() => setActiveModal("salesAgreement")} className="font-semibold text-primary underline">{isTr ? "Mesafeli Satış Sözleşmesi" : "Distance Sales Agreement"}</button>{isTr ? " metinlerini kabul ediyorum." : "."}</span></label><label className="flex gap-3"><input type="checkbox" checked={refundPolicyAccepted} onChange={(event) => setRefundPolicyAccepted(event.target.checked)} className="mt-0.5 size-4 accent-primary" /><span><button type="button" onClick={() => setActiveModal("refundPolicy")} className="font-semibold text-primary underline">{isTr ? "İptal ve İade Koşulları" : "Cancellation & Refund Policy"}</button>{isTr ? " metnini kabul ediyorum." : "."}</span></label></div>

            <div className="mt-6"><HostedCardPanel locale={locale} packageId={selectedPackage?.id ?? ""} couponCode={appliedCoupon?.code} learnerId={learnerId} guardianUserId={accountType === "admin" ? guardianId : undefined} payerAddress={normalizedPaymentAddress} addressErrorText={copy.billingAddressError} onAddressInvalid={() => setAddressTouched(true)} contextReady={contextReady} termsAccepted={termsAccepted} refundPolicyAccepted={refundPolicyAccepted} /></div>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground"><ShieldCheck className="size-4 text-emerald-700" />{copy.secureText}</div>
          </div>
        </div>
      </div>
      {activeModal ? <LegalModal isOpen onClose={() => setActiveModal(null)} docKey={activeModal} locale={locale} orderSnapshot={orderSnapshot} /> : null}
    </section>
  );
}
