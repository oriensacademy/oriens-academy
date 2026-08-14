import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { ProgramIngestionEngine } from "../src/lib/program-ingestion/ingestion-engine";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""
  );
  const engine = new ProgramIngestionEngine(supabase);
  const pilotNames = [
    "University of Oxford",
    "University of Cambridge",
    "Imperial College London",
    "Bocconi University",
  ];
  const { data: universities, error } = await supabase.from("universities").select("id,name").in("name", pilotNames);
  if (error) throw error;

  const { data: run, error: runError } = await supabase.from("ingestion_runs").insert({
    run_type: "PROGRAM_QUALITY_PILOT",
    source: "PATCH_3_CONTROLLED_OFFICIAL_SOURCES",
    status: "RUNNING",
  }).select("id").single();
  if (runError || !run) throw runError || new Error("Unable to create pilot run");

  const metrics: Array<Record<string, unknown>> = [];
  for (const university of universities || []) {
    try {
      const result = await engine.ingestUniversityPrograms(university.id);
      metrics.push({ university: university.name, ...result });
    } catch (error) {
      metrics.push({ university: university.name, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const sum = (field: string) => metrics.reduce((total, metric) => total + Number(metric[field] || 0), 0);
  const failedUniversities = metrics.filter((metric) => metric.error).length;
  await supabase.from("ingestion_runs").update({
    finished_at: new Date().toISOString(),
    status: failedUniversities > 0 ? "PARTIAL_SUCCESS" : "COMPLETED",
    records_discovered: sum("discovered"),
    records_inserted: sum("inserted"),
    records_updated: sum("updated"),
    records_skipped: sum("skipped") + sum("rejected") + sum("needsReview") + sum("duplicatesPrevented"),
    records_failed: sum("failed") + failedUniversities,
    error_summary: { metrics },
  }).eq("id", run.id);

  console.log(JSON.stringify({ runId: run.id, metrics }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
