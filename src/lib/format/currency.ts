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
 * - Decimals only shown when nonzero (e.g. ₺3.200 vs ₺3.200,50) unless forceDecimals is true.
 * - Standard currency symbols: ₺ for TRY, $ for USD, € for EUR, £ for GBP.
 * - No oversized or malformed currency symbols.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  options: FormatCurrencyOptions = {}
): string {
  const num = typeof amount === "number" ? amount : Number(amount || 0);
  if (isNaN(num)) return "₺0";

  const currency = (options.currency || "TRY").toUpperCase();
  const isTr = options.locale !== "en";
  const locale = isTr ? "tr-TR" : "en-US";

  // Check if amount has fractional cents (e.g., 2500.50)
  const hasFraction = Math.abs(num % 1) >= 0.009 || options.forceDecimals === true;
  const minDigits = hasFraction ? 2 : 0;
  const maxDigits = hasFraction ? 2 : 0;

  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    }).format(num);

    return formatted;
  } catch {
    const symbolMap: Record<string, string> = {
      TRY: "₺",
      USD: "$",
      EUR: "€",
      GBP: "£",
    };
    const symbol = symbolMap[currency] || `${currency} `;
    const formattedNum = hasFraction
      ? num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : num.toLocaleString(locale);

    return `${symbol}${formattedNum}`;
  }
}

/**
 * Shorthand for Turkish Lira (TRY) currency formatting.
 * Examples: 3200 -> "₺3.200", 3200.50 -> "₺3.200,50"
 */
export function formatTry(amount: number | string | null | undefined, forceDecimals = false): string {
  return formatCurrency(amount, { currency: "TRY", locale: "tr", forceDecimals });
}
