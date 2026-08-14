import { getSupabaseClient } from "@/lib/supabase/client";
import type { ContactRequestPayload, ContactResult } from "./types";

/**
 * Submits a contact inquiry to the create-contact Edge Function.
 * Direct browser INSERT into contact_requests is blocked by RLS.
 */
export async function submitContact(
  payload: ContactRequestPayload
): Promise<ContactResult> {
  const networkMessage = payload.locale === "tr"
    ? "İletişim hizmetine bağlanırken bir ağ hatası oluştu."
    : "A network error occurred while connecting to the contact service.";
  const fallbackMessage = payload.locale === "tr"
    ? "İletişim talebi gönderilemedi."
    : "Contact request could not be submitted.";
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
      console.warn("[contact/api] Error submitting contact:", error);
      return {
        success: false,
        errorCode: "NETWORK_ERROR",
        message: networkMessage,
      };
    }

    if (data && data.success) {
      return {
        success: true,
        contactId: data.contactId,
        message: data.message,
      };
    }

    return {
      success: false,
      errorCode: data?.error_code || "STORAGE_FAILED",
      message: fallbackMessage,
    };
  } catch (err) {
    console.warn("[contact/api] Unexpected error submitting contact:", err);
    return {
      success: false,
      errorCode: "NETWORK_ERROR",
      message: networkMessage,
    };
  }
}
