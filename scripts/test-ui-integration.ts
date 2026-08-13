import { searchAndRankPrograms } from "../src/lib/search/intent-ranking-engine";
import { evaluateProgramMatch } from "../src/lib/admission/eligibility-matcher";
import { createNormalizedProfile } from "../src/lib/admission/profile-normalizer";
import { parseQuery } from "../src/lib/search/query-parser";

const UI_VERIFICATION_QUERIES = [
  "Cambridge",
  "SAT",
  "Italy medicine",
  "IB 38 computer science UK",
  "medicine Italy IMAT",
];

function runUIVerificationTests() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — UI DISCOVERY INTEGRATION TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  for (const q of UI_VERIFICATION_QUERIES) {
    const parsed = parseQuery(q);
    const searchRes = searchAndRankPrograms(q);
    const profile = createNormalizedProfile(null, parsed);

    let ok = true;
    const checks: string[] = [];

    if (searchRes.totalItems === 0) {
      ok = false;
      checks.push(`Zero results for query "${q}"`);
    }

    if (q === "Cambridge" && searchRes.items[0]?.universityName !== "University of Cambridge") {
      ok = false;
      checks.push(`Expected University of Cambridge #1 for "Cambridge", got ${searchRes.items[0]?.universityName}`);
    }

    if (q === "Italy medicine" && (!searchRes.items[0]?.countryIso2 || searchRes.items[0]?.countryIso2 !== "IT")) {
      ok = false;
      checks.push(`Expected Italian program for "Italy medicine", got ${searchRes.items[0]?.countryIso2}`);
    }

    if (ok) {
      passed++;
      console.log(`✓ PASS: UI Query "${q}" -> ${searchRes.totalItems} results found, Intent: ${searchRes.intent}`);
    } else {
      failed++;
      console.error(`✗ FAIL: UI Query "${q}"`);
      for (const err of checks) {
        console.error(`  - ${err}`);
      }
    }
  }

  console.log("\n==================================================");
  console.log(`UI VERIFICATION TEST RESULTS: ${passed} PASSED, ${failed} FAILED (${passed + failed} Total)`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runUIVerificationTests();
