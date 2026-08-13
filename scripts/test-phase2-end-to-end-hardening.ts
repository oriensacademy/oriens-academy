import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { safeFetchUrl } from "../src/lib/source-discovery/ssrf-fetcher";
import { SearchEligibilityBridge } from "../src/lib/eligibility-engine/search-eligibility-bridge";

dotenv.config({ path: ".env.local" });

async function runPhase2HardeningAudit() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — PHASE 2 FINAL QA & HARDENING AUDIT");
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

  // 1. DATASET BASELINE COUNTS
  console.log("--- 1. REAL DATASET BASELINE AUDIT ---");
  const { count: univCount } = await supabase.from("universities").select("*", { count: "exact", head: true });
  const { count: countryCount } = await supabase.from("countries").select("*", { count: "exact", head: true });
  const { count: qualCount } = await supabase.from("qualifications").select("*", { count: "exact", head: true });
  const { count: fieldsCount } = await supabase.from("fields_of_study").select("*", { count: "exact", head: true });
  const { count: programCount } = await supabase.from("programs").select("*", { count: "exact", head: true });
  const { count: sourceCount } = await supabase.from("admission_sources").select("*", { count: "exact", head: true });
  const { count: snapshotCount } = await supabase.from("admission_source_snapshots").select("*", { count: "exact", head: true });
  const { count: reqCount } = await supabase.from("admission_requirements").select("*", { count: "exact", head: true });
  const { count: groupCount } = await supabase.from("admission_requirement_groups").select("*", { count: "exact", head: true });

  assert((univCount || 0) >= 24800, `Universities in DB (~24,876): ${univCount}`);
  assert((countryCount || 0) >= 240, `Countries in DB (~247): ${countryCount}`);
  assert((qualCount || 0) >= 29, `Canonical Qualifications in Ontology (>=29): ${qualCount}`);
  assert((fieldsCount || 0) >= 23, `Fields of Study / Subjects in Taxonomy (>=23): ${fieldsCount}`);
  assert((programCount || 0) >= 100, `Real Programs in DB (>=100): ${programCount}`);
  assert((sourceCount || 0) >= 100, `Official Admission Sources (>=100): ${sourceCount}`);
  assert((snapshotCount || 0) >= 100, `Evidence Snapshots (>=100): ${snapshotCount}`);
  assert((reqCount || 0) >= 400, `Structured Admission Requirements (>=400): ${reqCount}`);
  assert((groupCount || 0) >= 300, `Requirement Groups (>=300): ${groupCount}`);

  // 2. HALLUCINATION & PROVENANCE AUDIT
  console.log("\n--- 2. HALLUCINATION & PROVENANCE AUDIT ---");
  const { data: unbackedReqs } = await supabase
    .from("admission_requirements")
    .select("id")
    .is("source_id", null);
  assert((unbackedReqs?.length || 0) === 0, "Unsupported VERIFIED Requirements Target: 0 (100% Source Provenance)");

  const { data: reqsWithRawText } = await supabase
    .from("admission_requirements")
    .select("id")
    .not("raw_source_text", "is", null);
  assert((reqsWithRawText?.length || 0) === (reqCount || 0), "100% of structured requirements retain original raw_source_text");

  // 3. FRESHNESS & CONFLICT AUDIT
  console.log("\n--- 3. FRESHNESS & CONFLICT SAFETY AUDIT ---");
  const { data: currentSources } = await supabase
    .from("admission_sources")
    .select("id")
    .eq("freshness_status", "CURRENT");
  assert((currentSources?.length || 0) >= 100, `Current / Valid Admission Sources: ${currentSources?.length}`);

  const { data: noConflictReqs } = await supabase
    .from("admission_requirements")
    .select("id")
    .eq("conflict_status", "NO_CONFLICT");
  assert((noConflictReqs?.length || 0) >= 400, `Non-conflicting Requirements: ${noConflictReqs?.length}`);

  // 4. SECURITY & SSRF AUDIT
  console.log("\n--- 4. SECURITY & SSRF PROTECTION AUDIT ---");
  const localhostTest = await safeFetchUrl("http://127.0.0.1:8080");
  assert(!localhostTest.ok && !!localhostTest.error?.toUpperCase().includes("BLOCKED"), "SSRF Protection: Localhost 127.0.0.1 blocked");

  const metadataTest = await safeFetchUrl("http://169.254.169.254/latest/meta-data/");
  assert(!metadataTest.ok && !!metadataTest.error?.toUpperCase().includes("BLOCKED"), "SSRF Protection: Cloud Metadata endpoint 169.254.169.254 blocked");

  const fileSchemeTest = await safeFetchUrl("file:///etc/passwd");
  assert(!fileSchemeTest.ok && !!fileSchemeTest.error?.toUpperCase().includes("UNSUPPORTED"), "SSRF Protection: Non-HTTP scheme file:// blocked");

  // 5. NATURAL SEARCH & ELIGIBILITY INTEGRATION TEST
  console.log("\n--- 5. LIVE SEARCH & ELIGIBILITY INTEGRATION QA ---");
  const bridge = new SearchEligibilityBridge(supabase);
  await bridge.initialize();

  const results = await bridge.searchWithEligibility("IB 38 computer science UK");
  assert(results.length > 0, `Search & Eligibility returned ${results.length} candidate program results`);
  if (results.length > 0) {
    const first = results[0];
    assert(!!first.eligibility.status, `Evaluated Eligibility Status: ${first.eligibility.status}`);
    assert(first.eligibility.disclaimer.includes("does not guarantee admission"), "Legal disclaimer present on evaluation output");
  }

  console.log("\n==================================================");
  console.log(`PHASE 2 FINAL QA AUDIT: ${passed} PASSED, ${failed} FAILED (${passed + failed} Total Checks)`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
}

runPhase2HardeningAudit().catch((err) => {
  console.error("Phase 2 hardening audit error:", err);
  process.exit(1);
});
