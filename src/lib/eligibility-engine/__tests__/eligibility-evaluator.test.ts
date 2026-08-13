/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import { describe, it, expect } from "vitest";
import { EligibilityEvaluator } from "../eligibility-evaluator";
import { createStudentProfile } from "../../qualification-normalization/student-academic-profile";
import { SupabaseClient } from "@supabase/supabase-js";

describe("Deterministic Student Eligibility Engine Tests", () => {
  it("should return DATA_UNAVAILABLE when database has no requirements for program", async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    } as unknown as SupabaseClient;

    const evaluator = new EligibilityEvaluator(mockSupabase);
    const profile = createStudentProfile({
      primaryQualification: { qualCode: "IB", scoreType: "GRADE_POINTS", overallScore: 38 },
    });

    const res = await evaluator.evaluateProgramEligibility("prog-no-data", profile);
    expect(res.status).toBe("DATA_UNAVAILABLE");
    expect(res.checks.length).toBe(0);
    expect(res.disclaimer).toContain("does not guarantee admission");
  });

  it("should return CONFLICTING_DATA when requirement conflict_status is POTENTIAL_CONFLICT", async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [
                {
                  id: "req-1",
                  conflict_status: "POTENTIAL_CONFLICT",
                  requirement_type: "ACADEMIC_QUALIFICATION",
                },
              ],
              error: null,
            }),
        }),
      }),
    } as unknown as SupabaseClient;

    const evaluator = new EligibilityEvaluator(mockSupabase);
    const profile = createStudentProfile({});

    const res = await evaluator.evaluateProgramEligibility("prog-conflict", profile);
    expect(res.status).toBe("CONFLICTING_DATA");
  });

  it("should return REQUIREMENT_GAP when student score is below mandatory threshold", async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [
                {
                  id: "req-ib-39",
                  requirement_type: "ACADEMIC_QUALIFICATION",
                  requirement_status: "REQUIRED",
                  minimum_numeric_score: 39,
                  qualifications: { code: "IB", name: "IB Diploma" },
                },
              ],
              error: null,
            }),
        }),
      }),
    } as unknown as SupabaseClient;

    const evaluator = new EligibilityEvaluator(mockSupabase);
    const studentProfile = createStudentProfile({
      primaryQualification: { qualCode: "IB", scoreType: "GRADE_POINTS", overallScore: 34 },
    });

    const res = await evaluator.evaluateProgramEligibility("prog-ib-39", studentProfile);
    expect(res.status).toBe("REQUIREMENT_GAP");
    expect(res.failedChecksCount).toBe(1);
  });

  it("should return STRONG_MATCH when student score exceeds required threshold", async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [
                {
                  id: "req-ib-38",
                  requirement_type: "ACADEMIC_QUALIFICATION",
                  requirement_status: "REQUIRED",
                  minimum_numeric_score: 38,
                  qualifications: { code: "IB", name: "IB Diploma" },
                },
              ],
              error: null,
            }),
        }),
      }),
    } as unknown as SupabaseClient;

    const evaluator = new EligibilityEvaluator(mockSupabase);
    const studentProfile = createStudentProfile({
      primaryQualification: { qualCode: "IB", scoreType: "GRADE_POINTS", overallScore: 42 },
    });

    const res = await evaluator.evaluateProgramEligibility("prog-ib-38", studentProfile);
    expect(res.status).toBe("STRONG_MATCH");
    expect(res.passedChecksCount).toBe(1);
  });

  it("should return MISSING_INFORMATION when mandatory requirement score is not in student profile", async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [
                {
                  id: "req-alevel",
                  requirement_type: "ACADEMIC_QUALIFICATION",
                  requirement_status: "REQUIRED",
                  grade_text: "A*A*A",
                  qualifications: { code: "ALEVEL", name: "A-Levels" },
                },
              ],
              error: null,
            }),
        }),
      }),
    } as unknown as SupabaseClient;

    const evaluator = new EligibilityEvaluator(mockSupabase);
    // Student has IB instead of A-Level
    const studentProfile = createStudentProfile({
      primaryQualification: { qualCode: "IB", scoreType: "GRADE_POINTS", overallScore: 38 },
    });

    const res = await evaluator.evaluateProgramEligibility("prog-alevel", studentProfile);
    expect(res.status).toBe("MISSING_INFORMATION");
    expect(res.missingChecksCount).toBe(1);
  });
});
