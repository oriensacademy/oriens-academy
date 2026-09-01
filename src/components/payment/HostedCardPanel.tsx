"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { AlertCircle, ArrowRight, FileCheck2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import type { Locale } from "@/content/dictionaries";
import { getPaymentCopy } from "@/content/payment";
import { createPaytrToken, type CreatePaytrTokenResult } from "@/lib/payments/client";

interface ErrorState {
  title: string;
  subtitle: string;
}

export function HostedCardPanel({
  locale,
  packageId,
  couponCode,
  learnerId,
  guardianUserId,
  payerAddress,
  addressErrorText,
  onAddressInvalid,
  contextReady = false,
  termsAccepted = false,
  refundPolicyAccepted = false,
  onTokenReady,
}: {
  locale: Locale;
  packageId: string;
  couponCode?: string;
  learnerId: string;
  guardianUserId?: string;
  payerAddress: string;
  addressErrorText: string;
  onAddressInvalid?: () => void;
  contextReady?: boolean;
  termsAccepted?: boolean;
  refundPolicyAccepted?: boolean;
  onTokenReady?: (tokenResult: CreatePaytrTokenResult) => void;
}) {
  const copy = getPaymentCopy(locale);
  const isTr = locale === "tr";
  const isGated = !termsAccepted || !refundPolicyAccepted || !contextReady;

  const [loading, setLoading] = useState(false);
  const [iframeToken, setIframeToken] = useState<string | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [startRequested, setStartRequested] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Cache last fetched token to prevent redundant network delays
  const cachedKeyRef = useRef<string>("");
  const cachedTokenRef = useRef<string>("");

  const retry = useCallback(() => {
    cachedKeyRef.current = "";
    cachedTokenRef.current = "";
    setLoading(true);
    setError(null);
    setAttempt((c) => c + 1);
  }, []);

  useEffect(() => {
    if (!packageId || !learnerId || !termsAccepted || !refundPolicyAccepted || !contextReady || !startRequested) {
      return;
    }

    const currentKey = `${packageId}:${couponCode || ""}:${learnerId}:${guardianUserId || ""}:${payerAddress}:${locale}:${attempt}`;
    if (cachedKeyRef.current === currentKey && cachedTokenRef.current) {
      setIframeToken(cachedTokenRef.current);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      createPaytrToken({
        packageId,
        couponCode,
        learnerId,
        guardianUserId,
        payerAddress,
        locale,
        termsAccepted,
        refundPolicyAccepted,
      }).then((result) => {
        if (!active) return;
        setLoading(false);
        if (result.success && result.iframe_token) {
          cachedKeyRef.current = currentKey;
          cachedTokenRef.current = result.iframe_token;
          setIframeToken(result.iframe_token);
          onTokenReady?.(result);
        } else {
          const isNetwork = result.errorCode === "NETWORK_ERROR";
          if (isNetwork) {
            setError({
              title: isTr ? "Bağlantı Kurulamadı" : "Connection Failed",
              subtitle: isTr
                ? "İnternet bağlantınızı kontrol edip yeniden deneyin."
                : "Please check your network and try again.",
            });
          } else {
            setError({
              title:
                result.message ||
                (isTr
                  ? "Ödeme ekranı şu anda hazırlanamadı."
                  : "Payment screen could not be prepared."),
              subtitle: isTr
                ? "Güvenli ödeme oturumu başlatılamadı. Lütfen tekrar deneyin."
                : "Could not initialize secure payment session. Please try again.",
            });
          }
        }
      });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    packageId,
    couponCode,
    learnerId,
    guardianUserId,
    payerAddress,
    contextReady,
    startRequested,
    locale,
    termsAccepted,
    refundPolicyAccepted,
    onTokenReady,
    isTr,
    attempt,
  ]);

  // Load PayTR official iframeResizer script (V2)
  useEffect(() => {
    if (!iframeToken) return;

    const scriptId = "paytr-iframe-resizer";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initResizer = () => {
      try {
        const win = window as unknown as {
          iFrameResize?: (options: Record<string, unknown>, target: string) => void;
        };
        if (typeof win.iFrameResize === "function") {
          win.iFrameResize({}, "#paytriframe");
        }
      } catch (err) {
        console.warn("[paytr] iFrameResize initialization warning:", err);
      }
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://www.paytr.com/js/iframeResizer.min.js";
      script.async = true;
      script.onload = initResizer;
      document.body.appendChild(script);
    } else {
      initResizer();
    }
  }, [iframeToken]);

  return (
    <div className="space-y-4">
      {/* 1. Legal Acceptance Gated State */}
      {isGated ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#819586]/40 bg-[#F6F8F3] p-8 text-center sm:p-10">
          <div className="flex size-12 items-center justify-center rounded-full bg-[#10271B]/5 text-primary">
            <FileCheck2 className="size-6 text-[#10271B]" />
          </div>
          <h3 className="mt-4 font-heading text-base font-semibold text-[#10271B]">
            {isTr ? "Sözleşme Onayı Bekleniyor" : "Agreement Acceptance Required"}
          </h3>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-[#68756C]">
            {isTr
              ? "Güvenli PayTR ödeme ekranının açılması için lütfen yukarıdaki Ön Bilgilendirme Formu, Mesafeli Satış Sözleşmesi ve İptal/İade Koşullarını onaylayınız."
              : "Please accept the Pre-Information Form, Distance Sales Agreement, and Cancellation/Refund Policy above to enable the secure PayTR payment screen."}
          </p>
          <div className="mt-5 flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-[11px] font-medium text-[#10271B] border border-border shadow-xs">
            <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
            <span>
              {isTr
                ? "Onayınızın ardından 256-Bit SSL korumalı kart formu yüklenecektir."
                : "256-bit SSL encrypted card form will load upon acceptance."}
            </span>
          </div>
        </div>
      ) : !startRequested ? (
        <button
          type="button"
          onClick={() => {
            if (payerAddress.length < 10 || payerAddress.length > 300) {
              onAddressInvalid?.();
              setError({ title: addressErrorText, subtitle: isTr ? "Ödeme adresinizi kontrol edip tekrar deneyin." : "Review your billing address and try again." });
              return;
            }
            setError(null);
            setStartRequested(true);
          }}
          className="group inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-6 text-base font-bold text-white shadow-lg shadow-ink/15 transition-all hover:-translate-y-0.5 hover:bg-forest hover:shadow-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ShieldCheck className="size-5" />
          {isTr ? "Ödemeye Geç" : "Proceed to Payment"}
          <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
        </button>
      ) : loading ? (
        /* 2. Loading State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-[#F6F8F3] p-12 text-center">
          <Loader2 className="size-8 animate-spin text-[#819586]" />
          <p className="mt-4 text-xs font-semibold text-[#10271B]">
            {isTr ? "Güvenli kart formu hazırlanıyor…" : "Preparing secure payment form…"}
          </p>
          <p className="mt-1 text-[11px] text-[#68756C]">
            {isTr
              ? "PayTR 256-Bit SSL korumalı ödeme oturumu açılıyor."
              : "Establishing PayTR 256-bit SSL encrypted checkout session."}
          </p>
        </div>
      ) : error ? (
        /* 3. Error State */
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertCircle className="size-5" />
          </div>
          <h3 className="mt-3 font-semibold text-red-900 text-xs">{error.title}</h3>
          <p className="mt-1 text-xs text-red-700">{error.subtitle}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-900 hover:bg-red-50 transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className="size-3.5" />
            <span>{isTr ? "Tekrar Dene" : "Retry"}</span>
          </button>
        </div>
      ) : iframeToken ? (
        /* 4. Active PayTR iFrame */
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-xs">
          <iframe
            ref={iframeRef}
            id="paytriframe"
            title="PayTR Secure Payment"
            src={`https://www.paytr.com/odeme/guvenli/${iframeToken}`}
            className="w-full border-0 min-h-[480px]"
            scrolling="no"
          />
        </div>
      ) : null}

      {/* Trust & Provider Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[11px] text-[#68756C]">
        <div className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="size-4 text-emerald-600" />
          <span>{copy.secureText}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Image
              src="/images/paytr-logo.svg"
              alt="PayTR"
              width={56}
              height={18}
              className="h-4 w-auto grayscale contrast-200 opacity-70"
            />
          </div>
          <span className="text-[10px] text-muted-foreground">256-Bit SSL · 3D Secure</span>
        </div>
      </div>
    </div>
  );
}
