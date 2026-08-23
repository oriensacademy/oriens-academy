"use client";

import { useState, type ChangeEvent } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, LockKeyhole, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
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
  const isTr = locale === "tr";
  const [flipped, setFlipped] = useState(false);
  const isDev = process.env.NODE_ENV === "development";

  // Ephemeral interactive card inputs (never persisted or stored)
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  const handleCardNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (raw.length >= 3) {
      setExpiry(`${raw.slice(0, 2)}/${raw.slice(2)}`);
    } else {
      setExpiry(raw);
    }
  };

  const handleCvvChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    setCvv(raw);
  };

  return (
    <div className="space-y-6">
      {/* 3D Flip Card Preview */}
      <div className="mx-auto [perspective:1000px] max-w-md">
        <button
          type="button"
          onClick={() => setFlipped((value) => !value)}
          aria-label={isTr ? "Kart ön ve arka yüzünü göster" : "Show front or back of card"}
          className="block aspect-[1.586/1] w-full cursor-pointer rounded-[22px] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4"
        >
          <span
            className={`relative block size-full transition-transform duration-500 motion-reduce:transition-none [transform-style:preserve-3d] ${
              flipped ? "[transform:rotateY(180deg)]" : ""
            }`}
          >
            {/* Front */}
            <span className="absolute inset-0 flex flex-col justify-between rounded-[22px] border border-primary/35 bg-forest p-6 text-left text-white shadow-editorial [backface-visibility:hidden]">
              <span className="flex items-center justify-between">
                <span className="font-heading text-xl tracking-tight">Oriens Academy</span>
                <LockKeyhole className="size-5 text-warm-accent" />
              </span>
              <span className="font-mono text-xl tracking-[0.18em] text-white">
                {cardNumber || "•••• •••• •••• ••••"}
              </span>
              <span className="flex justify-between text-[11px] uppercase tracking-wider text-white/75">
                <span className="truncate max-w-[200px]">{cardHolder || (isTr ? "KART SAHİBİ" : "CARDHOLDER")}</span>
                <span>{expiry || "AA/YY"}</span>
              </span>
            </span>

            {/* Back */}
            <span className="absolute inset-0 rounded-[22px] border border-primary/35 bg-forest p-6 text-left text-white shadow-editorial [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <span className="mt-4 block h-10 bg-white/15 rounded-sm" />
              <span className="mt-6 flex items-center justify-end gap-3">
                <span className="text-xs text-white/70">CVV</span>
                <span className="font-mono rounded bg-white px-3 py-1.5 text-sm font-bold text-ink">
                  {cvv || "•••"}
                </span>
              </span>
              <RotateCcw className="absolute bottom-5 left-6 size-4 text-white/60" />
            </span>
          </span>
        </button>
      </div>

      {/* Card Input Controls */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="cc-number" className="block text-xs font-semibold text-ink">
            {isTr ? "Kart Numarası" : "Card Number"}
          </label>
          <div className="relative mt-1.5">
            <input
              id="cc-number"
              name="cardnumber"
              type="text"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              maxLength={19}
              value={cardNumber}
              onChange={handleCardNumberChange}
              onFocus={() => setFlipped(false)}
              className="min-h-11 w-full rounded-xl border border-input bg-background px-3.5 pr-10 font-mono text-sm tracking-wider text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-primary/20"
            />
            <CreditCard className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="cc-name" className="block text-xs font-semibold text-ink">
            {isTr ? "Kart Üzerindeki İsim" : "Cardholder Name"}
          </label>
          <input
            id="cc-name"
            name="ccname"
            type="text"
            autoComplete="cc-name"
            placeholder={isTr ? "Ad Soyad" : "Full Name"}
            value={cardHolder}
            onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
            onFocus={() => setFlipped(false)}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm uppercase text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label htmlFor="cc-exp" className="block text-xs font-semibold text-ink">
            {isTr ? "Son Kullanma Tarihi" : "Expiry Date"}
          </label>
          <input
            id="cc-exp"
            name="ccexp"
            type="text"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="AA/YY"
            maxLength={5}
            value={expiry}
            onChange={handleExpiryChange}
            onFocus={() => setFlipped(false)}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-input bg-background px-3.5 font-mono text-sm tracking-wider text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label htmlFor="cc-csc" className="block text-xs font-semibold text-ink">
            {isTr ? "Güvenlik Kodu (CVV)" : "CVV Code"}
          </label>
          <input
            id="cc-csc"
            name="cvv"
            type="password"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="•••"
            maxLength={4}
            value={cvv}
            onChange={handleCvvChange}
            onFocus={() => setFlipped(true)}
            onBlur={() => setFlipped(false)}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-input bg-background px-3.5 font-mono text-sm tracking-widest text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Security & 3D Secure Protection Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-[#DDE4DC] bg-[#F8FAF7] p-4 text-xs text-[#10271B]">
        <ShieldCheck className="size-5 shrink-0 text-[#819586] mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-ink">
            {isTr ? "256-Bit SSL & 3D Secure Güvencesi" : "256-Bit SSL & 3D Secure Protection"}
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {copy.secureText}
          </p>
        </div>
      </div>

      {/* Local Dev Simulator */}
      {isDev && onMockActionChange && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 text-xs">
          <div className="flex items-center gap-2 font-semibold text-indigo-950">
            <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white">
              Local Dev Only
            </span>
            <span>{isTr ? "Kart Ödeme Simülatörü" : "Card Payment Simulator"}</span>
          </div>
          <p className="mt-1 text-muted-foreground">
            {isTr
              ? "Banka sanal POS entegrasyonu tamamlanana kadar yalnızca localhost ortamında senaryo testi yapabilirsiniz."
              : "Until bank virtual POS is configured, scenario testing is available exclusively on localhost."}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => onMockActionChange("success")}
              className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-semibold transition-colors cursor-pointer ${
                mockAction === "success"
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-border bg-white text-ink hover:bg-emerald-50"
              }`}
            >
              <CheckCircle2 className="size-3.5" />
              {isTr ? "Başarılı (Mock)" : "Success (Mock)"}
            </button>
            <button
              type="button"
              onClick={() => onMockActionChange("failure")}
              className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-semibold transition-colors cursor-pointer ${
                mockAction === "failure"
                  ? "border-rose-600 bg-rose-600 text-white"
                  : "border-border bg-white text-ink hover:bg-rose-50"
              }`}
            >
              <XCircle className="size-3.5" />
              {isTr ? "Banka Reddi (Mock)" : "Decline (Mock)"}
            </button>
            <button
              type="button"
              onClick={() => onMockActionChange("cancel")}
              className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-semibold transition-colors cursor-pointer ${
                mockAction === "cancel"
                  ? "border-amber-600 bg-amber-600 text-white"
                  : "border-border bg-white text-ink hover:bg-amber-50"
              }`}
            >
              <AlertTriangle className="size-3.5" />
              {isTr ? "İptal (Mock)" : "Cancel (Mock)"}
            </button>
          </div>
        </div>
      )}

      {!pendingBankCapabilities.configured && (
        <div className="rounded-xl border border-amber-300/80 bg-amber-50/80 p-4 text-xs text-amber-950 leading-relaxed">
          <p className="font-semibold">{copy.cardPending}</p>
          <p className="mt-1 font-mono text-[10px] text-amber-800">
            BANK POS STATUS: PENDING CONFIGURATION · 3D Secure: REQUIRED
          </p>
        </div>
      )}
    </div>
  );
}

