export type FreshnessLevel =
  | "VERY_FRESH"
  | "FRESH"
  | "USABLE"
  | "AGING"
  | "STALE";

export type SourceConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "CONFLICTING";

export interface DataQualityMetrics {
  freshnessLevel: FreshnessLevel;
  confidenceLevel: SourceConfidenceLevel;
  confidenceScore: number; // 0 to 100
  monthsOld: number;
  verificationDate: string;
  primarySourceUrl: string;
  sourceTitle: string;
  sourceType: string;
  hasConflict: boolean;
  conflictReason?: string;
  userFacingBadge: string;
  userFacingMessage: string;
}

export interface SourceReference {
  id: string;
  url: string;
  title: string;
  sourceType: string;
  verifiedAt: string;
  academicYear: number;
}

export interface ConflictReport {
  hasConflict: boolean;
  conflictingSources: SourceReference[];
  description?: string;
}
