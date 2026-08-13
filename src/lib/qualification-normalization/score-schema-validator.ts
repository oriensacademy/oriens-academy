export type ValidationErrorType =
  | "INVALID_SCORE"
  | "INVALID_GRADE"
  | "INVALID_SUBJECT"
  | "UNKNOWN_QUALIFICATION"
  | "IMPOSSIBLE_COMPONENTS"
  | "NONE";

export interface ScoreValidationResult {
  isValid: boolean;
  errorType: ValidationErrorType;
  errorMessage?: string;
  normalizedScoreType: string;
  components?: Record<string, number>;
  confidence: "EXACT" | "CANONICAL_ALIAS" | "DETERMINISTIC_RULE" | "HIGH_CONFIDENCE" | "NEEDS_REVIEW" | "UNRESOLVED";
}

export class ScoreSchemaValidator {
  private static RANGE_RULES: Record<string, { min: number; max: number; type: string }> = {
    IB: { min: 24, max: 45, type: "GRADE_POINTS" },
    ALEVEL: { min: 1, max: 3, type: "GRADE_PROFILE" },
    AP: { min: 1, max: 5, type: "NUMERIC_SCALE" },
    SAT: { min: 400, max: 1600, type: "NUMERIC_SCALE" },
    ACT: { min: 1, max: 36, type: "NUMERIC_SCALE" },
    IELTS: { min: 0.0, max: 9.0, type: "NUMERIC_SCALE" },
    TOEFL: { min: 0, max: 120, type: "NUMERIC_SCALE" },
    PTE: { min: 10, max: 90, type: "NUMERIC_SCALE" },
    DUOLINGO: { min: 10, max: 160, type: "NUMERIC_SCALE" },
    GRE: { min: 260, max: 340, type: "NUMERIC_SCALE" },
    GMAT: { min: 200, max: 800, type: "NUMERIC_SCALE" },
    UCAT: { min: 1200, max: 3600, type: "NUMERIC_SCALE" },
    TMUA: { min: 1.0, max: 9.0, type: "NUMERIC_SCALE" },
    IMAT: { min: 0, max: 90, type: "NUMERIC_SCALE" },
    ESAT: { min: 1.0, max: 9.0, type: "NUMERIC_SCALE" },
    ABITUR: { min: 1.0, max: 6.0, type: "DECIMAL" },
    FRENCH_BAC: { min: 0, max: 20, type: "NUMERIC_SCALE" },
    EURO_BAC: { min: 0, max: 100, type: "NUMERIC_SCALE" },
    TURKISH_LISA: { min: 0, max: 100, type: "NUMERIC_SCALE" },
    YKS: { min: 100, max: 500, type: "NUMERIC_SCALE" },
    GAOKAO: { min: 0, max: 750, type: "NUMERIC_SCALE" },
    JEE: { min: 0, max: 360, type: "NUMERIC_SCALE" },
    NEET: { min: 0, max: 720, type: "NUMERIC_SCALE" },
    AS_LEVEL: { min: 1, max: 5, type: "GRADE_PROFILE" },
    CAMBRIDGE_ENG: { min: 160, max: 230, type: "NUMERIC_SCALE" },
    BACHELORS: { min: 2.0, max: 4.0, type: "DECIMAL" },
  };

  public validateScore(qualCode: string, minScore: number | null, gradeText: string | null): ScoreValidationResult {
    const code = qualCode.toUpperCase();
    const rule = ScoreSchemaValidator.RANGE_RULES[code];

    if (!rule && qualCode !== "PERSONAL_STATEMENT") {
      return {
        isValid: false,
        errorType: "UNKNOWN_QUALIFICATION",
        errorMessage: `Qualification code ${qualCode} is not in ontology schema`,
        normalizedScoreType: "COMPOSITE",
        confidence: "UNRESOLVED",
      };
    }

    if (minScore !== null && rule) {
      if (minScore < rule.min || minScore > rule.max) {
        return {
          isValid: false,
          errorType: "INVALID_SCORE",
          errorMessage: `Score ${minScore} is outside valid range [${rule.min}, ${rule.max}] for ${qualCode}`,
          normalizedScoreType: rule.type,
          confidence: "NEEDS_REVIEW",
        };
      }
    }

    if (code === "IELTS" && minScore !== null) {
      return {
        isValid: true,
        errorType: "NONE",
        normalizedScoreType: "NUMERIC_SCALE",
        components: { overall: minScore, listening: minScore, reading: minScore, writing: minScore, speaking: minScore },
        confidence: "EXACT",
      };
    }

    if (code === "TOEFL" && minScore !== null) {
      return {
        isValid: true,
        errorType: "NONE",
        normalizedScoreType: "NUMERIC_SCALE",
        components: { total: minScore },
        confidence: "EXACT",
      };
    }

    if (code === "ALEVEL" && gradeText) {
      const validProfilePattern = /^(A\*A\*A\*|A\*A\*A|A\*AA|AAA|AAB|ABB|BBB|BBC|BCC)$/i;
      if (!validProfilePattern.test(gradeText) && !gradeText.toLowerCase().includes("grade")) {
        return {
          isValid: false,
          errorType: "INVALID_GRADE",
          errorMessage: `Invalid A-Level grade profile: ${gradeText}`,
          normalizedScoreType: "GRADE_PROFILE",
          confidence: "NEEDS_REVIEW",
        };
      }
    }

    return {
      isValid: true,
      errorType: "NONE",
      normalizedScoreType: rule ? rule.type : "PRESENCE_ONLY",
      confidence: "EXACT",
    };
  }
}
