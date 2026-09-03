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

export async function sendStudentWelcomeEmail(params: {
  studentUserId?: string;
  email: string;
  fullName: string;
  locale: Locale;
  sessionToken?: string;
}) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl) return;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(anonKey ? { apikey: anonKey } : {}),
      ...(params.sessionToken ? { Authorization: `Bearer ${params.sessionToken}` } : {}),
    };

    await fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        studentUserId: params.studentUserId,
        email: params.email,
        fullName: params.fullName,
        locale: params.locale,
      }),
    });
  } catch (err) {
    // Non-blocking error handling
    console.warn("[auth] Non-blocking welcome email trigger error:", err);
  }
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

export async function updateStudentEmail(email: string) {
  return getSupabaseClient().auth.updateUser({ email: email.trim().toLowerCase() });
}

export async function updateStudentPassword(password: string) {
  return getSupabaseClient().auth.updateUser({ password });
}

export async function updateGuardianProfile(input: { fullName: string; phone: string; contactAddress?: string; preferredLanguage: Locale }) {
  const phone = validateStudentPhone(input.phone, input.preferredLanguage === "tr");
  if (!phone.valid) return { data: null, error: new Error(phone.error || "Invalid phone") };
  return getSupabaseClient().rpc("update_guardian_profile", {
    p_full_name: input.fullName.trim().replace(/\s+/g, " "),
    p_phone: phone.normalized,
    p_contact_address: input.contactAddress ? input.contactAddress.trim().replace(/\s+/g, " ") : undefined,
    p_preferred_language: input.preferredLanguage,
  });
}
