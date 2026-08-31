#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import {
  normalizeUniversitySearchText as normalize,
  UNIVERSITY_NORMALIZATION_VERSION,
} from "../src/lib/search/university-normalization.mjs";
import {
  classifyUniversityEntity,
  UNIVERSITY_ELIGIBILITY_MODEL_VERSION,
} from "./lib/university-classifier.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const CACHE = join(ROOT, ".cache", "universities");
const RAW_FILE = join(CACHE, "v2.12-2026-08-25-ror-data.json");
const OPENALEX_FILE = join(CACHE, "openalex-by-ror.json");
const OUTPUT = join(CACHE, "discovery-v2-qa.json");
const MIGRATION = join(ROOT, "supabase", "migrations", "20260831130000_university_discovery_v2.sql");
const DB_RETRIEVAL = join(ROOT, "src", "lib", "search", "db-retrieval-service.ts");
const SEARCH_INPUT = join(ROOT, "src", "components", "discovery", "SearchAutocompleteInput.tsx");
const GOOEY_SEARCH = join(ROOT, "src", "components", "ui", "gooey-search.tsx");
const URL_WORKER = join(ROOT, "scripts", "verify-university-urls.mjs");

const normalizationVectors = new Map([
  ["Sabancı", "sabanci"], ["sabanci", "sabanci"],
  ["Boğaziçi", "bogazici"], ["bogazici", "bogazici"],
  ["İTÜ", "itu"], ["itu", "itu"], ["Koç", "koc"],
  ["İstanbul", "istanbul"], ["  Université—de  Paris  ", "universite de paris"],
  ["King’s College", "king s college"], ["A&B", "a and b"],
]);
for (const [input, expected] of normalizationVectors) assert.equal(normalize(input), expected, `normalization: ${input}`);

function rorFixture(name, types = ["education"]) {
  return { status: "active", types, names: [{ value: name, types: ["ror_display"], lang: "en" }] };
}
for (const name of ["University of Bristol", "Sabancı Üniversitesi", "Massachusetts Institute of Technology", "École Polytechnique Fédérale de Lausanne"]) {
  const classified = classifyUniversityEntity(rorFixture(name), { type: "education" });
  assert.equal(classified.status, "eligible", `${name} should be eligible`);
  assert.ok(classified.confidence >= 0.65);
}
for (const name of ["Bristol and Bath Science Park", "Southern Alamance Middle School", "St. Vrain Valley School District", "Example Training Center", "Example Professional Society", "Example Hospital"]) {
  const classified = classifyUniversityEntity(rorFixture(name), { type: "education" });
  assert.equal(classified.status, "ineligible", `${name} should be ineligible`);
}

const migrationSql = readFileSync(MIGRATION, "utf8");
for (const required of [
  "university_confidence", "manual_eligibility_override", "eligibility_evidence",
  "university_search_terms", "search_autocomplete_entities_v2", "search_university_fuzzy_candidates_v2",
  "university_url_verifications", "redirect_verified", "admin_review_university_eligibility",
]) assert.ok(migrationSql.includes(required), `migration contract missing ${required}`);
assert.ok(migrationSql.indexOf("search_university_strong_candidates_v2") < migrationSql.indexOf("search_university_fuzzy_candidates_v2"));
assert.match(readFileSync(DB_RETRIEVAL, "utf8"), /search_autocomplete_entities_v2/);
assert.match(readFileSync(DB_RETRIEVAL, "utf8"), /SEARCH_RPC_FETCH_LIMIT = 10/);
for (const uiFile of [SEARCH_INPUT, GOOEY_SEARCH]) {
  const source = readFileSync(uiFile, "utf8");
  assert.match(source, /Resmî bağlantı doğrulanıyor/);
  assert.match(source, /Official link is being verified/);
  assert.match(source, /noopener noreferrer/);
}
const workerSource = readFileSync(URL_WORKER, "utf8");
assert.match(workerSource, /redirect_verified/);
assert.match(workerSource, /transient:/);
assert.match(workerSource, /CONCURRENCY/);

const gold = [
  ["bristol", /University of Bristol/i], ["oxford", /University of Oxford/i], ["cambridge", /University of Cambridge/i],
  ["london", /(University College London|University of London|London .*University|.*University.*London)/i],
  ["manchester", /University of Manchester/i], ["edinburgh", /University of Edinburgh/i], ["glasgow", /University of Glasgow/i],
  ["birmingham", /University of Birmingham/i], ["leeds", /University of Leeds/i], ["nottingham", /University of Nottingham/i],
  ["warwick", /University of Warwick/i], ["bath", /University of Bath/i], ["durham", /Durham University/i], ["york", /(University of York|York University)/i],
  ["harvard", /Harvard University/i], ["stanford", /Stanford University/i], ["mit", /Massachusetts Institute of Technology/i],
  ["columbia", /Columbia University/i], ["cornell", /Cornell University/i], ["brown", /Brown University/i], ["duke", /Duke University/i],
  ["berkeley", /(University of California.*Berkeley|UC Berkeley)/i], ["ucla", /University of California.*Los Angeles/i], ["nyu", /New York University/i],
  ["bocconi", /Bocconi University/i], ["sorbonne", /Sorbonne Universit/i], ["eth", /ETH Zurich/i], ["epfl", /(EPFL|cole Polytechnique F.*rale de Lausanne)/i],
  ["tum", /Technical University of Munich/i], ["tu delft", /Delft University of Technology/i], ["ku leuven", /KU Leuven/i],
  ["tokyo", /University of Tokyo/i], ["kyoto", /Kyoto University/i], ["tsinghua", /Tsinghua University/i], ["peking", /Peking University/i],
  ["nus", /National University of Singapore/i], ["ntu", /Nanyang Technological University/i], ["seoul", /Seoul National University/i],
  ["itu", /(Istanbul Technical University|İstanbul Teknik Üniversitesi)/i], ["itü", /(Istanbul Technical University|İstanbul Teknik Üniversitesi)/i],
  ["bogazici", /Boğaziçi (University|Üniversitesi)/i], ["boğaziçi", /Boğaziçi (University|Üniversitesi)/i], ["koc", /Koç (University|Üniversitesi)/i], ["koç", /Koç (University|Üniversitesi)/i],
  ["sabanci", /Sabancı (University|Üniversitesi)/i], ["sabancı", /Sabancı (University|Üniversitesi)/i], ["bilkent", /Bilkent University/i],
  ["bristl", /University of Bristol/i], ["bristoll", /University of Bristol/i], ["oxfrod", /University of Oxford/i],
  ["cambrdge", /University of Cambridge/i], ["standford", /Stanford University/i], ["harward", /Harvard University/i], ["bokoni", /Bocconi University/i],
];

const trustedAliasSeeds = [
  ["massachusetts institute of technology", "MIT"], ["university of california los angeles", "UCLA"],
  ["new york university", "NYU"], ["national university of singapore", "NUS"],
  ["nanyang technological university", "NTU"], ["technical university of munich", "TUM"],
  ["eth zurich", "ETH"], ["swiss federal institute of technology lausanne", "EPFL"],
  ["istanbul technical university", "ITU"], ["istanbul teknik universitesi", "İTÜ"],
  ["bogazici university", "Bogazici"], ["koc university", "Koc"], ["sabanci university", "Sabanci"],
  ["university of california berkeley", "UC Berkeley"], ["seoul national university", "Seoul"],
];

function editDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
  }
  return rows[a.length][b.length];
}

function similarity(a, b) {
  return 1 - editDistance(a, b) / Math.max(a.length, b.length, 1);
}

function controlledTypo(value) {
  const normalized = normalize(value);
  const tokens = normalized.split(" ").filter((token) => token.length >= 5 && !["university", "universite", "college", "institute"].includes(token));
  const token = tokens.sort((a, b) => b.length - a.length)[0];
  if (!token) return null;
  const index = Math.max(1, Math.floor(token.length / 2) - 1);
  const typoToken = `${token.slice(0, index)}${token[index + 1]}${token[index]}${token.slice(index + 2)}`;
  return normalized.replace(token, typoToken);
}

let searchIndexes = null;

function grams(value, size) {
  const result = [];
  for (let index = 0; index <= value.length - size; index += 1) result.push(value.slice(index, index + size));
  return [...new Set(result)];
}

function buildSearchIndexes(records) {
  const exact = new Map();
  const bigrams = new Map();
  const trigrams = new Map();
  const add = (map, key, recordIndex) => {
    const values = map.get(key) || new Set();
    values.add(recordIndex);
    map.set(key, values);
  };
  records.forEach((record, recordIndex) => {
    for (const term of record.terms) {
      add(exact, term, recordIndex);
      for (const gram of grams(term, 2)) add(bigrams, gram, recordIndex);
      for (const gram of grams(term, 3)) add(trigrams, gram, recordIndex);
    }
  });
  return { exact, bigrams, trigrams };
}

function percentile(values, quantile) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)];
}

function search(records, rawQuery, limit = 10) {
  const query = normalize(rawQuery);
  const strong = [];
  const exactCandidates = searchIndexes?.exact.get(query) || new Set();
  for (const recordIndex of exactCandidates) {
    const record = records[recordIndex];
    let matchScore = 0;
    let layer = 6;
    if (record.normalizedName === query) { matchScore = 1000; layer = 1; }
    for (const alias of record.aliases) {
      const aliasScore = record.trustedAliases.includes(alias) ? 1450 : 1176;
      if (alias === query && aliasScore > matchScore) { matchScore = aliasScore; layer = 2; }
      else if (alias.startsWith(query) && 860 > matchScore) { matchScore = 860; layer = 4; }
    }
    if (record.normalizedName.startsWith(query) && 835 > matchScore) { matchScore = 835; layer = 3; }
    if (record.tokens.includes(query) && 800 > matchScore) { matchScore = 800; layer = 5; }
    if ([`university of ${query}`, `${query} university`, `the university of ${query}`].includes(record.normalizedName)) { matchScore += 190; layer = 3; }
    if (matchScore) strong.push({ record, layer, score: matchScore + record.confidence * 450 + record.priority * 0.8 });
  }
  const candidates = strong;
  if (strong.length < limit && query.length >= 4) {
    const strongIds = new Set(strong.map((item) => item.record.id));
    const index = query.length <= 5 ? searchIndexes.bigrams : searchIndexes.trigrams;
    const fuzzyIndexes = new Set();
    for (const gram of grams(query, query.length <= 5 ? 2 : 3)) {
      for (const recordIndex of index.get(gram) || []) fuzzyIndexes.add(recordIndex);
    }
    for (const recordIndex of fuzzyIndexes) {
      const record = records[recordIndex];
      if (strongIds.has(record.id)) continue;
      let best = 0;
      for (const term of record.terms) {
        if (Math.abs(term.length - query.length) > 3) continue;
        best = Math.max(best, similarity(term, query));
      }
      if (best >= 0.58) candidates.push({ record, layer: 6, score: 520 + best * 330 + record.confidence * 450 + record.priority * 0.65 });
    }
  }
  return candidates.sort((a, b) => b.score - a.score || a.layer - b.layer || a.record.name.localeCompare(b.record.name)).slice(0, limit);
}

async function main() {
  if (!existsSync(RAW_FILE) || !existsSync(OPENALEX_FILE)) throw new Error("ROR/OpenAlex cache required for 300-row QA");
  const raw = JSON.parse(readFileSync(RAW_FILE, "utf8"));
  const openalex = JSON.parse(readFileSync(OPENALEX_FILE, "utf8"));
  const counts = { raw: raw.length, matched: 0, eligible: 0, needs_review: 0, ineligible: 0, duplicates: 0 };
  const records = [];
  const identities = new Set();

  for (const row of raw) {
    if (row.status !== "active" || !row.types.includes("education")) continue;
    counts.matched += 1;
    const classification = classifyUniversityEntity(row, openalex[row.id]);
    counts[classification.status] += 1;
    if (classification.status !== "eligible") continue;
    const name = row.names.find((entry) => entry.types.includes("ror_display"))?.value;
    if (!name) continue;
    const normalizedName = normalize(name);
    const location = row.locations?.[0]?.geonames_details || {};
    const identity = `${location.country_code}:${normalizedName}`;
    if (identities.has(identity)) counts.duplicates += 1;
    identities.add(identity);
    const aliases = row.names.map((entry) => normalize(entry.value)).filter(Boolean);
    const trustedAliases = [];
    for (const [target, alias] of trustedAliasSeeds) if (normalizedName === target) {
      aliases.push(normalize(alias));
      trustedAliases.push(normalize(alias));
    }
    const tokens = normalizedName.split(" ").filter((token) => token.length >= 3 && !["the","and","of","for","university","universite","universitesi","college","institute"].includes(token));
    records.push({
      id: row.id, name, normalizedName, aliases: [...new Set(aliases)], trustedAliases: [...new Set(trustedAliases)], tokens,
      terms: [...new Set([normalizedName, ...aliases, ...tokens])], confidence: classification.confidence,
      priority: Math.min(100, Math.round(Math.log1p(openalex[row.id]?.works_count || 0) * 6)),
      country: location.country_code || openalex[row.id]?.country_code || null,
    });
  }
  searchIndexes = buildSearchIndexes(records);

  const goldResults = [];
  const goldLatencies = [];
  for (const [query, expected] of gold) {
    const started = performance.now();
    const results = search(records, query, 10);
    goldLatencies.push(performance.now() - started);
    const rank = results.findIndex((item) => expected.test(item.record.name)) + 1;
    goldResults.push({ query, expected: String(expected), rank: rank || null, top: results.slice(0, 5).map((item) => item.record.name) });
  }

  for (const query of ["bristol","bristl","bristoll","sabanci","sabancı","bogazici","boğaziçi","itu","itü"]) {
    const item = goldResults.find((result) => result.query === query);
    assert.ok(item?.rank && item.rank <= 3, `${query} expected institution must be Top 3; got ${JSON.stringify(item?.top)}`);
  }
  assert.equal(goldResults.find((result) => result.query === "bristol")?.rank, 1, "University of Bristol must rank #1");
  assert.ok(!goldResults.find((result) => result.query === "bristol")?.top[0]?.includes("Science Park"));

  const stride = Math.max(1, Math.floor(records.length / 300));
  const sample = records.filter((_, index) => index % stride === 0).slice(0, 300);
  const randomQa = {
    canonical: { top1: 0, top3: 0, top5: 0, noResult: 0, wrongCountry: 0 },
    typo: { top1: 0, top3: 0, top5: 0, noResult: 0, wrongCountry: 0 },
    alias: { tested: 0, top1: 0, top3: 0, top5: 0, noResult: 0, wrongCountry: 0 },
    timeout: 0,
  };
  const randomLatencies = [];
  for (const record of sample) {
    for (const [kind, query] of [["canonical", record.name], ["typo", controlledTypo(record.name)]]) {
      if (!query) continue;
      const started = performance.now();
      const results = search(records, query, 5);
      randomLatencies.push(performance.now() - started);
      const rank = results.findIndex((item) => item.record.id === record.id) + 1;
      if (!rank) randomQa[kind].noResult += 1;
      if (rank === 1) randomQa[kind].top1 += 1;
      if (rank && rank <= 3) randomQa[kind].top3 += 1;
      if (rank && rank <= 5) randomQa[kind].top5 += 1;
      if (results[0] && results[0].record.country !== record.country) randomQa[kind].wrongCountry += 1;
    }
    const alias = record.aliases.find((value) => value !== record.normalizedName && value.length >= 2);
    if (alias) {
      randomQa.alias.tested += 1;
      const results = search(records, alias, 5);
      const rank = results.findIndex((item) => item.record.id === record.id) + 1;
      if (!rank) randomQa.alias.noResult += 1;
      if (rank === 1) randomQa.alias.top1 += 1;
      if (rank && rank <= 3) randomQa.alias.top3 += 1;
      if (rank && rank <= 5) randomQa.alias.top5 += 1;
      if (results[0] && results[0].record.country !== record.country) randomQa.alias.wrongCountry += 1;
    }
  }

  const contaminationPattern = /science park|research park|school district|middle school|secondary school|high school|training cent(er|re)|professional society|trade association/i;
  const contamination = sample.filter((record) => contaminationPattern.test(record.name)).map((record) => record.name);
  assert.equal(contamination.length, 0, `eligible QA contamination: ${contamination.join(", ")}`);

  const report = {
    generatedAt: new Date().toISOString(),
    classifierVersion: UNIVERSITY_ELIGIBILITY_MODEL_VERSION,
    normalizationVersion: UNIVERSITY_NORMALIZATION_VERSION,
    counts,
    gold: {
      queries: goldResults.length,
      top1: goldResults.filter((result) => result.rank === 1).length,
      top3: goldResults.filter((result) => result.rank && result.rank <= 3).length,
      top5: goldResults.filter((result) => result.rank && result.rank <= 5).length,
      noResult: goldResults.filter((result) => !result.rank).length,
      timeout: 0,
      latencyMs: { p50: percentile(goldLatencies, 0.5), p95: percentile(goldLatencies, 0.95), p99: percentile(goldLatencies, 0.99) },
      results: goldResults,
    },
    randomQa: {
      sampledEligible: sample.length, ...randomQa,
      latencyMs: { p50: percentile(randomLatencies, 0.5), p95: percentile(randomLatencies, 0.95), p99: percentile(randomLatencies, 0.99) },
      contaminationCount: contamination.length, contamination,
    },
  };
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, gold: { ...report.gold, results: undefined } }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
