import type { EntityMatch, QualificationQuery, SearchIntent } from "@/types/parser.types";

export interface IntentAnalysisResult {
  intent: SearchIntent;
  confidence: number;
}

export function classifySearchIntent(
  rawQuery: string,
  universities: EntityMatch[],
  countries: EntityMatch[],
  qualifications: QualificationQuery[],
  programs: EntityMatch[],
  fieldsOfStudy: EntityMatch[]
): IntentAnalysisResult {
  const normalized = rawQuery.toLowerCase().trim();

  const hasScore = qualifications.some((q) => q.score !== undefined);
  const hasQualification = qualifications.length > 0;
  const hasUniversity = universities.length > 0;
  const hasCountry = countries.length > 0;
  const hasFieldOfStudy = fieldsOfStudy.length > 0 || programs.length > 0;

  // Natural language intent signals
  const isEligibilityQuestion =
    /\b(what can i study|where can i study|am i eligible|can i get into|accepted with)\b/.test(normalized) || hasScore;
  const isQualificationDiscovery =
    /\b(accepting|accepts|accept|requires|require|with|accepting ib|accepting sat)\b/.test(normalized);

  // 1. ELIGIBILITY SEARCH (Scores present or explicit eligibility phrasing)
  if (isEligibilityQuestion && (hasQualification || hasScore)) {
    return {
      intent: "ELIGIBILITY_SEARCH",
      confidence: hasScore ? 0.95 : 0.85,
    };
  }

  // 2. DISCOVERY SEARCH (Compound search e.g. "Italy medicine", "UK computer science", "medicine in Italy with IMAT")
  if ((hasCountry || hasUniversity) && hasFieldOfStudy) {
    return {
      intent: "DISCOVERY_SEARCH",
      confidence: 0.92,
    };
  }

  // 3. QUALIFICATION SEARCH (Exam mentioned without specific score, e.g. "universities accepting IB", "TMUA", "MBA GMAT")
  if (hasQualification && (isQualificationDiscovery || (!hasUniversity && !hasCountry))) {
    return {
      intent: "QUALIFICATION_SEARCH",
      confidence: 0.9,
    };
  }

  // 4. UNIVERSITY SEARCH (Direct university query e.g. "Cambridge", "UCL", "computer science at Cambridge")
  if (hasUniversity) {
    return {
      intent: "UNIVERSITY_SEARCH",
      confidence: 0.95,
    };
  }

  // 5. PROGRAM SEARCH (Field of study query e.g. "computer science", "medicine", "engineering")
  if (hasFieldOfStudy && !hasCountry && !hasUniversity) {
    return {
      intent: "PROGRAM_SEARCH",
      confidence: 0.88,
    };
  }

  // 6. COUNTRY SEARCH (Country query e.g. "Italy", "UK", "United States")
  if (hasCountry && !hasFieldOfStudy && !hasUniversity) {
    return {
      intent: "COUNTRY_SEARCH",
      confidence: 0.9,
    };
  }

  // Fallback DISCOVERY / MIXED
  if (hasCountry || hasQualification || hasFieldOfStudy || hasUniversity) {
    return {
      intent: "DISCOVERY_SEARCH",
      confidence: 0.75,
    };
  }

  return {
    intent: "MIXED",
    confidence: 0.5,
  };
}
