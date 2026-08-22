import { getSupabaseClient } from "@/lib/supabase/client";
import type { Locale } from "@/content/dictionaries";

export interface StudentRegistrationInput {
  fullName: string; email: string; phone: string; password: string; locale: Locale;
  school?: string; targetExam?: string; targetCountry?: string;
  captchaToken?: string;
}

export async function registerStudent(input: StudentRegistrationInput) {
  const supabase = getSupabaseClient();
  const redirectTo = `${window.location.origin}/${input.locale}/${input.locale === "tr" ? "hesabim" : "account"}`;
  return supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      emailRedirectTo: redirectTo,
      captchaToken: input.captchaToken,
      data: {
        full_name: input.fullName.trim(), phone: input.phone.trim(), preferred_language: input.locale,
        school: input.school?.trim() || null, target_exam: input.targetExam?.trim() || null,
        target_country: input.targetCountry?.trim() || null,
      },
    },
  });
}

export async function updateStudentEmail(email: string) { return getSupabaseClient().auth.updateUser({ email: email.trim().toLowerCase() }); }
export async function updateStudentPassword(password: string) { return getSupabaseClient().auth.updateUser({ password }); }
