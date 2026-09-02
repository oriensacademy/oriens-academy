export type PaymentLocale = "tr" | "en";

const PAYMENT_ERROR_COPY: Record<string, Record<PaymentLocale, string>> = {
  SESSION_EXPIRED: {
    tr: "Oturumunuzun süresi dolmuş. Lütfen yeniden giriş yapın.",
    en: "Your session has expired. Please sign in again.",
  },
  INVALID_SESSION: {
    tr: "Oturumunuzun süresi dolmuş. Lütfen yeniden giriş yapın.",
    en: "Your session has expired. Please sign in again.",
  },
  EMAIL_NOT_VERIFIED: {
    tr: "Ödeme yapabilmek için e-posta adresinizi doğrulamanız gerekiyor.",
    en: "You need to verify your email address before making a payment.",
  },
  LEARNER_ACCESS_DENIED: {
    tr: "Bu ödeme için hesap ve öğrenci bilgileri doğrulanamadı.",
    en: "The account and learner details for this payment could not be verified.",
  },
};

export function paymentErrorMessage(
  code: string | undefined,
  locale: PaymentLocale,
  serverMessage?: string
): string {
  const normalizedCode = String(code || "TOKEN_ERROR").toUpperCase();
  const mapped = PAYMENT_ERROR_COPY[normalizedCode]?.[locale];
  if (mapped) return mapped;

  if (serverMessage?.trim() && !/invalid\s+(user\s+)?session/i.test(serverMessage)) {
    return serverMessage.trim();
  }

  return locale === "tr"
    ? "Ödeme ekranı şu anda hazırlanamadı. Lütfen tekrar deneyin."
    : "Payment screen could not be prepared. Please try again.";
}

export function paymentErrorRequiresLogin(code: string | undefined): boolean {
  return code === "SESSION_EXPIRED" || code === "INVALID_SESSION";
}
