import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { ProgramIngestionEngine } from "../src/lib/program-ingestion/ingestion-engine";

async function main() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — REAL PROGRAM INGESTION RUNNER");
  console.log("==================================================\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  const engine = new ProgramIngestionEngine(supabase);

  console.log("Starting Pilot University Program Ingestion...");
  const res = await engine.runPilotIngestion();

  console.log("\n==================================================");
  console.log("PROGRAM INGESTION SUMMARY");
  console.log("==================================================");
  console.log(`Run ID:                             ${res.runId}`);
  console.log(`Universities Processed:             ${res.universitiesProcessed}`);
  console.log(`Program Links Discovered:           ${res.programLinksDiscovered}`);
  console.log(`Programs Inserted:                  ${res.programsInserted}`);
  console.log(`Programs Updated:                   ${res.programsUpdated}`);
  console.log(`Programs Skipped:                   ${res.programsSkipped}`);
  console.log(`Programs Failed:                    ${res.programsFailed}`);
  console.log(`Admission Requirements Inserted:    ${res.admissionRequirementsInserted} (STRICT ZERO RULE)`);
  console.log("==================================================\n");

  // Query Sample Ingested Programs
  const { data: samplePrograms } = await supabase
    .from("programs")
    .select("id, name, degree_level, degree_title, official_program_url, universities(name)")
    .limit(10);

  console.log("SAMPLE INGESTED REAL PROGRAMS IN SUPABASE DB:");
  console.log("--------------------------------------------------");
  samplePrograms?.forEach((p, idx: number) => {
    const univ = Array.isArray(p.universities) ? p.universities[0] : p.universities;
    const univName = univ ? (univ as { name: string }).name : "N/A";
    console.log(`${idx + 1}. [${univName}] ${p.name}`);
    console.log(`   Degree Level:  ${p.degree_level}`);
    console.log(`   Degree Title:  ${p.degree_title || "N/A"}`);
    console.log(`   Official URL:  ${p.official_program_url}`);
    console.log(`   DB ID:         ${p.id}`);
    console.log("--------------------------------------------------");
  });
}

main().catch((err) => {
  console.error("Ingestion runner error:", err);
  process.exit(1);
});
