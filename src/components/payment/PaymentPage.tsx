"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Fraunces } from "next/font/google";
import { Check, ChevronDown, LockKeyhole, Mail, Tag, UserRound } from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { getPaymentCopy } from "@/content/payment";
import { getPublicPricingPackages, selectPurchasablePackages, type PublicPricingPackage } from "@/lib/admin/pricing";
import { calculateAuthoritativeTotal } from "@/lib/payments/pricing";
import { useCheckoutCoupon } from "@/lib/coupons/use-checkout-coupon";
import { localizedPath, unifiedLoginPath } from "@/lib/routes";
import { formatCurrency } from "@/lib/format/currency";
import { formatPaymentPhoneInput, isValidPaymentPhoneDigits, trPhoneInputDigits } from "@/lib/format/phone";
import { getLocalizedPackageDisplayPrice } from "@/lib/pricing/package-display";
import { packageDisplayName } from "@/lib/packages/display";
import { useAccount } from "@/lib/auth/account-context";
import { usePublicSettings } from "@/lib/settings/public-settings-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { validateStudentPhone } from "@/lib/student/auth";
import type { Tables } from "@/types/database.types";
import { AccountWaveLoader } from "@/components/auth/AccountWaveLoader";
import { EmailOtpGate } from "@/components/auth/EmailOtpGate";
import { ButtonLink } from "@/components/ui/button";
import { HostedCardPanel, type PaymentSessionResult } from "./HostedCardPanel";
import { newCartId, recordCartEvent } from "@/lib/cart/cart-audit";
import { LegalModal, type LegalOrderSnapshot } from "@/components/legal/LegalModal";
import type { LegalDocKey } from "@/config/legal";
import styles from "./payment.module.css";

type Guardian = Tables<"guardian_accounts">;
type Learner = Tables<"student_profiles">;
type GuardianLink = Tables<"guardian_students">;

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
  display: "swap",
  variable: "--pay-serif",
});

/**
 * Doğrudan paket ödemesi (sepet yok): /tr/odeme/?package=<id>.
 * Görünüm müşteri referansı oriens-odeme_8.html'in birebir uyarlamasıdır;
 * tutarlar ortak hesapla (lib/payments/pricing) üretilir ve paytr-create-token
 * aynı paket + kupon + öğrenci girdisiyle aynı toplamı hesaplar.
 */
export function PaymentPage() {
  const locale = useLocale();
  const isTr = locale === "tr";
  const copy = getPaymentCopy(locale);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accountType, user, isInitializing } = useAccount();
  const userId = user?.id;
  const { showPricing, loading: settingsLoading } = usePublicSettings();
  const [packages, setPackages] = useState<PublicPricingPackage[]>([]);
  const [directPackageId, setDirectPackageId] = useState("");
  const [dataLoading, setDataLoading] = useState(true);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [links, setLinks] = useState<GuardianLink[]>([]);
  const [guardianId, setGuardianId] = useState("");
  const [learnerId, setLearnerId] = useState("");
  const [paymentGateGuardian, setPaymentGateGuardian] = useState<Guardian | null>(null);
  const [verificationResolvedUserId, setVerificationResolvedUserId] = useState("");
  const [activeModal, setActiveModal] = useState<LegalDocKey | null>(null);

  // Transient checkout-only 3D Secure phone (never persisted to a profile).
  // TR: "+90" sabit önek + 10 hane (5XX XXX XX XX). EN: serbest uluslararası numara.
  // null = kullanıcı henüz yazmadı: hesap sahibinin kayıtlı telefonu önerilir.
  const [phoneInput, setPhoneInput] = useState<string | null>(null);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);

  // İndirim kodu: kural yalnız sunucudan (quote_checkout_coupon) gelir.
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponNote, setCouponNote] = useState("");
  const couponInputRef = useRef<HTMLInputElement | null>(null);

  // Mobil alt ödeme çubuğu: kart bölümü (PayTR formu) ekrandayken gizlenir.
  const [cardSection, setCardSection] = useState<HTMLElement | null>(null);
  const [cardSectionVisible, setCardSectionVisible] = useState(false);
  const [iframeOpen, setIframeOpen] = useState(false);

  const initializedForUserRef = useRef("");
  const packageParam = searchParams.get("package");

  const refreshGuardianData = useCallback(async () => {
    if (!userId) return;
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("guardian_accounts").select("*").eq("user_id", userId).maybeSingle();
    if (data) {
      setPaymentGateGuardian(data);
      setGuardians((prev) => {
        const exists = prev.some((g) => g.user_id === data.user_id);
        return exists ? prev.map((g) => (g.user_id === data.user_id ? data : g)) : [...prev, data];
      });
      setGuardianId((current) => current || data.user_id);
    }
  }, [userId, setGuardianId]);

  useEffect(() => {
    if (isInitializing) return;
    if (accountType !== "student" && accountType !== "admin") {
      const qs = window.location.search;
      const next = `${localizedPath("payment", locale)}${qs}`;
      router.replace(`${unifiedLoginPath(locale)}?next=${encodeURIComponent(next)}&source=checkout`);
    }
  }, [accountType, isInitializing, locale, router]);

  // Resolve the canonical verification state before loading any checkout data.
  // This deliberately queries only the signed-in guardian's own row.
  useEffect(() => {
    if (isInitializing) return;
    if (accountType !== "student" || !userId) return;

    let cancelled = false;
    const expectedUserId = userId;
    const supabase = getSupabaseClient();
    void supabase
      .from("guardian_accounts")
      .select("*")
      .eq("user_id", expectedUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setPaymentGateGuardian(data ?? null);
        if (data) {
          setGuardians([data]);
          setGuardianId(data.user_id);
        }
        setVerificationResolvedUserId(expectedUserId);
      });

    return () => {
      cancelled = true;
    };
  }, [accountType, isInitializing, userId]);

  const emailVerified = accountType === "admin"
    || Boolean(
      accountType === "student"
      && paymentGateGuardian?.user_id === user?.id
      && paymentGateGuardian?.email_verified_at,
    );

  useEffect(() => {
    if ((accountType !== "student" && accountType !== "admin") || !user?.id || !emailVerified) return;
    if (initializedForUserRef.current === user.id) return;
    initializedForUserRef.current = user.id;
    const supabase = getSupabaseClient();
    const requested = packageParam ?? "";
    void Promise.all([
      getPublicPricingPackages(),
      supabase.from("guardian_accounts").select("*").eq("active", true),
      supabase.from("guardian_students").select("*").eq("active", true),
    ]).then(async ([packageRows, guardianResult, linkResult]) => {
      // Dinamik paket listesi: aktif + satın alınabilir + ders sayısı > 0 (package40 dahil).
      const purchasable = selectPurchasablePackages(packageRows);
      const guardianRows = guardianResult.data ?? [];
      const linkRows = linkResult.data ?? [];
      const ids = [...new Set(linkRows.map((row) => row.student_id))];
      const learnerResult = ids.length ? await supabase.from("student_profiles").select("*").in("id", ids).eq("active", true) : { data: [] as Learner[] };
      setPackages(purchasable);
      // Geçersiz/eksik paket kimliğinde hiçbir paket kendiliğinden seçilmez.
      setDirectPackageId(purchasable.some((row) => row.id === requested) ? requested : "");
      setGuardians(guardianRows);
      setLinks(linkRows);
      setLearners(learnerResult.data ?? []);
      if (accountType === "student") {
        const ownGuardian = guardianRows.find((row) => row.user_id === user.id);
        setPaymentGateGuardian(ownGuardian ?? null);
        setGuardianId(ownGuardian?.user_id ?? "");
        const ownLinks = linkRows.filter((row) => row.guardian_user_id === user.id);
        const saved = localStorage.getItem("oriens.selectedLearnerId");
        setLearnerId(ownLinks.some((row) => row.student_id === saved) ? saved! : ownLinks.find((row) => row.is_primary)?.student_id ?? ownLinks[0]?.student_id ?? "");
      }
      setDataLoading(false);
    });
  }, [accountType, emailVerified, user?.id, packageParam]);

  // Refresh only the guardian row when checkout regains focus (for example after
  // email verification in another tab). Calling the account-wide refresh here
  // sets `isInitializing`, unmounts HostedCardPanel, and destroys an active
  // PayTR iframe when the iframe/3D flow moves browser focus.
  useEffect(() => {
    const handleCheck = () => {
      if (document.visibilityState === "visible") {
        void refreshGuardianData();
      }
    };
    window.addEventListener("focus", handleCheck);
    document.addEventListener("visibilitychange", handleCheck);
    return () => {
      window.removeEventListener("focus", handleCheck);
      document.removeEventListener("visibilitychange", handleCheck);
    };
  }, [refreshGuardianData]);

  // Kart bölümü görünürken mobil çubuğu gizle (PayTR formunun üstünü örtmesin).
  useEffect(() => {
    if (!cardSection) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      setCardSectionVisible(Boolean(entries[0]?.isIntersecting));
    }, { threshold: 0 });
    observer.observe(cardSection);
    return () => observer.disconnect();
  }, [cardSection]);

  const selectedGuardian = guardians.find((item) => item.user_id === guardianId) ?? null;
  const savedPhone = isTr ? trPhoneInputDigits(selectedGuardian?.phone) : (selectedGuardian?.phone || "").trim();
  const paymentPhone = phoneInput ?? savedPhone;

  const availableLearners = useMemo(() => {
    const allowed = new Set(links.filter((row) => row.guardian_user_id === guardianId).map((row) => row.student_id));
    return learners.filter((row) => allowed.has(row.id));
  }, [guardianId, learners, links]);
  const selectedLearner = availableLearners.find((item) => item.id === learnerId) ?? null;
  const selectedPackage = packages.find((pkg) => pkg.id === directPackageId) ?? null;
  const packageIds = useMemo(() => (selectedPackage ? [selectedPackage.id] : []), [selectedPackage]);

  // Kupon kuralı bu paket + seçili öğrenci için sunucudan alınır;
  // paytr-create-token aynı RPC'yi aynı girdiyle çağırır.
  const couponState = useCheckoutCoupon(couponCode, packageIds, learnerId || user?.id, locale);

  // Denetim: ödeme ekranı açılışı ve ödeme başlatma sonucu (yalnız veli hesabı;
  // yönetici destekli ödemeler sunucuda ayrıca kaydedilir). Doğrudan paket
  // alımında her ödeme sayfası açılışı kendi kimliğini alır.
  const checkoutCartIdRef = useRef<string | null>(null);
  const checkoutOpenedRef = useRef(false);
  const auditCheckout = accountType === "student";
  const checkoutUiReady = Boolean(
    emailVerified
    && selectedGuardian
    && selectedLearner
    && packageIds.length
    && couponState.status !== "loading",
  );
  useEffect(() => {
    if (!auditCheckout || dataLoading || !checkoutUiReady || checkoutOpenedRef.current) return;
    checkoutOpenedRef.current = true;
    checkoutCartIdRef.current = newCartId();
    recordCartEvent("checkout_opened", checkoutCartIdRef.current, packageIds, { studentId: learnerId || null, source: "payment" });
  }, [auditCheckout, checkoutUiReady, dataLoading, learnerId, packageIds]);

  const handleSessionResult = useCallback((result: PaymentSessionResult) => {
    if (!auditCheckout) return;
    const cartId = checkoutCartIdRef.current ?? newCartId();
    checkoutCartIdRef.current = cartId;
    recordCartEvent("checkout_started", cartId, packageIds, {
      studentId: learnerId || null,
      reference: result.reference ?? null,
      result: result.errorCode ? "session_failed" : result.zero ? "zero_payment" : "session_created",
      errorCode: result.errorCode ?? null,
      source: "payment",
    });
  }, [auditCheckout, learnerId, packageIds]);

  const pricingBreakdown = calculateAuthoritativeTotal({
    packages: selectedPackage
      ? [{
          id: selectedPackage.id,
          price: Number(selectedPackage.current_total ?? selectedPackage.price_amount ?? 0),
          name_tr: selectedPackage.name_tr,
          name_en: selectedPackage.name_en,
          lesson_count: selectedPackage.lesson_count,
        }]
      : [],
    coupon: couponState.rule,
  });

  const basePrice = pricingBreakdown.subtotal;
  const couponDiscount = pricingBreakdown.discount;
  const finalPrice = pricingBreakdown.finalTotal;
  const currency = selectedPackage?.currency || "TRY";
  const money = (value: number) => formatCurrency(value, { currency, locale });
  const listPrice = selectedPackage ? Number(selectedPackage.old_total ?? selectedPackage.price_amount ?? 0) : 0;
  const packageDiscount = Math.max(0, listPrice - basePrice);
  const packageDiscountPct = selectedPackage && packageDiscount > 0
    ? selectedPackage.discount_percentage || Math.round((packageDiscount / listPrice) * 100)
    : 0;

  // Geçerli kural bu siparişe indirim sağlamıyorsa (ör. alt limit) kupon gönderilmez:
  // ekrandaki toplam ile PayTR'ye giden toplam her durumda aynı kalır.
  const couponApplied = couponState.status === "valid" && couponDiscount > 0;
  const checkoutCouponCode = couponApplied ? couponState.rule?.code : undefined;
  const couponLoading = couponState.status === "loading";
  const couponError = couponState.status === "invalid"
    ? couponState.error || (isTr ? "Bu kod geçerli değil." : "This code is not valid.")
    : couponState.status === "valid" && couponDiscount <= 0
      ? (isTr ? "Bu kod bu pakete indirim sağlamıyor." : "This code does not apply to this package.")
      : "";
  const couponRuleLabel = couponState.rule
    ? couponState.rule.discount_type === "percentage"
      ? (isTr ? `%${couponState.rule.discount_value} indirim` : `${couponState.rule.discount_value}% discount`)
      : (isTr ? "İndirim kodu" : "Discount code")
    : "";
  const couponMessage = couponError
    || (couponApplied
      ? (isTr ? `${couponRuleLabel} uygulandı. ${money(couponDiscount)} tasarruf ettiniz.` : `${couponRuleLabel} applied. You saved ${money(couponDiscount)}.`)
      : couponNote);

  const phoneDigits = isTr ? trPhoneInputDigits(paymentPhone) : "";
  const phoneCheck = isTr
    ? validateStudentPhone(`+90${phoneDigits}`, true)
    : validateStudentPhone(paymentPhone, false);
  const isPhoneValid = isTr ? isValidPaymentPhoneDigits(phoneDigits) && phoneCheck.valid : paymentPhone.trim().length > 0 && phoneCheck.valid;
  const phoneError = !isPhoneValid && phoneTouched && paymentPhone.trim()
    ? (isTr ? "Lütfen 5 ile başlayan 10 haneli cep telefonu numaranızı girin." : phoneCheck.error || "Please enter a valid phone number.")
    : "";
  const contextReady = Boolean(selectedGuardian && selectedLearner && emailVerified && packageIds.length && isPhoneValid && !couponLoading);

  const pendingMessage = !packageIds.length
    ? (isTr ? "Ödemeye devam etmek için bir paket seçin." : "Select a package to continue.")
    : !selectedGuardian || !selectedLearner
      ? (isTr ? "Hesap sahibi ve öğrenci bilgisi bekleniyor." : "Waiting for the account holder and learner.")
      : !isPhoneValid
        ? (isTr ? "Telefon numaranızı girin, PayTR kart formu burada açılsın." : "Enter your phone number to open the PayTR card form here.")
        : (isTr ? "İndirim kodu kontrol ediliyor…" : "Checking the discount code…");
  const amountText = money(finalPrice);
  const expectedAmountKurus = Math.round(finalPrice * 100);

  const orderSnapshot: LegalOrderSnapshot = {
    packageName: selectedPackage ? packageDisplayName(selectedPackage, locale) : (isTr ? "Ders Paketi" : "Lesson Package"),
    lessonCount: selectedPackage?.lesson_count || 0, baseAmount: basePrice,
    discountAmount: couponApplied ? couponDiscount : undefined, couponCode: checkoutCouponCode, finalAmount: finalPrice, currency,
    payerName: selectedGuardian?.full_name, payerEmail: selectedGuardian?.email, paymentMethod: "card",
  };

  const handleCouponSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (code.length < 3 || couponLoading) return;
    setCouponNote("");
    setCouponCode(code);
  };

  const removeCoupon = () => {
    setCouponCode("");
    setCouponInput("");
    setCouponOpen(true);
    setCouponNote(isTr ? "İndirim kodu kaldırıldı." : "Discount code removed.");
    window.setTimeout(() => couponInputRef.current?.focus(), 0);
  };

  const handleMobilePay = () => {
    if (!isPhoneValid && phoneInputRef.current) {
      setPhoneTouched(true);
      phoneInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => phoneInputRef.current?.focus({ preventScroll: true }), 350);
      return;
    }
    cardSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const verificationResolved = accountType === "admin"
    || (accountType === "student" && verificationResolvedUserId === user?.id);

  if (isInitializing || !verificationResolved || (accountType !== "student" && accountType !== "admin")) return <AccountWaveLoader />;
  if (accountType === "student" && !paymentGateGuardian) {
    return <section className="pt-32 pb-24"><div className="mx-auto max-w-xl px-6 text-center"><h1 className="font-heading text-3xl text-ink">{isTr ? "Hesap doğrulama bilgisi bulunamadı" : "Account verification information was not found"}</h1><ButtonLink href={localizedPath("studentAccount", locale)} className="mt-8">{isTr ? "Hesabıma Git" : "Go to My Account"}</ButtonLink></div></section>;
  }
  if (accountType === "student" && paymentGateGuardian && !emailVerified) {
    return <EmailOtpGate
      email={paymentGateGuardian.email.trim().toLowerCase()}
      locale={locale}
      onVerified={() => { void refreshGuardianData(); }}
    />;
  }
  if (settingsLoading || dataLoading) return <AccountWaveLoader />;
  if (!showPricing && accountType !== "admin") return <section className="pt-32 pb-24"><div className="mx-auto max-w-xl px-6 text-center"><h1 className="font-heading text-3xl text-ink">{isTr ? "Ödeme Sistemi Geçici Olarak Kapalı" : "Payment System Temporarily Unavailable"}</h1><ButtonLink href={localizedPath("home", locale)} className="mt-8">{isTr ? "Ana Sayfa" : "Home"}</ButtonLink></div></section>;

  const displayPrice = selectedPackage
    ? getLocalizedPackageDisplayPrice({ locale, tryAmount: selectedPackage.current_total ?? selectedPackage.price_amount, eurAmount: selectedPackage.price_eur })
    : null;
  const showPaybar = Boolean(cardSection) && !cardSectionVisible && !iframeOpen;

  return (
    <section className={`${styles.root} ${fraunces.variable} pt-16 md:pt-20`} data-payment-page="">
      <div className={styles.main}>
        <ol className={styles.stepper} aria-label={isTr ? "Satın alma adımları" : "Checkout steps"}>
          <li className={styles.current} aria-current="step"><span className={styles.dot}>1</span>{isTr ? "Ödeme" : "Payment"}</li>
          <li className={styles.bar} aria-hidden="true" />
          <li className={styles.todo}><span className={styles.dot}>2</span>{isTr ? "Onay" : "Confirmation"}</li>
        </ol>

        <div className={styles.pageHead}>
          <div>
            <h1 className={styles.h1}>{copy.title.replace(/\.$/, "")}</h1>
          </div>
          <div className={styles.securePill}>
            <LockKeyhole size={15} aria-hidden="true" />
            {isTr ? "Güvenli ödeme · 3D Secure" : "Secure payment · 3D Secure"}
          </div>
        </div>

        <div className={styles.layout}>
          <div className={styles.steps}>
            {/* 1. İletişim */}
            <section className={styles.card} aria-labelledby="pay-s1">
              <div className={styles.stepHead}>
                <span className={`${styles.stepNum} ${isPhoneValid ? styles.ok : ""}`} data-step-ok={isPhoneValid ? "" : undefined}>
                  {isPhoneValid ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : "1"}
                </span>
                <h2 id="pay-s1" className={styles.h2}>{isTr ? "İletişim bilgileri" : "Contact information"}</h2>
              </div>

              {accountType === "admin" ? (
                <div className={styles.adminBox}>
                  <p>{isTr ? "Yönetici işlemi için hesap sahibi ve öğrenci bağlamını seçin." : "Select the account holder and learner for this admin-assisted payment."}</p>
                  <div className={styles.adminGrid}>
                    <select aria-label={isTr ? "Hesap sahibi" : "Account holder"} value={guardianId} onChange={(event) => { setGuardianId(event.target.value); setLearnerId(""); }} className={styles.select}>
                      <option value="">{isTr ? "Hesap sahibi seçin" : "Select account holder"}</option>
                      {guardians.map((item) => <option key={item.user_id} value={item.user_id}>{item.full_name} — {item.email}</option>)}
                    </select>
                    <select aria-label={isTr ? "Öğrenci" : "Learner"} value={learnerId} onChange={(event) => setLearnerId(event.target.value)} disabled={!guardianId} className={styles.select}>
                      <option value="">{isTr ? "Öğrenci seçin" : "Select learner"}</option>
                      {availableLearners.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
                    </select>
                  </div>
                </div>
              ) : null}

              <div className={styles.readonlyGrid}>
                <div className={styles.readonly}>
                  <span className={styles.ic}><UserRound size={16} aria-hidden="true" /></span>
                  <div className={styles.tx}><div className={styles.k}>{isTr ? "Ad Soyad" : "Full name"}</div><div className={styles.v} title={selectedGuardian?.full_name || ""}>{selectedGuardian?.full_name || "—"}</div></div>
                </div>
                <div className={styles.readonly}>
                  <span className={styles.ic}><Mail size={16} aria-hidden="true" /></span>
                  <div className={styles.tx}><div className={styles.k}>{isTr ? "E-posta" : "Email"}</div><div className={styles.v} title={selectedGuardian?.email || ""}>{selectedGuardian?.email || "—"}</div></div>
                </div>
              </div>

              <label className={styles.fieldLabel} htmlFor="payment-phone">{isTr ? "Ödeme telefonu" : "Payment phone"}</label>
              <div className={styles.phone} data-invalid={phoneError ? "true" : undefined}>
                {isTr ? <span className={styles.prefix}>+90</span> : null}
                <input
                  ref={phoneInputRef}
                  id="payment-phone"
                  name="phone"
                  type="tel"
                  inputMode={isTr ? "numeric" : "tel"}
                  autoComplete={isTr ? "tel-national" : "tel"}
                  required
                  value={isTr ? formatPaymentPhoneInput(paymentPhone) : paymentPhone}
                  onChange={(event) => setPhoneInput(isTr ? trPhoneInputDigits(event.target.value) : event.target.value)}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder={isTr ? "5xx xxx xx xx" : "+44 7xxx xxx xxx"}
                  maxLength={isTr ? 13 : 24}
                  aria-invalid={phoneError ? true : undefined}
                  aria-describedby="payment-phone-hint"
                />
              </div>
              {phoneError ? <p role="alert" className={styles.fieldError}>{phoneError}</p> : null}
              <p id="payment-phone-hint" className={styles.hint}>
                {isTr
                  ? "3D Secure doğrulaması için kullanılır; profilinize kaydedilmez."
                  : "Used for 3D Secure verification; it is not saved to your profile."}
              </p>
            </section>

            {/* 2. Kart */}
            <section ref={setCardSection} className={styles.card} aria-labelledby="pay-s2" data-card-section="">
              <div className={styles.stepHead}><span className={styles.stepNum}>2</span><h2 id="pay-s2" className={styles.h2}>{isTr ? "Kart ile ödeme" : "Pay by card"}</h2></div>
              <HostedCardPanel
                locale={locale}
                packageIds={packageIds}
                couponCode={checkoutCouponCode}
                learnerId={learnerId}
                guardianUserId={accountType === "admin" ? guardianId : undefined}
                paymentPhone={phoneCheck.normalized}
                contextReady={contextReady}
                expectedAmountKurus={expectedAmountKurus}
                pendingMessage={pendingMessage}
                onIframeChange={setIframeOpen}
                onOpenLegalDoc={setActiveModal}
                onSessionResult={handleSessionResult}
              />
            </section>
          </div>

          {/* Özet */}
          <aside className={styles.summary} aria-labelledby="pay-sum">
            <div className={`${styles.card} ${styles.summaryCard}`}>
              <div className={styles.sumGroup}>
                <h2 id="pay-sum" className={styles.h2} style={{ marginBottom: 18 }}>{isTr ? "Sipariş özeti" : "Order summary"}</h2>
                {selectedPackage ? (
                  <>
                    <div className={styles.item} data-summary-package={selectedPackage.id}>
                      <div className={styles.badgeTile} aria-hidden="true"><b>{selectedPackage.lesson_count}</b><small>{isTr ? "DERS" : "LESSONS"}</small></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className={styles.name}>{packageDisplayName(selectedPackage, locale)}</div>
                        <div className={styles.priceRow}>
                          <span className={styles.now}>{isTr ? money(basePrice) : displayPrice?.formatted}</span>
                          {isTr && packageDiscount > 0 ? <span className={styles.strike}>{money(listPrice)}</span> : null}
                        </div>
                      </div>
                    </div>
                    {isTr && packageDiscount > 0 ? (
                      <div className={styles.discount}>
                        <Tag size={12} strokeWidth={2.4} aria-hidden="true" />
                        %{packageDiscountPct} indirim · {money(packageDiscount)} avantaj
                      </div>
                    ) : null}
                  </>
                ) : packages.length ? (
                  <label className={styles.k} style={{ display: "block" }}>
                    {isTr ? "Eğitim paketi" : "Package"}
                    <select
                      value={directPackageId}
                      onChange={(event) => { setDirectPackageId(event.target.value); }}
                      className={styles.select}
                      style={{ marginTop: 8 }}
                    >
                      <option value="">{isTr ? "Paket seçin" : "Select package"}</option>
                      {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {packageDisplayName(pkg, locale)} — {getLocalizedPackageDisplayPrice({ locale, tryAmount: pkg.current_total ?? pkg.price_amount, eurAmount: pkg.price_eur }).formatted}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p role="alert" className={styles.notice}>{isTr ? "Şu anda satın alınabilir paket bulunmuyor." : "No packages are available for purchase right now."}</p>
                )}
              </div>

              <div className={styles.sep} />

              {/* İndirim kodu */}
              <div>
                {couponApplied ? (
                  <div className={styles.couponChip} data-coupon-chip="">
                    <span className={styles.code}><Check size={14} strokeWidth={2.6} aria-hidden="true" /><span>{couponState.rule?.code}</span></span>
                    <button type="button" onClick={removeCoupon}>{isTr ? "Kaldır" : "Remove"}</button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.couponToggle}
                      aria-expanded={couponOpen}
                      aria-controls="pay-coupon-form"
                      onClick={() => {
                        const next = !couponOpen;
                        setCouponOpen(next);
                        if (next) window.setTimeout(() => couponInputRef.current?.focus(), 0);
                      }}
                    >
                      <Tag size={15} aria-hidden="true" />
                      <span style={{ flex: 1 }}>{isTr ? "İndirim kodunuz mu var?" : "Have a discount code?"}</span>
                      <ChevronDown size={15} className={styles.chev} aria-hidden="true" />
                    </button>
                    <form id="pay-coupon-form" className={styles.couponForm} hidden={!couponOpen} noValidate onSubmit={handleCouponSubmit}>
                      <label htmlFor="pay-coupon-input" className={styles.srOnly}>{isTr ? "İndirim kodu" : "Discount code"}</label>
                      <input
                        ref={couponInputRef}
                        id="pay-coupon-input"
                        name="coupon"
                        type="text"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        placeholder={isTr ? "Kodu girin" : "Enter code"}
                        maxLength={32}
                        value={couponInput}
                        onChange={(event) => {
                          setCouponInput(event.target.value);
                          // Hatalı koddan sonra yazmaya başlayınca hata temizlenir.
                          if (couponCode && couponState.status !== "loading") setCouponCode("");
                          setCouponNote("");
                        }}
                        aria-invalid={couponError ? true : undefined}
                        aria-describedby="pay-coupon-msg"
                      />
                      <button type="submit" disabled={couponInput.trim().length < 3 || couponLoading || !packageIds.length}>
                        {couponLoading ? (isTr ? "Kontrol ediliyor…" : "Checking…") : (isTr ? "Uygula" : "Apply")}
                      </button>
                    </form>
                  </>
                )}
                <p id="pay-coupon-msg" className={`${styles.couponMsg} ${couponError ? styles.err : ""}`} role="status" aria-live="polite">{couponMessage}</p>
              </div>

              <div className={styles.sep} />
              <div className={styles.lines}>
                <div><span className={styles.k}>{isTr ? "Paket liste fiyatı" : "Package list price"}</span><span>{money(selectedPackage ? listPrice : 0)}</span></div>
                {packageDiscount > 0 ? (
                  <div><span className={styles.k}>{isTr ? "Paket indirimi" : "Package discount"}</span><span className={styles.minus}>−{money(packageDiscount)}</span></div>
                ) : null}
                {couponApplied ? (
                  <div data-coupon-line=""><span className={styles.k}>{isTr ? "İndirim kodu" : "Discount code"} ({couponState.rule?.code})</span><span className={styles.minus}>−{money(couponDiscount)}</span></div>
                ) : null}
              </div>
              <div className={styles.totalBox}>
                <div className={styles.total}><span>{isTr ? "Ödenecek tutar" : "Amount due"}</span><span className={styles.totalV} data-amount="">{amountText}</span></div>
                {!isTr ? <p className={styles.totalNote}>Displayed package prices are in EUR. Your payment will be processed in TRY.</p> : null}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Yalnızca telefonda görünür */}
      <div className={`${styles.mobilePaybar} ${showPaybar ? "" : styles.hide}`} aria-hidden={showPaybar ? undefined : true}>
        <div className={styles.amt}><small>{isTr ? "Ödenecek tutar" : "Amount due"}</small><b>{amountText}</b></div>
        <button type="button" onClick={handleMobilePay} tabIndex={showPaybar ? undefined : -1}>
          <LockKeyhole size={15} aria-hidden="true" />
          {isTr ? "Ödemeye geç" : "Continue to payment"}
        </button>
      </div>

      {activeModal ? <LegalModal isOpen onClose={() => setActiveModal(null)} docKey={activeModal} locale={locale} orderSnapshot={orderSnapshot} /> : null}
    </section>
  );
}
