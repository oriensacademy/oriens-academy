import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { retrieveSearchResultsFromDatabase } from "../src/lib/search/db-retrieval-service";

async function testProgramSearch() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — PROGRAM SEARCH INTEGRATION TEST");
  console.log("==================================================\n");

  const queries = [
    "computer science",
    "medicine",
    "engineering",
    "Oxford computer science",
    "Cambridge medicine",
    "UCL computer science",
    "Italy medicine",
    "econmics",
  ];

  for (const q of queries) {
    const res = await retrieveSearchResultsFromDatabase(q);
    const programs = res.groups.programs;
    const universities = res.groups.universities;

    console.log(`QUERY: "${q}" (Intent: ${res.intent}, Total Programs Found: ${programs.length})`);
    if (programs.length > 0) {
      programs.forEach((p) => {
        console.log(`   └─ Program: "${p.title}" | Subtitle: ${p.subtitle} | Score: ${p.score} | URL: ${p.officialUrl}`);
      });
    } else if (universities.length > 0) {
      console.log(`   └─ University Match: "${universities[0].title}" (${universities[0].subtitle})`);
    } else {
      console.log(`   └─ NO DIRECT MATCH (DB-backed search correctly reflects active DB state)`);
    }
    console.log("");
  }
}

testProgramSearch().catch((err) => {
  console.error("Program search test error:", err);
  process.exit(1);
});
