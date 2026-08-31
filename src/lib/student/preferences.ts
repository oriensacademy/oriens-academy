import { getSupabaseClient } from "@/lib/supabase/client";
import { canonicalExams, type CanonicalExamCode } from "@/content/canonical-exams";

export interface PreferenceOption {
  id: string;
  name_tr: string;
  name_en: string;
  badge?: string;
}

const examBadges: Partial<Record<CanonicalExamCode, string>> = {
  IB: "Diploma", AP: "Curriculum", IGCSE: "Secondary", "A-Level": "UK / Global",
  SAT: "US / Global", ACT: "US / Global", ESAT: "UK STEM", TMUA: "UK Math",
  TARA: "Academic Reasoning", UCAT: "Medicine / Dentistry",
  IMAT: "Italy", MCAT: "US / Canada",
  GRE: "Graduate", GMAT: "Business / MBA", OMPT: "Mathematics",
};

export const SUPPORTED_EXAMS: PreferenceOption[] = canonicalExams.map((exam) => ({
  id: exam.code,
  name_tr: exam.displayNameTr,
  name_en: exam.displayNameEn,
  badge: examBadges[exam.code],
}));

export const SUPPORTED_DESTINATIONS: PreferenceOption[] = [
  { id: "UK", name_tr: "Birleşik Krallık (İngiltere)", name_en: "United Kingdom", badge: "Russell Group" },
  { id: "USA", name_tr: "Amerika Birleşik Devletleri", name_en: "United States", badge: "Ivy League" },
  { id: "CAN", name_tr: "Kanada", name_en: "Canada", badge: "U15" },
  { id: "ITA", name_tr: "İtalya", name_en: "Italy", badge: "EU Medicine / Design" },
  { id: "NLD", name_tr: "Hollanda", name_en: "Netherlands", badge: "EU Research" },
  { id: "DEU", name_tr: "Almanya", name_en: "Germany", badge: "TU9" },
  { id: "CHE", name_tr: "İsviçre", name_en: "Switzerland", badge: "ETH / EPFL" },
  { id: "FRA", name_tr: "Fransa", name_en: "France", badge: "Grandes Écoles" },
];

export async function saveStudentPreferences(
  studentId: string,
  exams: string[],
  countries: string[],
  markOnboardingCompleted = true,
  language?: "tr" | "en"
): Promise<{ success: boolean; profile: Record<string, unknown> | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const normalizedExams = Array.from(new Set(exams.map((value) => value.trim()).filter(Boolean)));
  const normalizedCountries = Array.from(new Set(countries.map((value) => value.trim()).filter(Boolean)));

  try {
    const canonicalLanguage: "tr" | "en" = language === "en" ? "en" : "tr";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("save_student_preferences", {
      p_student_id: studentId,
      p_exams: normalizedExams,
      p_countries: normalizedCountries,
      p_mark_onboarding_completed: markOnboardingCompleted,
      p_language: canonicalLanguage,
    });
    if (error) return { success: false, profile: null, error: error.message };
    if (!data || data.success !== true || !data.profile) {
      return { success: false, profile: null, error: "Tercihler veritabanı tarafından doğrulanamadı." };
    }
    return { success: true, profile: data.profile as Record<string, unknown>, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tercihler kaydedilemedi.";
    return { success: false, profile: null, error: message };
  }
}

export function formatExamBadges(exams: string[] | null | undefined): string[] {
  if (!exams || exams.length === 0) return [];
  return Array.from(new Set(exams.map((id) => {
    const found = SUPPORTED_EXAMS.find((e) => e.id.toLowerCase() === id.toLowerCase());
    return found ? found.name_tr : id;
  })));
}

export function formatDestinationBadges(countries: string[] | null | undefined, locale: "tr" | "en" = "tr"): string[] {
  if (!countries || countries.length === 0) return [];
  return Array.from(new Set(countries.map((id) => {
    const found = SUPPORTED_DESTINATIONS.find((d) => d.id.toLowerCase() === id.toLowerCase() || d.name_en.toLowerCase() === id.toLowerCase());
    return found ? (locale === "tr" ? found.name_tr : found.name_en) : id;
  })));
}
