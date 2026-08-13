import type { RequirementType } from "./admission.types";

export type EvaluationStatus =
  | "ELIGIBLE"
  | "STRONG_MATCH"
  | "MATCH"
  | "REACH"
  | "REQUIREMENT_GAP"
  | "MISSING_INFORMATION"
  | "UNKNOWN";

export type CheckStatus = "PASSED" | "FAILED" | "MISSING" | "UNKNOWN" | "NOT_REQUIRED";

export interface StudentQualificationRecord {
  code: string;
  score?: number;
  exactGrade?: string;
  subject?: string;
  level?: string;
  present?: boolean;
}

export interface StudentProfile {
  qualifications: StudentQualificationRecord[];
}

export interface SingleRequirementCheck {
  qualificationCode: string;
  subject?: string;
  requirementType: RequirementType;
  status: CheckStatus;
  requiredScore?: string | number;
  studentScore?: string | number;
  reason: string;
}

export interface GroupCheckResult {
  groupId: string;
  logicalOperator: "AND" | "OR";
  passed: boolean;
  hasMissingInfo: boolean;
  checks: SingleRequirementCheck[];
  subGroups: GroupCheckResult[];
}

export interface EvaluationResult {
  status: EvaluationStatus;
  passed: boolean;
  overallCompetitiveness: number; // 0.0 to 100.0
  checks: SingleRequirementCheck[];
  missingQualifications: string[];
  failedRequirements: SingleRequirementCheck[];
  explanation: string;
}
