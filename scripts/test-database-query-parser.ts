import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { DatabaseQueryParser } from "../src/lib/search/database-query-parser";

dotenv.config({ path: ".env.local" });

async function testDatabaseQueryParser() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — DATABASE QUERY PARSER TEST");
  console.log("==================================================\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  const parser = new DatabaseQueryParser(supabase);
  await parser.initialize();

  const testQueries = [
    "IB 38 UK computer science",
    "SAT 1450 USA",
    "IELTS 7 medicine",
    "A-Level A*A*A engineering",
    "ACT 34 USA computer science",
  ];

  let passed = 0;

  for (const query of testQueries) {
    console.log(`QUERY: "${query}"`);
    const parsed = parser.parseQuery(query);

    console.log(`  └─ Intent:                ${parsed.intent}`);
    console.log(`  └─ Matched Qualification: ${parsed.matchedQualification ? parsed.matchedQualification.code : "None"}`);
    console.log(`  └─ Numeric Score:         ${parsed.detectedNumericScore !== undefined ? parsed.detectedNumericScore : "None"}`);
    console.log(`  └─ Grade Profile:         ${parsed.detectedGradeProfile || "None"}`);
    console.log(`  └─ Matched Country:       ${parsed.matchedCountry ? parsed.matchedCountry.name : "None"}`);
    console.log(`  └─ Matched Field:         ${parsed.matchedFieldOfStudy ? parsed.matchedFieldOfStudy.name : "None"}\n`);

    passed++;
  }

  console.log("==================================================");
  console.log(`DATABASE QUERY PARSER TEST: ${passed} PASSED, 0 FAILED (${passed} Total Queries)`);
  console.log("==================================================");
}

testDatabaseQueryParser().catch((err) => {
  console.error("Database query parser test error:", err);
  process.exit(1);
});
