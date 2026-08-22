import { getSupabaseClient } from "@/lib/supabase/client";

export interface PreferenceOption {
  id: string;
  name_tr: string;
  name_en: string;
  badge?: string;
}

export const SUPPORTED_EXAMS: PreferenceOption[] = [
  { id: "SAT", name_tr: "SAT", name_en: "SAT", badge: "US / Global" },
  { id: "IB", name_tr: "IB Diploma", name_en: "IB Diploma", badge: "Curriculum" },
  { id: "AP", name_tr: "Advanced Placement (AP)", name_en: "Advanced Placement (AP)", badge: "US / Global" },
  { id: "TMUA", name_tr: "TMUA (Cambridge / LSE)", name_en: "TMUA (Cambridge / LSE)", badge: "UK" },
  { id: "ESAT", name_tr: "ESAT (Engineering / Science)", name_en: "ESAT (Engineering / Science)", badge: "UK" },
  { id: "IMAT", name_tr: "IMAT (İtalya Tıp)", name_en: "IMAT (Italy Medicine)", badge: "Italy" },
  { id: "UCAT", name_tr: "UCAT (UK Tıp)", name_en: "UCAT (UK Medicine)", badge: "UK / Australia" },
  { id: "OMPT", name_tr: "OMPT (Hollanda Matematik)", name_en: "OMPT (Netherlands Math)", badge: "Netherlands" },
  { id: "IELTS", name_tr: "IELTS Academic", name_en: "IELTS Academic", badge: "Language" },
  { id: "TOEFL", name_tr: "TOEFL iBT", name_en: "TOEFL iBT", badge: "Language" },
  { id: "GRE", name_tr: "GRE", name_en: "GRE", badge: "Graduate" },
  { id: "GMAT", name_tr: "GMAT Focus", name_en: "GMAT Focus", badge: "Graduate" },
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
  markOnboardingCompleted = true
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    const rpcFn = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    const { error: rpcError } = await rpcFn("save_student_preferences", {
      p_student_id: studentId,
      p_exams: exams,
      p_countries: countries,
      p_mark_onboarding_completed: markOnboardingCompleted,
    });

    if (rpcError) {
      // Fallback direct table update if RPC migration is still being applied locally
      const updateFn = supabase.from("student_profiles").update as unknown as (data: Record<string, unknown>) => { eq: (column: string, val: string) => Promise<{ error: { message: string } | null }> };
      const { error: directError } = await updateFn({
        target_exams: exams,
        target_countries: countries,
        target_exam: exams[0] || null,
        target_country: countries[0] || null,
        onboarding_completed: markOnboardingCompleted,
        updated_at: new Date().toISOString(),
      }).eq("id", studentId);

      if (directError) {
        return { success: false, error: directError.message };
      }
    }

    return { success: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tercihler kaydedilemedi.";
    return { success: false, error: message };
  }
}

export function formatExamBadges(exams: string[] | null | undefined): string[] {
  if (!exams || exams.length === 0) return [];
  return exams.map((id) => {
    const found = SUPPORTED_EXAMS.find((e) => e.id.toLowerCase() === id.toLowerCase());
    return found ? found.name_tr : id;
  });
}

export function formatDestinationBadges(countries: string[] | null | undefined, locale: "tr" | "en" = "tr"): string[] {
  if (!countries || countries.length === 0) return [];
  return countries.map((id) => {
    const found = SUPPORTED_DESTINATIONS.find((d) => d.id.toLowerCase() === id.toLowerCase() || d.name_en.toLowerCase() === id.toLowerCase());
    return found ? (locale === "tr" ? found.name_tr : found.name_en) : id;
  });
}
