import { localizeErrorMessage } from "@/lib/utils/error-messages";

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
  PHONE_REQUIRED: {
    tr: "Ödeme için 3D Secure telefon numarası gereklidir.",
    en: "A 3D Secure phone number is required to make a payment.",
  },
  INVALID_PHONE: {
    tr: "Lütfen geçerli bir telefon numarası girin.",
    en: "Please enter a valid phone number.",
  },
  UNSUPPORTED_CURRENCY: {
    tr: "Bu para birimiyle ödeme şu anda desteklenmiyor.",
    en: "Payment in this currency is not currently supported.",
  },
  AGREEMENT_RECORD_FAILED: {
    tr: "Ödeme koşullarının onayı kaydedilemedi. Lütfen tekrar deneyin.",
    en: "Your acceptance of the payment terms could not be recorded. Please try again.",
  },
  LEGAL_ACCEPTANCE_REQUIRED: {
    tr: "Ödeme koşullarının onayı kaydedilemedi. Lütfen tekrar deneyin.",
    en: "Your acceptance of the payment terms could not be recorded. Please try again.",
  },
  PAYTR_SESSION_FAILED: {
    tr: "Ödeme sağlayıcısına bağlanırken bir sorun oluştu. Lütfen tekrar deneyin.",
    en: "There was a problem connecting to the payment provider. Please try again.",
  },
  NETWORK_ERROR: {
    tr: "Bağlantı sırasında bir sorun oluştu.",
    en: "A network error occurred.",
  },
  // PayTR iframe token'i tek kullanimliktir. Bayat bir oturum bulundugunda
  // sunucu onu arsivler ve istemciden taze bir oturum istemesini bekler.
  PAYMENT_SESSION_RETRY: {
    tr: "Ödeme oturumu yenilendi. Lütfen tekrar deneyin.",
    en: "The payment session was refreshed. Please try again.",
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
    return localizeErrorMessage(
      serverMessage.trim(),
      locale,
      locale === "tr"
        ? "Ödeme işlemi şu anda hazırlanamadı. Lütfen tekrar deneyin."
        : "Payment could not be prepared. Please try again."
    );
  }

  return locale === "tr"
    ? "Ödeme ekranı şu anda hazırlanamadı. Lütfen tekrar deneyin."
    : "Payment screen could not be prepared. Please try again.";
}

export function paymentErrorRequiresLogin(code: string | undefined): boolean {
  return code === "SESSION_EXPIRED" || code === "INVALID_SESSION";
}
