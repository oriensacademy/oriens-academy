import { SourceType } from "../../types/admission.types";
import { normalizeDomain, isWithinOfficialDomainBoundary } from "./domain-normalizer";

export type ProvenanceType =
  | "OFFICIAL_UNIVERSITY_DOMAIN"
  | "OFFICIAL_DELEGATED_PLATFORM"
  | "GOVERNMENT"
  | "NATIONAL_ADMISSIONS_PLATFORM"
  | "THIRD_PARTY";

export type SourceVerificationStatus =
  | "VERIFIED"
  | "HIGH_CONFIDENCE"
  | "NEEDS_REVIEW"
  | "REJECTED";

export interface ClassificationResult {
  sourceType: SourceType;
  priority: number;
  provenanceType: ProvenanceType;
  verificationStatus: SourceVerificationStatus;
  isOfficial: boolean;
  contentType: "HTML" | "PDF" | "JSON" | "XML" | "OTHER";
  reason: string;
}

const DELEGATED_DOMAINS = [
  "ucas.com",
  "universitaly.it",
  "studielink.nl",
  "hochschulstart.de",
  "parcoursup.fr",
  "applyweb.com",
  "commonapp.org",
];

const GOVERNMENT_DOMAINS = [
  ".gov",
  ".gov.uk",
  ".edu.gov",
  ".mur.gov.it",
  ".education.gov.au",
];

/**
 * Classifies a discovered URL based on URL path, page title, anchor text, content type, and domain boundary.
 */
export function classifySourceUrl(
  urlStr: string,
  officialDomain: string,
  meta?: { title?: string; anchorText?: string; contentType?: string }
): ClassificationResult {
  let normUrl: URL;
  try {
    normUrl = new URL(urlStr);
  } catch {
    return {
      sourceType: "OTHER",
      priority: 50,
      provenanceType: "THIRD_PARTY",
      verificationStatus: "REJECTED",
      isOfficial: false,
      contentType: "OTHER",
      reason: "Invalid URL syntax",
    };
  }

  const path = normUrl.pathname.toLowerCase();
  const title = (meta?.title || "").toLowerCase();
  const anchor = (meta?.anchorText || "").toLowerCase();
  const fullTextSignal = `${path} ${title} ${anchor}`;

  const isPdf = path.endsWith(".pdf") || (meta?.contentType || "").includes("pdf");
  const contentType = isPdf ? "PDF" : (meta?.contentType || "").includes("xml") ? "XML" : "HTML";

  // 1. Determine Provenance & Official Domain Boundary
  const urlDomain = normalizeDomain(urlStr);

  let provenanceType: ProvenanceType = "THIRD_PARTY";
  let isOfficial = false;

  if (isWithinOfficialDomainBoundary(urlStr, officialDomain)) {
    provenanceType = "OFFICIAL_UNIVERSITY_DOMAIN";
    isOfficial = true;
  } else if (DELEGATED_DOMAINS.some((d) => urlDomain.domain.endsWith(d))) {
    provenanceType = "OFFICIAL_DELEGATED_PLATFORM";
    isOfficial = true;
  } else if (GOVERNMENT_DOMAINS.some((g) => urlDomain.domain.endsWith(g))) {
    provenanceType = "GOVERNMENT";
    isOfficial = true;
  } else {
    provenanceType = "THIRD_PARTY";
    isOfficial = false;
  }

  // 2. Classify Source Type & Priority
  let sourceType: SourceType = "OTHER";
  let priority = 50;

  // Specific Requirement Sources (Priority 1)
  if (
    fullTextSignal.includes("english") &&
    (fullTextSignal.includes("requirement") || fullTextSignal.includes("language") || fullTextSignal.includes("ielts") || fullTextSignal.includes("toefl"))
  ) {
    sourceType = "ENGLISH_LANGUAGE_REQUIREMENTS";
    priority = 1;
  } else if (
    fullTextSignal.includes("country") ||
    fullTextSignal.includes("international qualifications") ||
    fullTextSignal.includes("overseas qualifications") ||
    fullTextSignal.includes("equivalent qualifications")
  ) {
    sourceType = "COUNTRY_REQUIREMENTS";
    priority = 1;
  } else if (
    fullTextSignal.includes("entry requirement") ||
    fullTextSignal.includes("admission requirement") ||
    fullTextSignal.includes("entry-requirements") ||
    fullTextSignal.includes("admissions-requirements")
  ) {
    sourceType = "ENTRY_REQUIREMENTS";
    priority = 1;
  }
  // Program Catalogs & Courses (Priority 2)
  else if (
    fullTextSignal.includes("undergraduate courses") ||
    fullTextSignal.includes("undergraduate programmes") ||
    fullTextSignal.includes("undergraduate-courses") ||
    fullTextSignal.includes("/undergraduate/courses") ||
    fullTextSignal.includes("bachelor")
  ) {
    sourceType = "UNDERGRADUATE_PROGRAMS";
    priority = 2;
  } else if (
    fullTextSignal.includes("postgraduate courses") ||
    fullTextSignal.includes("postgraduate programmes") ||
    fullTextSignal.includes("graduate courses") ||
    fullTextSignal.includes("master") ||
    fullTextSignal.includes("/graduate/courses")
  ) {
    sourceType = "POSTGRADUATE_PROGRAMS";
    priority = 2;
  } else if (fullTextSignal.includes("phd") || fullTextSignal.includes("doctoral") || fullTextSignal.includes("research degrees")) {
    sourceType = "PHD_PROGRAMS";
    priority = 2;
  } else if (fullTextSignal.includes("mba") || fullTextSignal.includes("business school master")) {
    sourceType = "MBA_PROGRAMS";
    priority = 2;
  } else if (
    fullTextSignal.includes("course catalog") ||
    fullTextSignal.includes("program catalog") ||
    fullTextSignal.includes("programmes") ||
    fullTextSignal.includes("courses") ||
    fullTextSignal.includes("all-courses") ||
    fullTextSignal.includes("/study/courses")
  ) {
    sourceType = isPdf ? "OFFICIAL_CATALOG_PDF" : "PROGRAM_CATALOG";
    priority = isPdf ? 5 : 2;
  }
  // General Admissions Portals (Priority 3)
  else if (fullTextSignal.includes("international admission") || fullTextSignal.includes("international-students")) {
    sourceType = "INTERNATIONAL_ADMISSIONS";
    priority = 3;
  } else if (fullTextSignal.includes("undergraduate admission") || fullTextSignal.includes("undergraduate-admissions")) {
    sourceType = "UNDERGRADUATE_ADMISSIONS";
    priority = 3;
  } else if (fullTextSignal.includes("postgraduate admission") || fullTextSignal.includes("graduate-admissions")) {
    sourceType = "POSTGRADUATE_ADMISSIONS";
    priority = 3;
  } else if (fullTextSignal.includes("tuition") || fullTextSignal.includes("fees") || fullTextSignal.includes("cost of study")) {
    sourceType = "TUITION_FEES";
    priority = 4;
  } else if (fullTextSignal.includes("how to apply") || fullTextSignal.includes("application guide") || fullTextSignal.includes("applying")) {
    sourceType = "APPLICATION_GUIDE";
    priority = 4;
  } else if (path === "" || path === "/" || path.includes("index")) {
    sourceType = "MAIN_WEBSITE";
    priority = 10;
  }

  // 3. Determine Verification Status based on provenance & signal strength
  let verificationStatus: SourceVerificationStatus = "NEEDS_REVIEW";

  if (isOfficial) {
    if (provenanceType === "OFFICIAL_UNIVERSITY_DOMAIN") {
      verificationStatus = sourceType !== "OTHER" ? "VERIFIED" : "HIGH_CONFIDENCE";
    } else if (provenanceType === "OFFICIAL_DELEGATED_PLATFORM" || provenanceType === "GOVERNMENT") {
      verificationStatus = "VERIFIED";
    }
  } else {
    verificationStatus = "REJECTED";
  }

  return {
    sourceType,
    priority,
    provenanceType,
    verificationStatus,
    isOfficial,
    contentType,
    reason: `Domain: ${urlDomain.domain} (${provenanceType}), Matched: ${sourceType}`,
  };
}
