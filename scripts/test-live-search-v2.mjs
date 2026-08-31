import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

const queries = [
  "bristol", "oxford", "cambridge", "london", "manchester", "edinburgh", "glasgow",
  "birmingham", "leeds", "nottingham", "warwick", "bath", "durham", "york",
  "harvard", "stanford", "mit", "berkeley", "ucla", "bocconi", "eth", "epfl",
  "tum", "tu delft", "tokyo", "tsinghua", "nus", "itu", "itü", "bogazici",
  "boğaziçi", "koc", "koç", "sabanci", "sabancı", "bilkent", "bristl", "bristoll",
  "oxfrod", "cambrdge", "standford", "harward", "bokoni"
];

async function main() {
  console.log("=== TESTING SEARCH_AUTOCOMPLETE_ENTITIES_V2 ON LIVE PRODUCTION DB ===");
  
  const latencies = [];
  const results = [];

  for (const q of queries) {
    const t0 = performance.now();
    const { data, error } = await supabase.rpc("search_autocomplete_entities_v2", {
      p_query: q,
      p_limit: 10,
      p_country_iso2: null
    });
    const t1 = performance.now();
    const latency = t1 - t0;
    latencies.push(latency);

    if (error) {
      console.error(`Query '${q}' ERROR:`, error);
      results.push({ query: q, error: error.message, latency });
    } else {
      const top1 = data && data[0] ? data[0].title : "NO_RESULT";
      const top3 = (data || []).slice(0, 3).map(d => d.title);
      results.push({ query: q, top1, top3, count: data?.length || 0, latency });
      console.log(`[${latency.toFixed(1)}ms] '${q}' -> #1: ${top1} (total ${data?.length})`);
    }
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  console.log("\n=== LATENCY METRICS ===");
  console.log(`Queries tested: ${queries.length}`);
  console.log(`p50: ${p50.toFixed(2)} ms`);
  console.log(`p95: ${p95.toFixed(2)} ms`);
  console.log(`p99: ${p99.toFixed(2)} ms`);

  // Check specific requirements:
  const bristolResult = results.find(r => r.query === "bristol");
  const sabanciResult = results.find(r => r.query === "sabanci");
  const sabanciTrResult = results.find(r => r.query === "sabancı");

  console.log("\n=== CRITICAL INVARIANT CHECKS ===");
  console.log(`- Bristol #1: ${bristolResult?.top1} (Matches University of Bristol: ${bristolResult?.top1.toLowerCase().includes("university of bristol")})`);
  console.log(`- Sabancı #1 (ASCII): ${sabanciResult?.top1} (Matches Sabancı: ${sabanciResult?.top1.toLowerCase().includes("sabancı") || sabanciResult?.top1.toLowerCase().includes("sabanci")})`);
  console.log(`- Sabancı #1 (Turkish): ${sabanciTrResult?.top1} (Matches Sabancı: ${sabanciTrResult?.top1.toLowerCase().includes("sabancı") || sabanciTrResult?.top1.toLowerCase().includes("sabanci")})`);
}

main().catch(console.error);
