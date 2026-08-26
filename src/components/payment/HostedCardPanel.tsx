"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { AlertCircle, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import type { Locale } from "@/content/dictionaries";
import { getPaymentCopy } from "@/content/payment";
import { createPaytrToken, type CreatePaytrTokenResult } from "@/lib/payments/client";

export function HostedCardPanel({
  locale,
  packageId,
  couponCode,
  payerName,
  payerPhone,
  onTokenReady,
}: {
  locale: Locale;
  packageId: string;
  couponCode?: string;
  payerName?: string;
  payerPhone?: string;
  onTokenReady?: (tokenResult: CreatePaytrTokenResult) => void;
}) {
  const copy = getPaymentCopy(locale);
  const isTr = locale === "tr";

  const [loading, setLoading] = useState(Boolean(packageId));
  const [iframeToken, setIframeToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setAttempt((c) => c + 1);
  }, []);

  useEffect(() => {
    if (!packageId) {
      return;
    }

    let active = true;

    createPaytrToken({
      packageId,
      couponCode,
      payerName,
      payerPhone,
      locale,
    }).then((result) => {
      if (!active) return;
      setLoading(false);
      if (result.success && result.iframe_token) {
        setIframeToken(result.iframe_token);
        onTokenReady?.(result);
      } else {
        setError(
          result.message ||
            (isTr
              ? "Ödeme ekranı şu anda hazırlanamadı. Lütfen tekrar deneyin."
              : "Payment screen could not be prepared. Please try again.")
        );
      }
    });

    return () => {
      active = false;
    };
  }, [packageId, couponCode, payerName, payerPhone, locale, onTokenReady, isTr, attempt]);

  // Load PayTR official iframeResizer script
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
      script.onload = () => initResizer();
      document.body.appendChild(script);
    } else {
      initResizer();
    }

    return () => {
      try {
        const iframe = document.getElementById("paytriframe") as unknown as {
          iFrameResizer?: { close: () => void };
        };
        if (iframe?.iFrameResizer) {
          iframe.iFrameResizer.close();
        }
      } catch {
        /* ignore */
      }
    };
  }, [iframeToken]);

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-muted/50 py-16 px-6 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="mt-4 font-heading text-base font-semibold text-ink">
            {isTr ? "Güvenli ödeme ekranı hazırlanıyor..." : "Preparing secure payment screen..."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isTr
              ? "PayTR 256-bit SSL şifreli kart paneline bağlanılıyor."
              : "Connecting to PayTR 256-bit SSL encrypted payment gateway."}
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 p-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100 text-red-700">
            <AlertCircle className="size-6" />
          </div>
          <p className="mt-3 font-semibold text-sm text-red-900">{error}</p>
          <p className="mt-1 text-xs text-red-700">
            {isTr
              ? "Lütfen internet bağlantınızı kontrol edip yeniden deneyiniz."
              : "Please check your network and try again."}
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-forest cursor-pointer"
          >
            <RefreshCw className="size-3.5" />
            {isTr ? "Tekrar Dene" : "Try Again"}
          </button>
        </div>
      )}

      {iframeToken && !loading && (
        <div className="relative min-h-[620px] w-full overflow-hidden rounded-2xl border border-border bg-white shadow-xs">
          <iframe
            ref={iframeRef}
            src={`https://www.paytr.com/odeme/guvenli/${iframeToken}`}
            id="paytriframe"
            frameBorder="0"
            scrolling="no"
            style={{ width: "100%", minHeight: "650px", border: "none" }}
            className="w-full"
            title="PayTR Secure Card Payment"
          />
        </div>
      )}

      {/* Security & 3D Secure Protection Notice with Visa/Mastercard Marks */}
      <div className="rounded-xl border border-[#DDE4DC] bg-[#F8FAF7] p-4 text-xs text-[#10271B]">
        <div className="flex items-start gap-3">
          <ShieldCheck className="size-5 shrink-0 text-[#819586] mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="font-semibold text-ink">
                {isTr ? "256-Bit SSL & 3D Secure Güvencesi" : "256-Bit SSL & 3D Secure Protection"}
              </p>
              <Image
                src="/images/payment-methods.png"
                alt="Visa & Mastercard"
                width={120}
                height={30}
                className="h-4 w-auto object-contain opacity-90"
              />
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {copy.secureText}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
