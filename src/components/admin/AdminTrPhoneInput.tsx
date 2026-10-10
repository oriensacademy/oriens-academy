"use client";

import { formatTrGuardianPhoneInput, formatTrPhoneInput, guardianPhoneInputDigits, trPhoneInputDigits } from "@/lib/format/phone";
import styles from "./admin-tr-phone-input.module.css";

export function AdminTrPhoneInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (digits: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <div className={styles.wrap} data-phone-input="">
      <span className={styles.prefix} aria-hidden="true">+90</span>
      <input
        id={id}
        className={`m-input ${styles.input}`}
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        placeholder="(532) 123 45 67"
        maxLength={24}
        value={formatTrPhoneInput(value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(trPhoneInputDigits(event.target.value))}
      />
    </div>
  );
}

/** Veli telefonu: tek alanda "+90 XXX XXX XX XX" (müşteri revizyonu PDF-14). Değer 10 hane tutulur. */
export function AdminGuardianPhoneInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (digits: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <input
      id={id}
      className="m-input"
      type="tel"
      inputMode="numeric"
      autoComplete="off"
      placeholder="+90 XXX XXX XX XX"
      maxLength={20}
      value={formatTrGuardianPhoneInput(value)}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      data-guardian-phone-input=""
      onChange={(event) => onChange(guardianPhoneInputDigits(event.target.value))}
    />
  );
}
