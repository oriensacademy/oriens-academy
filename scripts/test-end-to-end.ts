import { parseQuery } from "../src/lib/search/query-parser";
import { searchAndRankPrograms } from "../src/lib/search/intent-ranking-engine";
import { createNormalizedProfile } from "../src/lib/admission/profile-normalizer";

function runEndToEndTests() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — END-TO-END SEARCH ENGINE TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  // SCENARIO 1: "Cambridge"
  const parsed1 = parseQuery("Cambridge");
  const rank1 = searchAndRankPrograms("Cambridge");
  if (parsed1.intent === "UNIVERSITY_SEARCH" && rank1.items[0]?.universityName === "University of Cambridge") {
    console.log("✓ PASS: 1. Cambridge -> Ranks University of Cambridge #1 (Intent: UNIVERSITY_SEARCH)");
    passed++;
  } else {
    console.error(`✗ FAIL: 1. Cambridge -> Expected University of Cambridge #1, got ${rank1.items[0]?.universityName}`);
    failed++;
  }

  // SCENARIO 2: "Cambrige" (Typo tolerance)
  const parsed2 = parseQuery("Cambrige");
  const rank2 = searchAndRankPrograms("Cambrige");
  if (parsed2.universities.some((u) => u.name === "University of Cambridge") && rank2.items[0]?.universityName === "University of Cambridge") {
    console.log("✓ PASS: 2. Cambrige -> Typo tolerance correctly discovers University of Cambridge");
    passed++;
  } else {
    console.error(`✗ FAIL: 2. Cambrige -> Expected University of Cambridge #1, got ${rank2.items[0]?.universityName}`);
    failed++;
  }

  // SCENARIO 3: "SAT"
  const parsed3 = parseQuery("SAT");
  const rank3 = searchAndRankPrograms("SAT");
  if (parsed3.intent === "QUALIFICATION_SEARCH" && parsed3.qualifications.some((q) => q.code === "SAT")) {
    console.log("✓ PASS: 3. SAT -> Discovers SAT qualification entity (Intent: QUALIFICATION_SEARCH)");
    passed++;
  } else {
    console.error(`✗ FAIL: 3. SAT -> Expected QUALIFICATION_SEARCH, got ${parsed3.intent}`);
    failed++;
  }

  // SCENARIO 4: "Italy medicine"
  const parsed4 = parseQuery("Italy medicine");
  const rank4 = searchAndRankPrograms("Italy medicine");
  if (parsed4.intent === "DISCOVERY_SEARCH" && rank4.items[0]?.countryIso2 === "IT" && rank4.items[0]?.programName.toLowerCase().includes("medicine")) {
    console.log("✓ PASS: 4. Italy medicine -> Discovers Italian Medicine programs #1");
    passed++;
  } else {
    console.error(`✗ FAIL: 4. Italy medicine -> Expected Italian Medicine #1, got ${rank4.items[0]?.programName}`);
    failed++;
  }

  // SCENARIO 5: "IB 38 computer science UK"
  const parsed5 = parseQuery("IB 38 computer science UK");
  const profile5 = createNormalizedProfile(null, parsed5);
  const rank5 = searchAndRankPrograms("IB 38 computer science UK");
  if (
    parsed5.intent === "ELIGIBILITY_SEARCH" &&
    profile5.qualifications.some((q) => q.code === "IB" && q.score === 38) &&
    rank5.items[0]?.countryIso2 === "GB" &&
    rank5.items[0]?.programName.toLowerCase().includes("computer")
  ) {
    console.log("✓ PASS: 5. IB 38 computer science UK -> Extracted IB score 38, UK, Computer Science, ranked by requirement compatibility");
    passed++;
  } else {
    console.error(`✗ FAIL: 5. IB 38 computer science UK -> Extraction/Ranking failed`);
    failed++;
  }

  // SCENARIO 6: "SAT 1450 USA computer science"
  const parsed6 = parseQuery("SAT 1450 USA computer science");
  const profile6 = createNormalizedProfile(null, parsed6);
  if (
    parsed6.intent === "ELIGIBILITY_SEARCH" &&
    profile6.qualifications.some((q) => q.code === "SAT" && q.score === 1450) &&
    profile6.country === "US"
  ) {
    console.log("✓ PASS: 6. SAT 1450 USA computer science -> Extracted SAT score 1450, USA, Computer Science");
    passed++;
  } else {
    console.error(`✗ FAIL: 6. SAT 1450 USA computer science -> Extraction failed`);
    failed++;
  }

  // SCENARIO 7: "medicine in Italy with IMAT"
  const parsed7 = parseQuery("medicine in Italy with IMAT");
  if (
    parsed7.intent === "DISCOVERY_SEARCH" &&
    parsed7.countries.some((c) => c.iso2 === "IT") &&
    parsed7.qualifications.some((q) => q.code === "IMAT") &&
    parsed7.fieldsOfStudy.some((f) => f.name === "Medicine")
  ) {
    console.log("✓ PASS: 7. medicine in Italy with IMAT -> Extracted Medicine + Italy + IMAT");
    passed++;
  } else {
    console.error(`✗ FAIL: 7. medicine in Italy with IMAT -> Extraction failed`);
    failed++;
  }

  // SCENARIO 8: "MBA GMAT"
  const parsed8 = parseQuery("MBA GMAT");
  if (parsed8.degreeLevel === "MBA" && parsed8.qualifications.some((q) => q.code === "GMAT")) {
    console.log("✓ PASS: 8. MBA GMAT -> Correctly identifies MBA postgraduate intent & GMAT qualification");
    passed++;
  } else {
    console.error(`✗ FAIL: 8. MBA GMAT -> Expected MBA degree level & GMAT qualification, got degree: ${parsed8.degreeLevel}`);
    failed++;
  }

  // SCENARIO 9: "universities accepting IB"
  const parsed9 = parseQuery("universities accepting IB");
  if (parsed9.intent === "QUALIFICATION_SEARCH" && parsed9.qualifications.some((q) => q.code === "IB")) {
    console.log("✓ PASS: 9. universities accepting IB -> Qualification-centric discovery for IB");
    passed++;
  } else {
    console.error(`✗ FAIL: 9. universities accepting IB -> Expected QUALIFICATION_SEARCH, got ${parsed9.intent}`);
    failed++;
  }

  // SCENARIO 10: "UK universities accepting TMUA"
  const parsed10 = parseQuery("UK universities accepting TMUA");
  if (
    parsed10.intent === "QUALIFICATION_SEARCH" &&
    parsed10.countries.some((c) => c.iso2 === "GB") &&
    parsed10.qualifications.some((q) => q.code === "TMUA")
  ) {
    console.log("✓ PASS: 10. UK universities accepting TMUA -> Country GB + TMUA qualification filtering");
    passed++;
  } else {
    console.error(`✗ FAIL: 10. UK universities accepting TMUA -> Extraction failed`);
    failed++;
  }

  console.log("\n==================================================");
  console.log(`END-TO-END TEST RESULTS: ${passed} PASSED, ${failed} FAILED (${passed + failed} Total Scenarios)`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runEndToEndTests();
