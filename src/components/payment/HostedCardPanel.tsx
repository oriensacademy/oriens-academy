"use client";

import { useState, useId, useEffect, type ChangeEvent } from "react";
import Image from "next/image";
import { CreditCard, LockKeyhole, RotateCcw, ShieldCheck } from "lucide-react";
import type { Locale } from "@/content/dictionaries";
import { getPaymentCopy } from "@/content/payment";

export interface CardFormState {
  cardNumber: string;
  cardHolder: string;
  expiry: string;
  cvv: string;
}

export function HostedCardPanel({
  locale,
  onValidityChange,
}: {
  locale: Locale;
  onValidityChange?: (isValid: boolean) => void;
}) {
  const copy = getPaymentCopy(locale);
  const isTr = locale === "tr";
  const [flipped, setFlipped] = useState(false);
  const numberId = useId();
  const nameId = useId();
  const expId = useId();
  const cscId = useId();

  // Ephemeral interactive card inputs (never persisted to storage, cookies, or database)
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  // Card brand detection
  const cleanNumber = cardNumber.replace(/\D/g, "");
  const isVisa = cleanNumber.startsWith("4");
  const isMastercard =
    /^5[1-5]/.test(cleanNumber) ||
    /^(222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)/.test(cleanNumber);

  // Expiry validation (MM/YY, valid month 01-12, not expired)
  const isExpiryValid = (() => {
    const clean = expiry.replace(/\D/g, "");
    if (clean.length !== 4) return false;
    const month = parseInt(clean.slice(0, 2), 10);
    const year = parseInt(`20${clean.slice(2)}`, 10);
    if (month < 1 || month > 12) return false;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    if (year < currentYear) return false;
    if (year === currentYear && month < currentMonth) return false;
    return true;
  })();

  const isCardNumberValid = cleanNumber.length === 16;
  const isCardHolderValid = cardHolder.trim().length >= 3;
  const isCvvValid = cvv.length >= 3 && cvv.length <= 4;
  const isFormValid = isCardNumberValid && isCardHolderValid && isExpiryValid && isCvvValid;

  useEffect(() => {
    onValidityChange?.(isFormValid);
  }, [isFormValid, onValidityChange]);

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
                <span className="flex items-center gap-2">
                  {isVisa && (
                    <span className="rounded bg-white/20 px-2 py-0.5 font-heading text-xs font-bold tracking-wider text-white">
                      VISA
                    </span>
                  )}
                  {isMastercard && (
                    <span className="rounded bg-white/20 px-2 py-0.5 font-heading text-xs font-bold tracking-wider text-white">
                      MASTERCARD
                    </span>
                  )}
                  {!isVisa && !isMastercard && <LockKeyhole className="size-5 text-warm-accent" />}
                </span>
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
          <label htmlFor={numberId} className="block text-xs font-semibold text-ink">
            {copy.cardNumber}
          </label>
          <div className="relative mt-1.5">
            <input
              id={numberId}
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
          <label htmlFor={nameId} className="block text-xs font-semibold text-ink">
            {copy.cardHolder}
          </label>
          <input
            id={nameId}
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
          <label htmlFor={expId} className="block text-xs font-semibold text-ink">
            {copy.expiry}
          </label>
          <input
            id={expId}
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
          <label htmlFor={cscId} className="block text-xs font-semibold text-ink">
            {isTr ? "Güvenlik Kodu (CVV)" : "CVV Code"}
          </label>
          <input
            id={cscId}
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
