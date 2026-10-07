import { formatCurrency } from "@/lib/format/currency";

export interface LocalizedPackageDisplayPrice {
  amount: number | null;
  currency: "TRY" | "EUR";
  formatted: string;
  usesTryFallback: boolean;
}

/**
 * Customer display selection only. Payment and coupon calculations must keep
 * using the canonical TRY fields and must never call this helper.
 */
export function getLocalizedPackageDisplayPrice({
  locale,
  tryAmount,
  eurAmount,
}: {
  locale: "tr" | "en";
  tryAmount: number | string | null | undefined;
  eurAmount: number | string | null | undefined;
}): LocalizedPackageDisplayPrice {
  const parsedTry = tryAmount == null ? null : Number(tryAmount);
  const parsedEur = eurAmount == null ? null : Number(eurAmount);

  if (locale === "en" && parsedEur !== null && Number.isFinite(parsedEur) && parsedEur > 0) {
    return {
      amount: parsedEur,
      currency: "EUR",
      formatted: formatCurrency(parsedEur, { currency: "EUR", locale: "en", forceDecimals: true }),
      usesTryFallback: false,
    };
  }

  if (parsedTry !== null && Number.isFinite(parsedTry)) {
    return {
      amount: parsedTry,
      currency: "TRY",
      formatted: formatCurrency(parsedTry, { currency: "TRY", locale }),
      usesTryFallback: locale === "en",
    };
  }

  return {
    amount: null,
    currency: locale === "en" ? "EUR" : "TRY",
    formatted: locale === "en" ? "Contact us" : "Bilgi alın",
    usesTryFallback: false,
  };
}
