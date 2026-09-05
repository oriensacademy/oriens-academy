"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, FileCheck2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import type { Locale } from "@/content/dictionaries";
import { getPaymentCopy } from "@/content/payment";
import { confirmPaymentAgreements, createPaytrToken } from "@/lib/payments/client";
import { localizedPath, paymentSuccessPath, unifiedLoginPath } from "@/lib/routes";
import { paymentErrorMessage, paymentErrorRequiresLogin } from "@/lib/payments/public-errors";
import { LEGAL_VERSIONS } from "@/config/legal";
import type { LegalDocKey } from "@/config/legal";

interface ErrorState {
  message: string;
  requiresLogin: boolean;
}

interface PreparedPayment {
  token: string;
}

interface HostedCardPanelProps {
  packageIds: string[];
  couponCode?: string;
  learnerId: string;
  guardianUserId?: string;
  paymentPhone: string;
  contextReady: boolean;
  emailVerified?: boolean;
  locale: Locale;
  onOpenLegalDoc: (key: LegalDocKey) => void;
}

/**
 * The single "Ödemeye Geç" action is the legal acceptance: no checkboxes,
 * no separate confirmation step. One click runs, in order: create the PayTR
 * session (the edge function commits legal-acceptance metadata to the new
 * payment_transactions row BEFORE it ever calls PayTR's API -- see
 * supabase/functions/paytr-create-token/index.ts), then confirm that
 * acceptance via the existing confirm_payment_agreements RPC, then show the
 * iframe. No PayTR session is ever created just from the page loading.
 */
export function HostedCardPanel({
  packageIds,
  couponCode,
  learnerId,
  guardianUserId,
  paymentPhone,
  contextReady,
  emailVerified = true,
  locale,
  onOpenLegalDoc,
}: HostedCardPanelProps) {
  const copy = getPaymentCopy(locale);
  const router = useRouter();
  const isTr = locale === "tr";

  const [starting, setStarting] = useState(false);
  const [prepared, setPrepared] = useState<PreparedPayment | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const inFlightRef = useRef(false);

  // Invalidate any prepared payment session if package selection or coupon changes
  const prevPricingKeyRef = useRef<string>("");
  useEffect(() => {
    const currentKey = `${packageIds.slice().sort().join(",")}:${couponCode || ""}`;
    if (prevPricingKeyRef.current && prevPricingKeyRef.current !== currentKey) {
      setPrepared(null);
      setError(null);
    }
    prevPricingKeyRef.current = currentKey;
  }, [packageIds, couponCode]);

  const handleProceedToPayment = useCallback(async () => {
    // Belt-and-suspenders re-entrancy guard on top of the disabled button --
    // covers a rapid double-click landing between React's disabled-state
    // paint and the actual click handler running.
    if (inFlightRef.current || !contextReady) return;
    inFlightRef.current = true;
    setStarting(true);
    setError(null);

    try {
      const legalVersions = {
        salesAgreement: LEGAL_VERSIONS.salesAgreement,
        preInformation: LEGAL_VERSIONS.preInformation,
        refundPolicy: LEGAL_VERSIONS.refundPolicy,
      };

      // PAYMENT_SESSION_RETRY: sunucu bayat (tek kullanımlık, tüketilmiş) bir
      // PayTR oturumu bulup arşivledi. Kullanıcıya hata göstermek yerine aynı
      // tık içinde bir kez daha, taze bir oturumla deneriz.
      let result = await createPaytrToken({
        packageIds,
        couponCode,
        learnerId,
        guardianUserId,
        paymentPhone,
        locale,
        // The click itself is the acceptance -- see plan "PayTR Legal
        // Acceptance + Payment Start Flow Repair".
        termsAccepted: true,
        refundPolicyAccepted: true,
        legalVersions,
      });

      if (result.errorCode === "PAYMENT_SESSION_RETRY") {
        result = await createPaytrToken({
          packageIds,
          couponCode,
          learnerId,
          guardianUserId,
          paymentPhone,
          locale,
          termsAccepted: true,
          refundPolicyAccepted: true,
          legalVersions,
        });
      }

      if (!result.success || (!result.iframe_token && !result.zero_payment)) {
        setError({
          message: result.message || (isTr ? "Ödeme ekranı şu anda hazırlanamadı." : "Payment screen could not be prepared."),
          requiresLogin: paymentErrorRequiresLogin(result.errorCode),
        });
        return;
      }

      if (result.zero_payment) {
        // Zero-amount (100% coupon) orders are finalized server-side in the
        // same request once legal acceptance is true -- nothing left to show.
        if (result.reference && result.statusToken) {
          const path = paymentSuccessPath(locale);
          router.push(`${path}?reference=${encodeURIComponent(result.reference)}&token=${encodeURIComponent(result.statusToken)}`);
        }
        return;
      }

      // Required, not fire-and-forget: if this fails, no actionable payment
      // session is shown, even though a pending transaction row now exists
      // (it will simply expire via the existing 30-minute stale-pending TTL).
      const confirmed = await confirmPaymentAgreements(result.merchant_oid || result.reference || "", legalVersions);
      if (!confirmed) {
        setError({ message: paymentErrorMessage("AGREEMENT_RECORD_FAILED", locale), requiresLogin: false });
        return;
      }

      setPrepared({ token: result.iframe_token || "" });
    } catch {
      setError({ message: paymentErrorMessage("NETWORK_ERROR", locale), requiresLogin: false });
    } finally {
      inFlightRef.current = false;
      setStarting(false);
    }
  }, [contextReady, couponCode, guardianUserId, isTr, learnerId, locale, packageIds, paymentPhone, router]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  /**
   * PayTR'nin resmi iframeResizer betiği, ödeme formunun gerçek yüksekliğini
   * üst pencereye bildirip çerçeveyi büyütür. Yalnızca ödeme oturumu
   * hazırlandıktan sonra, yani iframe DOM'a girdikten sonra yüklenir.
   *
   * Betik yüklenemezse hiçbir şey bozulmaz: iframe en az 850px yüksekliğiyle
   * ve kaydırmasıyla kalır, kullanıcı butona her durumda ulaşır.
   */
  useEffect(() => {
    if (!prepared?.token) return;
    let cancelled = false;

    const applyResizer = () => {
      const resize = (window as unknown as { iFrameResize?: (options: object, target: string) => void }).iFrameResize;
      if (!resize || cancelled) return;
      try {
        resize({ checkOrigin: false }, "#paytriframe");
      } catch {
        // Yedek yükseklik + iframe kaydırması devrede kalır.
      }
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-paytr-resizer="1"]');
    if (existing) {
      if (existing.dataset.loaded === "1") applyResizer();
      else existing.addEventListener("load", applyResizer, { once: true });
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = "https://www.paytr.com/js/iframeResizer.min.js";
    script.async = true;
    script.dataset.paytrResizer = "1";
    script.addEventListener("load", () => {
      script.dataset.loaded = "1";
      applyResizer();
    });
    document.body.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [prepared?.token]);

  return (
    <div className="space-y-4">
      {!contextReady ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#819586]/40 bg-[#F6F8F3] p-8 text-center sm:p-10">
          <FileCheck2 className="size-7 text-[#10271B]" />
          <h3 className="mt-4 font-heading text-base font-semibold text-[#10271B]">
            {!packageIds.length
              ? (isTr ? "Paket Seçimi Bekleniyor" : "Package Selection Pending")
              : !emailVerified
                ? (isTr ? "E-posta Doğrulaması Bekleniyor" : "Email Verification Pending")
                : (isTr ? "Ödeme Bilgileri Bekleniyor" : "Payment Information Pending")}
          </h3>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-[#68756C]">
            {!packageIds.length
              ? (isTr ? "Ödemeye devam etmek için lütfen bir eğitim paketi seçiniz." : "Please select an academic package to proceed.")
              : !emailVerified
                ? (isTr ? "Kart ile ödeme formunun açılması için lütfen yukarıdaki alandan e-posta adresinizi doğrulayınız." : "Please verify your email address above to proceed with card payment.")
                : (isTr ? "Ödemeye devam etmek için lütfen sipariş ve iletişim adımlarını tamamlayınız." : "Please complete the required order and contact steps to proceed.")}
          </p>
        </div>
      ) : prepared?.token ? (
        <div className="rounded-2xl border border-border bg-white shadow-xs">
          {/*
            PayTR'nin ödeme formu (kart alanları + taksit tablosu + "Ödemeyi
            Tamamla" butonu) sabit bir yüksekliğe sığmaz. Önceki sürümde iframe
            `scrolling="no"` ile sabit yükseklikteydi ve dıştaki kap
            `overflow-hidden` idi: formun altı -- yani ödemeyi tamamlayan buton
            -- tamamen erişilemez oluyordu, ödeme bitirilemiyordu.

            Çözüm PayTR'nin kendi iframeResizer entegrasyonu: iframe içeriği
            yüksekliğini üst pencereye bildirir ve çerçeve içeriğe göre büyür,
            böylece sayfa normal şekilde kaydırılır ve buton görünür olur.
            Betik yüklenemezse `scrolling` varsayılanda kalır (auto), yani
            kullanıcı yine de iframe içinde kaydırıp butona ulaşabilir --
            para akışını tek bir üçüncü taraf betiğine bağlamıyoruz.
          */}
          <iframe
            // Her yeni oturum yepyeni bir iframe elemanıdır: React eski
            // elemanı yeniden kullanıp tüketilmiş bir token'ı ikinci kez
            // yükleyemez.
            key={prepared.token}
            ref={iframeRef}
            id="paytriframe"
            title="PayTR Secure Payment"
            src={`https://www.paytr.com/odeme/guvenli/${prepared.token}`}
            className="w-full rounded-2xl border-0"
            scrolling="auto"
            style={{ minHeight: "850px", width: "100%" }}
          />
          {/*
            PayTR token'i tek kullanimliktir; kullanici geri gelip cerceveyi
            yeniden yuklerse PayTR kendi sayfasinda "Bu odeme sayfasi artik
            gecersiz" der. Bu buton kullaniciyi cikmaza birakmaz: tek tikla
            yepyeni bir odeme oturumu baslatilir.
          */}
          <div className="border-t border-border p-3 text-center">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {isTr
                ? "Ödeme formu yüklenmediyse veya \"bu ödeme sayfası geçersiz\" uyarısı görüyorsanız:"
                : "If the payment form did not load, or you see an \"invalid payment page\" warning:"}
            </p>
            <button
              type="button"
              onClick={() => {
                setPrepared(null);
                setError(null);
                void handleProceedToPayment();
              }}
              disabled={starting}
              className="mt-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-4 text-xs font-semibold text-ink transition-colors hover:bg-surface-muted disabled:opacity-60"
            >
              {starting ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              {isTr ? "Yeni Ödeme Oturumu Başlat" : "Start a New Payment Session"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {error ? (
            <div role="alert" aria-live="assertive" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
              <AlertCircle className="mx-auto size-5 text-red-600" />
              <p className="mt-2 text-sm font-semibold text-red-900">{error.message}</p>
              {error.requiresLogin ? (
                <button
                  type="button"
                  onClick={() => {
                    const next = `${localizedPath("payment", locale)}${window.location.search}`;
                    router.push(`${unifiedLoginPath(locale)}?next=${encodeURIComponent(next)}&source=checkout`);
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest"
                >
                  {isTr ? "Yeniden Giriş Yap" : "Sign In Again"}
                  <ArrowRight className="size-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}

          <p className="text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
            {isTr ? '"Ödemeye Geç" butonuna tıklayarak ' : 'By clicking "Proceed to Payment", you confirm that you have read and accepted the '}
            <button type="button" onClick={() => onOpenLegalDoc("preInformation")} className="font-semibold text-primary underline underline-offset-2 hover:no-underline">
              {isTr ? "Ön Bilgilendirme Formu" : "Pre-Information Form"}
            </button>
            {", "}
            <button type="button" onClick={() => onOpenLegalDoc("salesAgreement")} className="font-semibold text-primary underline underline-offset-2 hover:no-underline">
              {isTr ? "Mesafeli Satış Sözleşmesi" : "Distance Sales Agreement"}
            </button>
            {isTr ? " ve " : " and "}
            <button type="button" onClick={() => onOpenLegalDoc("refundPolicy")} className="font-semibold text-primary underline underline-offset-2 hover:no-underline">
              {isTr ? "İptal ve İade Koşulları" : "Cancellation & Refund Policy"}
            </button>
            {isTr
              ? "'nı okuduğunuzu ve kabul ettiğinizi; siparişin ödeme yükümlülüğü doğurduğunu onaylamış olursunuz."
              : ", and acknowledge that placing the order creates a payment obligation."}
          </p>

          {error?.requiresLogin ? null : (
            <button
              type="button"
              onClick={() => void handleProceedToPayment()}
              disabled={starting}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#6748D7] px-5 text-base font-bold text-white shadow-md shadow-violet-900/15 transition-all hover:-translate-y-0.5 hover:bg-[#593BC8] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#6748D7]/30 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
            >
              {starting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {isTr ? "Ödeme Hazırlanıyor…" : "Preparing Payment…"}
                </>
              ) : (
                <>{isTr ? "Ödemeye Geç" : "Proceed to Payment"}</>
              )}
            </button>
          )}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl bg-surface-muted p-3 text-[11px] leading-relaxed text-[#68756C]">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <span>{copy.secureText}</span>
      </div>
    </div>
  );
}
