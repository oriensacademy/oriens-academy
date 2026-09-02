import type { Locale } from "@/content/dictionaries";
import { getSupabaseClient } from "@/lib/supabase/client";

export interface RequestPasswordRecoveryParams {
  email: string;
  locale?: Locale;
  turnstileToken?: string;
}

export interface PasswordRecoveryResult {
  success: boolean;
  error?: string;
  errorCode?: "RATE_LIMIT" | "INVALID_EMAIL" | "NETWORK_ERROR" | "GENERIC" | "BOT_VERIFICATION";
  message?: string;
}

/**
 * Shared canonical helper for dispatching Supabase Auth password recovery emails.
 * Used by both the public "Şifremi Unuttum" flow and the Admin CRM Student Detail action.
 *
 * Exclusively dispatches through the hardened server-side `request-password-recovery` Edge Function.
 * Direct GoTrue fallback has been permanently removed to eliminate duplicate email dispatch,
 * ensure single-language (TR/EN) delivery guarantees, and prevent Turnstile/rate-limit bypass.
 */
export async function requestPasswordRecovery(
  params: RequestPasswordRecoveryParams
): Promise<PasswordRecoveryResult> {
  const { email, locale = "tr", turnstileToken } = params;
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes("@")) {
    return {
      success: false,
      errorCode: "INVALID_EMAIL",
      error:
        locale === "tr"
          ? "Lütfen geçerli bir e-posta adresi girin."
          : "Please enter a valid email address.",
    };
  }

  try {
    const supabase = getSupabaseClient();

    // Canonical single dispatch path: invoke hardened Edge Function
    const { data, error: fnError } = await supabase.functions.invoke(
      "request-password-recovery",
      {
        body: {
          email: cleanEmail,
          locale,
          turnstileToken,
        },
      }
    );

    if (!fnError && data?.success) {
      return {
        success: true,
        message: data.message,
      };
    }

    if (fnError) {
      const errMsg = fnError.message?.toLowerCase() || "";
      const status = fnError.context?.status || fnError.status;

      // Rate limit detection (HTTP 429)
      if (status === 429 || errMsg.includes("rate limit") || errMsg.includes("429")) {
        return {
          success: false,
          errorCode: "RATE_LIMIT",
          error:
            locale === "tr"
              ? "Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyiniz."
              : "Too many requests. Please wait a moment and try again.",
        };
      }

      // Security verification detection
      if (
        errMsg.includes("bot_verification") ||
        errMsg.includes("security verification") ||
        errMsg.includes("turnstile")
      ) {
        return {
          success: false,
          errorCode: "BOT_VERIFICATION",
          error:
            locale === "tr"
              ? "Güvenlik doğrulaması tamamlanamadı. Lütfen sayfayı yenileyip tekrar deneyiniz."
              : "Security verification could not be completed. Please refresh and try again.",
        };
      }

      console.warn(`[password-recovery] Edge function reported error (${status}): ${fnError.message}`);
    }

    // Controlled failure without secondary dispatch
    return {
      success: false,
      errorCode: "NETWORK_ERROR",
      error:
        locale === "tr"
          ? "İstek durumunu doğrulayamadık. Lütfen e-posta kutunuzu kontrol edin; bağlantı gelmediyse kısa bir süre sonra tekrar deneyin."
          : "We could not verify the request status. Please check your inbox; if no link arrives, try again shortly.",
    };
  } catch (err) {
    console.error("[password-recovery] Unexpected recovery error:", err);
    // Never trigger secondary fallback mail on network or runtime exceptions
    return {
      success: false,
      errorCode: "NETWORK_ERROR",
      error:
        locale === "tr"
          ? "İstek durumunu doğrulayamadık. Lütfen e-posta kutunuzu kontrol edin; bağlantı gelmediyse kısa bir süre sonra tekrar deneyin."
          : "We could not verify the request status. Please check your inbox; if no link arrives, try again shortly.",
    };
  }
}
