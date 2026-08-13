import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { AdmissionSourceCollectorEngine } from "../src/lib/admission-sources/admission-source-collector";

async function main() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — OFFICIAL ADMISSION SOURCE COLLECTOR");
  console.log("==================================================\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  const engine = new AdmissionSourceCollectorEngine(supabase);
  console.log("Starting Admission Source Collection for Real Programs...\n");

  const result = await engine.collectBatchAdmissionSources();

  console.log("==================================================");
  console.log("ADMISSION SOURCE COLLECTION SUMMARY");
  console.log("==================================================");
  console.log(`Run ID:                             ${result.runId}`);
  console.log(`Programs Processed:                 ${result.programsProcessed}`);
  console.log(`Sources Collected:                  ${result.sourcesCollected}`);
  console.log(`Snapshots Created:                  ${result.snapshotsCreated}`);
  console.log(`Conflicts Detected:                 ${result.conflictsDetected}`);
  console.log(`Structured Requirements Created:    ${result.structuredAdmissionRequirementsCreated} (STRICT ZERO RULE)`);
  console.log("==================================================\n");

  // Query Sample Collected Admission Sources
  const { data: sampleSources } = await supabase
    .from("admission_sources")
    .select("id, url, source_scope, source_type, authority_level, program_id, programs(name, universities(name))")
    .limit(10);

  console.log("SAMPLE CONNECTED ADMISSION SOURCES IN DB:");
  console.log("--------------------------------------------------");
  sampleSources?.forEach((s, idx: number) => {
    const prog = Array.isArray(s.programs) ? s.programs[0] : s.programs;
    const progName = prog ? (prog as unknown as { name: string }).name : "N/A";
    const univ = prog && Array.isArray((prog as unknown as { universities: unknown }).universities)
      ? (prog as unknown as { universities: { name: string }[] }).universities[0]
      : (prog as unknown as { universities: { name: string } })?.universities;
    const univName = univ ? univ.name : "N/A";

    console.log(`${idx + 1}. [${univName}] ${progName}`);
    console.log(`   Scope:      ${s.source_scope}`);
    console.log(`   Type:       ${s.source_type}`);
    console.log(`   Authority:  ${s.authority_level}`);
    console.log(`   URL:        ${s.url}`);
    console.log(`   DB ID:      ${s.id}`);
    console.log("--------------------------------------------------");
  });
}

main().catch((err) => {
  console.error("Admission collector runner error:", err);
  process.exit(1);
});
