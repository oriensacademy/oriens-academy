/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import { describe, it, expect } from "vitest";
import { ScoreSchemaValidator } from "../score-schema-validator";
import { GradeProfileComparator } from "../grade-profile-comparator";
import { createStudentProfile } from "../student-academic-profile";

describe("Qualification Normalization & Score Schemas Unit Tests", () => {
  const validator = new ScoreSchemaValidator();

  it("should validate IB Diploma score range [24, 45]", () => {
    const validIB = validator.validateScore("IB", 38, "38 points");
    expect(validIB.isValid).toBe(true);

    const invalidIB = validator.validateScore("IB", 50, "50 points");
    expect(invalidIB.isValid).toBe(false);
    expect(invalidIB.errorType).toBe("INVALID_SCORE");
  });

  it("should validate IELTS score range [0.0, 9.0] and populate components", () => {
    const validIELTS = validator.validateScore("IELTS", 7.5, "7.5 overall");
    expect(validIELTS.isValid).toBe(true);
    expect(validIELTS.components?.overall).toBe(7.5);
    expect(validIELTS.components?.speaking).toBe(7.5);
  });

  it("should order A-Level grade profiles deterministically (A*A*A > AAA)", () => {
    expect(GradeProfileComparator.compareALevelProfiles("A*A*A", "AAA")).toBe(true);
    expect(GradeProfileComparator.compareALevelProfiles("AAA", "A*A*A")).toBe(false);
    expect(GradeProfileComparator.compareALevelProfiles("AAB", "ABB")).toBe(true);
  });

  it("should enforce English subscore failures (hard component failure cannot be averaged away)", () => {
    const student = { overall: 7.5, listening: 7.5, reading: 7.5, writing: 6.0, speaking: 7.5 };
    const requirement = { minOverall: 7.0, minComponent: 7.0 };

    const passes = GradeProfileComparator.compareEnglishSubscores(student, requirement);
    expect(passes).toBe(false); // Fails because writing is 6.0 < 7.0
  });

  it("should separate IB Math AA and Math AI (Math AI does not satisfy Math AA)", () => {
    expect(GradeProfileComparator.compareIBMathSubject("IB Math AI HL", "IB Math AA HL")).toBe(false);
    expect(GradeProfileComparator.compareIBMathSubject("IB Math AA HL", "IB Math AA HL")).toBe(true);
  });

  it("should forbid cross-qualification conversion formulas unless explicitly source-backed", () => {
    expect(GradeProfileComparator.isCrossQualificationConversionAllowed("IB", "SAT")).toBe(false);
    expect(GradeProfileComparator.isCrossQualificationConversionAllowed("ALEVEL", "IB")).toBe(false);
    expect(GradeProfileComparator.isCrossQualificationConversionAllowed("IB", "IB")).toBe(true);
  });

  it("should create student academic profile data structure", () => {
    const profile = createStudentProfile({
      citizenshipCountryCode: "TR",
      applicantType: "INTERNATIONAL",
      primaryQualification: { qualCode: "IB", scoreType: "GRADE_POINTS", overallScore: 39 },
      englishTest: { testCode: "IELTS", overallScore: 7.5, listening: 7.5, reading: 7.5, writing: 7.0, speaking: 7.5 },
      targetDegreeLevel: "UNDERGRADUATE",
    });

    expect(profile.citizenshipCountryCode).toBe("TR");
    expect(profile.primaryQualification.overallScore).toBe(39);
    expect(profile.englishTest?.overallScore).toBe(7.5);
  });
});
