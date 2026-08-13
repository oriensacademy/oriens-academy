import { searchAndRankPrograms } from "../src/lib/search/intent-ranking-engine";
import { calculateDataQuality } from "../src/lib/search/data-confidence-service";

function runRankingTests() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — ADAPTIVE SEARCH RANKING TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  // TEST 1: "Cambridge" query must rank University of Cambridge #1 over globally popular non-matching universities (like MIT)
  const res1 = searchAndRankPrograms("Cambridge");
  const top1 = res1.items[0];
  if (top1 && top1.universityName === "University of Cambridge") {
    console.log(`✓ PASS: Test 1 — "Cambridge" query ranks University of Cambridge #1 (Top: ${top1.universityName} - ${top1.programName})`);
    passed++;
  } else {
    console.error(`✗ FAIL: Test 1 — Expected University of Cambridge #1, got ${top1 ? top1.universityName : "none"}`);
    failed++;
  }

  // TEST 2: "Italy medicine" query must prioritize Italian Medicine programs #1
  const res2 = searchAndRankPrograms("Italy medicine");
  const top2 = res2.items[0];
  if (top2 && top2.countryIso2 === "IT" && top2.programName.toLowerCase().includes("medicine")) {
    console.log(`✓ PASS: Test 2 — "Italy medicine" query ranks Italian Medicine #1 (Top: ${top2.universityName} - ${top2.programName})`);
    passed++;
  } else {
    console.error(`✗ FAIL: Test 2 — Expected Italian Medicine #1, got ${top2 ? `${top2.universityName} (${top2.countryIso2})` : "none"}`);
    failed++;
  }

  // TEST 3: "IB 38 UK computer science" query prioritizes UK Computer Science programs
  const res3 = searchAndRankPrograms("IB 38 UK computer science");
  const top3 = res3.items[0];
  if (top3 && top3.countryIso2 === "GB" && top3.programName.toLowerCase().includes("computer")) {
    console.log(`✓ PASS: Test 3 — "IB 38 UK computer science" ranks UK CS #1 (Top: ${top3.universityName} - ${top3.programName})`);
    passed++;
  } else {
    console.error(`✗ FAIL: Test 3 — Expected UK CS #1, got ${top3 ? `${top3.universityName} - ${top3.programName}` : "none"}`);
    failed++;
  }

  // TEST 4: Data Quality & Freshness Calculation
  const freshSource = {
    id: "s1",
    url: "https://cam.ac.uk",
    title: "Cambridge Admissions",
    sourceType: "OFFICIAL_UNIVERSITY_PAGE" as const,
    retrievedAt: new Date().toISOString(),
    verifiedAt: new Date().toISOString(),
    academicYear: 2026,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const dqRes = calculateDataQuality([freshSource]);
  if (dqRes.freshnessLevel === "VERY_FRESH" && dqRes.confidenceLevel === "HIGH") {
    console.log(`✓ PASS: Test 4 — Data Quality & Freshness (VERY_FRESH, HIGH confidence score ${dqRes.confidenceScore})`);
    passed++;
  } else {
    console.error(`✗ FAIL: Test 4 — Expected VERY_FRESH & HIGH, got ${dqRes.freshnessLevel} & ${dqRes.confidenceLevel}`);
    failed++;
  }

  console.log("\n==================================================");
  console.log(`RANKING TEST RESULTS: ${passed} PASSED, ${failed} FAILED (${passed + failed} Total Scenarios)`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runRankingTests();
