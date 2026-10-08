"use client";

import { formatTrPhoneInput, trPhoneInputDigits } from "@/lib/format/phone";
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
