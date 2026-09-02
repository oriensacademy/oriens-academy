import { getSupabaseClient } from "@/lib/supabase/client";

export interface RequestVerificationResponse {
  success: boolean;
  candidate_email?: string;
  resend_available_at?: string;
  expires_at?: string;
  error_code?: string;
  message?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  email?: string;
  verified_at?: string;
  error_code?: string;
  remaining_attempts?: number;
  message?: string;
}

async function getAuthToken(): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export async function requestPurchaseEmailVerification(
  candidateEmail: string,
  locale: "tr" | "en" = "tr"
): Promise<RequestVerificationResponse> {
  const token = await getAuthToken();
  if (!token) {
    return {
      success: false,
      error_code: "UNAUTHORIZED",
      message: locale === "tr" ? "Lütfen önce giriş yapınız." : "Please sign in first.",
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return {
      success: false,
      error_code: "CONFIG_ERROR",
      message: locale === "tr" ? "Sistem yapılandırma hatası." : "System configuration error.",
    };
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/request-purchase-email-verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ candidateEmail, locale }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error_code: data.error_code || `HTTP_${res.status}`,
        resend_available_at: data.resend_available_at,
        message: data.message || (locale === "tr" ? "Doğrulama kodu gönderilemedi." : "Failed to send verification code."),
      };
    }

    return {
      success: true,
      candidate_email: data.candidate_email,
      resend_available_at: data.resend_available_at,
      expires_at: data.expires_at,
    };
  } catch (_err) {
    return {
      success: false,
      error_code: "NETWORK_ERROR",
      message: locale === "tr" ? "Bağlantı hatası oluştu. Lütfen tekrar deneyiniz." : "Network error. Please try again.",
    };
  }
}

export async function verifyPurchaseEmailVerification(
  candidateEmail: string,
  code: string,
  locale: "tr" | "en" = "tr"
): Promise<VerifyOtpResponse> {
  const token = await getAuthToken();
  if (!token) {
    return {
      success: false,
      error_code: "UNAUTHORIZED",
      message: locale === "tr" ? "Lütfen önce giriş yapınız." : "Please sign in first.",
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return {
      success: false,
      error_code: "CONFIG_ERROR",
      message: locale === "tr" ? "Sistem yapılandırma hatası." : "System configuration error.",
    };
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/verify-purchase-email-verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ candidateEmail, code, locale }),
    });

    const data = await res.json();
    if (!res.ok || data.success !== true) {
      return {
        success: false,
        error_code: data.error_code || `HTTP_${res.status}`,
        remaining_attempts: data.remaining_attempts,
        message: data.message || (locale === "tr" ? "Doğrulama başarısız oldu." : "Verification failed."),
      };
    }

    return {
      success: true,
      email: data.email,
      verified_at: data.verified_at,
      message: data.message,
    };
  } catch (_err) {
    return {
      success: false,
      error_code: "NETWORK_ERROR",
      message: locale === "tr" ? "Bağlantı hatası oluştu. Lütfen tekrar deneyiniz." : "Network error. Please try again.",
    };
  }
}
