import type { ExamCode } from "@/content/exams";
import { examRecords } from "@/content/exams";
import type { AdmissionRelationship } from "@/data/exam-university-map";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { StudyUniversity } from "@/components/discovery/globe-types";

type RequirementRow = {
  exam: string;
  status: "required" | "accepted" | "recommended" | "alternative" | "not_required" | "unknown";
  scope: "university" | "faculty" | "programme";
  programme_name: string | null;
  summary_tr: string;
  summary_en: string;
  official_source_url: string;
  verified_at: string;
  admissions_cycle: string | null;
};

type FeaturedRow = {
  id: string;
  name: string;
  city: string | null;
  country_name: string;
  country_iso3: string;
  latitude: number | null;
  longitude: number | null;
  official_url: string | null;
  admissions_url: string | null;
  verified_at: string | null;
  requirements: RequirementRow[] | null;
};

const examCodes = new Set(examRecords.map((exam) => exam.code));

function relationship(requirement: RequirementRow): AdmissionRelationship {
  if (requirement.scope !== "university") return "program_specific";
  if (requirement.status === "alternative") return "accepted";
  if (requirement.status === "unknown" || requirement.status === "not_required") return "considered";
  return requirement.status;
}

export async function loadFeaturedUniversities(
  iso3: string,
  signal?: AbortSignal,
): Promise<StudyUniversity[]> {
  const supabase = getSupabaseClient();
  // Generated database types intentionally lag additive migrations during rollout.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let request = (supabase as any).rpc("get_featured_universities_by_country", { p_iso3: iso3 });
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw error;

  return ((data || []) as FeaturedRow[]).map((row) => {
    const requirements = (row.requirements || []).filter(
      (item): item is RequirementRow & { exam: ExamCode } => examCodes.has(item.exam as ExamCode),
    );
    return {
      id: row.id,
      name: row.name,
      city: row.city || undefined,
      country: row.country_name,
      countryCode: row.country_iso3,
      lat: row.latitude ?? 0,
      lng: row.longitude ?? 0,
      officialUrl: row.official_url || undefined,
      admissionsUrl: row.admissions_url || undefined,
      verifiedAt: row.verified_at?.slice(0, 10),
      examChips: requirements.map((item) => ({
        exam: item.exam,
        relationship: relationship(item),
        labelTr: item.summary_tr,
        labelEn: item.summary_en,
        evidence: `${item.programme_name || item.scope} · ${item.admissions_cycle || "current"}`,
      })),
      examRelations: requirements.map((item) => ({
        examId: item.exam,
        relationship: relationship(item),
        programScope: item.programme_name || item.scope,
        sourceUrl: item.official_source_url,
      })),
    };
  });
}
