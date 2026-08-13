import type { AdmissionSource } from "@/types/admission.types";
import type { DataQualityMetrics, FreshnessLevel, SourceConfidenceLevel } from "@/types/confidence.types";

const SOURCE_TYPE_WEIGHTS: Record<string, number> = {
  OFFICIAL_UNIVERSITY_PAGE: 1.0,
  OFFICIAL_ADMISSIONS_PORTAL: 0.95,
  GOVERNMENT_DATABASE: 0.95,
  RECOGNIZED_ADMISSIONS_DATABASE: 0.85,
  MANUALLY_VERIFIED: 0.75,
};

export function calculateDataQuality(
  sources?: AdmissionSource[] | null,
  conflictingSources?: AdmissionSource[] | null
): DataQualityMetrics {
  const primarySource = sources && sources.length > 0 ? sources[0] : null;

  if (!primarySource) {
    return {
      freshnessLevel: "STALE",
      confidenceLevel: "LOW",
      confidenceScore: 40,
      monthsOld: 24,
      verificationDate: "Unverified",
      primarySourceUrl: "",
      sourceTitle: "Unverified Source",
      sourceType: "MANUALLY_VERIFIED",
      hasConflict: false,
      userFacingBadge: "Unverified Data",
      userFacingMessage: "Requirement data is unverified or derived from secondary sources.",
    };
  }

  // 1. Calculate Age in Months
  const verifiedDate = new Date(primarySource.verifiedAt || primarySource.retrievedAt || Date.now());
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - verifiedDate.getTime());
  const monthsOld = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.4375));

  // 2. Determine Freshness Level
  let freshnessLevel: FreshnessLevel = "VERY_FRESH";
  let ageScore = 100;

  if (monthsOld <= 3) {
    freshnessLevel = "VERY_FRESH";
    ageScore = 100;
  } else if (monthsOld <= 6) {
    freshnessLevel = "FRESH";
    ageScore = 90;
  } else if (monthsOld <= 12) {
    freshnessLevel = "USABLE";
    ageScore = 75;
  } else if (monthsOld <= 24) {
    freshnessLevel = "AGING";
    ageScore = 55;
  } else {
    freshnessLevel = "STALE";
    ageScore = 30;
  }

  // 3. Evaluate Conflict
  const hasConflict = conflictingSources && conflictingSources.length > 1;

  // 4. Source Weight & Composite Confidence Score
  const sourceWeight = SOURCE_TYPE_WEIGHTS[primarySource.sourceType] || 0.7;
  let compositeScore = Math.round(ageScore * sourceWeight);
  if (hasConflict) compositeScore = Math.min(compositeScore, 45);

  let confidenceLevel: SourceConfidenceLevel = "HIGH";
  if (hasConflict) {
    confidenceLevel = "CONFLICTING";
  } else if (compositeScore >= 80) {
    confidenceLevel = "HIGH";
  } else if (compositeScore >= 55) {
    confidenceLevel = "MEDIUM";
  } else {
    confidenceLevel = "LOW";
  }

  // 5. User Facing Badges and Messages
  let userFacingBadge = "High Confidence";
  let userFacingMessage = `Verified from ${primarySource.title} (${primarySource.academicYear} intake).`;

  if (hasConflict) {
    userFacingBadge = "Conflicting Sources";
    userFacingMessage = "Multiple official sources present conflicting requirement values. Handle with caution.";
  } else if (freshnessLevel === "AGING" || freshnessLevel === "STALE") {
    userFacingBadge = "Aging Data";
    userFacingMessage = `Requirements last verified ${monthsOld} months ago. Official university update recommended.`;
  } else if (confidenceLevel === "MEDIUM") {
    userFacingBadge = "Verified Data";
    userFacingMessage = `Verified ${monthsOld} months ago from ${primarySource.title}.`;
  }

  return {
    freshnessLevel,
    confidenceLevel,
    confidenceScore: compositeScore,
    monthsOld,
    verificationDate: primarySource.verifiedAt ? primarySource.verifiedAt.split("T")[0] : "Verified",
    primarySourceUrl: primarySource.url,
    sourceTitle: primarySource.title,
    sourceType: primarySource.sourceType,
    hasConflict: !!hasConflict,
    conflictReason: hasConflict ? "Multiple sources report differing minimum scores" : undefined,
    userFacingBadge,
    userFacingMessage,
  };
}
