/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import { describe, it, expect } from "vitest";
import { parseRequirementScore } from "../score-parser";
import { classifyRequirement } from "../requirement-classifier";
import { RuleGroupBuilder, RequirementGroupNode } from "../rule-group-builder";

describe("Structured Admission Requirement Extractor Unit Tests", () => {
  it("should correctly parse IB Diploma overall score and HL grade profile", () => {
    const parsed = parseRequirementScore("39 points overall with 7,6,6 at HL", "IB");
    expect(parsed.minScore).toBe(39);
    expect(parsed.gradeText).toBe("7,6,6 at HL");
    expect(parsed.levelRequirement).toBe("HL");
  });

  it("should correctly parse A-Level grade profiles (A*A*A, AAA)", () => {
    const parsedAStar = parseRequirementScore("A-Level entry requirements: A*A*A in Math and Physics", "ALEVEL");
    expect(parsedAStar.gradeText).toBe("A*A*A");

    const parsedAAA = parseRequirementScore("Standard offer is AAA", "ALEVEL");
    expect(parsedAAA.gradeText).toBe("AAA");
  });

  it("should correctly parse IELTS & TOEFL numeric thresholds", () => {
    const ielts = parseRequirementScore("IELTS 7.5 overall with minimum 7.0 in components", "IELTS");
    expect(ielts.minScore).toBe(7.5);

    const toefl = parseRequirementScore("TOEFL iBT 100 minimum score", "TOEFL");
    expect(toefl.minScore).toBe(100);
  });

  it("should correctly classify requirement category and status", () => {
    const classif = classifyRequirement("IELTS 7.0 required for international applicants", { qualCode: "IELTS", isOfficialSource: true });
    expect(classif.category).toBe("ENGLISH_LANGUAGE");
    expect(classif.status).toBe("REQUIRED");
    expect(classif.applicantType).toBe("INTERNATIONAL");
    expect(classif.confidence).toBe("VERIFIED");
  });

  it("should correctly render ASCII rule trees for requirement groups", () => {
    const dummyBuilder = new RuleGroupBuilder({} as unknown as import("@supabase/supabase-js").SupabaseClient);
    const rootNode: RequirementGroupNode = {
      name: "Computer Science BA",
      logicalOperator: "AND",
      children: [
        {
          name: "Academic Entry Qualifications",
          logicalOperator: "OR",
          children: [],
          requirements: [
            { qualCode: "IB", status: "REQUIRED", minScore: 39, gradeText: "7,6,6 at HL" },
            { qualCode: "ALEVEL", status: "REQUIRED", gradeText: "A*A*A" },
          ],
        },
      ],
      requirements: [],
    };

    const ascii = dummyBuilder.renderRuleTreeASCII(rootNode);
    expect(ascii).toContain("[GROUP: AND] Computer Science BA");
    expect(ascii).toContain("[GROUP: OR] Academic Entry Qualifications");
    expect(ascii).toContain("IB >= 39 (7,6,6 at HL) (REQUIRED)");
    expect(ascii).toContain("ALEVEL (A*A*A) (REQUIRED)");
  });
});
