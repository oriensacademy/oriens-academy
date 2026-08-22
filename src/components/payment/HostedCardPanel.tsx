"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, LockKeyhole, RotateCcw, XCircle } from "lucide-react";
import type { Locale } from "@/content/dictionaries";
import { getPaymentCopy } from "@/content/payment";
import { pendingBankCapabilities } from "@/lib/payments/bank-provider";

export function HostedCardPanel({
  locale,
  mockAction,
  onMockActionChange,
}: {
  locale: Locale;
  mockAction?: "success" | "failure" | "cancel";
  onMockActionChange?: (action: "success" | "failure" | "cancel") => void;
}) {
  const copy = getPaymentCopy(locale);
  const [flipped, setFlipped] = useState(false);
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="space-y-5">
      <div className="mx-auto [perspective:1000px] max-w-md">
        <button
          type="button"
          onClick={() => setFlipped((value) => !value)}
          aria-label={locale === "tr" ? "Kart ön ve arka yüzünü göster" : "Show front or back of card"}
          className="block aspect-[1.586/1] w-full rounded-[22px] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4"
        >
          <span
            className={`relative block size-full transition-transform duration-500 motion-reduce:transition-none [transform-style:preserve-3d] ${
              flipped ? "[transform:rotateY(180deg)]" : ""
            }`}
          >
            <span className="absolute inset-0 flex flex-col justify-between rounded-[22px] border border-primary/35 bg-forest p-6 text-left text-white shadow-editorial [backface-visibility:hidden]">
              <span className="flex items-center justify-between">
                <span className="font-heading text-xl">Oriens Academy</span>
                <LockKeyhole className="size-5 text-warm-accent" />
              </span>
              <span className="font-ui text-xl tracking-[0.14em]">•••• •••• •••• ••••</span>
              <span className="flex justify-between text-[10px] uppercase tracking-wider text-white/70">
                <span>{copy.cardHolder}</span>
                <span>{copy.expiry}</span>
              </span>
            </span>
            <span className="absolute inset-0 rounded-[22px] border border-primary/35 bg-forest p-6 text-left text-white shadow-editorial [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <span className="mt-5 block h-10 bg-white/15" />
              <span className="mt-6 flex items-center justify-end gap-3">
                <span className="text-xs text-white/70">{copy.cvv}</span>
                <span className="rounded bg-surface px-4 py-2 text-sm text-ink">•••</span>
              </span>
              <RotateCcw className="absolute bottom-5 left-6 size-4 text-white/60" />
            </span>
          </span>
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {[copy.cardNumber, copy.cardHolder, copy.expiry, copy.cvv].map((label) => (
          <div key={label} className="rounded-lg border border-border bg-surface-muted p-3">
            <div className="text-xs font-semibold text-ink">{label}</div>
            <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{copy.hostedField}</div>
          </div>
        ))}
      </div>

      {isDev && onMockActionChange && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 text-xs">
          <div className="flex items-center gap-2 font-semibold text-indigo-950">
            <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white">
              Local Dev Only
            </span>
            <span>{locale === "tr" ? "Kart Ödeme Simülatörü" : "Card Payment Simulator"}</span>
          </div>
          <p className="mt-1 text-muted-foreground">
            {locale === "tr"
              ? "Banka sanal POS entegrasyonu tamamlanana kadar yalnızca localhost ortamında senaryo testi yapabilirsiniz."
              : "Until bank virtual POS is configured, scenario testing is available exclusively on localhost."}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => onMockActionChange("success")}
              className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-semibold transition-colors ${
                mockAction === "success"
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-border bg-white text-ink hover:bg-emerald-50"
              }`}
            >
              <CheckCircle2 className="size-3.5" />
              {locale === "tr" ? "Başarılı (Mock)" : "Success (Mock)"}
            </button>
            <button
              type="button"
              onClick={() => onMockActionChange("failure")}
              className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-semibold transition-colors ${
                mockAction === "failure"
                  ? "border-rose-600 bg-rose-600 text-white"
                  : "border-border bg-white text-ink hover:bg-rose-50"
              }`}
            >
              <XCircle className="size-3.5" />
              {locale === "tr" ? "Banka Reddi (Mock)" : "Decline (Mock)"}
            </button>
            <button
              type="button"
              onClick={() => onMockActionChange("cancel")}
              className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-semibold transition-colors ${
                mockAction === "cancel"
                  ? "border-amber-600 bg-amber-600 text-white"
                  : "border-border bg-white text-ink hover:bg-amber-50"
              }`}
            >
              <AlertTriangle className="size-3.5" />
              {locale === "tr" ? "İptal (Mock)" : "Cancel (Mock)"}
            </button>
          </div>
        </div>
      )}

      <div
        className={`rounded-xl p-4 text-sm leading-6 ${
          pendingBankCapabilities.configured
            ? "border border-border bg-surface-muted text-ink"
            : "border border-amber-300 bg-amber-50 text-amber-950"
        }`}
      >
        {!pendingBankCapabilities.configured && !isDev && <p className="font-semibold">{copy.cardPending}</p>}
        <p className="mt-1 text-xs text-muted-foreground">{copy.secureText}</p>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
          {pendingBankCapabilities.configured ? "BANK PROVIDER CONFIGURED" : "PENDING BANK CREDENTIALS"} · 3D Secure:{" "}
          {pendingBankCapabilities.threeDSecure ? "ACTIVE" : "PENDING"}
        </p>
      </div>
    </div>
  );
}
