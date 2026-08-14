import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function runDataIntegrityValidation() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — DATA INTEGRITY & SCHEMA AUDIT");
  console.log("==================================================\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      passed++;
      console.log(`✓ PASS: ${message}`);
    } else {
      failed++;
      console.error(`✗ FAIL: ${message}`);
    }
  }

  // 1. Audit Table Counts
  const { count: univCount } = await supabase.from("universities").select("*", { count: "exact", head: true });
  const { count: countryCount } = await supabase.from("countries").select("*", { count: "exact", head: true });
  const { count: qualCount } = await supabase.from("qualifications").select("*", { count: "exact", head: true });
  const { count: fieldsCount } = await supabase.from("fields_of_study").select("*", { count: "exact", head: true });
  const { count: programCount } = await supabase.from("programs").select("*", { count: "exact", head: true });
  const { count: sourceCount } = await supabase.from("admission_sources").select("*", { count: "exact", head: true });
  const { count: reqCount } = await supabase.from("admission_requirements").select("*", { count: "exact", head: true });

  assert((univCount || 0) >= 24800, `Universities count (~24,876): ${univCount}`);
  assert((countryCount || 0) >= 240, `Countries count (~247): ${countryCount}`);
  assert((qualCount || 0) >= 29, `Canonical Qualifications in Ontology (>=29): ${qualCount}`);
  assert((fieldsCount || 0) >= 23, `Fields of Study Taxonomy (>=23): ${fieldsCount}`);
  assert((programCount || 0) > 0, `Active, quality-gated programs available: ${programCount}`);
  assert((sourceCount || 0) >= 100, `Official admission sources collected (>=100): ${sourceCount}`);

  // 2. PROMPT 6 NORMALIZATION & SCORE SCHEMA CHECKS
  assert((reqCount || 0) >= 400, `Structured admission requirements normalized (>=400): ${reqCount}`);

  const { data: validScoreTypes } = await supabase
    .from("admission_requirements")
    .select("id")
    .not("score_type", "is", null);
  assert((validScoreTypes?.length || 0) === (reqCount || 0), "100% of admission requirements have valid score_type");

  const { data: highConfidenceReqs } = await supabase
    .from("admission_requirements")
    .select("id")
    .in("normalization_confidence", ["EXACT", "HIGH_CONFIDENCE"]);
  assert((highConfidenceReqs?.length || 0) === (reqCount || 0), "100% of admission requirements have EXACT / HIGH_CONFIDENCE normalization status");

  const { data: unbackedReqs } = await supabase
    .from("admission_requirements")
    .select("id")
    .is("source_id", null);
  assert((unbackedReqs?.length || 0) === 0, "100% of structured requirements trace to official source_id");

  const { data: invalidActivePrograms } = await supabase
    .from("programs")
    .select("id")
    .eq("active", true)
    .not("data_quality_status", "in", "(VALID_PROGRAM,LIKELY_VALID_PROGRAM)");
  assert((invalidActivePrograms?.length || 0) === 0, "No quarantined/invalid page is active as a program");

  const { data: activeWithoutSource } = await supabase
    .from("programs")
    .select("id")
    .eq("active", true)
    .is("source_id", null);
  assert((activeWithoutSource?.length || 0) === 0, "All active programs have source provenance");

  const { data: activeWithoutUrl } = await supabase
    .from("programs")
    .select("id")
    .eq("active", true)
    .is("official_program_url", null);
  assert((activeWithoutUrl?.length || 0) === 0, "All active programs have official URLs");

  const { data: duplicateUrls } = await supabase.rpc("program_quality_duplicate_url_count");
  assert(Number(duplicateUrls || 0) === 0, `Duplicate canonical program URLs: ${duplicateUrls || 0}`);

  console.log("\n==================================================");
  console.log(`DATA INTEGRITY AUDIT: ${passed} PASSED, ${failed} FAILED (${passed + failed} Total Checks)`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
}

runDataIntegrityValidation().catch((err) => {
  console.error("Data integrity audit error:", err);
  process.exit(1);
});
