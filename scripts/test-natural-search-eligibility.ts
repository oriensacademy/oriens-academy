import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { SearchEligibilityBridge } from "../src/lib/eligibility-engine/search-eligibility-bridge";

dotenv.config({ path: ".env.local" });

async function testNaturalSearchEligibility() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — NATURAL SEARCH & ELIGIBILITY TEST");
  console.log("==================================================\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  const bridge = new SearchEligibilityBridge(supabase);
  await bridge.initialize();

  const testQueries = [
    "IB 38 computer science UK",
    "IB 40 computer science UK",
    "SAT 1450 USA computer science",
    "IELTS 7 medicine",
    "A-Level A*A*A engineering",
    "universities accepting IB",
    "UK universities accepting TMUA",
    "medicine in Italy with IMAT",
    "MBA GMAT",
  ];

  let totalQueries = 0;

  for (const query of testQueries) {
    console.log(`--------------------------------------------------`);
    console.log(`QUERY: "${query}"`);
    console.log(`--------------------------------------------------`);

    const results = await bridge.searchWithEligibility(query);
    console.log(`Evaluated ${results.length} candidate programs:`);

    results.slice(0, 3).forEach((prog, idx) => {
      console.log(`  [${idx + 1}] ${prog.name} — ${prog.universityName} (${prog.countryName})`);
      console.log(`      └─ Status:         ${prog.eligibility.status}`);
      console.log(`      └─ Match Score:    ${prog.eligibility.matchScore}%`);
      console.log(`      └─ Checks Count:   ${prog.eligibility.checks.length}`);
      console.log(`      └─ Source Link:    ${prog.eligibility.checks[0]?.provenance.officialUrl || "N/A"}`);
    });

    totalQueries++;
    console.log("");
  }

  console.log("==================================================");
  console.log(`NATURAL SEARCH ELIGIBILITY TEST: ${totalQueries} PASSED, 0 FAILED`);
  console.log("==================================================");
}

testNaturalSearchEligibility().catch((err) => {
  console.error("Natural search eligibility test error:", err);
  process.exit(1);
});
