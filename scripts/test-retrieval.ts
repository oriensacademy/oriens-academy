import { retrieveSearchResults } from "../src/lib/search/retrieval-engine";

interface TestRetrievalCase {
  query: string;
  expectedUniversityTitle?: string;
  expectedCountryIso2?: string;
  expectedQualSlug?: string;
  expectedProgramSlug?: string;
  minTotalCount?: number;
}

const TEST_RETRIEVAL_CASES: TestRetrievalCase[] = [
  { query: "cam", expectedUniversityTitle: "University of Cambridge", minTotalCount: 1 },
  { query: "cambridge", expectedUniversityTitle: "University of Cambridge", minTotalCount: 1 },
  { query: "cambrige", expectedUniversityTitle: "University of Cambridge", minTotalCount: 1 },
  { query: "ucl", expectedUniversityTitle: "University College London", minTotalCount: 1 },
  { query: "uk", expectedCountryIso2: "GB", minTotalCount: 1 },
  { query: "sat", expectedQualSlug: "sat", minTotalCount: 1 },
  { query: "ib", expectedQualSlug: "ib", minTotalCount: 1 },
  { query: "medicine", expectedProgramSlug: "medicine", minTotalCount: 1 },
  { query: "computer science", expectedProgramSlug: "computer-science", minTotalCount: 1 },
  { query: "italy medicine", expectedCountryIso2: "IT", expectedProgramSlug: "medicine", minTotalCount: 2 },
];

function runRetrievalTests() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — SEARCH RETRIEVAL & AUTOCOMPLETE TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  for (const tc of TEST_RETRIEVAL_CASES) {
    const res = retrieveSearchResults(tc.query);
    const checks: string[] = [];
    let ok = true;

    if (tc.minTotalCount !== undefined && res.totalCount < tc.minTotalCount) {
      ok = false;
      checks.push(`Total count low: expected >= ${tc.minTotalCount}, got ${res.totalCount}`);
    }

    if (tc.expectedUniversityTitle) {
      const topUni = res.groups.universities[0];
      if (!topUni || topUni.title !== tc.expectedUniversityTitle) {
        ok = false;
        checks.push(`University mismatch: expected ${tc.expectedUniversityTitle}, got ${topUni ? topUni.title : "none"}`);
      }
    }

    if (tc.expectedCountryIso2) {
      const topCountry = res.groups.countries[0];
      if (!topCountry || topCountry.countryIso2 !== tc.expectedCountryIso2) {
        ok = false;
        checks.push(`Country mismatch: expected ${tc.expectedCountryIso2}, got ${topCountry ? topCountry.countryIso2 : "none"}`);
      }
    }

    if (tc.expectedQualSlug) {
      const topQual = res.groups.qualifications[0];
      if (!topQual || topQual.slug !== tc.expectedQualSlug) {
        ok = false;
        checks.push(`Qualification mismatch: expected ${tc.expectedQualSlug}, got ${topQual ? topQual.slug : "none"}`);
      }
    }

    if (tc.expectedProgramSlug) {
      const topProg = res.groups.programs[0];
      if (!topProg || topProg.slug !== tc.expectedProgramSlug) {
        ok = false;
        checks.push(`Program mismatch: expected ${tc.expectedProgramSlug}, got ${topProg ? topProg.slug : "none"}`);
      }
    }

    if (ok) {
      passed++;
      console.log(`✓ PASS: "${tc.query}" -> Intent: ${res.intent} (${res.totalCount} results)`);
    } else {
      failed++;
      console.error(`✗ FAIL: "${tc.query}"`);
      for (const err of checks) {
        console.error(`  - ${err}`);
      }
    }
  }

  console.log("\n==================================================");
  console.log(`RETRIEVAL TEST RESULTS: ${passed} PASSED, ${failed} FAILED (${TEST_RETRIEVAL_CASES.length} Total)`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runRetrievalTests();
