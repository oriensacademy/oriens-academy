export type RequirementCategory =
  | "ACADEMIC_QUALIFICATION"
  | "SUBJECT_REQUIREMENT"
  | "ADMISSION_TEST"
  | "ENGLISH_LANGUAGE"
  | "PORTFOLIO"
  | "INTERVIEW"
  | "WORK_EXPERIENCE"
  | "REFERENCE"
  | "PERSONAL_STATEMENT"
  | "WRITTEN_WORK"
  | "AUDITION"
  | "OTHER";

export type RequirementStatus =
  | "REQUIRED"
  | "RECOMMENDED"
  | "OPTIONAL"
  | "ACCEPTED"
  | "ALTERNATIVE"
  | "COMPETITIVE"
  | "NOT_ACCEPTED"
  | "UNKNOWN";

export type DataConfidence =
  | "VERIFIED"
  | "HIGH_CONFIDENCE"
  | "NEEDS_REVIEW"
  | "CONFLICTING"
  | "STALE"
  | "UNVERIFIED";

export type ApplicantType = "DOMESTIC" | "INTERNATIONAL" | "EU" | "NON_EU" | "OTHER";

export interface ClassificationResult {
  category: RequirementCategory;
  status: RequirementStatus;
  applicantType: ApplicantType;
  confidence: DataConfidence;
  isNegativeRule: boolean;
}

export function classifyRequirement(
  text: string,
  options?: { qualCode?: string; isOfficialSource?: boolean; isProgramPage?: boolean }
): ClassificationResult {
  const lower = text.toLowerCase();

  // 1. Detect Category
  let category: RequirementCategory = "OTHER";

  if (options?.qualCode) {
    if (["IELTS", "TOEFL", "PTE", "DUOLINGO"].includes(options.qualCode)) {
      category = "ENGLISH_LANGUAGE";
    } else if (["SAT", "ACT", "GRE", "GMAT", "UCAT", "TMUA", "IMAT", "ESAT", "TARA", "OMPT"].includes(options.qualCode)) {
      category = "ADMISSION_TEST";
    } else if (["IB", "ALEVEL", "AP", "IGCSE", "BACHELORS"].includes(options.qualCode)) {
      category = "ACADEMIC_QUALIFICATION";
    }
  }

  if (category === "OTHER") {
    if (lower.includes("english") || lower.includes("ielts") || lower.includes("toefl") || lower.includes("language")) {
      category = "ENGLISH_LANGUAGE";
    } else if (lower.includes("portfolio") || lower.includes("artwork") || lower.includes("sample")) {
      category = "PORTFOLIO";
    } else if (lower.includes("interview") || lower.includes("oral exam")) {
      category = "INTERVIEW";
    } else if (lower.includes("statement") || lower.includes("motivation") || lower.includes("essay")) {
      category = "PERSONAL_STATEMENT";
    } else if (lower.includes("reference") || lower.includes("letter of recommendation") || lower.includes("recommendation")) {
      category = "REFERENCE";
    } else if (lower.includes("work experience") || lower.includes("employment")) {
      category = "WORK_EXPERIENCE";
    } else if (lower.includes("written work") || lower.includes("writing sample")) {
      category = "WRITTEN_WORK";
    } else if (lower.includes("math") || lower.includes("physics") || lower.includes("chemistry") || lower.includes("biology") || lower.includes("subject")) {
      category = "SUBJECT_REQUIREMENT";
    } else {
      category = "ACADEMIC_QUALIFICATION";
    }
  }

  // 2. Detect Status
  let status: RequirementStatus = "REQUIRED";
  let isNegativeRule = false;

  if (lower.includes("not accepted") || lower.includes("will not accept") || lower.includes("ineligible")) {
    status = "NOT_ACCEPTED";
    isNegativeRule = true;
  } else if (lower.includes("competitive") || lower.includes("typically looking for") || lower.includes("typical offer")) {
    status = "COMPETITIVE";
  } else if (lower.includes("recommended") || lower.includes("advisable") || lower.includes("strongly encouraged")) {
    status = "RECOMMENDED";
  } else if (lower.includes("optional") || lower.includes("considered if submitted")) {
    status = "OPTIONAL";
  } else if (lower.includes("alternative") || lower.includes("or equivalent") || lower.includes("instead of")) {
    status = "ALTERNATIVE";
  } else if (lower.includes("accepted") || lower.includes("recognized")) {
    status = "ACCEPTED";
  }

  // 3. Detect Applicant Type
  let applicantType: ApplicantType = "INTERNATIONAL";
  if (lower.includes("domestic") || lower.includes("uk students") || lower.includes("home students") || lower.includes("us applicants")) {
    applicantType = "DOMESTIC";
  } else if (lower.includes("eu students") || lower.includes("european union")) {
    applicantType = "EU";
  } else if (lower.includes("non-eu")) {
    applicantType = "NON_EU";
  }

  // 4. Determine Data Confidence
  let confidence: DataConfidence = "HIGH_CONFIDENCE";
  if (options?.isOfficialSource) {
    confidence = "VERIFIED";
  }

  if (lower.includes("subject to change") || lower.includes("check with department") || lower.includes("contact admissions")) {
    confidence = "NEEDS_REVIEW";
  }

  return {
    category,
    status,
    applicantType,
    confidence,
    isNegativeRule,
  };
}
