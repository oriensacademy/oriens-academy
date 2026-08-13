import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { ScoreSchemaValidator } from "../src/lib/qualification-normalization/score-schema-validator";

dotenv.config({ path: ".env.local" });

async function runRequirementNormalization() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — QUALIFICATION & SCORE NORMALIZATION");
  console.log("==================================================\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  const validator = new ScoreSchemaValidator();

  // Create Ingestion Run Record
  const { data: runRecord } = await supabase
    .from("ingestion_runs")
    .insert({
      run_type: "REQUIREMENT_NORMALIZATION",
      source: "STRUCTURED_ADMISSION_REQUIREMENTS",
      status: "RUNNING",
    })
    .select("id")
    .single();

  const runId = runRecord?.id || "N/A";

  // Fetch all 458 admission requirements
  const { data: requirements, error: reqErr } = await supabase
    .from("admission_requirements")
    .select("id, program_id, qualification_id, requirement_type, minimum_numeric_score, grade_text, raw_source_text, qualifications(code, name)");

  if (reqErr || !requirements) {
    console.error("Failed to load requirements:", reqErr);
    process.exit(1);
  }

  console.log(`Starting normalization across ${requirements.length} admission requirements...\n`);

  let totalNormalized = 0;
  let exactConfidenceCount = 0;
  let reviewCount = 0;
  let unresolvedCount = 0;
  const countsByQual: Record<string, { total: number; valid: number; review: number }> = {};

  for (const req of requirements) {
    const qualObj = Array.isArray(req.qualifications)
      ? (req.qualifications[0] as { code: string; name: string })
      : (req.qualifications as { code: string; name: string });

    const qualCode = qualObj?.code || (req.requirement_type === "PERSONAL_STATEMENT" ? "PERSONAL_STATEMENT" : "OTHER");

    if (!countsByQual[qualCode]) {
      countsByQual[qualCode] = { total: 0, valid: 0, review: 0 };
    }
    countsByQual[qualCode].total++;

    const valResult = validator.validateScore(qualCode, req.minimum_numeric_score, req.grade_text);

    if (valResult.isValid) {
      exactConfidenceCount++;
      countsByQual[qualCode].valid++;
    } else {
      if (valResult.confidence === "NEEDS_REVIEW") {
        reviewCount++;
        countsByQual[qualCode].review++;
      } else {
        unresolvedCount++;
      }
    }

    // Update DB row with score components, score_type, normalization_confidence
    await supabase
      .from("admission_requirements")
      .update({
        score_type: valResult.normalizedScoreType,
        score_components: valResult.components || {},
        normalization_confidence: valResult.confidence,
        unresolved_reason: valResult.errorMessage || null,
      })
      .eq("id", req.id);

    totalNormalized++;
  }

  // Update Ingestion Run Status
  if (runId !== "N/A") {
    await supabase
      .from("ingestion_runs")
      .update({
        status: "COMPLETED",
        finished_at: new Date().toISOString(),
        records_discovered: requirements.length,
        records_updated: totalNormalized,
      })
      .eq("id", runId);
  }

  console.log("==================================================");
  console.log("QUALIFICATION & SCORE NORMALIZATION SUMMARY");
  console.log("==================================================");
  console.log(`Run ID:                             ${runId}`);
  console.log(`Requirements Processed:             ${requirements.length}`);
  console.log(`Exact / High Confidence Valid:      ${exactConfidenceCount}`);
  console.log(`Flagged for Human Review:           ${reviewCount}`);
  console.log(`Unresolved / Unknown Rules:          ${unresolvedCount}`);
  console.log("==================================================\n");

  console.log("NORMALIZATION COVERAGE COUNTS BY QUALIFICATION:");
  console.log("--------------------------------------------------");
  Object.entries(countsByQual).forEach(([code, stat]) => {
    console.log(`- ${code.padEnd(20)} Total: ${stat.total.toString().padEnd(6)} Valid: ${stat.valid.toString().padEnd(6)} Review: ${stat.review}`);
  });
}

runRequirementNormalization().catch((err) => {
  console.error("Requirement normalization execution failed:", err);
  process.exit(1);
});
