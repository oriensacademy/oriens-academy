"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, FileCheck2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import type { Locale } from "@/content/dictionaries";
import { getPaymentCopy } from "@/content/payment";
import { createPaytrToken, type CreatePaytrTokenResult } from "@/lib/payments/client";

interface ErrorState { message: string; retryable: boolean; }

export function HostedCardPanel({ locale, packageIds, couponCode, learnerId, guardianUserId, contextReady = false, termsAccepted = false, refundPolicyAccepted = false, onTokenReady }: {
  locale: Locale; packageIds: string[]; couponCode?: string; learnerId: string; guardianUserId?: string;
  contextReady?: boolean; termsAccepted?: boolean; refundPolicyAccepted?: boolean;
  onTokenReady?: (tokenResult: CreatePaytrTokenResult) => void;
}) {
  const copy = getPaymentCopy(locale);
  const router = useRouter();
  const isTr = locale === "tr";
  const isGated = !termsAccepted || !refundPolicyAccepted || !contextReady;
  const [loading, setLoading] = useState(false);
  const [iframeToken, setIframeToken] = useState<string | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [startRequested, setStartRequested] = useState(false);
  const cachedKeyRef = useRef("");
  const cachedTokenRef = useRef("");

  const retry = useCallback(() => { cachedKeyRef.current = ""; cachedTokenRef.current = ""; setError(null); setAttempt((value) => value + 1); }, []);

  useEffect(() => {
    if (!packageIds.length || !learnerId || isGated || !startRequested) return;
    const currentKey = `${packageIds.join(",")}:${couponCode || ""}:${learnerId}:${guardianUserId || ""}:${locale}:${attempt}`;
    if (cachedKeyRef.current === currentKey && cachedTokenRef.current) { setIframeToken(cachedTokenRef.current); return; }
    let active = true;
    setLoading(true);
    setError(null);
    void createPaytrToken({ packageIds, couponCode, learnerId, guardianUserId, locale, termsAccepted, refundPolicyAccepted }).then((result) => {
      if (!active) return;
      setLoading(false);
      if (result.success && result.zero_payment && result.reference && result.statusToken) {
        onTokenReady?.(result);
        const path = locale === "en" ? "/en/payment/success" : "/tr/odeme/basarili";
        router.push(`${path}?reference=${encodeURIComponent(result.reference)}&token=${encodeURIComponent(result.statusToken)}`);
      } else if (result.success && result.iframe_token) {
        cachedKeyRef.current = currentKey; cachedTokenRef.current = result.iframe_token; setIframeToken(result.iframe_token); onTokenReady?.(result);
      } else {
        setError({ message: result.message || (isTr ? "Ödeme ekranı şu anda hazırlanamadı." : "Payment screen could not be prepared."), retryable: ["NETWORK_ERROR", "TOKEN_ERROR", "PAYTR_SESSION_FAILED", "INTERNAL_ERROR"].includes(result.errorCode || "") });
      }
    });
    return () => { active = false; };
  }, [attempt, couponCode, guardianUserId, isGated, isTr, learnerId, locale, onTokenReady, packageIds, refundPolicyAccepted, router, startRequested, termsAccepted]);

  useEffect(() => {
    if (!iframeToken) return;
    const scriptId = "paytr-iframe-resizer";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    const initialize = () => { const resize = (window as unknown as { iFrameResize?: (options: Record<string, unknown>, target: string) => void }).iFrameResize; if (typeof resize === "function") resize({}, "#paytriframe"); };
    if (!script) { script = document.createElement("script"); script.id = scriptId; script.src = "https://www.paytr.com/js/iframeResizer.min.js"; script.async = true; script.onload = initialize; document.body.appendChild(script); } else initialize();
  }, [iframeToken]);

  return <div className="space-y-4">
    {isGated ? <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#819586]/40 bg-[#F6F8F3] p-8 text-center sm:p-10"><FileCheck2 className="size-7 text-[#10271B]" /><h3 className="mt-4 font-heading text-base font-semibold text-[#10271B]">{isTr ? "Sözleşme Onayı Bekleniyor" : "Agreement Acceptance Required"}</h3><p className="mt-2 max-w-md text-xs leading-relaxed text-[#68756C]">{isTr ? "Ödemeye devam etmek için sözleşmeleri onaylayın." : "Accept the agreements to continue to payment."}</p></div>
      : !startRequested ? <button type="button" onClick={() => { setError(null); setStartRequested(true); }} className="group inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-6 text-base font-bold text-white shadow-lg shadow-ink/15 transition-all hover:-translate-y-0.5 hover:bg-forest focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2"><ShieldCheck className="size-5" />{isTr ? "Ödemeye Geç" : "Proceed to Payment"}<ArrowRight className="size-5" /></button>
      : loading ? <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-[#F6F8F3] p-12 text-center" role="status"><Loader2 className="size-8 animate-spin text-[#819586]" /><p className="mt-4 text-xs font-semibold text-[#10271B]">{isTr ? "Güvenli ödeme hazırlanıyor…" : "Preparing secure payment…"}</p></div>
      : error ? <div role="alert" aria-live="assertive" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"><AlertCircle className="mx-auto size-6 text-red-600" /><p className="mt-3 text-sm font-semibold text-red-900">{error.message}</p>{error.retryable ? <button type="button" onClick={retry} className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-900 hover:bg-red-50"><RefreshCw className="size-3.5" />{isTr ? "Tekrar Dene" : "Retry"}</button> : null}</div>
      : iframeToken ? <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-xs"><iframe id="paytriframe" title="PayTR Secure Payment" src={`https://www.paytr.com/odeme/guvenli/${iframeToken}`} className="min-h-[480px] w-full border-0" scrolling="no" /></div> : null}
    <div className="flex items-start gap-2 rounded-xl bg-surface-muted p-3 text-[11px] leading-relaxed text-[#68756C]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span>{copy.secureText}</span></div>
  </div>;
}
