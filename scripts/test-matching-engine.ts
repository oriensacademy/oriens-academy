import type { AdmissionRequirementGroup } from "../src/types/admission.types";
import type { StudentAcademicProfile } from "../src/types/matching.types";
import { evaluateProgramMatch } from "../src/lib/admission/eligibility-matcher";
import { createNormalizedProfile } from "../src/lib/admission/profile-normalizer";
import { parseQuery } from "../src/lib/search/query-parser";

function runMatchingEngineTests() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — ELIGIBILITY & MATCHING ENGINE TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  const sampleProgram = {
    id: "prog-cs-cambridge",
    name: "Computer Science BSc",
    universityName: "University of Cambridge",
  };

  const sampleRequirementTree: AdmissionRequirementGroup = {
    id: "g1",
    programId: "prog-cs-cambridge",
    logicalOperator: "AND",
    requirements: [
      {
        id: "r_ib",
        groupId: "g1",
        qualificationId: "ib-id",
        qualification: { id: "ib-id", code: "IB", name: "International Baccalaureate", shortName: "IB", category: "DIPLOMA", active: true },
        requirementType: "REQUIRED",
        minimumScore: 36,
        academicYear: 2026,
      },
      {
        id: "r_ielts",
        groupId: "g1",
        qualificationId: "ielts-id",
        qualification: { id: "ielts-id", code: "IELTS", name: "IELTS Academic", shortName: "IELTS", category: "ENGLISH_LANGUAGE_TEST", active: true },
        requirementType: "REQUIRED",
        minimumScore: 7.0,
        academicYear: 2026,
      },
    ],
  };

  const competitiveBounds = {
    minimumIb: 36,
    typicalIb: 40,
  };

  // PROFILE 1: All requirements passed (IB 42, IELTS 8.0)
  const profile1: StudentAcademicProfile = {
    country: "TR",
    targetDegreeLevel: "UNDERGRADUATE",
    qualifications: [
      { code: "IB", score: 42 },
      { code: "IELTS", score: 8.0 },
    ],
    subjects: [],
  };

  const res1 = evaluateProgramMatch(sampleProgram, sampleRequirementTree, profile1, competitiveBounds);
  if (res1.category === "ELIGIBLE" || res1.category === "STRONG_MATCH") {
    console.log("✓ PASS: Profile 1 — All requirements passed (Strong Match)");
    passed++;
  } else {
    console.error(`✗ FAIL: Profile 1 — Expected ELIGIBLE/STRONG_MATCH, got ${res1.category}`);
    failed++;
  }

  // PROFILE 2: Hard requirement failed (IB 34 < 36 required)
  const profile2: StudentAcademicProfile = {
    qualifications: [
      { code: "IB", score: 34 },
      { code: "IELTS", score: 7.5 },
    ],
    subjects: [],
  };

  const res2 = evaluateProgramMatch(sampleProgram, sampleRequirementTree, profile2, competitiveBounds);
  if (res2.category === "REQUIREMENT_GAP" && res2.explanations.some((e) => e.kind === "GAP")) {
    console.log("✓ PASS: Profile 2 — Hard requirement failed (Returns REQUIREMENT_GAP with ✗ symbol)");
    passed++;
  } else {
    console.error(`✗ FAIL: Profile 2 — Expected REQUIREMENT_GAP, got ${res2.category}`);
    failed++;
  }

  // PROFILE 3: Missing English test (IB 40, no IELTS)
  const profile3: StudentAcademicProfile = {
    qualifications: [{ code: "IB", score: 40 }],
    subjects: [],
  };

  const res3 = evaluateProgramMatch(sampleProgram, sampleRequirementTree, profile3, competitiveBounds);
  if (res3.category === "MISSING_INFORMATION" && res3.explanations.some((e) => e.kind === "MISSING")) {
    console.log("✓ PASS: Profile 3 — Missing English test (Returns MISSING_INFORMATION with ? symbol)");
    passed++;
  } else {
    console.error(`✗ FAIL: Profile 3 — Expected MISSING_INFORMATION, got ${res3.category}`);
    failed++;
  }

  // PROFILE 4: Alternative Qualification Passed (via A-Level OR branch)
  const treeWithOr: AdmissionRequirementGroup = {
    id: "g_or",
    programId: "prog-cs-cambridge",
    logicalOperator: "OR",
    requirements: [
      {
        id: "r1",
        groupId: "g_or",
        qualificationId: "ib-id",
        qualification: { id: "ib-id", code: "IB", name: "International Baccalaureate", shortName: "IB", category: "DIPLOMA", active: true },
        requirementType: "REQUIRED",
        minimumScore: 40,
        academicYear: 2026,
      },
      {
        id: "r2",
        groupId: "g_or",
        qualificationId: "alevel-id",
        qualification: { id: "alevel-id", code: "A-LEVEL", name: "A-Level", shortName: "A-Level", category: "DIPLOMA", active: true },
        requirementType: "REQUIRED",
        exactGrade: "A*A*A",
        academicYear: 2026,
      },
    ],
  };

  const profile4: StudentAcademicProfile = {
    qualifications: [{ code: "A-LEVEL", exactGrade: "A*A*A" }],
    subjects: [],
  };

  const res4 = evaluateProgramMatch(sampleProgram, treeWithOr, profile4);
  if (res4.category === "ELIGIBLE" || res4.category === "STRONG_MATCH") {
    console.log("✓ PASS: Profile 4 — Alternative qualification passed (via A-Level A*A*A branch)");
    passed++;
  } else {
    console.error(`✗ FAIL: Profile 4 — Expected ELIGIBLE/STRONG_MATCH, got ${res4.category}`);
    failed++;
  }

  // PROFILE 5: Minimum passed but competitive score missed (IB 38 >= min 36, but < typical 40)
  const profile5: StudentAcademicProfile = {
    qualifications: [
      { code: "IB", score: 38 },
      { code: "IELTS", score: 7.5 },
    ],
    subjects: [],
  };

  const res5 = evaluateProgramMatch(sampleProgram, sampleRequirementTree, profile5, competitiveBounds);
  if ((res5.category === "MATCH" || res5.category === "REACH") && res5.explanations.some((e) => e.kind === "WARNING")) {
    console.log("✓ PASS: Profile 5 — Minimum passed but competitive score missed (Returns warning ⚠ Typical score is 40)");
    passed++;
  } else {
    console.error(`✗ FAIL: Profile 5 — Expected warning item and MATCH/REACH status, got ${res5.category}`);
    failed++;
  }

  // PROFILE 6: No admission data
  const res6 = evaluateProgramMatch(sampleProgram, null, profile1);
  if (res6.category === "UNKNOWN") {
    console.log("✓ PASS: Profile 6 — No admission data (Returns UNKNOWN)");
    passed++;
  } else {
    console.error(`✗ FAIL: Profile 6 — Expected UNKNOWN, got ${res6.category}`);
    failed++;
  }

  // PROFILE 7: Ephemeral Query-Provided Score (IB 39 from query "IB 39 computer science UK")
  const parsedQ7 = parseQuery("IB 39 computer science UK");
  const profile7 = createNormalizedProfile(null, parsedQ7);
  const res7 = evaluateProgramMatch(sampleProgram, sampleRequirementTree, profile7);
  if (profile7.isEphemeral && profile7.qualifications[0]?.score === 39 && res7.category !== "REQUIREMENT_GAP") {
    console.log("✓ PASS: Profile 7 — Query-provided score parsed into ephemeral profile (IB 39)");
    passed++;
  } else {
    console.error(`✗ FAIL: Profile 7 — Expected ephemeral profile score 39, got ${profile7.qualifications[0]?.score}`);
    failed++;
  }

  // PROFILE 8: Saved-Profile Score Override Resolution
  const savedProfile: StudentAcademicProfile = {
    qualifications: [{ code: "IB", score: 34 }], // Saved score 34 fails min 36
    subjects: [],
  };
  const parsedQ8 = parseQuery("IB 39"); // Search session override score 39
  const profile8 = createNormalizedProfile(savedProfile, parsedQ8);
  const res8 = evaluateProgramMatch(sampleProgram, sampleRequirementTree, profile8);
  if (profile8.qualifications[0]?.score === 39 && res8.category !== "REQUIREMENT_GAP") {
    console.log("✓ PASS: Profile 8 — Saved-profile score (34) successfully overridden by session search query (39)");
    passed++;
  } else {
    console.error(`✗ FAIL: Profile 8 — Expected overridden score 39, got ${profile8.qualifications[0]?.score}`);
    failed++;
  }

  console.log("\n==================================================");
  console.log(`MATCHING ENGINE TEST RESULTS: ${passed} PASSED, ${failed} FAILED (${passed + failed} Total)`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runMatchingEngineTests();
