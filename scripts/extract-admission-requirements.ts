import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { RequirementExtractorEngine } from "../src/lib/requirement-extraction/requirement-extractor";

dotenv.config({ path: ".env.local" });

async function runRequirementExtraction() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — STRUCTURED ADMISSION REQUIREMENT EXTRACTION");
  console.log("==================================================\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  const engine = new RequirementExtractorEngine(supabase);
  await engine.initialize();

  // Create Ingestion Run Record
  const { data: runRecord } = await supabase
    .from("ingestion_runs")
    .insert({
      run_type: "REQUIREMENT_EXTRACTION",
      source: "OFFICIAL_ADMISSION_SOURCES",
      status: "RUNNING",
    })
    .select("id")
    .single();

  const runId = runRecord?.id || "N/A";

  // Fetch all 112 real programs
  const { data: programs, error: progErr } = await supabase
    .from("programs")
    .select("id, name, degree_level, official_program_url, university_id, universities(name)")
    .order("created_at", { ascending: true });

  if (progErr || !programs) {
    console.error("Failed to load programs:", progErr);
    process.exit(1);
  }

  console.log(`Starting extraction across ${programs.length} database programs...\n`);

  let totalRequirementsCreated = 0;
  let totalGroupsCreated = 0;
  const sampleRuleTrees: Array<{ programName: string; univName: string; ruleTree: string }> = [];

  for (const prog of programs) {
    const univName = Array.isArray(prog.universities)
      ? (prog.universities[0] as { name: string })?.name
      : (prog.universities as { name: string })?.name || "University";

    console.log(`[RequirementExtractor] Extracting requirements for: ${prog.name} (${univName})`);

    try {
      const result = await engine.extractProgramRequirements(prog.id);
      totalRequirementsCreated += result.extractedRequirementsCount;
      totalGroupsCreated += result.groupsCreatedCount;

      if (sampleRuleTrees.length < 5) {
        sampleRuleTrees.push({
          programName: prog.name,
          univName,
          ruleTree: result.ruleTreeText,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[RequirementExtractor] Error extracting requirements for ${prog.name}: ${msg}`);
    }
  }

  // Update Ingestion Run Status
  if (runId !== "N/A") {
    await supabase
      .from("ingestion_runs")
      .update({
        status: "COMPLETED",
        finished_at: new Date().toISOString(),
        records_discovered: programs.length,
        records_inserted: totalRequirementsCreated,
      })
      .eq("id", runId);
  }

  console.log("\n==================================================");
  console.log("STRUCTURED ADMISSION REQUIREMENT EXTRACTION SUMMARY");
  console.log("==================================================");
  console.log(`Run ID:                             ${runId}`);
  console.log(`Programs Processed:                 ${programs.length}`);
  console.log(`Requirement Groups Created:        ${totalGroupsCreated}`);
  console.log(`Structured Requirements Inserted:   ${totalRequirementsCreated}`);
  console.log("==================================================\n");

  console.log("SAMPLE PILOT RULE TREES:");
  console.log("--------------------------------------------------");
  sampleRuleTrees.forEach((st, idx) => {
    console.log(`\n--- SAMPLE ${idx + 1}: ${st.programName} (${st.univName}) ---`);
    console.log(st.ruleTree);
  });
}

runRequirementExtraction().catch((err) => {
  console.error("Requirement extraction execution failed:", err);
  process.exit(1);
});
