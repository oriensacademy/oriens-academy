"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, FileCheck2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import type { Locale } from "@/content/dictionaries";
import { getPaymentCopy } from "@/content/payment";
import { confirmPaymentAgreements, createPaytrToken, type CreatePaytrTokenResult } from "@/lib/payments/client";
import { localizedPath, unifiedLoginPath } from "@/lib/routes";
import { paymentErrorRequiresLogin } from "@/lib/payments/public-errors";

interface ErrorState {
  message: string;
  retryable: boolean;
  requiresLogin: boolean;
}

interface PreparedPayment {
  token: string;
  merchantOid: string;
  reference: string;
  statusToken?: string;
  zeroPayment?: boolean;
  legalAccepted: boolean;
  finalAmount?: number;
  currency?: string;
}

interface HostedCardPanelProps {
  packageIds: string[];
  couponCode?: string;
  learnerId: string;
  guardianUserId?: string;
  paymentPhone: string;
  termsAccepted: boolean;
  refundPolicyAccepted: boolean;
  onTokenReady?: (result: CreatePaytrTokenResult) => void;
  contextReady: boolean;
  emailVerified?: boolean;
  locale: Locale;
}

export function HostedCardPanel({
  packageIds,
  couponCode,
  learnerId,
  guardianUserId,
  paymentPhone,
  termsAccepted,
  refundPolicyAccepted,
  onTokenReady,
  contextReady,
  emailVerified = true,
  locale,
}: HostedCardPanelProps) {
  const copy = getPaymentCopy(locale);
  const router = useRouter();
  const isTr = locale === "tr";

  const isAgreementsAccepted = Boolean(termsAccepted && refundPolicyAccepted);
  const [loading, setLoading] = useState(false);
  const [prepared, setPrepared] = useState<PreparedPayment | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Stable sorted packages key to prevent array reference recreation triggers
  const sortedPackagesKey = useMemo(() => [...packageIds].sort().join(","), [packageIds]);
  const inFlightKeyRef = useRef<string>("");
  const preparedKeyRef = useRef<string>("");
  const activeAbortRef = useRef<AbortController | null>(null);
  const confirmedAgreementOidRef = useRef<string>("");

  const retry = useCallback(() => {
    inFlightKeyRef.current = "";
    preparedKeyRef.current = "";
    setPrepared(null);
    setError(null);
    setAttempt((v) => v + 1);
  }, []);

  // 1. PAYMENT PRELOAD: Prepare early in the background once context is ready
  useEffect(() => {
    if (!contextReady || !sortedPackagesKey || !learnerId) {
      return;
    }

    const currentContextKey = `${sortedPackagesKey}:${couponCode || ""}:${learnerId}:${guardianUserId || ""}:${paymentPhone}:${locale}:${attempt}`;

    // Single-flight lock: If already in-flight or prepared for this exact checkout context, do not duplicate
    if (inFlightKeyRef.current === currentContextKey || preparedKeyRef.current === currentContextKey) {
      return;
    }

    // Cancel any previous in-flight preload for a stale context
    if (activeAbortRef.current) {
      activeAbortRef.current.abort();
    }
    const abortCtrl = new AbortController();
    activeAbortRef.current = abortCtrl;
    inFlightKeyRef.current = currentContextKey;

    let isActive = true;
    setLoading(true);
    setError(null);

    void createPaytrToken({
      packageIds,
      couponCode,
      learnerId,
      guardianUserId,
      paymentPhone,
      locale,
      termsAccepted: false,
      refundPolicyAccepted: false,
    }).then((result) => {
      if (!isActive || abortCtrl.signal.aborted) {
        if (inFlightKeyRef.current === currentContextKey) {
          inFlightKeyRef.current = "";
        }
        return;
      }
      setLoading(false);
      inFlightKeyRef.current = "";

      if (result.success && (result.iframe_token || result.zero_payment)) {
        preparedKeyRef.current = currentContextKey;
        const prep: PreparedPayment = {
          token: result.iframe_token || "",
          merchantOid: result.merchant_oid || result.reference || "",
          reference: result.reference || result.merchant_oid || "",
          statusToken: result.statusToken,
          zeroPayment: Boolean(result.zero_payment),
          legalAccepted: false,
          finalAmount: result.final_amount,
          currency: result.currency,
        };
        setPrepared(prep);
        onTokenReady?.(result);
      } else {
        setError({
          message: result.message || (isTr ? "Ödeme ekranı şu anda hazırlanamadı." : "Payment screen could not be prepared."),
          retryable: ["NETWORK_ERROR", "TOKEN_ERROR", "PAYTR_SESSION_FAILED", "INTERNAL_ERROR"].includes(result.errorCode || ""),
          requiresLogin: paymentErrorRequiresLogin(result.errorCode),
        });
      }
    });

    return () => {
      isActive = false;
      abortCtrl.abort();
    };
    // sortedPackagesKey represents stable identity of packageIds without object reference recreation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, contextReady, couponCode, guardianUserId, isTr, learnerId, locale, onTokenReady, paymentPhone, sortedPackagesKey]);

  // 2. AUDITABLE LEGAL ACCEPTANCE CONFIRMATION
  // When user checks both agreements, persist legal timestamp server-side if not already recorded
  useEffect(() => {
    if (!isAgreementsAccepted || !prepared || !prepared.merchantOid) return;

    if (prepared.zeroPayment && prepared.reference && prepared.statusToken) {
      const path = locale === "en" ? "/en/payment/success" : "/tr/odeme/basarili";
      router.push(`${path}?reference=${encodeURIComponent(prepared.reference)}&token=${encodeURIComponent(prepared.statusToken)}`);
      return;
    }

    if (!prepared.legalAccepted && confirmedAgreementOidRef.current !== prepared.merchantOid) {
      confirmedAgreementOidRef.current = prepared.merchantOid;
      void confirmPaymentAgreements(prepared.merchantOid).then((ok) => {
        if (ok) {
          setPrepared((prev) => (prev ? { ...prev, legalAccepted: true } : prev));
        }
      });
    }
  }, [isAgreementsAccepted, prepared, locale, router]);

  // 3. PAYTR IFRAME RESIZER
  useEffect(() => {
    if (!prepared?.token || !isAgreementsAccepted) return;
    const scriptId = "paytr-iframe-resizer";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    const initialize = () => {
      const resize = (window as unknown as { iFrameResize?: (options: Record<string, unknown>, target: string) => void }).iFrameResize;
      if (typeof resize === "function") resize({}, "#paytriframe");
    };
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://www.paytr.com/js/iframeResizer.min.js";
      script.async = true;
      script.onload = initialize;
      document.body.appendChild(script);
    } else {
      initialize();
    }
  }, [prepared?.token, isAgreementsAccepted]);

  return (
    <div className="space-y-4">
      {/* Context Not Ready State */}
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
      ) : loading && !prepared ? (
        /* Preparing State: Early preload in background */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-[#F6F8F3] p-12 text-center" role="status">
          <Loader2 className="size-8 animate-spin text-[#819586]" />
          <p className="mt-4 text-xs font-semibold text-[#10271B]">
            {isTr ? "Güvenli ödeme altyapısı hazırlanıyor…" : "Preparing secure payment…"}
          </p>
        </div>
      ) : error ? (
        /* Error State with Retry / Re-login */
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto size-6 text-red-600" />
          <p className="mt-3 text-sm font-semibold text-red-900">{error.message}</p>
          {error.requiresLogin ? (
            <button
              type="button"
              onClick={() => {
                const next = `${localizedPath("payment", locale)}${window.location.search}`;
                router.push(`${unifiedLoginPath(locale)}?next=${encodeURIComponent(next)}&source=checkout`);
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest"
            >
              {isTr ? "Yeniden Giriş Yap" : "Sign In Again"}
              <ArrowRight className="size-3.5" />
            </button>
          ) : error.retryable ? (
            <button
              type="button"
              onClick={retry}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-900 hover:bg-red-50"
            >
              <RefreshCw className="size-3.5" />
              {isTr ? "Tekrar Dene" : "Retry"}
            </button>
          ) : null}
        </div>
      ) : !isAgreementsAccepted ? (
        /* Prepared in Background, but Locked Until Agreements Checked */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#819586]/40 bg-[#F6F8F3] p-8 text-center sm:p-10">
          <FileCheck2 className="size-7 text-[#10271B]" />
          <h3 className="mt-4 font-heading text-base font-semibold text-[#10271B]">
            {isTr ? "Sözleşme Onayı Bekleniyor" : "Agreement Acceptance Required"}
          </h3>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-[#68756C]">
            {isTr
              ? "Güvenli ödeme altyapısı hazırlandı. Ödemeye geçmek için lütfen yukarıdaki sözleşme koşullarını onaylayınız."
              : "Payment infrastructure is ready. Please accept the agreement terms above to proceed."}
          </p>
        </div>
      ) : prepared?.token ? (
        /* Actionable / Unlocked State: Display PayTR iFrame Immediately */
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-xs">
          <iframe
            id="paytriframe"
            title="PayTR Secure Payment"
            src={`https://www.paytr.com/odeme/guvenli/${prepared.token}`}
            className="min-h-[70dvh] w-full border-0 sm:min-h-[480px]"
            scrolling="no"
          />
        </div>
      ) : null}

      <div className="flex items-start gap-2 rounded-xl bg-surface-muted p-3 text-[11px] leading-relaxed text-[#68756C]">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <span>{copy.secureText}</span>
      </div>
    </div>
  );
}
