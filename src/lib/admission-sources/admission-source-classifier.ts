import { SourceScope, AuthorityLevel, SourceType } from "../../types/admission.types";

export interface ClassifiedAdmissionSource {
  scope: SourceScope;
  sourceType: SourceType;
  authorityLevel: AuthorityLevel;
  admissionCycle?: string | null;
  detectedCountry?: string | null;
  detectedQualification?: string | null;
  isEnglishRequirement: boolean;
  isTestRequirement: boolean;
  isNonScoreRequirement: boolean;
}

export function classifyAdmissionSource(
  url: string,
  pageTitle: string,
  contentExcerpt: string,
  programContext?: { isProgramPage?: boolean; faculty?: string | null }
): ClassifiedAdmissionSource {
  const text = `${url} ${pageTitle} ${contentExcerpt}`.toLowerCase();

  // 1. Admission Cycle Detection
  let admissionCycle: string | null = null;
  if (text.includes("2026/27") || text.includes("2026-2027") || text.includes("2026 entry")) {
    admissionCycle = "2026/2027";
  } else if (text.includes("2027/28") || text.includes("2027-2028") || text.includes("2027 entry")) {
    admissionCycle = "2027/2028";
  } else if (text.includes("2025/26") || text.includes("2025-2026") || text.includes("2025 entry")) {
    admissionCycle = "2025/2026";
  }

  // 2. English & Test Requirement Flags
  const isEnglishRequirement =
    text.includes("english language") ||
    text.includes("ielts") ||
    text.includes("toefl") ||
    text.includes("pte academic") ||
    text.includes("duolingo english") ||
    text.includes("language proficiency");

  const isTestRequirement =
    text.includes("sat") ||
    text.includes("act") ||
    text.includes("tmua") ||
    text.includes("esat") ||
    text.includes("ucat") ||
    text.includes("imat") ||
    text.includes("gre") ||
    text.includes("gmat") ||
    text.includes("admissions test");

  const isNonScoreRequirement =
    text.includes("interview") ||
    text.includes("portfolio") ||
    text.includes("written work") ||
    text.includes("personal statement") ||
    text.includes("reference") ||
    text.includes("work experience") ||
    text.includes("audition");

  // 3. Detected Qualification
  let detectedQualification: string | null = null;
  if (text.includes("international baccalaureate") || text.includes(" ib ")) detectedQualification = "IB";
  else if (text.includes("a-level") || text.includes("a level") || text.includes("gce a")) detectedQualification = "A-Level";
  else if (text.includes("advanced placement") || text.includes(" ap ")) detectedQualification = "AP";
  else if (text.includes("abitur")) detectedQualification = "Abitur";
  else if (text.includes("sat reasoning") || text.includes(" sat ")) detectedQualification = "SAT";
  else if (text.includes("ucat")) detectedQualification = "UCAT";
  else if (text.includes("imat")) detectedQualification = "IMAT";

  // 4. Detected Country
  let detectedCountry: string | null = null;
  if (text.includes("turkey") || text.includes("turkish")) detectedCountry = "Turkey";
  else if (text.includes("india") || text.includes("indian")) detectedCountry = "India";
  else if (text.includes("china") || text.includes("chinese")) detectedCountry = "China";
  else if (text.includes("united states") || text.includes("us applicants")) detectedCountry = "United States";
  else if (text.includes("germany") || text.includes("german")) detectedCountry = "Germany";

  // 5. Authority Level Determination
  let authorityLevel: AuthorityLevel = "OFFICIAL_UNIVERSITY_PAGE";
  if (programContext?.isProgramPage || text.includes("/course/") || text.includes("/courses/") || text.includes("/program/") || text.includes("/programmes/")) {
    authorityLevel = "OFFICIAL_PROGRAM_PAGE";
  } else if (text.includes("faculty of") || text.includes("department of") || text.includes("school of")) {
    authorityLevel = "OFFICIAL_FACULTY_PAGE";
  } else if (url.includes("ucas.com") || url.includes("commonapp.org") || url.includes("universitaly.it") || url.includes("caap.fr")) {
    authorityLevel = "OFFICIAL_DELEGATED_PLATFORM";
  }

  // 6. Source Scope & Source Type Classification
  let scope: SourceScope = "PROGRAM";
  let sourceType: SourceType = "PROGRAM_ENTRY_REQUIREMENTS";

  if (programContext?.isProgramPage) {
    scope = "PROGRAM";
    sourceType = "PROGRAM_ENTRY_REQUIREMENTS";
  } else if (isEnglishRequirement) {
    scope = "LANGUAGE_REQUIREMENT";
    sourceType = "ENGLISH_LANGUAGE_REQUIREMENTS";
  } else if (isTestRequirement) {
    scope = "QUALIFICATION";
    sourceType = "ADMISSION_TEST_REQUIREMENTS";
  } else if (detectedCountry) {
    scope = "COUNTRY";
    sourceType = "COUNTRY_SPECIFIC_REQUIREMENTS";
  } else if (detectedQualification) {
    scope = "QUALIFICATION";
    sourceType = "QUALIFICATION_SPECIFIC_REQUIREMENTS";
  } else if (text.includes("international entry") || text.includes("international qualifications") || text.includes("overseas entry")) {
    scope = "GENERAL_ADMISSIONS";
    sourceType = "INTERNATIONAL_ENTRY_REQUIREMENTS";
  } else if (text.includes("faculty") || text.includes("department")) {
    scope = "FACULTY";
    sourceType = "FACULTY_REQUIREMENTS";
  } else {
    scope = "UNIVERSITY";
    sourceType = "UNDERGRADUATE_ENTRY_REQUIREMENTS";
  }

  return {
    scope,
    sourceType,
    authorityLevel,
    admissionCycle,
    detectedCountry,
    detectedQualification,
    isEnglishRequirement,
    isTestRequirement,
    isNonScoreRequirement,
  };
}
