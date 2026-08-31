import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log("=== VERIFYING PRODUCTION DATABASE RECORDS ===");

async function verifyUniversities() {
  const targetUnis = [
    { name: "University of Oxford", expectedUrl: "https://www.ox.ac.uk" },
    { name: "University of Cambridge", expectedUrl: "https://www.cam.ac.uk" },
    { name: "Harvard University", expectedUrl: "https://www.harvard.edu" },
    { name: "Massachusetts Institute of Technology", expectedUrl: "https://www.mit.edu" },
    { name: "Stanford University", expectedUrl: "https://www.stanford.edu" },
    { name: "University of Toronto", expectedUrl: "https://www.utoronto.ca" },
    { name: "University of British Columbia", expectedUrl: "https://www.ubc.ca" },
    { name: "ETH Zurich", expectedUrl: "https://ethz.ch" },
    { name: "EPFL", expectedUrl: "https://www.epfl.ch" },
    { name: "Technical University of Munich", expectedUrl: "https://www.tum.de" },
  ];

  for (const item of targetUnis) {
    const { data, error } = await supabase
      .from("universities")
      .select("id, name, website, admissions_url")
      .eq("name", item.name)
      .limit(1);

    if (error) {
      console.error(`Error querying ${item.name}:`, error);
      process.exit(1);
    }

    assert.ok(data && data.length > 0, `University ${item.name} must exist in DB`);
    const uni = data[0];
    const canonicalUrl = uni.website || uni.admissions_url;
    console.log(`[PASS] DB University: "${uni.name}" | website: ${uni.website} | canonical: ${canonicalUrl}`);
    assert.strictEqual(canonicalUrl, item.expectedUrl, `Canonical URL for ${item.name} must match`);
  }

  // Verify RPC search_autocomplete_entities
  const { data: rpcData, error: rpcError } = await supabase.rpc("search_autocomplete_entities", {
    p_query: "oxford",
    p_limit: 5,
  });

  if (rpcError) {
    console.error("Error executing search_autocomplete_entities RPC:", rpcError);
    process.exit(1);
  }

  const oxfordResult = rpcData?.find((r) => r.entity_type === "UNIVERSITY" && r.title.includes("Oxford"));
  assert.ok(oxfordResult, "RPC must return Oxford university");
  assert.strictEqual(oxfordResult.official_url, "https://www.ox.ac.uk", "RPC must return official_url https://www.ox.ac.uk");
  console.log(`[PASS] RPC search_autocomplete_entities returned: title="${oxfordResult.title}", official_url="${oxfordResult.official_url}"`);
}

verifyUniversities().then(() => {
  console.log("\n=== PRODUCTION DATABASE VERIFICATION SUCCESSFUL ===");
  process.exit(0);
}).catch((err) => {
  console.error("DB verification failed:", err);
  process.exit(1);
});
