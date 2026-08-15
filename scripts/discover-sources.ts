import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { SourceDiscoveryEngine } from "../src/lib/source-discovery/discovery-engine";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const PILOT_UNIVERSITY_NAMES = [
  "University of Oxford",
  "University of Cambridge",
  "University College London",
  "Imperial College London",
  "Massachusetts Institute of Technology",
  "Harvard University",
  "Stanford University",
  "Bocconi University",
  "ETH Zurich",
];

async function main() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — OFFICIAL SOURCE DISCOVERY RUNNER");
  console.log("==================================================\n");

  const args = process.argv.slice(2);
  const isPilot = args.includes("--pilot") || args.length === 0;

  const universityIdArg = args.find((a) => a.startsWith("--university-id="))?.split("=")[1];
  const countryArg = args.find((a) => a.startsWith("--country="))?.split("=")[1];
  const limitArg = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "10", 10);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  if (!supabaseKey) throw new Error("A Supabase key is required for source discovery.");
  const supabase = createClient(supabaseUrl, supabaseKey);

  let targetUniversities: Array<{
    id: string;
    name: string;
    website: string | null;
    admissions_url: string | null;
    popularity_score: number | null;
  }> = [];

  if (universityIdArg) {
    const { data } = await supabase
      .from("universities")
      .select("id, name, website, admissions_url, popularity_score")
      .eq("id", universityIdArg);
    targetUniversities = data || [];
  } else if (countryArg) {
    const { data: countryData } = await supabase.from("countries").select("id").eq("iso2", countryArg.toUpperCase()).single();
    if (countryData) {
      const { data } = await supabase
        .from("universities")
        .select("id, name, website, admissions_url, popularity_score")
        .eq("country_id", countryData.id)
        .order("popularity_score", { ascending: false })
        .limit(limitArg);
      targetUniversities = data || [];
    }
  } else if (isPilot) {
    console.log("Mode: PILOT RUN (Representative Top Universities)\n");
    const { data } = await supabase
      .from("universities")
      .select("id, name, website, admissions_url, popularity_score")
      .in("name", PILOT_UNIVERSITY_NAMES);
    targetUniversities = data || [];
  } else {
    const { data } = await supabase
      .from("universities")
      .select("id, name, website, admissions_url, popularity_score")
      .order("popularity_score", { ascending: false })
      .limit(limitArg);
    targetUniversities = data || [];
  }

  if (targetUniversities.length === 0) {
    console.error("No universities found matching target filter criteria.");
    process.exit(1);
  }

  console.log(`Target Universities Count: ${targetUniversities.length}`);
  for (const u of targetUniversities) {
    console.log(` - ${u.name} (Website: ${u.website || "NONE"})`);
  }
  console.log("\nStarting Discovery Engine Pipeline...\n");

  const discoveryEngine = new SourceDiscoveryEngine(supabase);
  const targetsFormatted = targetUniversities.map((u) => ({
    id: u.id,
    name: u.name,
    website: u.website,
    admissionsUrl: u.admissions_url,
    popularityScore: u.popularity_score,
  }));

  const result = await discoveryEngine.runDiscoveryBatch(targetsFormatted, isPilot ? "PILOT_SOURCE_DISCOVERY" : "BATCH_SOURCE_DISCOVERY");

  console.log("==================================================");
  console.log("SOURCE DISCOVERY PILOT RUN COMPLETE");
  console.log("==================================================");
  console.log(`Run ID:                   ${result.runId}`);
  console.log(`Universities Processed:   ${result.universitiesProcessed}`);
  console.log(`Sources Discovered:       ${result.sourcesDiscovered}`);
  console.log(`Sources Verified:         ${result.sourcesVerified}`);
  console.log(`Sources Needing Review:   ${result.sourcesNeedingReview}`);
  console.log(`Sources Rejected:         ${result.sourcesRejected}`);
  console.log(`Failures Count:           ${result.failures.length}`);
  console.log("==================================================\n");

  if (result.failures.length > 0) {
    console.log("Failures Summary:");
    for (const f of result.failures) {
      console.log(` ✗ ${f.name} (${f.universityId}): ${f.reason}`);
    }
  }

  // Print Sample Discovered Registry Entries per Pilot University
  for (const u of targetUniversities) {
    const { data: sources } = await supabase
      .from("university_source_registry")
      .select("source_type, url, is_official, verification_status, priority")
      .eq("university_id", u.id)
      .order("priority", { ascending: true });

    console.log(`\n--------------------------------------------------`);
    console.log(`UNIVERSITY: ${u.name}`);
    console.log(`--------------------------------------------------`);
    if (!sources || sources.length === 0) {
      console.log("  Program Catalog:        NOT FOUND");
      console.log("  Undergraduate Source:   NOT FOUND");
      console.log("  Postgraduate Source:    NOT FOUND");
      console.log("  Admissions Source:      NOT FOUND");
      console.log("  Entry Requirements:     NOT FOUND");
    } else {
      const getSrc = (st: string) => sources.find((s) => s.source_type === st)?.url || "NOT FOUND";
      console.log(`  Program Catalog:        ${getSrc("PROGRAM_CATALOG")}`);
      console.log(`  Undergraduate Source:   ${getSrc("UNDERGRADUATE_PROGRAMS")}`);
      console.log(`  Postgraduate Source:    ${getSrc("POSTGRADUATE_PROGRAMS")}`);
      console.log(`  Admissions Source:      ${getSrc("UNDERGRADUATE_ADMISSIONS")}`);
      console.log(`  Entry Requirements:     ${getSrc("ENTRY_REQUIREMENTS")}`);
      console.log(`  Total Registered:       ${sources.length} sources (Verified: ${sources.filter(s => s.verification_status === 'VERIFIED').length})`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal Error running source discovery script:", err);
  process.exit(1);
});
