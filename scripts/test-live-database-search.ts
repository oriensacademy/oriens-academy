import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { retrieveSearchResultsFromDatabase } from "../src/lib/search/db-retrieval-service";

const TEST_QUERIES = [
  "Oxford",
  "oxfor",
  "oxfrod",
  "Cambridge",
  "cambrige",
  "UCL",
  "MIT",
  "SAT",
  "IB",
  "Italy",
  "Harvard",
  "Stanford",
  "Bocconi",
  "ETH Zurich",
];

async function runLiveDatabaseSearchTests() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — LIVE DATABASE SEARCH RETRIEVAL TEST");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  for (const q of TEST_QUERIES) {
    const res = await retrieveSearchResultsFromDatabase(q);
    const topUni = res.groups.universities[0];
    const topQual = res.groups.qualifications[0];
    const topCountry = res.groups.countries[0];

    console.log(`QUERY: "${q}" (Intent: ${res.intent}, Total Results: ${res.totalCount})`);

    if (res.groups.universities.length > 0) {
      console.log(`  └─ Top University: "${topUni.title}" (${topUni.subtitle}) [Score: ${topUni.score}, Layer: ${topUni.matchLayer}]`);
    }
    if (res.groups.qualifications.length > 0) {
      console.log(`  └─ Top Qualification: "${topQual.title}" [Score: ${topQual.score}]`);
    }
    if (res.groups.countries.length > 0) {
      console.log(`  └─ Top Country: "${topCountry.title}" (${topCountry.countryIso2}) [Score: ${topCountry.score}]`);
    }

    if (res.totalCount > 0) {
      passed++;
      console.log(`✓ SUCCESS: Query "${q}" resolved from PostgreSQL DB.\n`);
    } else {
      failed++;
      console.error(`✗ FAIL: Query "${q}" returned 0 results.\n`);
    }
  }

  console.log("==================================================");
  console.log(`LIVE DATABASE SEARCH TESTS: ${passed} PASSED, ${failed} FAILED (${TEST_QUERIES.length} Total)`);
  console.log("==================================================");

  process.exit(failed > 0 ? 1 : 0);
}

runLiveDatabaseSearchTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
