import type { DegreeLevel } from "./admission.types";

export interface SubjectRecord {
  name: string;
  level?: string;
  score?: number;
  exactGrade?: string;
}

export interface QualificationRecord {
  code: string;
  score?: number;
  exactGrade?: string;
  present?: boolean;
}

export interface StudentAcademicProfile {
  country?: string;
  targetDegreeLevel?: DegreeLevel | string;
  qualifications: QualificationRecord[];
  subjects: SubjectRecord[];
  isEphemeral?: boolean;
}

export type ExplanationKind = "SUCCESS" | "WARNING" | "MISSING" | "GAP" | "INFO";

export interface ExplanationItem {
  kind: ExplanationKind;
  symbol: "✓" | "⚠" | "?" | "✗" | "ℹ";
  message: string;
  qualificationCode?: string;
  subjectName?: string;
}

export type MatchCategory =
  | "ELIGIBLE"
  | "STRONG_MATCH"
  | "MATCH"
  | "REACH"
  | "REQUIREMENT_GAP"
  | "MISSING_INFORMATION"
  | "UNKNOWN";

export interface ProgramMatchEvaluation {
  programId: string;
  programName: string;
  universityName: string;
  category: MatchCategory;
  requirementMatchPercentage: number; // 0 to 100%
  searchRelevanceScore: number; // Internal ranking score
  explanations: ExplanationItem[];
  missingQualifications: string[];
  failedRequirements: string[];
}
