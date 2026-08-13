import type { AdmissionRequirementGroup } from "@/types/admission.types";
import type { ExplanationItem, MatchCategory, ProgramMatchEvaluation, StudentAcademicProfile } from "@/types/matching.types";
import { evaluateAdmissionEligibility } from "./admission-rule-engine";
import { toEngineStudentProfile } from "./profile-normalizer";

interface ProgramCompetitiveData {
  minimumIb?: number;
  typicalIb?: number;
  minimumSat?: number;
  typicalSat?: number;
}

/**
 * Evaluates admission eligibility, competitive thresholds, and structured explanations.
 */
export function evaluateProgramMatch(
  program: { id: string; name: string; universityName: string },
  requirementTree: AdmissionRequirementGroup | null | undefined,
  studentProfile: StudentAcademicProfile,
  competitiveData?: ProgramCompetitiveData,
  searchRelevanceScore = 500
): ProgramMatchEvaluation {
  const engineProfile = toEngineStudentProfile(studentProfile);
  const evalResult = evaluateAdmissionEligibility(engineProfile, requirementTree);

  const explanations: ExplanationItem[] = [];
  let category: MatchCategory = evalResult.status as MatchCategory;

  // 1. Process Rule Checks into Structured Explanation Items
  for (const check of evalResult.checks) {
    if (check.status === "PASSED") {
      explanations.push({
        kind: "SUCCESS",
        symbol: "✓",
        message: check.subject
          ? `${check.qualificationCode} ${check.subject} requirement met (${check.studentScore})`
          : `${check.qualificationCode} requirement met (${check.studentScore} >= ${check.requiredScore})`,
        qualificationCode: check.qualificationCode,
        subjectName: check.subject,
      });
    } else if (check.status === "FAILED") {
      explanations.push({
        kind: "GAP",
        symbol: "✗",
        message: check.subject
          ? `${check.qualificationCode} ${check.subject} requirement failed: ${check.reason}`
          : `${check.qualificationCode} requirement failed: required ${check.requiredScore}, found ${check.studentScore || "None"}`,
        qualificationCode: check.qualificationCode,
        subjectName: check.subject,
      });
    } else if (check.status === "MISSING") {
      explanations.push({
        kind: "MISSING",
        symbol: "?",
        message: `${check.qualificationCode} result missing (Required)`,
        qualificationCode: check.qualificationCode,
        subjectName: check.subject,
      });
    }
  }

  // 2. Evaluate Competitive vs Minimum Score Thresholds
  if (evalResult.passed && competitiveData) {
    const ibRecord = studentProfile.qualifications.find((q) => q.code === "IB");
    if (ibRecord?.score && competitiveData.typicalIb) {
      if (ibRecord.score < competitiveData.typicalIb) {
        explanations.push({
          kind: "WARNING",
          symbol: "⚠",
          message: `Typical admitted score is ${competitiveData.typicalIb} IB points (Student has ${ibRecord.score})`,
          qualificationCode: "IB",
        });

        // Demote from STRONG_MATCH / ELIGIBLE to REACH or MATCH if competitive gap is significant
        if (ibRecord.score < competitiveData.typicalIb - 2) {
          category = "REACH";
        } else if (category === "ELIGIBLE" || category === "STRONG_MATCH") {
          category = "MATCH";
        }
      }
    }

    const satRecord = studentProfile.qualifications.find((q) => q.code === "SAT");
    if (satRecord?.score && competitiveData.typicalSat) {
      if (satRecord.score < competitiveData.typicalSat) {
        explanations.push({
          kind: "WARNING",
          symbol: "⚠",
          message: `Typical admitted score is ${competitiveData.typicalSat} SAT (Student has ${satRecord.score})`,
          qualificationCode: "SAT",
        });
        if (satRecord.score < competitiveData.typicalSat - 50 && category !== "REACH") {
          category = "REACH";
        }
      }
    }
  }

  // Handle zero requirement data case
  if (!requirementTree || (!requirementTree.requirements?.length && !requirementTree.subGroups?.length)) {
    category = "UNKNOWN";
    explanations.push({
      kind: "INFO",
      symbol: "ℹ",
      message: "Insufficient database requirement data for definitive eligibility decision.",
    });
  }

  return {
    programId: program.id,
    programName: program.name,
    universityName: program.universityName,
    category,
    requirementMatchPercentage: evalResult.overallCompetitiveness,
    searchRelevanceScore,
    explanations,
    missingQualifications: evalResult.missingQualifications,
    failedRequirements: evalResult.failedRequirements.map((f) => f.reason),
  };
}
