import type { AdmissionRequirementGroup } from "../src/types/admission.types";
import type { StudentProfile } from "../src/types/rule-engine.types";
import { evaluateAdmissionEligibility } from "../src/lib/admission/admission-rule-engine";

function runRuleEngineTests() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — ADMISSION RULE ENGINE TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  // TEST 1: AND Logic with Numeric Minimum (IB >= 38 AND IELTS >= 7.0)
  const test1Tree: AdmissionRequirementGroup = {
    id: "g1",
    programId: "p1",
    logicalOperator: "AND",
    requirements: [
      {
        id: "r1",
        groupId: "g1",
        qualificationId: "ib-id",
        qualification: { id: "ib-id", code: "IB", name: "International Baccalaureate", shortName: "IB", category: "DIPLOMA", active: true },
        requirementType: "REQUIRED",
        minimumScore: 38,
        academicYear: 2026,
      },
      {
        id: "r2",
        groupId: "g1",
        qualificationId: "ielts-id",
        qualification: { id: "ielts-id", code: "IELTS", name: "IELTS Academic", shortName: "IELTS", category: "ENGLISH_LANGUAGE_TEST", active: true },
        requirementType: "REQUIRED",
        minimumScore: 7.0,
        academicYear: 2026,
      },
    ],
  };

  const student1: StudentProfile = {
    qualifications: [
      { code: "IB", score: 39 },
      { code: "IELTS", score: 7.5 },
    ],
  };

  const res1 = evaluateAdmissionEligibility(student1, test1Tree);
  if (res1.status === "ELIGIBLE" && res1.passed) {
    console.log("✓ PASS: Test 1 — AND Logic with Numeric Minimum (IB 39 >= 38, IELTS 7.5 >= 7.0)");
    passed++;
  } else {
    console.error(`✗ FAIL: Test 1 — Expected ELIGIBLE, got ${res1.status}`);
    failed++;
  }

  // TEST 2: Hard Requirement Failure (IB 43 overall, but Math AA HL 6 when Math AA HL 7 is REQUIRED)
  const test2Tree: AdmissionRequirementGroup = {
    id: "g2",
    programId: "p2",
    logicalOperator: "AND",
    requirements: [
      {
        id: "r1",
        groupId: "g2",
        qualificationId: "ib-id",
        qualification: { id: "ib-id", code: "IB", name: "International Baccalaureate", shortName: "IB", category: "DIPLOMA", active: true },
        requirementType: "REQUIRED",
        minimumScore: 41,
        academicYear: 2026,
      },
      {
        id: "r2",
        groupId: "g2",
        qualificationId: "ib-math-id",
        qualification: { id: "ib-math-id", code: "IB", name: "International Baccalaureate", shortName: "IB", category: "DIPLOMA", active: true },
        requirementType: "REQUIRED",
        minimumScore: 7,
        subjectRequirement: "Math AA",
        levelRequirement: "HL",
        academicYear: 2026,
      },
    ],
  };

  const student2: StudentProfile = {
    qualifications: [
      { code: "IB", score: 43 },
      { code: "IB", score: 6, subject: "Math AA", level: "HL" },
    ],
  };

  const res2 = evaluateAdmissionEligibility(student2, test2Tree);
  if (res2.status === "REQUIREMENT_GAP" && !res2.passed && res2.failedRequirements.length === 1) {
    console.log("✓ PASS: Test 2 — Hard Requirement Gap (IB 43 overall passed, but Math AA HL 6 < 7 failed hard requirement)");
    passed++;
  } else {
    console.error(`✗ FAIL: Test 2 — Expected REQUIREMENT_GAP, got ${res2.status}`);
    failed++;
  }

  // TEST 3: Nested Logic ( (IB >= 39 OR A-Level >= A*A*A) AND IELTS >= 7 AND TMUA present )
  const test3Tree: AdmissionRequirementGroup = {
    id: "root",
    programId: "p3",
    logicalOperator: "AND",
    requirements: [
      {
        id: "r_ielts",
        groupId: "root",
        qualificationId: "ielts-id",
        qualification: { id: "ielts-id", code: "IELTS", name: "IELTS Academic", shortName: "IELTS", category: "ENGLISH_LANGUAGE_TEST", active: true },
        requirementType: "REQUIRED",
        minimumScore: 7.0,
        academicYear: 2026,
      },
      {
        id: "r_tmua",
        groupId: "root",
        qualificationId: "tmua-id",
        qualification: { id: "tmua-id", code: "TMUA", name: "TMUA Exam", shortName: "TMUA", category: "ADMISSION_TEST", active: true },
        requirementType: "REQUIRED",
        academicYear: 2026,
      },
    ],
    subGroups: [
      {
        id: "or_group",
        programId: "p3",
        parentGroupId: "root",
        logicalOperator: "OR",
        requirements: [
          {
            id: "r_ib",
            groupId: "or_group",
            qualificationId: "ib-id",
            qualification: { id: "ib-id", code: "IB", name: "International Baccalaureate", shortName: "IB", category: "DIPLOMA", active: true },
            requirementType: "REQUIRED",
            minimumScore: 39,
            academicYear: 2026,
          },
          {
            id: "r_alevel",
            groupId: "or_group",
            qualificationId: "alevel-id",
            qualification: { id: "alevel-id", code: "A-LEVEL", name: "A-Level", shortName: "A-Level", category: "DIPLOMA", active: true },
            requirementType: "REQUIRED",
            exactGrade: "A*A*A",
            academicYear: 2026,
          },
        ],
      },
    ],
  };

  // Student 3 has A-Level A*A*A, IELTS 7.5, TMUA present (No IB) -> Should PASS via A-Level OR branch!
  const student3: StudentProfile = {
    qualifications: [
      { code: "A-LEVEL", exactGrade: "A*A*A" },
      { code: "IELTS", score: 7.5 },
      { code: "TMUA", present: true },
    ],
  };

  const res3 = evaluateAdmissionEligibility(student3, test3Tree);
  if (res3.passed && (res3.status === "ELIGIBLE" || res3.status === "STRONG_MATCH")) {
    console.log("✓ PASS: Test 3 — Nested Logic (IB OR A-Level) branch passed via A-Level A*A*A with IELTS & TMUA");
    passed++;
  } else {
    console.error(`✗ FAIL: Test 3 — Expected ELIGIBLE/STRONG_MATCH, got ${res3.status}`);
    failed++;
  }

  // TEST 4: Missing Information (TMUA required, but student has no TMUA score/record)
  const student4MissingTMUA: StudentProfile = {
    qualifications: [
      { code: "IB", score: 40 },
      { code: "IELTS", score: 7.5 },
    ],
  };

  const res4 = evaluateAdmissionEligibility(student4MissingTMUA, test3Tree);
  if (res4.status === "MISSING_INFORMATION" && res4.missingQualifications.includes("TMUA")) {
    console.log("✓ PASS: Test 4 — Missing Score Behavior (TMUA missing returns MISSING_INFORMATION)");
    passed++;
  } else {
    console.error(`✗ FAIL: Test 4 — Expected MISSING_INFORMATION, got ${res4.status}`);
    failed++;
  }

  // TEST 5: Exact Letter Grade Comparison (Student A*AA vs Required AAA)
  const test5Tree: AdmissionRequirementGroup = {
    id: "g5",
    programId: "p5",
    logicalOperator: "AND",
    requirements: [
      {
        id: "r_alevel5",
        groupId: "g5",
        qualificationId: "alevel-id",
        qualification: { id: "alevel-id", code: "A-LEVEL", name: "A-Level", shortName: "A-Level", category: "DIPLOMA", active: true },
        requirementType: "REQUIRED",
        exactGrade: "AAA",
        academicYear: 2026,
      },
    ],
  };

  const student5: StudentProfile = {
    qualifications: [{ code: "A-LEVEL", exactGrade: "A*AA" }],
  };

  const res5 = evaluateAdmissionEligibility(student5, test5Tree);
  if (res5.passed) {
    console.log("✓ PASS: Test 5 — Exact Letter Grade Comparison (A*AA exceeds AAA requirement)");
    passed++;
  } else {
    console.error(`✗ FAIL: Test 5 — Expected passed, got ${res5.status}`);
    failed++;
  }

  console.log("\n==================================================");
  console.log(`RULE ENGINE TEST RESULTS: ${passed} PASSED, ${failed} FAILED (5 Total Scenarios)`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runRuleEngineTests();
