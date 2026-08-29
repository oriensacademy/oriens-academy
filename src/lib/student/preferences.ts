import { getSupabaseClient } from "@/lib/supabase/client";

export interface PreferenceOption {
  id: string;
  name_tr: string;
  name_en: string;
  badge?: string;
}

export const SUPPORTED_EXAMS: PreferenceOption[] = [
  { id: "IB", name_tr: "IB Diploma", name_en: "IB Diploma", badge: "Diploma" },
  { id: "AP", name_tr: "Advanced Placement (AP)", name_en: "Advanced Placement (AP)", badge: "Curriculum" },
  { id: "IGCSE", name_tr: "Cambridge IGCSE", name_en: "Cambridge IGCSE", badge: "Secondary" },
  { id: "A-Level", name_tr: "A-Level", name_en: "A-Level", badge: "UK / Global" },
  { id: "SAT", name_tr: "Digital SAT", name_en: "Digital SAT", badge: "US / Global" },
  { id: "ACT", name_tr: "ACT", name_en: "ACT", badge: "US / Global" },
  { id: "ESAT", name_tr: "ESAT (Engineering / Science)", name_en: "ESAT (Engineering / Science)", badge: "UK STEM" },
  { id: "TMUA", name_tr: "TMUA (Cambridge / LSE)", name_en: "TMUA (Cambridge / LSE)", badge: "UK Math" },
  { id: "TARA", name_tr: "TARA / TEST-ARCHED (Mimarlık)", name_en: "TARA (Architecture)", badge: "Architecture" },
  { id: "UCAT", name_tr: "UCAT (Tıp / Diş Hekimliği)", name_en: "UCAT (Medicine / Dentistry)", badge: "UK / Australia" },
  { id: "LNAT", name_tr: "LNAT (Hukuk)", name_en: "LNAT (Law)", badge: "UK Law" },
  { id: "IMAT", name_tr: "IMAT (İtalya İngilizce Tıp)", name_en: "IMAT (Italy Medicine)", badge: "Italy" },
  { id: "GAMSAT", name_tr: "GAMSAT (Lisansüstü Tıp)", name_en: "GAMSAT (Graduate Medicine)", badge: "UK / Australia" },
  { id: "MCAT", name_tr: "MCAT (Kuzey Amerika Tıp)", name_en: "MCAT (US/CA Medicine)", badge: "US / Canada" },
  { id: "LSAT", name_tr: "LSAT (JD Hukuk)", name_en: "LSAT (JD Law)", badge: "US / Canada" },
  { id: "GRE", name_tr: "GRE General Test", name_en: "GRE General Test", badge: "Graduate" },
  { id: "GMAT", name_tr: "GMAT Focus Edition", name_en: "GMAT Focus Edition", badge: "Business / MBA" },
  { id: "OMPT", name_tr: "OMPT (Hollanda Matematik)", name_en: "OMPT (Netherlands Math)", badge: "Netherlands" },
  { id: "IELTS", name_tr: "IELTS Academic", name_en: "IELTS Academic", badge: "Language" },
  { id: "TOEFL", name_tr: "TOEFL iBT", name_en: "TOEFL iBT", badge: "Language" },
];

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
