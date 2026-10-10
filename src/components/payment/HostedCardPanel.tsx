"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import type { Locale } from "@/content/dictionaries";
import { confirmPaymentAgreements, createPaytrToken, recordPaymentClientEvent } from "@/lib/payments/client";
import type { CreatePaytrTokenResult } from "@/lib/payments/client";
import { localizedPath, paymentSuccessPath, unifiedLoginPath } from "@/lib/routes";
import { paymentErrorMessage, paymentErrorRequiresLogin } from "@/lib/payments/public-errors";
import { LEGAL_VERSIONS } from "@/config/legal";
import type { LegalDocKey } from "@/config/legal";
import styles from "./payment.module.css";

interface ErrorState {
  /** Sunucunun/yerelleştirilmiş ikincil açıklama (ham yanıt asla gösterilmez). */
  detail: string;
  requiresLogin: boolean;
}

interface PreparedPayment {
  token: string;
  reference: string;
  statusToken: string;
}

interface HostedCardPanelProps {
  packageIds: string[];
  couponCode?: string;
  learnerId: string;
  guardianUserId?: string;
  paymentPhone: string;
  contextReady: boolean;
  /** Ekrandaki ödenecek tutar (kuruş). PayTR oturumunun tutarı bununla aynı olmalı. */
  expectedAmountKurus: number;
  /** Bağlam hazır değilken durum satırı (ör. telefon bekleniyor). */
  pendingMessage: string;
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

const LEGAL_ACCEPTED_VERSIONS = {
  salesAgreement: LEGAL_VERSIONS.salesAgreement,
  preInformation: LEGAL_VERSIONS.preInformation,
  refundPolicy: LEGAL_VERSIONS.refundPolicy,
};

/** Bağlam değiştikten sonra token istemeden önce beklenen süre (yazarken istek yağmurunu önler). */
const REQUEST_DEBOUNCE_MS = 350;
/** PayTR iframe'i bu süre içinde `load` olmazsa görünür hata + yeniden dene gösterilir. */
const IFRAME_LOAD_TIMEOUT_MS = 20_000;

function newClientRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Kart bilgisi yalnızca PayTR'nin barındırdığı iframe'e girilir; Oriens hiçbir
 * kart alanı çizmez, kart verisi Oriens DOM/state/backend'inden geçmez.
 *
 * Bağlam hazır olduğunda (e-posta doğrulanmış, paket, geçerli telefon, kupon
 * teklifi) PayTR oturumu otomatik istenir ve form açılır. Her istek kendi
 * `clientRequestId`'sini taşır: sunucu tek kullanımlık bir token'ı yalnız aynı
 * isteğin ağ tekrarına geri verir, böylece yenileme veya kupon/paket değişimi
 * hiçbir zaman tüketilmiş ("bu ödeme sayfası geçersiz") bir formu açmaz.
 * Bağlam değişince sürüm artar; geç gelen eski yanıtlar yok sayılır ve eski
 * iframe hemen kaldırılır.
 *
 * Yasal kabul: oturum oluşturulurken edge function kabul meta verisini işlemin
 * satırına yazar; ardından confirm_payment_agreements ile teyit edilir. Kabul
 * metni PayTR formunun hemen altında, ödemeyi tamamlayan PayTR butonunun
 * yanında gösterilir. Sıfır tutarlı siparişler (ör. %100 kupon) otomatik
 * tamamlanmaz; açık bir "Siparişi tamamla" tıklaması gerekir.
 */
export function HostedCardPanel({
  packageIds,
  couponCode,
  learnerId,
  guardianUserId,
  paymentPhone,
  contextReady,
  expectedAmountKurus,
  pendingMessage,
  onIframeChange,
  locale,
  onOpenLegalDoc,
  onSessionResult,
}: HostedCardPanelProps) {
  const router = useRouter();
  const isTr = locale === "tr";
  const zeroOrder = expectedAmountKurus <= 0;

  const [attempt, setAttempt] = useState(0);
  const [zeroStarting, setZeroStarting] = useState(false);
  /**
   * Oturum durumu, üretildiği istek anahtarıyla saklanır. Bağlam (paket, kupon,
   * telefon, tutar…) veya deneme sayacı değişince anahtar değişir; eski token,
   * iframe ve hata böylece anında geçersiz sayılır.
   */
  const [session, setSession] = useState<{ key: string; prepared: PreparedPayment | null; error: ErrorState | null }>({ key: "", prepared: null, error: null });
  const [loadedToken, setLoadedToken] = useState("");

  const packageKey = packageIds.join(",");
  const requestKey = useMemo(
    () => (contextReady
      ? JSON.stringify([packageKey, couponCode || "", learnerId, guardianUserId || "", paymentPhone, locale, expectedAmountKurus])
      : ""),
    [contextReady, couponCode, expectedAmountKurus, guardianUserId, learnerId, locale, packageKey, paymentPhone],
  );
  const sessionKey = !requestKey ? "" : zeroOrder ? `zero#${requestKey}` : `${requestKey}#${attempt}`;
  const current = sessionKey && session.key === sessionKey ? session : null;
  const prepared = current?.prepared ?? null;
  const error = current?.error ?? null;
  const loading = Boolean(sessionKey) && !zeroOrder && !current;
  const frameLoaded = Boolean(prepared?.token) && loadedToken === prepared?.token;

  const notifySession = useCallback((sessionResult: PaymentSessionResult) => {
    try {
      onSessionResult?.(sessionResult);
    } catch {
      // Denetim bildirimi ödeme akışını asla etkilemez.
    }
  }, [onSessionResult]);

  /** Tek bir PayTR oturumu ister; PAYMENT_SESSION_RETRY'da yeni kimlikle bir kez daha dener. */
  const requestSession = useCallback(async (): Promise<CreatePaytrTokenResult> => {
    const input = {
      packageIds: packageKey ? packageKey.split(",") : [],
      couponCode,
      learnerId,
      guardianUserId,
      paymentPhone,
      locale,
      termsAccepted: true,
      refundPolicyAccepted: true,
      legalVersions: LEGAL_ACCEPTED_VERSIONS,
    };
    let result = await createPaytrToken({ ...input, clientRequestId: newClientRequestId() });
    if (result.errorCode === "PAYMENT_SESSION_RETRY") {
      result = await createPaytrToken({ ...input, clientRequestId: newClientRequestId() });
    }
    return result;
  }, [couponCode, guardianUserId, learnerId, locale, packageKey, paymentPhone]);

  const fail = useCallback((key: string, errorCode: string | undefined, message?: string) => {
    setSession({
      key,
      prepared: null,
      error: {
        detail: message || paymentErrorMessage(errorCode || "TOKEN_ERROR", locale),
        requiresLogin: paymentErrorRequiresLogin(errorCode),
      },
    });
  }, [locale]);

  // Effect yalnız gerçek girdiler (requestKey) ve yeniden deneme sayacıyla
  // tetiklenir; geri çağırımların kimliği değişti diye yeni token istenmez.
  const latestRef = useRef({ requestSession, notifySession, fail, expectedAmountKurus, isTr });
  useEffect(() => {
    latestRef.current = { requestSession, notifySession, fail, expectedAmountKurus, isTr };
  });

  // Otomatik açılış: bağlam (veya yeniden deneme sayacı) her değiştiğinde yeni
  // bir PayTR oturumu istenir; temizlikte eski isteğin geç yanıtı yok sayılır.
  useEffect(() => {
    if (!sessionKey || zeroOrder) return;
    const key = sessionKey;
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      const { requestSession, notifySession, fail, expectedAmountKurus, isTr } = latestRef.current;
      try {
        const result = await requestSession();
        if (cancelled) return;

        if (!result.success || !result.iframe_token) {
          notifySession({ errorCode: result.errorCode || "PAYMENT_SESSION_FAILED" });
          fail(key, result.errorCode, result.message);
          return;
        }

        const reference = result.reference || result.merchant_oid || "";
        // Ekrandaki tutar ile PayTR oturumunun tutarı kuruş düzeyinde aynı olmalı;
        // değilse form gösterilmez (yanlış tutarla ödeme alınmaz).
        const tokenKurus = Math.round(Number(result.final_amount ?? Number.NaN) * 100);
        if (!Number.isFinite(tokenKurus) || tokenKurus !== expectedAmountKurus) {
          notifySession({ reference, errorCode: "AMOUNT_MISMATCH" });
          fail(key, "AMOUNT_MISMATCH", isTr
            ? "Ödeme tutarı güncellendi. Güncel tutarla formu yeniden yükleyin."
            : "The payment amount changed. Reload the form with the current amount.");
          return;
        }

        notifySession({ reference });

        // Zorunlu: kabul teyidi kaydedilemezse ödeme formu gösterilmez
        // (bekleyen işlem 30 dakikalık stale-pending TTL ile kendiliğinden düşer).
        const confirmed = await confirmPaymentAgreements(result.merchant_oid || reference, LEGAL_ACCEPTED_VERSIONS);
        if (cancelled) return;
        if (!confirmed) {
          fail(key, "AGREEMENT_RECORD_FAILED");
          return;
        }

        setSession({ key, prepared: { token: result.iframe_token, reference, statusToken: result.statusToken || "" }, error: null });
      } catch {
        if (cancelled) return;
        notifySession({ errorCode: "NETWORK_ERROR" });
        fail(key, "NETWORK_ERROR");
      }
    }, REQUEST_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sessionKey, zeroOrder]);

  const retry = useCallback(() => {
    // Yükleme sürerken ikinci istek açılmaz.
    if (loading || zeroStarting) return;
    // Sıfır tutarlı siparişte "Siparişi tamamla" adımına dönülür; diğerlerinde aynı girdilerle yeni oturum.
    if (zeroOrder) setSession({ key: "", prepared: null, error: null });
    else setAttempt((value) => value + 1);
  }, [loading, zeroOrder, zeroStarting]);

  /** Sıfır tutarlı sipariş: kullanıcının açık onayıyla sunucuda tamamlanır. */
  const completeZeroOrder = useCallback(async () => {
    if (zeroStarting || !contextReady || !sessionKey) return;
    const key = sessionKey;
    setZeroStarting(true);
    setSession({ key: "", prepared: null, error: null });
    try {
      const result = await requestSession();
      if (!result.success || !result.zero_payment) {
        notifySession({ errorCode: result.errorCode || "PAYMENT_SESSION_FAILED" });
        fail(key, result.errorCode, result.message);
        return;
      }
      notifySession({ reference: result.reference || result.merchant_oid, zero: true });
      if (result.reference && result.statusToken) {
        router.push(`${paymentSuccessPath(locale)}?reference=${encodeURIComponent(result.reference)}&token=${encodeURIComponent(result.statusToken)}`);
      }
    } catch {
      notifySession({ errorCode: "NETWORK_ERROR" });
      fail(key, "NETWORK_ERROR");
    } finally {
      setZeroStarting(false);
    }
  }, [contextReady, fail, locale, notifySession, requestSession, router, sessionKey, zeroStarting]);

  const iframeOpen = Boolean(prepared?.token);
  useEffect(() => {
    onIframeChange?.(iframeOpen);
  }, [iframeOpen, onIframeChange]);

  // Sunucu tarafı denetim kaydı: iframe DOM'a girdiğinde.
  useEffect(() => {
    if (!prepared?.token || !prepared.reference || !prepared.statusToken) return;
    void recordPaymentClientEvent(prepared.reference, prepared.statusToken, "paytr_iframe_opened");
  }, [prepared?.token, prepared?.reference, prepared?.statusToken]);

  // PayTR formu makul sürede yüklenmezse sonsuz yükleme yerine hata + yeniden dene.
  useEffect(() => {
    if (!prepared?.token || frameLoaded) return;
    const key = sessionKey;
    const timer = window.setTimeout(() => fail(key, "PAYTR_FRAME_TIMEOUT", isTr
      ? "PayTR güvenli ödeme formuna ulaşılamadı."
      : "The secure PayTR payment form could not be reached."), IFRAME_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [fail, frameLoaded, isTr, prepared?.token, sessionKey]);

  /**
   * PayTR'nin resmi iframeResizer betiği, ödeme formunun gerçek yüksekliğini
   * üst pencereye bildirip çerçeveyi büyütür. Betik yüklenemezse iframe en az
   * 600px yüksekliğiyle ve kendi kaydırmasıyla kalır; PayTR'nin ödeme butonuna
   * her durumda ulaşılır.
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

  const legalDocs = (
    <>
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
    </>
  );

  let body: ReactNode;
  if (error) {
    body = (
      <div role="alert" aria-live="assertive" className={styles.payError} data-paytr-error="">
        <p>{isTr ? "Ödeme formu yüklenemedi. Tekrar deneyin." : "The payment form could not be loaded. Please try again."}</p>
        {error.detail ? <span className={styles.payErrorDetail}>{error.detail}</span> : null}
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
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        ) : (
          <button type="button" onClick={retry} disabled={loading} className={styles.ghostBtn} data-paytr-retry="">
            <RefreshCw size={14} aria-hidden="true" />
            {isTr ? "Tekrar dene" : "Try again"}
          </button>
        )}
      </div>
    );
  } else if (prepared?.token) {
    body = (
      <div className={styles.iframeBox} data-paytr-frame-state={frameLoaded ? "loaded" : "loading"}>
        {!frameLoaded ? (
          <div className={styles.frameLoading} aria-live="polite">
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            <span>{isTr ? "PayTR güvenli ödeme formu yükleniyor…" : "Loading the secure PayTR payment form…"}</span>
          </div>
        ) : null}
        <iframe
          // Her yeni oturum yepyeni bir iframe elemanıdır: React eski elemanı
          // yeniden kullanıp tüketilmiş bir token'ı ikinci kez yükleyemez.
          key={prepared.token}
          id="paytriframe"
          title={isTr ? "PayTR güvenli ödeme formu" : "PayTR secure payment form"}
          src={`https://www.paytr.com/odeme/guvenli/${prepared.token}`}
          scrolling="auto"
          onLoad={() => setLoadedToken(prepared.token)}
          data-paytr-iframe=""
        />
      </div>
    );
  } else if (loading) {
    body = (
      <div className={styles.payState} aria-live="polite" data-paytr-loading="">
        <span className={styles.ic}><Loader2 size={15} className="animate-spin" aria-hidden="true" /></span>
        <p>{isTr ? "PayTR güvenli ödeme formu hazırlanıyor…" : "Preparing the secure PayTR payment form…"}</p>
      </div>
    );
  } else if (contextReady && zeroOrder) {
    body = (
      <div className={styles.zeroBox}>
        <p>{isTr ? "Bu sipariş için kart ile ödeme gerekmiyor." : "No card payment is required for this order."}</p>
        <button type="button" onClick={() => void completeZeroOrder()} disabled={zeroStarting} className={styles.zeroBtn} data-zero-order="">
          {zeroStarting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
          {isTr ? "Siparişi tamamla" : "Complete order"}
        </button>
      </div>
    );
  } else {
    body = (
      <div className={styles.payState} aria-live="polite" data-paytr-pending="">
        <span className={styles.ic}><LockKeyhole size={14} aria-hidden="true" /></span>
        <p>{pendingMessage}</p>
      </div>
    );
  }

  return (
    <div className={styles.payBox} data-pay-box="">
      {body}

      <p className={styles.legal} data-legal-consent="">
        {zeroOrder
          ? (isTr ? "Siparişi tamamlayarak " : "By completing the order, you confirm that you have read and accepted the ")
          : (isTr ? "Ödemeyi PayTR güvenli formunda tamamlayarak " : "By completing the payment in the secure PayTR form, you confirm that you have read and accepted the ")}
        {legalDocs}
        {isTr
          ? "'nı okuduğunuzu ve kabul ettiğinizi; siparişin ödeme yükümlülüğü doğurduğunu onaylamış olursunuz."
          : ", and acknowledge that placing the order creates a payment obligation."}
      </p>

      <div className={styles.trust}>
        <span><ShieldCheck size={14} aria-hidden="true" />{isTr ? "3D Secure doğrulama" : "3D Secure verification"}</span>
        <span><LockKeyhole size={14} aria-hidden="true" />{isTr ? "256-bit SSL şifreleme" : "256-bit SSL encryption"}</span>
        <span><Check size={14} aria-hidden="true" />{isTr ? "Kart bilgileriniz sunucularımızda saklanmaz" : "Your card details are never stored on our servers"}</span>
      </div>
    </div>
  );
}
