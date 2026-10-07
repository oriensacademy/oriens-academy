"use client";

import type { InputHTMLAttributes } from "react";
import { formatTrNumberInput, parseTrNumberInput } from "@/lib/format/turkish";

type TrNumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode"> & {
  /** İç değer: binlik ayırıcısız, ondalık noktalı ("3200", "12.5"). */
  value: string;
  onValueChange: (value: string) => void;
  /** Virgülle ondalık girişine izin verir (ör. EUR, iade tutarı). */
  decimals?: boolean;
};

/**
 * Fiyat alanı: yazarken sağdan üç basamakta bir nokta koyar (3200 → 3.200).
 * Forma giden değer değişmez; yalnız görünüm biçimlenir.
 */
export function TrNumberInput({ value, onValueChange, decimals = false, ...rest }: TrNumberInputProps) {
  return (
    <input
      {...rest}
      type="text"
      inputMode={decimals ? "decimal" : "numeric"}
      autoComplete="off"
      value={formatTrNumberInput(value, decimals)}
      onChange={(event) => {
        const input = event.target;
        const caret = input.selectionStart ?? input.value.length;
        const significant = input.value.slice(0, caret).replace(/[^\d,]/g, "").length;
        onValueChange(parseTrNumberInput(input.value, decimals));
        // Biçimleme noktaları ekleyip silerken imleç yerinde kalsın.
        requestAnimationFrame(() => {
          if (document.activeElement !== input) return;
          let position = 0;
          let seen = 0;
          while (position < input.value.length && seen < significant) {
            if (/[\d,]/.test(input.value[position])) seen += 1;
            position += 1;
          }
          input.setSelectionRange(position, position);
        });
      }}
    />
  );
}
