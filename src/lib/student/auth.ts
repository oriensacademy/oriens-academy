import { getSupabaseClient } from "@/lib/supabase/client";
import type { Locale } from "@/content/dictionaries";

export interface StudentRegistrationInput {
  fullName: string;
  email: string;
  password: string;
  locale: Locale;
  school?: string;
  targetExam?: string;
  targetCountry?: string;
  captchaToken?: string;
}

export function validateStudentPhone(
  rawPhone: string,
  isTr = true
): { valid: boolean; normalized: string; error?: string } {
  const trimmed = (rawPhone || "").trim();
  if (!trimmed) {
    return {
      valid: false,
      normalized: "",
      error: isTr ? "Telefon alanı zorunludur." : "Phone number is required.",
    };
  }

  // Reject if letters or disallowed characters exist (allowed: digits, +, spaces, (), -, .)
  if (/[a-zA-Z]/.test(trimmed) || !/^[+\d\s().-]+$/.test(trimmed)) {
    return {
      valid: false,
      normalized: "",
      error: isTr ? "Lütfen geçerli bir telefon numarası girin." : "Please enter a valid phone number.",
    };
  }

  const hasPlus = trimmed.startsWith("+");
  let digitsOnly = trimmed.replace(/\D/g, "");

  // Convert leading international 00 to standard international format
  if (!hasPlus && digitsOnly.startsWith("00")) {
    digitsOnly = digitsOnly.slice(2);
  }

  let normalized = "";

  if (hasPlus) {
    normalized = `+${digitsOnly}`;
  } else if (digitsOnly.startsWith("90") && digitsOnly.length === 12) {
    normalized = `+${digitsOnly}`;
  } else if (digitsOnly.startsWith("05") && digitsOnly.length === 11) {
    normalized = `+90${digitsOnly.slice(1)}`;
  } else if (digitsOnly.startsWith("5") && digitsOnly.length === 10) {
    normalized = `+90${digitsOnly}`;
  } else if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
    normalized = `+${digitsOnly}`;
  }

  const normDigits = normalized.replace(/\D/g, "");
  if (!normalized || normDigits.length < 7 || normDigits.length > 16) {
    return {
      valid: false,
      normalized: "",
      error: isTr ? "Lütfen geçerli uzunlukta bir telefon numarası girin." : "Please enter a valid phone number.",
    };
  }

  return { valid: true, normalized };
}

/**
 * @deprecated Welcome emails are now canonically managed by the database trigger
 * on_auth_user_verified_guardian_welcome -> queue_verified_guardian_welcome_email
 * once the user confirms their email address. Client-side triggers are disabled
 * to prevent duplicate welcome emails.
 */
export async function sendStudentWelcomeEmail(_params: {
  studentUserId?: string;
  email: string;
  fullName: string;
  locale: Locale;
  sessionToken?: string;
}) {
  // Canonical welcome emails are handled strictly by verified trigger to prevent duplicate emails.
  void _params;
  return;
}

export async function registerStudent(input: StudentRegistrationInput) {
  const supabase = getSupabaseClient();
  const redirectTo = `${window.location.origin}/${input.locale}/${input.locale === "tr" ? "hesabim" : "account"}`;

  const result = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      emailRedirectTo: redirectTo,
      captchaToken: input.captchaToken,
      data: {
        full_name: input.fullName.trim(),
        preferred_language: input.locale,
        school: input.school?.trim() || null,
        target_exam: input.targetExam?.trim() || null,
        target_country: input.targetCountry?.trim() || null,
      },
    },
  });

  return result;
}

export async function resendGuardianConfirmation(email: string, locale: Locale) {
  return getSupabaseClient().auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: `${window.location.origin}/${locale}/${locale === "tr" ? "hesabim" : "account"}` },
  });
}

export interface RequestEmailChangeResult {
  success: boolean;
  new_email?: string;
  masked_new_email?: string;
  resend_available_at?: string;
  expires_at?: string;
  error_code?: string;
  message?: string;
}

export interface VerifyEmailChangeResult {
  success: boolean;
  email?: string;
  verified_at?: string;
  error_code?: string;
  remaining_attempts?: number;
  message?: string;
}

export async function requestEmailChange(
  newEmail: string,
  locale: Locale
): Promise<RequestEmailChangeResult> {
  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
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
    const res = await fetch(`${supabaseUrl}/functions/v1/request-email-change`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ newEmail: newEmail.trim().toLowerCase(), locale }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error_code: data.error_code || `HTTP_${res.status}`,
        resend_available_at: data.resend_available_at,
        message: data.message || (locale === "tr" ? "E-posta değişikliği başlatılamadı." : "Failed to request email change."),
      };
    }
    return {
      success: true,
      new_email: data.new_email,
      masked_new_email: data.masked_new_email,
      resend_available_at: data.resend_available_at,
      expires_at: data.expires_at,
    };
  } catch {
    return {
      success: false,
      error_code: "NETWORK_ERROR",
      message: locale === "tr" ? "Bağlantı hatası oluştu. Lütfen tekrar deneyiniz." : "Network error. Please try again.",
    };
  }
}

export async function verifyEmailChangeOtp(
  code: string,
  locale: Locale
): Promise<VerifyEmailChangeResult> {
  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
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
    const res = await fetch(`${supabaseUrl}/functions/v1/verify-email-change`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ code: code.trim(), locale }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error_code: data.error_code || `HTTP_${res.status}`,
        remaining_attempts: data.remaining_attempts,
        message: data.message || (locale === "tr" ? "Doğrulama başarısız oldu." : "Verification failed."),
      };
    }
    await supabase.auth.refreshSession();
    return {
      success: true,
      email: data.email,
      verified_at: data.verified_at,
    };
  } catch {
    return {
      success: false,
      error_code: "NETWORK_ERROR",
      message: locale === "tr" ? "Bağlantı hatası oluştu. Lütfen tekrar deneyiniz." : "Network error. Please try again.",
    };
  }
}

export async function updateStudentEmail(email: string, locale: Locale) {
  return requestEmailChange(email, locale);
}

export async function updateStudentPassword(password: string) {
  return getSupabaseClient().auth.updateUser({ password });
}

export async function updateGuardianProfile(input: { fullName: string; contactAddress?: string; preferredLanguage: Locale }) {
  return getSupabaseClient().rpc("update_guardian_profile", {
    p_full_name: input.fullName.trim().replace(/\s+/g, " "),
    p_contact_address: input.contactAddress ? input.contactAddress.trim().replace(/\s+/g, " ") : undefined,
    p_preferred_language: input.preferredLanguage,
  });
}

export interface DeleteAccountResult {
  success: boolean;
  mode?: "deleted";
  error_code?: string;
  message?: string;
}

export async function deleteOwnAccount(password: string, locale: Locale): Promise<DeleteAccountResult> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return {
      success: false,
      error_code: "UNAUTHORIZED",
      message: locale === "tr" ? "Lütfen tekrar giriş yapın." : "Please sign in again.",
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
    const res = await fetch(`${supabaseUrl}/functions/v1/delete-student-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ password, locale }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error_code: data.error_code || `HTTP_${res.status}`,
        message: data.message || (locale === "tr" ? "Üyelik silme işlemi gerçekleştirilemedi." : "Your account could not be deleted."),
      };
    }
    return { success: true, mode: data.mode };
  } catch {
    return {
      success: false,
      error_code: "NETWORK_ERROR",
      message: locale === "tr" ? "Bağlantı hatası oluştu. Lütfen tekrar deneyiniz." : "Network error. Please try again.",
    };
  }
}
