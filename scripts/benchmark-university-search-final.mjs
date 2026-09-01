#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const env = Object.fromEntries(readFileSync(resolve(root, ".env.local"), "utf8")
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith("#") && line.includes("="))
  .map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
  }));
const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!baseUrl || !anonKey) throw new Error("Missing public Supabase configuration");

const sections = {
  turkish: ["sabanci","sabancı","itu","itü","bogazici","boğaziçi","koc","koç","istanbul teknik","istanbul universitesi","hacettepe","bilkent","odtu","metu"],
  international: ["oxford","cambridge","imperial","ucl","lse","manchester","edinburgh","glasgow","birmingham","bristol","leeds","nottingham","warwick","bath","durham","york","harvard","stanford","mit","columbia","berkeley","ucla","nyu","princeton","yale","cornell","bocconi","eth","epfl","tum","tu delft","ku leuven","sorbonne","tokyo","tsinghua","peking","nus","ntu","melbourne","sydney","toronto","mcgill"],
  acronym: ["MIT","UCL","LSE","ETH","EPFL","TUM","NUS","NTU","UCLA","NYU","METU","ODTU","ITU"],
  typo: ["bristl","bristoll","oxfrod","cambrdge","standford","harward","princton","colmbia","berkley","bokoni","sabnci","bogazci","hacetepe"],
};

const expected = new Map([
  [["sabanci","sabancı","sabnci"], /Sabanc/i], [["itu","itü","istanbul teknik"], /Istanbul Technical|İstanbul Teknik/i],
  [["bogazici","boğaziçi","bogazci"], /Boğaziçi/i], [["koc","koç"], /Koç/i],
  [["istanbul universitesi"], /Istanbul University|İstanbul Üniversitesi/i], [["hacettepe","hacetepe"], /Hacettepe/i],
  [["bilkent"], /Bilkent/i], [["odtu","metu"], /Middle East Technical|Orta Doğu Teknik/i],
  [["oxford","oxfrod"], /University of Oxford/i], [["cambridge","cambrdge"], /University of Cambridge/i],
  [["imperial"], /Imperial College London/i], [["ucl"], /University College London/i],
  [["lse"], /London School of Economics/i], [["manchester"], /University of Manchester/i],
  [["edinburgh"], /University of Edinburgh/i], [["glasgow"], /University of Glasgow/i],
  [["birmingham"], /University of Birmingham/i], [["bristol","bristl","bristoll"], /University of Bristol/i],
  [["leeds"], /University of Leeds/i], [["nottingham"], /University of Nottingham/i], [["warwick"], /University of Warwick/i],
  [["bath"], /University of Bath/i], [["durham"], /Durham University/i], [["york"], /University of York|York University/i],
  [["harvard","harward"], /Harvard University/i], [["stanford","standford"], /Stanford University/i],
  [["mit"], /Massachusetts Institute of Technology/i], [["columbia","colmbia"], /Columbia University/i],
  [["berkeley","berkley"], /University of California.*Berkeley/i], [["ucla"], /University of California.*Los Angeles/i],
  [["nyu"], /New York University/i], [["princeton","princton"], /Princeton University/i], [["yale"], /Yale University/i],
  [["cornell"], /Cornell University/i], [["bocconi","bokoni"], /Bocconi University/i], [["eth"], /ETH Zurich/i],
  [["epfl"], /EPFL|Lausanne/i], [["tum"], /Technical University of Munich/i], [["tu delft"], /Delft University of Technology/i],
  [["ku leuven"], /KU Leuven/i], [["sorbonne"], /Sorbonne/i], [["tokyo"], /University of Tokyo/i],
  [["tsinghua"], /Tsinghua University/i], [["peking"], /Peking University/i], [["nus"], /National University of Singapore/i],
  [["ntu"], /Nanyang Technological University/i], [["melbourne"], /University of Melbourne/i],
  [["sydney"], /University of Sydney/i], [["toronto"], /University of Toronto/i], [["mcgill"], /McGill University/i],
].flatMap(([queries, pattern]) => queries.map((query) => [query, pattern])));

const jobs = Object.entries(sections).flatMap(([section, queries]) => queries.map((query) => ({ section, query })));
const results = new Array(jobs.length);
let cursor = 0;
async function worker() {
  while (cursor < jobs.length) {
    const index = cursor++;
    const job = jobs[index];
    const started = performance.now();
    let status = 0, code = null, rows = [];
    try {
      const response = await fetch(`${baseUrl}/rest/v1/rpc/search_autocomplete_entities_v2`, {
        method: "POST",
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_query: job.query, p_limit: 10, p_country_iso2: null }),
      });
      status = response.status;
      const payload = await response.json();
      if (response.ok && Array.isArray(payload)) rows = payload.filter((row) => row.entity_type === "UNIVERSITY");
      else code = payload?.code || "HTTP_ERROR";
    } catch (error) {
      code = error?.name || "FETCH_ERROR";
    }
    const top = rows.slice(0, 5).map((row) => row.title);
    const normalized = job.query.toLowerCase();
    const pattern = expected.get(normalized);
    results[index] = {
      ...job, http: status, code, latency_ms: Number((performance.now() - started).toFixed(1)),
      top1: top[0] || null, top3: top.slice(0, 3), top5: top,
      count: rows.length, timeout: code === "57014", correct_top1: Boolean(pattern?.test(top[0] || "")),
      contamination: top.filter((name) => /science park|middle school|school district|training cent(er|re)|professional society/i.test(name)),
    };
  }
}
await Promise.all([worker(), worker()]);
const latencies = results.map((row) => row.latency_ms).sort((a, b) => a - b);
const percentile = (p) => latencies[Math.max(0, Math.ceil(latencies.length * p) - 1)];
const summary = {
  requests: results.length, concurrency: 2, p50: percentile(.50), p75: percentile(.75),
  p95: percentile(.95), p99: percentile(.99), max: percentile(1),
  timeouts: results.filter((row) => row.timeout).length,
  errors: results.filter((row) => row.http !== 200).length,
  incorrect_top1: results.filter((row) => !row.correct_top1).length,
  contamination: results.reduce((count, row) => count + row.contamination.length, 0),
};
console.log(JSON.stringify({ summary, results }, null, 2));
if (summary.errors || summary.timeouts || summary.incorrect_top1 || summary.contamination || summary.p95 > 700) process.exitCode = 1;
