import { DegreeLevel, StudyMode, DurationUnit } from "@/types/admission.types";

/**
 * Normalizes degree level from degree title, program name, and source context text.
 */
export function normalizeDegreeLevel(
  degreeTitle?: string | null,
  programName?: string | null,
  rawContext?: string | null
): DegreeLevel {
  const text = `${degreeTitle || ""} ${programName || ""} ${rawContext || ""}`.toLowerCase();

  // PhD / Doctoral
  if (text.includes("phd") || text.includes("dphil") || text.includes("doctor of philosophy") || text.includes("doctorate")) {
    return "PHD";
  }

  // MBA
  if (text.includes("mba") || text.includes("master of business administration")) {
    return "MBA";
  }

  // Integrated Master's (Undergraduate entry in UK/EU systems: MEng, MSci, MChem, MBiol, MPhys, MMath)
  if (
    /\b(meng|msci|mchem|mbiol|mphys|mmath)\b/.test(text) ||
    (text.includes("undergraduate") && text.includes("integrated master"))
  ) {
    return "UNDERGRADUATE";
  }

  // Postgraduate Taught & Research
  if (text.includes("mphil") || text.includes("master of research") || text.includes("mres")) {
    return "POSTGRADUATE_RESEARCH";
  }
  if (
    text.includes("msc") ||
    text.includes("ma ") ||
    text.includes("master of science") ||
    text.includes("master of arts") ||
    text.includes("postgraduate") ||
    text.includes("graduate") ||
    text.includes("master") ||
    text.includes("pgdip") ||
    text.includes("pgcert")
  ) {
    return "POSTGRADUATE_TAUGHT";
  }

  // Undergraduate Bachelor's
  if (
    text.includes("bsc") ||
    text.includes("ba ") ||
    text.includes("beng") ||
    text.includes("mbbs") ||
    text.includes("mb bchir") ||
    text.includes("llb") ||
    text.includes("bachelor") ||
    text.includes("undergraduate") ||
    text.includes("laurea") ||
    text.includes("triennale")
  ) {
    return "UNDERGRADUATE";
  }

  return "OTHER";
}

/**
 * Normalizes degree title (e.g. "BSc (Hons)", "BA", "MSc", "PhD").
 */
export function extractDegreeTitle(text: string): string | null {
  const match = text.match(/\b(BSc|BA|BEng|MEng|MSci|MChem|MMath|MBBS|LLB|MSc|MA|MPhil|MBA|PhD|DPhil)\b/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Normalizes program duration string into durationValue and durationUnit.
 */
export function normalizeDuration(durationStr?: string | null): { value: number | null; unit: DurationUnit | null } {
  if (!durationStr) return { value: null, unit: null };

  const str = durationStr.toLowerCase();

  const yearMatch = str.match(/(\d+)\s*(?:-\s*\d+)?\s*(?:year|yr|academic year)/);
  if (yearMatch) {
    return { value: parseInt(yearMatch[1], 10), unit: "YEARS" };
  }

  const monthMatch = str.match(/(\d+)\s*(?:-\s*\d+)?\s*(?:month|mo)/);
  if (monthMatch) {
    return { value: parseInt(monthMatch[1], 10), unit: "MONTHS" };
  }

  const semMatch = str.match(/(\d+)\s*(?:-\s*\d+)?\s*(?:semester|term)/);
  if (semMatch) {
    return { value: parseInt(semMatch[1], 10), unit: "SEMESTERS" };
  }

  return { value: null, unit: null };
}

/**
 * Normalizes study mode (FULL_TIME, PART_TIME, DISTANCE, HYBRID, FLEXIBLE, OTHER).
 */
export function normalizeStudyMode(modeStr?: string | null): StudyMode {
  if (!modeStr) return "OTHER";
  const str = modeStr.toLowerCase();

  if (str.includes("full") || str.includes("full-time") || str.includes("ft")) return "FULL_TIME";
  if (str.includes("part") || str.includes("part-time") || str.includes("pt")) return "PART_TIME";
  if (str.includes("online") || str.includes("distance")) return "DISTANCE";
  if (str.includes("hybrid") || str.includes("blended")) return "HYBRID";

  return "OTHER";
}
