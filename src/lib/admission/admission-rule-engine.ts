import type { AdmissionRequirementGroup } from "@/types/admission.types";
import type { EvaluationResult, SingleRequirementCheck, StudentProfile } from "@/types/rule-engine.types";
import { evaluateRequirementGroup } from "./rule-evaluator";

/**
 * Deterministic Admission Rule Engine Facade.
 * Evaluates student profiles against structured program admission requirement trees.
 */
export function evaluateAdmissionEligibility(
  profile: StudentProfile,
  requirementTree: AdmissionRequirementGroup | null | undefined,
  qualCodeMap: Record<string, string> = {}
): EvaluationResult {
  if (!requirementTree || (!requirementTree.requirements?.length && !requirementTree.subGroups?.length)) {
    return {
      status: "UNKNOWN",
      passed: false,
      overallCompetitiveness: 0,
      checks: [],
      missingQualifications: [],
      failedRequirements: [],
      explanation: "No structured admission requirements available for this program in dataset.",
    };
  }

  const groupResult = evaluateRequirementGroup(requirementTree, qualCodeMap, profile);

  // Flatten all requirement checks for explainability
  const allChecks: SingleRequirementCheck[] = [];
  function collectChecks(g: typeof groupResult) {
    allChecks.push(...g.checks);
    for (const sg of g.subGroups) {
      collectChecks(sg);
    }
  }
  collectChecks(groupResult);

  const failedReqs = allChecks.filter((c) => c.status === "FAILED");
  const missingReqs = allChecks.filter((c) => c.status === "MISSING");
  const passedReqs = allChecks.filter((c) => c.status === "PASSED");

  const missingQualCodes = Array.from(new Set(missingReqs.map((m) => m.qualificationCode)));

  // Calculate competitiveness score (0 to 100)
  const relevantChecks = allChecks.filter((c) => c.status !== "NOT_REQUIRED");
  let competitiveness = 100;
  if (relevantChecks.length > 0) {
    competitiveness = Math.round((passedReqs.length / relevantChecks.length) * 100);
  }

  // Determine explicit evaluation status
  let status: EvaluationResult["status"] = "REQUIREMENT_GAP";

  if (groupResult.passed) {
    if (failedReqs.length === 0) {
      status = "ELIGIBLE";
      competitiveness = Math.max(competitiveness, 95);
    } else if (competitiveness >= 75) {
      status = "STRONG_MATCH";
    } else if (competitiveness >= 60) {
      status = "MATCH";
    } else {
      status = "REACH";
    }
  } else if (groupResult.hasMissingInfo && failedReqs.length === 0) {
    status = "MISSING_INFORMATION";
  } else if (failedReqs.length > 0) {
    status = "REQUIREMENT_GAP";
  }

  // Readable human/machine explanation
  let explanation = "";
  if (status === "ELIGIBLE" || status === "STRONG_MATCH" || status === "MATCH") {
    explanation = `All mandatory admission requirements met. Student is ${status.replace("_", " ").toLowerCase()}.`;
  } else if (status === "MISSING_INFORMATION") {
    explanation = `Student profile is missing required score/information for: ${missingQualCodes.join(", ")}.`;
  } else if (status === "REQUIREMENT_GAP") {
    explanation = `Hard requirement gap detected: ${failedReqs.map((f) => f.reason).join("; ")}.`;
  } else {
    explanation = `Program requirements not satisfied.`;
  }

  return {
    status,
    passed: groupResult.passed,
    overallCompetitiveness: competitiveness,
    checks: allChecks,
    missingQualifications: missingQualCodes,
    failedRequirements: failedReqs,
    explanation,
  };
}
