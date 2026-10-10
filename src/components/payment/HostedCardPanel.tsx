"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import type { Locale } from "@/content/dictionaries";
import { confirmPaymentAgreements, createPaytrToken, recordPaymentClientEvent } from "@/lib/payments/client";
import { localizedPath, paymentSuccessPath, unifiedLoginPath } from "@/lib/routes";
import { paymentErrorMessage, paymentErrorRequiresLogin } from "@/lib/payments/public-errors";
import { LEGAL_VERSIONS } from "@/config/legal";
import type { LegalDocKey } from "@/config/legal";
import styles from "./payment.module.css";

interface ErrorState {
  message: string;
  requiresLogin: boolean;
}

interface PreparedPayment {
  token: string;
  reference?: string;
  statusToken?: string;
}

interface HostedCardPanelProps {
  packageIds: string[];
  couponCode?: string;
  learnerId: string;
  guardianUserId?: string;
  paymentPhone: string;
  contextReady: boolean;
  /** Buton metni: "15.000 TL öde" (sıfır tutarda "Siparişi tamamla"). */
  payLabel: string;
  /** Bağlam hazır değilken durum satırı (ör. telefon bekleniyor). */
  pendingMessage: string;
  /** Mobil alt ödeme çubuğu bu butonu izler ve tetikler. */
  payButtonRef?: (element: HTMLButtonElement | null) => void;
  /** PayTR iframe'i açıldığında/kapandığında bildirilir. */
  onIframeChange?: (open: boolean) => void;
  locale: Locale;
  onOpenLegalDoc: (key: LegalDocKey) => void;
  /** Denetim kaydı için ödeme oturumu sonucu (yalnız bilgi; akışı etkilemez). */
  onSessionResult?: (result: PaymentSessionResult) => void;
}

export interface PaymentSessionResult {
  reference?: string;
  errorCode?: string;
  zero?: boolean;
}

/**
 * The single pay button ("15.000 TL öde") action is the legal acceptance: no checkboxes,
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
  payLabel,
  pendingMessage,
  payButtonRef,
  onIframeChange,
  locale,
  onOpenLegalDoc,
  onSessionResult,
}: HostedCardPanelProps) {
  const router = useRouter();
  const isTr = locale === "tr";

  const [starting, setStarting] = useState(false);
  const [prepared, setPrepared] = useState<PreparedPayment | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const inFlightRef = useRef(false);

  const handleProceedToPayment = useCallback(async () => {
    // Belt-and-suspenders re-entrancy guard on top of the disabled button --
    // covers a rapid double-click landing between React's disabled-state
    // paint and the actual click handler running.
    if (inFlightRef.current || !contextReady) return;
    const notifySession = (sessionResult: PaymentSessionResult) => {
      try {
        onSessionResult?.(sessionResult);
      } catch {
        // Denetim bildirimi ödeme akışını asla etkilemez.
      }
    };
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

      notifySession(!result.success || (!result.iframe_token && !result.zero_payment)
        ? { errorCode: result.errorCode || "PAYMENT_SESSION_FAILED" }
        : { reference: result.reference || result.merchant_oid, zero: Boolean(result.zero_payment) });

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

      setPrepared({
        token: result.iframe_token || "",
        reference: result.reference || result.merchant_oid || "",
        statusToken: result.statusToken || "",
      });
    } catch {
      notifySession({ errorCode: "NETWORK_ERROR" });
      setError({ message: paymentErrorMessage("NETWORK_ERROR", locale), requiresLogin: false });
    } finally {
      inFlightRef.current = false;
      setStarting(false);
    }
  }, [contextReady, couponCode, guardianUserId, isTr, learnerId, locale, onSessionResult, packageIds, paymentPhone, router]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const iframeOpen = Boolean(prepared?.token);

  useEffect(() => {
    onIframeChange?.(iframeOpen);
  }, [iframeOpen, onIframeChange]);

  // Safe server-side audit logging when iframe mounts
  useEffect(() => {
    if (!prepared?.token || !prepared?.reference || !prepared?.statusToken) return;
    void recordPaymentClientEvent(prepared.reference, prepared.statusToken, "paytr_iframe_opened");
  }, [prepared?.token, prepared?.reference, prepared?.statusToken]);

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
    <div>
      {prepared?.token ? (
        <div className={styles.iframeBox}>
          {/*
            PayTR'nin ödeme formu (kart alanları + taksit seçenekleri + "Ödemeyi
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
            scrolling="auto"
            style={{ minHeight: "850px", width: "100%" }}
          />
          {/*
            PayTR token'i tek kullanimliktir; kullanici geri gelip cerceveyi
            yeniden yuklerse PayTR kendi sayfasinda "Bu odeme sayfasi artik
            gecersiz" der. Bu buton kullaniciyi cikmaza birakmaz: tek tikla
            yepyeni bir odeme oturumu baslatilir.
          */}
          <div className={styles.iframeFoot}>
            <p>
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
              className={styles.ghostBtn}
            >
              {starting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {isTr ? "Yeni Ödeme Oturumu Başlat" : "Start a New Payment Session"}
            </button>
          </div>
        </div>
      ) : (
        <div className={`${styles.payBox} ${contextReady ? styles.ready : ""}`} data-pay-box="">
          {/* Görsel önizleme; gerçek kart alanları PayTR formunda. */}
          <div className={styles.skeleton} aria-hidden="true">
            <div className={styles.skField}><span>{isTr ? "Kart numarası" : "Card number"}</span><i>•••• •••• •••• ••••</i></div>
            <div className={styles.skRow}>
              <div className={styles.skField}><span>{isTr ? "Son kullanma" : "Expiry"}</span><i>{isTr ? "AA / YY" : "MM / YY"}</i></div>
              <div className={styles.skField}><span>CVC</span><i>•••</i></div>
            </div>
          </div>
          <div className={styles.payStatus}>
            <span className={styles.ic}><LockKeyhole size={14} aria-hidden="true" /></span>
            <p aria-live="polite">
              {contextReady
                ? (isTr ? "Hazır. Devam ettiğinizde PayTR güvenli kart formu açılır." : "Ready. The secure PayTR card form opens when you continue.")
                : pendingMessage}
            </p>
          </div>

          {error ? (
            <div role="alert" aria-live="assertive" className={styles.payError}>
              <p>{error.message}</p>
              {error.requiresLogin ? (
                <button
                  type="button"
                  onClick={() => {
                    const next = `${localizedPath("payment", locale)}${window.location.search}`;
                    router.push(`${unifiedLoginPath(locale)}?next=${encodeURIComponent(next)}&source=checkout`);
                  }}
                  className={styles.ghostBtn}
                >
                  {isTr ? "Yeniden Giriş Yap" : "Sign In Again"}
                  <ArrowRight size={14} />
                </button>
              ) : null}
            </div>
          ) : null}

          <p className={styles.legal}>
            {isTr ? "Ödeme butonuna tıklayarak " : "By clicking the pay button, you confirm that you have read and accepted the "}
            <button type="button" onClick={() => onOpenLegalDoc("preInformation")}>
              {isTr ? "Ön Bilgilendirme Formu" : "Pre-Information Form"}
            </button>
            {", "}
            <button type="button" onClick={() => onOpenLegalDoc("salesAgreement")}>
              {isTr ? "Mesafeli Satış Sözleşmesi" : "Distance Sales Agreement"}
            </button>
            {isTr ? " ve " : " and "}
            <button type="button" onClick={() => onOpenLegalDoc("refundPolicy")}>
              {isTr ? "İptal ve İade Koşulları" : "Cancellation & Refund Policy"}
            </button>
            {isTr
              ? "'nı okuduğunuzu ve kabul ettiğinizi; siparişin ödeme yükümlülüğü doğurduğunu onaylamış olursunuz."
              : ", and acknowledge that placing the order creates a payment obligation."}
          </p>

          {error?.requiresLogin ? null : (
            <button
              ref={payButtonRef}
              type="button"
              onClick={() => void handleProceedToPayment()}
              disabled={!contextReady || starting}
              className={styles.payBtn}
              data-pay-button=""
            >
              {starting ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  {isTr ? "Ödeme hazırlanıyor…" : "Preparing payment…"}
                </>
              ) : (
                <>
                  <LockKeyhole size={16} aria-hidden="true" />
                  <span>{payLabel}</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      <div className={styles.trust}>
        <span><ShieldCheck size={14} aria-hidden="true" />{isTr ? "3D Secure doğrulama" : "3D Secure verification"}</span>
        <span><LockKeyhole size={14} aria-hidden="true" />{isTr ? "256-bit SSL şifreleme" : "256-bit SSL encryption"}</span>
        <span><Check size={14} aria-hidden="true" />{isTr ? "Kart bilgileriniz sunucularımızda saklanmaz" : "Your card details are never stored on our servers"}</span>
      </div>
    </div>
  );
}
