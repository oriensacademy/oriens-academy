import { getSupabaseClient } from "@/lib/supabase/client";
import type { ContactRequestPayload, ContactResult } from "./types";

type ContactErrorCode = Extract<ContactResult, { success: false }>["errorCode"];

const knownErrorCodes = new Set<ContactErrorCode>([
  "INVALID_FULL_NAME", "INVALID_EMAIL", "INVALID_PHONE", "INVALID_SUBJECT", "INVALID_MESSAGE", "INVALID_PACKAGE",
  "PRIVACY_CONSENT_REQUIRED", "BOT_VERIFICATION_REQUIRED", "BOT_VERIFICATION_FAILED",
  "BOT_VERIFICATION_EXPIRED", "TEMPORARY_ERROR", "FORBIDDEN_ORIGIN", "RATE_LIMITED",
  "SERVER_CONFIG_ERROR", "STORAGE_FAILED", "NETWORK_ERROR", "INTERNAL_ERROR",
]);

function messageForError(code: ContactErrorCode, locale: "tr" | "en"): string {
  const isTr = locale === "tr";
  switch (code) {
    case "INVALID_FULL_NAME": return isTr ? "Lütfen geçerli bir ad soyad girin." : "Please enter a valid full name.";
    case "INVALID_EMAIL": return isTr ? "Lütfen geçerli bir e-posta adresi girin." : "Please enter a valid email address.";
    case "INVALID_PHONE": return isTr ? "Telefon alanı zorunludur. Lütfen geçerli bir telefon numarası girin." : "Phone is required. Please enter a valid phone number.";
    case "INVALID_SUBJECT": return isTr ? "Konu alanı çok uzun." : "The subject is too long.";
    case "INVALID_MESSAGE": return isTr ? "Mesajınız 5–2000 karakter arasında olmalıdır." : "Your message must be between 5 and 2,000 characters.";
    case "INVALID_PACKAGE": return isTr ? "Seçilen ders paketi artık kullanılamıyor. Lütfen paketleri yeniden inceleyin." : "The selected lesson package is no longer available. Please review the packages again.";
    case "PRIVACY_CONSENT_REQUIRED": return isTr ? "Devam etmek için gizlilik onayını kabul edin." : "Please accept the privacy consent to continue.";
    case "BOT_VERIFICATION_REQUIRED": return isTr ? "Lütfen güvenlik doğrulamasını tamamlayın." : "Please complete the security verification.";
    case "BOT_VERIFICATION_FAILED": return isTr ? "Güvenlik doğrulaması başarısız oldu. Lütfen yeniden deneyin." : "Security verification failed. Please try again.";
    case "BOT_VERIFICATION_EXPIRED": return isTr ? "Güvenlik doğrulamasının süresi doldu. Lütfen yeniden doğrulayın." : "Security verification expired. Please verify again.";
    case "TEMPORARY_ERROR": return isTr ? "Güvenlik hizmetine şu anda ulaşılamıyor. Lütfen kısa süre sonra deneyin." : "The security service is temporarily unavailable. Please try again shortly.";
    case "FORBIDDEN_ORIGIN": return isTr ? "Bu sayfadan gönderim yapılamıyor. Lütfen sayfayı yenileyin." : "Submission is not available from this page. Please refresh it.";
    case "RATE_LIMITED": return isTr ? "Çok fazla deneme yapıldı. Lütfen bir süre sonra yeniden deneyin." : "Too many attempts. Please try again later.";
    case "SERVER_CONFIG_ERROR": return isTr ? "İletişim hizmeti geçici olarak kullanılamıyor." : "The contact service is temporarily unavailable.";
    case "STORAGE_FAILED": return isTr ? "Talebiniz kaydedilemedi. Lütfen yeniden deneyin." : "Your request could not be saved. Please try again.";
    case "INTERNAL_ERROR": return isTr ? "Beklenmeyen bir hata oluştu. Lütfen yeniden deneyin." : "An unexpected error occurred. Please try again.";
    default: return isTr ? "İletişim hizmetine bağlanılamadı. İnternet bağlantınızı kontrol edip yeniden deneyin." : "Could not reach the contact service. Check your connection and try again.";
  }
}

async function parseFunctionError(error: unknown): Promise<ContactErrorCode> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json() as { error_code?: string };
      if (body.error_code && knownErrorCodes.has(body.error_code as ContactErrorCode)) return body.error_code as ContactErrorCode;
    } catch {
      // Fall through to the HTTP status when the response body is unavailable.
    }
    if (context.status === 429) return "RATE_LIMITED";
    if (context.status === 403) return "FORBIDDEN_ORIGIN";
    if (context.status >= 500) return "INTERNAL_ERROR";
    return "INTERNAL_ERROR";
  }
  return "NETWORK_ERROR";
}

/**
 * Submits a contact inquiry to the create-contact Edge Function.
 * Direct browser INSERT into contact_requests is blocked by RLS.
 */
export async function submitContact(
  payload: ContactRequestPayload
): Promise<ContactResult> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke("create-contact", {
      body: payload,
    });

    if (error) {
      // Do NOT retry with the same payload: turnstileToken is single-use, and
      // the original request may have already reached and been processed by
      // the server. Resubmitting here would fail Turnstile verification with
      // a confusing "token already used" error, or risk a duplicate request.
      // Let the caller surface this and have the user retry with a fresh token.
      const errorCode = await parseFunctionError(error);
      console.warn("[contact/api] Contact submission failed:", errorCode);
      return {
        success: false,
        errorCode,
        message: messageForError(errorCode, payload.locale),
      };
    }

    if (data && data.success) {
      return {
        success: true,
        contactId: data.contactId,
        message: data.delivery_status === "partial"
          ? payload.locale === "tr"
            ? "Talebiniz kaydedildi. E-posta bilgilendirmesinde geçici bir gecikme olabilir."
            : "Your request was saved. There may be a temporary delay in email confirmation."
          : payload.locale === "tr" ? "Talebiniz başarıyla alındı." : "Your request was received successfully.",
        deliveryStatus: data.delivery_status === "partial" ? "partial" : "sent",
      };
    }

    return {
      success: false,
      errorCode: knownErrorCodes.has(data?.error_code) ? data.error_code : "STORAGE_FAILED",
      message: messageForError(knownErrorCodes.has(data?.error_code) ? data.error_code : "STORAGE_FAILED", payload.locale),
    };
  } catch (err) {
    console.warn("[contact/api] Unexpected error submitting contact:", err);
    return {
      success: false,
      errorCode: "NETWORK_ERROR",
      message: messageForError("NETWORK_ERROR", payload.locale),
    };
  }
}
