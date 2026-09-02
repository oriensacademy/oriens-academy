import type { Locale } from "@/content/dictionaries";
import { resetPasswordPath } from "@/lib/routes";
import { getSupabaseClient } from "@/lib/supabase/client";

export interface RequestPasswordRecoveryParams {
  email: string;
  locale?: Locale;
}

export interface PasswordRecoveryResult {
  success: boolean;
  error?: string;
  errorCode?: "RATE_LIMIT" | "INVALID_EMAIL" | "NETWORK_ERROR" | "GENERIC";
}

/**
 * Shared canonical helper for dispatching Supabase Auth password recovery emails.
 * Used by both the public "Şifremi Unuttum" flow and the Admin CRM Student Detail action.
 *
 * Directs the user to the dedicated localized reset-password page (/sifre-yenile or /reset-password)
 * via Supabase Auth GoTrue recovery link. Does NOT generate temporary plaintext passwords.
 */
export async function requestPasswordRecovery(
  params: RequestPasswordRecoveryParams
): Promise<PasswordRecoveryResult> {
  const { email, locale = "tr" } = params;
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
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://oriens-academy.com";

    const redirectTo = `${origin}${resetPasswordPath(locale)}`;

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo,
    });

    if (error) {
      const msg = error.message?.toLowerCase() || "";
      const status = error.status;

      // Rate limit detection
      if (
        status === 429 ||
        msg.includes("rate limit") ||
        msg.includes("too many requests") ||
        msg.includes("security purposes")
      ) {
        return {
          success: false,
          errorCode: "RATE_LIMIT",
          error:
            locale === "tr"
              ? "Çok fazla istek gönderildi. Lütfen birkaç dakika sonra tekrar deneyin."
              : "Too many requests. Please try again in a few minutes.",
        };
      }

      // Network / connection detection
      if (
        msg.includes("fetch") ||
        msg.includes("network") ||
        msg.includes("failed to fetch")
      ) {
        return {
          success: false,
          errorCode: "NETWORK_ERROR",
          error:
            locale === "tr"
              ? "Bağlantı sırasında bir sorun oluştu. Lütfen internet bağlantınızı kontrol edip tekrar deneyin."
              : "A connection error occurred. Please check your network and try again.",
        };
      }

      console.warn(`[password-recovery] Supabase resetPasswordForEmail reported: ${error.message}`);

      return {
        success: false,
        errorCode: "GENERIC",
        error:
          locale === "tr"
            ? "Şifre sıfırlama bağlantısı şu anda gönderilemedi. Lütfen daha sonra tekrar deneyin."
            : "Could not send the password reset link at this time. Please try again later.",
      };
    }

    return { success: true };
  } catch (err) {
    console.error("[password-recovery] Unexpected recovery error:", err);
    return {
      success: false,
      errorCode: "NETWORK_ERROR",
      error:
        locale === "tr"
          ? "Bağlantı sırasında bir sorun oluştu. Lütfen tekrar deneyin."
          : "A connection error occurred. Please try again.",
    };
  }
}
