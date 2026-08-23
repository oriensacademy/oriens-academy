export type SupportedCurrency = "TRY" | "USD" | "EUR" | "GBP" | string;

export interface FormatCurrencyOptions {
  locale?: "tr" | "en" | string;
  currency?: SupportedCurrency;
  forceDecimals?: boolean;
}

/**
 * Formats a monetary amount into a clean, consistent, and localized currency string.
 *
 * Rules:
 * - Decimals only shown when nonzero (e.g. 3.200 TL vs 3.200,50 TL) unless forceDecimals is true.
 * - TR default: "27.000 TL", "0 TL" (avoids broken/stylized ₺ glyph).
 * - EN default: "27,000 TRY" or standard symbol for USD/EUR/GBP ($27,000, €27,000).
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  options: FormatCurrencyOptions = {}
): string {
  const num = typeof amount === "number" ? amount : Number(amount || 0);
  if (isNaN(num)) return options.locale === "en" ? "0 TRY" : "0 TL";

  const currency = (options.currency || "TRY").toUpperCase();
  const isTr = options.locale !== "en";
  const locale = isTr ? "tr-TR" : "en-US";

  // Check if amount has fractional cents (e.g., 2500.50)
  const hasFraction = Math.abs(num % 1) >= 0.009 || options.forceDecimals === true;

  const formattedNum = hasFraction
    ? num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : num.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  if (currency === "TRY") {
    return isTr ? `${formattedNum} TL` : `${formattedNum} TRY`;
  }

  if (currency === "USD") {
    return `$${formattedNum}`;
  }

  if (currency === "EUR") {
    return `€${formattedNum}`;
  }

  if (currency === "GBP") {
    return `£${formattedNum}`;
  }

  return `${formattedNum} ${currency}`;
}

/**
 * Shorthand for Turkish Lira (TRY) currency formatting.
 * Examples: 3200 -> "3.200 TL", 3200.50 -> "3.200,50 TL"
 */
export function formatTry(amount: number | string | null | undefined, forceDecimals = false, locale = "tr"): string {
  return formatCurrency(amount, { currency: "TRY", locale, forceDecimals });
}

