import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { safeFetchUrl } from "../src/lib/source-discovery/ssrf-fetcher";
import { classifyProgramPage } from "../src/lib/program-ingestion/program-page-classifier";
import { isWithinOfficialDomainBoundary } from "../src/lib/source-discovery/domain-normalizer";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""
  );

  const { data: programs, error } = await supabase
  .from("programs")
  .select("id,name,degree_level,official_program_url,active,source_id,university_id,universities(name,website),admission_sources!fk_programs_source_id(url,canonical_url,source_type,is_official,active)")
  .order("created_at");

  if (error) throw error;

  const results: Array<Record<string, unknown>> = [];
  const queue = [...(programs || [])];

  async function worker() {
    while (queue.length > 0) {
    const program = queue.shift();
    if (!program) return;
    const university = Array.isArray(program.universities) ? program.universities[0] : program.universities;
    const fetched = await safeFetchUrl(program.official_program_url, { timeoutMs: 12_000, maxSizeBytes: 3_000_000 });
    const domainOk = fetched.ok && isWithinOfficialDomainBoundary(fetched.finalUrl, new URL(program.official_program_url).hostname);
    const classification = fetched.ok
      ? classifyProgramPage({ html: fetched.body, url: fetched.finalUrl, title: program.name })
      : {
          decision: "NEEDS_REVIEW",
          classification: "AMBIGUOUS_NEEDS_REVIEW",
          confidence: 0,
          score: 0,
          reasons: [`fetch failed: ${fetched.status} ${fetched.error || ""}`],
          positiveSignals: [],
          negativeSignals: [],
          title: program.name,
        };
    results.push({
      id: program.id,
      university: university?.name,
      name: program.name,
      degreeLevel: program.degree_level,
      url: program.official_program_url,
      httpStatus: fetched.status,
      finalUrl: fetched.finalUrl,
      domainOk,
      ...classification,
    });
    }
  }

  await Promise.all(Array.from({ length: 5 }, () => worker()));
  results.sort((a, b) => String(a.university).localeCompare(String(b.university)) || String(a.name).localeCompare(String(b.name)));

  const counts = results.reduce<Record<string, number>>((acc, result) => {
  const key = String(result.classification);
  acc[key] = (acc[key] || 0) + 1;
  return acc;
  }, {});

  if (process.argv.includes("--summary")) {
    console.log(JSON.stringify({ total: results.length, counts }, null, 2));
    for (const result of results) {
      console.log([
        result.id,
        result.university,
        result.name,
        result.classification,
        result.decision,
        result.httpStatus,
        result.score,
        result.url,
      ].join("|"));
    }
  } else {
    console.log(JSON.stringify({ total: results.length, counts, results }, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
