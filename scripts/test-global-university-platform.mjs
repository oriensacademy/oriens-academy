#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(import.meta.dirname, "..");

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function percentile(values, value) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))] || 0;
}

function typo(name) {
  const words = name.split(/\s+/).filter((word) => word.length >= 6).sort((a, b) => b.length - a.length);
  const word = words[0] || name;
  const index = Math.max(1, Math.floor(word.length / 2) - 1);
  const misspelled = `${word.slice(0, index)}${word[index + 1]}${word[index]}${word.slice(index + 2)}`;
  return name.replace(word, misspelled);
}

async function fetchAll(client, table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select(columns).order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function concurrentMap(values, concurrency, mapper) {
  const results = new Array(values.length);
  let next = 0;
  async function worker() {
    while (next < values.length) {
      const index = next++;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

async function main() {
  loadEnv(join(ROOT, ".env.local"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment is required");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [universities, countries, aliases] = await Promise.all([
    fetchAll(client, "universities", "id,name,country_id,ror_id,openalex_id,wikidata_id,website,verified_url,featured_country_rank,active"),
    fetchAll(client, "countries", "id,iso2,iso3,name,active"),
    fetchAll(client, "search_aliases", "entity_id,alias,entity_type"),
  ]);
  const activeUniversities = universities.filter((row) => row.active);
  const countsByCountry = new Map();
  for (const university of activeUniversities) countsByCountry.set(university.country_id, (countsByCountry.get(university.country_id) || 0) + 1);

  const geojson = JSON.parse(readFileSync(join(ROOT, "public", "data", "world-countries-110m.geojson"), "utf8"));
  const recognizedIso3 = [...new Set(geojson.features.map((feature) => feature.properties?.ADM0_A3).filter((code) => /^[A-Z]{3}$/.test(code)))];
  const mapResults = await concurrentMap(recognizedIso3, 12, async (iso3) => {
    const { data, error } = await client.rpc("get_featured_universities_by_country", { p_iso3: iso3 });
    if (error) throw error;
    const country = countries.find((candidate) => candidate.iso3 === iso3);
    const eligible = country ? countsByCountry.get(country.id) || 0 : 0;
    const expected = Math.min(3, eligible);
    const leak = (data || []).some((row) => row.country_iso3 !== iso3);
    return { iso3, state: data?.length ? "FEATURED_UNIVERSITIES" : "NO_DIRECT_MATCH_GUIDANCE", returned: data?.length || 0, expected, leak };
  });

  const deterministic = [...activeUniversities]
    .sort((left, right) => createHash("sha256").update(left.ror_id || left.id).digest("hex").localeCompare(createHash("sha256").update(right.ror_id || right.id).digest("hex")));
  const sampled = [];
  const usedCountries = new Set();
  for (const university of deterministic) {
    if (!usedCountries.has(university.country_id)) {
      sampled.push(university);
      usedCountries.add(university.country_id);
    }
    if (sampled.length === 100) break;
  }
  for (const university of deterministic) if (sampled.length < 100 && !sampled.some((row) => row.id === university.id)) sampled.push(university);
  const aliasesByUniversity = new Map();
  for (const alias of aliases) if (alias.entity_type === "UNIVERSITY") {
    const values = aliasesByUniversity.get(alias.entity_id) || [];
    values.push(alias.alias);
    aliasesByUniversity.set(alias.entity_id, values);
  }

  const searchCases = sampled.flatMap((university) => {
    const availableAliases = (aliasesByUniversity.get(university.id) || []).filter((alias) => alias.length >= 3);
    return [
      { kind: "canonical", query: university.name, target: university.id },
      ...(availableAliases[0] ? [{ kind: "alias", query: availableAliases[0], target: university.id }] : []),
      { kind: "typo", query: typo(university.name), target: university.id },
    ];
  });
  const searchLatencies = [];
  const searchResults = await concurrentMap(searchCases, 4, async (testCase) => {
    const started = performance.now();
    const { data, error } = await client.rpc("search_autocomplete_entities", { p_query: testCase.query, p_limit: 5 });
    searchLatencies.push(performance.now() - started);
    if (error) throw new Error(`Search failed for ${testCase.kind} query "${testCase.query}": ${error.message}`);
    const universityRows = (data || []).filter((row) => row.entity_type === "UNIVERSITY");
    return { ...testCase, top1: universityRows[0]?.entity_id === testCase.target, top5: universityRows.some((row) => row.entity_id === testCase.target) };
  });

  const examQueries = ["IB", "International Baccalaureate", "AP", "IGCSE", "A Level", "SAT", "ACT", "ESAT", "TMUA", "TARA", "UCAT", "UKCAT", "LNAT", "IMAT", "GAMSAT", "MCAT", "LSAT", "GRE", "GMAT", "OMPT"];
  const examResults = await concurrentMap(examQueries, 8, async (query) => {
    const { data, error } = await client.rpc("search_autocomplete_entities", { p_query: query, p_limit: 5 });
    if (error) throw error;
    return { query, pass: (data || []).some((row) => row.entity_type === "QUALIFICATION") };
  });

  const { data: requirements, error: requirementError } = await client.from("university_admission_requirements").select("id,confidence,official_source_url,verified_at,expires_at");
  if (requirementError) throw requirementError;
  const { data: testimonials, error: testimonialError } = await client.from("testimonials").select("id,source_hash,imported_from_source,source_import_id");
  if (testimonialError) throw testimonialError;

  const top1 = searchResults.filter((result) => result.top1).length / searchResults.length;
  const top5 = searchResults.filter((result) => result.top5).length / searchResults.length;
  const accuracyByKind = Object.fromEntries(["canonical", "alias", "typo"].map((kind) => {
    const cases = searchResults.filter((result) => result.kind === kind);
    return [kind, {
      cases: cases.length,
      top_1_accuracy: cases.filter((result) => result.top1).length / cases.length,
      top_5_accuracy: cases.filter((result) => result.top5).length / cases.length,
    }];
  }));
  const report = {
    university_count: activeUniversities.length,
    country_count: new Set(activeUniversities.map((row) => row.country_id)).size,
    alias_count: aliases.filter((row) => row.entity_type === "UNIVERSITY").length,
    verified_official_urls: activeUniversities.filter((row) => row.verified_url && row.website).length,
    openalex_matched: activeUniversities.filter((row) => row.openalex_id).length,
    wikidata_matched: activeUniversities.filter((row) => row.wikidata_id).length,
    recognized_map_countries: recognizedIso3.length,
    countries_with_at_least_3: countries.filter((country) => (countsByCountry.get(country.id) || 0) >= 3).length,
    countries_with_exactly_3_featured: mapResults.filter((result) => result.expected === 3 && result.returned === 3).length,
    countries_with_fewer_than_3: mapResults.filter((result) => result.expected < 3).length,
    countries_with_zero_universities: mapResults.filter((result) => result.expected === 0).length,
    blank_response_states: mapResults.filter((result) => !result.state).length,
    featured_count_failures: mapResults.filter((result) => result.returned !== result.expected),
    cross_country_leak_failures: mapResults.filter((result) => result.leak),
    randomized_universities: sampled.length,
    randomized_search_cases: searchResults.length,
    top_1_accuracy: top1,
    top_5_accuracy: top5,
    accuracy_by_kind: accuracyByKind,
    search_failures_sample: searchResults.filter((result) => !result.top5).slice(0, 20),
    p50_latency_ms: Math.round(percentile(searchLatencies, 0.5)),
    p95_latency_ms: Math.round(percentile(searchLatencies, 0.95)),
    exam_regression_failures: examResults.filter((result) => !result.pass),
    requirements_total: requirements.length,
    requirements_verified: requirements.filter((row) => row.confidence === "verified").length,
    requirements_invalid_source: requirements.filter((row) => !String(row.official_source_url).startsWith("https://")),
    testimonials_total: testimonials.length,
    testimonial_source_hashes: testimonials.filter((row) => row.source_hash).length,
    testimonial_duplicate_hashes: testimonials.filter((row) => row.source_hash).length - new Set(testimonials.map((row) => row.source_hash).filter(Boolean)).size,
  };
  const output = join(ROOT, ".cache", "universities", "qa-results.json");
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (report.blank_response_states || report.featured_count_failures.length || report.cross_country_leak_failures.length || report.exam_regression_failures.length || top5 < 0.95) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
