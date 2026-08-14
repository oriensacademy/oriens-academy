import { SupabaseClient } from "@supabase/supabase-js";
import { StudentAcademicProfile } from "../qualification-normalization/student-academic-profile";
import { GradeProfileComparator } from "../qualification-normalization/grade-profile-comparator";

export type ProgramEligibilityStatus =
  | "STRONG_MATCH"
  | "MATCH"
  | "REACH"
  | "REQUIREMENT_GAP"
  | "MISSING_INFORMATION"
  | "DATA_UNAVAILABLE"
  | "CONFLICTING_DATA";

export type CheckState = "PASSED" | "FAILED" | "MISSING" | "NOT_APPLICABLE" | "UNKNOWN" | "CONFLICTING";

export interface RequirementCheckItem {
  requirementId: string;
  category: string;
  requirementType: string;
  status: CheckState;
  requiredValueText: string;
  studentValueText: string;
  isHardGate: boolean;
  provenance: {
    sourceId?: string;
    rawSourceText?: string;
    retrievedAt?: string;
    admissionCycle?: string;
    officialUrl?: string;
  };
}

export interface EligibilityEvaluationResult {
  programId: string;
  status: ProgramEligibilityStatus;
  matchScore: number; // Internal ranking score (0-100), NOT admission probability!
  totalChecks: number;
  passedChecksCount: number;
  failedChecksCount: number;
  missingChecksCount: number;
  checks: RequirementCheckItem[];
  disclaimer: string;
  evaluatedAt: string;
}

export class EligibilityEvaluator {
  constructor(private supabase: SupabaseClient) {}

  public async evaluateProgramEligibility(
    programId: string,
    profile: StudentAcademicProfile,
    selectedCycle: string = "2026/2027"
  ): Promise<EligibilityEvaluationResult> {
    const disclaimer = "Meeting published requirements does not guarantee admission.";
    const evaluatedAt = new Date().toISOString();

    // 1. Fetch requirements & requirement groups for the program
    const { data: requirements, error: reqErr } = await this.supabase
      .from("admission_requirements")
      .select("*, qualifications(code, name), admission_sources(url)")
      .eq("program_id", programId);

    if (reqErr) {
      console.error("[EligibilityEvaluator] Admission requirements query failed", {
        code: reqErr.code,
        message: reqErr.message,
      });
      throw new Error("Unable to load eligibility requirements", { cause: reqErr });
    }

    if (!requirements || requirements.length === 0) {
      return {
        programId,
        status: "DATA_UNAVAILABLE",
        matchScore: 0,
        totalChecks: 0,
        passedChecksCount: 0,
        failedChecksCount: 0,
        missingChecksCount: 0,
        checks: [],
        disclaimer,
        evaluatedAt,
      };
    }

    // 2. Check for conflicting data
    const hasConflict = requirements.some((r) => r.conflict_status === "POTENTIAL_CONFLICT");
    if (hasConflict) {
      return {
        programId,
        status: "CONFLICTING_DATA",
        matchScore: 0,
        totalChecks: requirements.length,
        passedChecksCount: 0,
        failedChecksCount: 0,
        missingChecksCount: 0,
        checks: [],
        disclaimer,
        evaluatedAt,
      };
    }

    const checks: RequirementCheckItem[] = [];
    let passedCount = 0;
    let failedCount = 0;
    let missingCount = 0;
    let isReach = false;

    // 3. Evaluate individual requirements
    for (const req of requirements) {
      const qualObj = Array.isArray(req.qualifications) ? req.qualifications[0] : req.qualifications;
      const qualCode = qualObj?.code || (req.requirement_type === "PERSONAL_STATEMENT" ? "PERSONAL_STATEMENT" : "OTHER");
      const sourceObj = Array.isArray(req.admission_sources) ? req.admission_sources[0] : req.admission_sources;

      const provenance = {
        sourceId: req.source_id,
        rawSourceText: req.raw_source_text,
        retrievedAt: req.retrieved_at,
        admissionCycle: req.admission_cycle || selectedCycle,
        officialUrl: sourceObj?.url,
      };

      let checkState: CheckState = "UNKNOWN";
      const requiredText = req.grade_text || (req.minimum_numeric_score !== null ? `>= ${req.minimum_numeric_score}` : "Required");
      let studentText = "Not Provided";
      const isHardGate = req.requirement_status === "REQUIRED" || req.requirement_status === "ACADEMIC_QUALIFICATION";

      // Evaluate Academic Qualifications
      if (qualCode === "IB") {
        if (profile.primaryQualification?.qualCode === "IB" && profile.primaryQualification.overallScore !== undefined) {
          const sScore = profile.primaryQualification.overallScore || 0;
          const rMin = req.minimum_numeric_score || 24;
          studentText = `${sScore} Points`;
          if (sScore >= rMin) {
            checkState = "PASSED";
            passedCount++;
            if (req.is_typical_threshold && sScore < rMin + 2) isReach = true;
          } else {
            checkState = "FAILED";
            failedCount++;
          }
        } else {
          checkState = "MISSING";
          missingCount++;
        }
      } else if (qualCode === "ALEVEL") {
        if (profile.primaryQualification?.qualCode === "ALEVEL" && profile.primaryQualification.gradeProfile) {
          const sProfile = profile.primaryQualification.gradeProfile;
          const rProfile = req.grade_text || "AAA";
          studentText = sProfile;
          if (GradeProfileComparator.compareALevelProfiles(sProfile, rProfile)) {
            checkState = "PASSED";
            passedCount++;
          } else {
            checkState = "FAILED";
            failedCount++;
          }
        } else {
          checkState = "MISSING";
          missingCount++;
        }
      } else if (qualCode === "IELTS" || qualCode === "TOEFL") {
        const engTest = profile.englishTest;
        if (engTest && (engTest.testCode === qualCode || req.requirement_status === "ALTERNATIVE")) {
          const sScore = engTest.overallScore;
          const rMin = req.minimum_numeric_score || (qualCode === "IELTS" ? 6.5 : 90);
          studentText = `${qualCode} ${sScore}`;

          const minComp = req.score_components?.minComponent;
          const subscorePass = GradeProfileComparator.compareEnglishSubscores(
            {
              overall: sScore,
              listening: engTest.listening,
              reading: engTest.reading,
              writing: engTest.writing,
              speaking: engTest.speaking,
            },
            { minOverall: rMin, minComponent: minComp }
          );

          if (subscorePass) {
            checkState = "PASSED";
            passedCount++;
          } else {
            checkState = "FAILED";
            failedCount++;
          }
        } else {
          checkState = "MISSING";
          missingCount++;
        }
      } else if (qualCode === "PERSONAL_STATEMENT" || req.requirement_type === "PERSONAL_STATEMENT") {
        studentText = "Document Available";
        checkState = "PASSED";
        passedCount++;
      } else if (qualCode === "BACHELORS") {
        const sScore = profile.primaryQualification?.overallScore || 3.5;
        studentText = `GPA ${sScore}`;
        checkState = "PASSED";
        passedCount++;
      } else {
        // Fallback for optional / presence tests
        checkState = "PASSED";
        passedCount++;
      }

      checks.push({
        requirementId: req.id,
        category: req.requirement_type,
        requirementType: req.requirement_type,
        status: checkState,
        requiredValueText: requiredText,
        studentValueText: studentText,
        isHardGate,
        provenance,
      });
    }

    // 4. Compute overall program status
    let finalStatus: ProgramEligibilityStatus = "MATCH";
    if (failedCount > 0) {
      finalStatus = "REQUIREMENT_GAP";
    } else if (missingCount > 0 && passedCount === 0) {
      finalStatus = "MISSING_INFORMATION";
    } else if (isReach) {
      finalStatus = "REACH";
    } else if (passedCount === checks.length && passedCount > 0) {
      finalStatus = "STRONG_MATCH";
    }

    const matchScore = checks.length > 0 ? Math.round((passedCount / checks.length) * 100) : 0;

    return {
      programId,
      status: finalStatus,
      matchScore,
      totalChecks: checks.length,
      passedChecksCount: passedCount,
      failedChecksCount: failedCount,
      missingChecksCount: missingCount,
      checks,
      disclaimer,
      evaluatedAt,
    };
  }
}
