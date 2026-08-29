#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import isoCountries from "i18n-iso-countries";

const ROOT = resolve(import.meta.dirname, "..");
const CACHE_DIR = join(ROOT, ".cache", "universities");
const DATA_DIR = join(ROOT, "data", "universities");
const ZENODO_CONCEPT_API = "https://zenodo.org/api/records/6347574";
const OPENALEX_API = "https://api.openalex.org/institutions";
const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const SKIP_OPENALEX = args.has("--skip-openalex");
const FINALIZE_ONLY = args.has("--finalize-only");

mkdirSync(CACHE_DIR, { recursive: true });
mkdirSync(DATA_DIR, { recursive: true });
loadEnv(join(ROOT, ".env.local"));

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function slugify(value) {
  return normalize(value).replace(/\s+/g, "-").slice(0, 120) || "institution";
}

function deterministicUuid(value) {
  const hex = createHash("sha256").update(value).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function fetchJson(url, options = {}, retries = 5) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { "User-Agent": "OriensAcademy-UniversitySync/1.0", ...(options.headers || {}) },
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status} for ${url}`);
        if (response.status < 500 && response.status !== 429) throw error;
        throw error;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await delay(Math.min(10_000, 500 * 2 ** attempt));
    }
  }
  throw lastError;
}

async function download(url, target, expectedSize) {
  if (existsSync(target) && (!expectedSize || statSync(target).size === expectedSize)) return;
  const temporary = `${target}.partial`;
  const response = await fetch(url, { headers: { "User-Agent": "OriensAcademy-UniversitySync/1.0" } });
  if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status}`);
  await pipeline(response.body, createWriteStream(temporary));
  if (expectedSize && statSync(temporary).size !== expectedSize) throw new Error("Downloaded ROR archive size mismatch");
  renameSync(temporary, target);
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function chunk(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function nameEntry(record, type) {
  return record.names.find((name) => name.types.includes(type));
}

function externalId(record, type) {
  const entry = record.external_ids.find((item) => item.type === type);
  return entry?.preferred || entry?.all?.[0] || null;
}

function classify(record) {
  const display = nameEntry(record, "ror_display")?.value || "";
  const lower = display.toLowerCase();
  const isEducation = record.status === "active" && record.types.includes("education");
  if (!isEducation) return { eligible: false, reason: record.status !== "active" ? "inactive" : "not_education" };

  const obviousHealthcare = /\b(hospital|clinic|health system|medical cent(?:er|re))\b/i;
  if (obviousHealthcare.test(lower)) return { eligible: false, reason: "healthcare_entity" };
  const obviousNonUniversity = /\b(academy of sciences|national laboratory|research cent(?:er|re)|research institute|observatory|museum)\b/i;
  const higherEducationEvidence = /\b(university|college|polytechnic|business school|graduate school|faculty|hochschule|universit[a-zà-ſ]*|universidad|universidade|universiteit|universitet|universitas|institute of technology|institut.*technolog|ecole|école|conservator)/i;
  if (obviousNonUniversity.test(lower) && !higherEducationEvidence.test(lower.replace(/university hospital/g, "hospital"))) {
    return { eligible: false, reason: "obvious_non_university_education_entity" };
  }
  return { eligible: true, reason: "ror_active_education" };
}

function transformRor(record, openalex) {
  const displayEntry = nameEntry(record, "ror_display");
  const canonicalName = displayEntry?.value?.trim();
  const location = record.locations[0]?.geonames_details || {};
  const rorId = record.id;
  const rorKey = rorId.split("/").pop();
  const names = record.names.map((entry) => entry.value.trim()).filter(Boolean);
  const deterministicVariants = canonicalName.startsWith("The ") ? [canonicalName.slice(4)] : [];
  const aliases = [...new Set([...names.filter((value) => value !== canonicalName), ...deterministicVariants])].sort((a, b) => a.localeCompare(b));
  const nativeName = record.names.find((entry) => entry.lang && entry.lang !== "en" && entry.types.includes("label"))?.value || null;
  const website = record.links.find((link) => link.type === "website")?.value || null;
  const wikidataId = externalId(record, "wikidata");
  const iso2 = String(location.country_code || openalex?.country_code || "").toUpperCase();
  const iso3 = isoCountries.alpha2ToAlpha3(iso2) || null;

  return {
    id: deterministicUuid(`ror:${rorId}`),
    ror_id: rorId,
    openalex_id: openalex?.id || null,
    wikidata_id: wikidataId,
    name: canonicalName,
    normalized_name: normalize(canonicalName),
    native_name: nativeName,
    aliases,
    slug: `${slugify(canonicalName)}-${rorKey}`,
    iso2,
    iso3,
    country_name: location.country_name || openalex?.geo?.country || null,
    city: location.name || openalex?.geo?.city || null,
    state_or_region: location.country_subdivision_name || openalex?.geo?.region || null,
    latitude: location.lat ?? openalex?.geo?.latitude ?? null,
    longitude: location.lng ?? openalex?.geo?.longitude ?? null,
    website,
    institution_type: "OTHER",
    research_works_count: openalex?.works_count ?? null,
    research_cited_by_count: openalex?.cited_by_count ?? null,
    verified_url: Boolean(website),
    search_priority: Math.min(100, Math.round(Math.log1p(openalex?.works_count || 0) * 6)),
    source_metadata: {
      canonical_source: "ROR",
      source_version: null,
      ror_types: record.types,
      ror_status: record.status,
      classification: { eligible: true, evidence: ["ROR type: education", openalex ? `OpenAlex type: ${openalex.type}` : "OpenAlex: unmatched"] },
      ror_last_modified: record.admin?.last_modified?.date || null,
      official_domain_evidence: record.domains || [],
      source_links: record.links,
      openalex_snapshot: openalex ? { id: openalex.id, type: openalex.type } : null,
      wikidata_id: wikidataId,
    },
  };
}

async function enrichOpenAlex(records) {
  const cacheFile = join(CACHE_DIR, "openalex-by-ror.json");
  const cached = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, "utf8")) : {};
  const missing = records.map((record) => record.id).filter((id) => !(id in cached));
  const batches = chunk(missing, 50);
  console.log(`OpenAlex: ${Object.keys(cached).length} cached, ${missing.length} missing, ${batches.length} batches`);

  for (let groupIndex = 0; groupIndex < batches.length; groupIndex += 4) {
    const group = batches.slice(groupIndex, groupIndex + 4);
    const results = await Promise.all(group.map(async (ids) => {
      const filter = ids.join("|");
      const params = new URLSearchParams({
        filter: `ror:${filter}`,
        "per-page": "100",
        select: "id,ror,display_name,country_code,type,works_count,cited_by_count,geo",
      });
      if (process.env.OPENALEX_API_KEY) params.set("api_key", process.env.OPENALEX_API_KEY);
      if (process.env.OPENALEX_MAILTO) params.set("mailto", process.env.OPENALEX_MAILTO);
      return fetchJson(`${OPENALEX_API}?${params}`);
    }));
    for (let batchIndex = 0; batchIndex < group.length; batchIndex += 1) {
      for (const id of group[batchIndex]) cached[id] = null;
      for (const item of results[batchIndex].results || []) if (item.ror) cached[item.ror] = item;
    }
    if (groupIndex % 40 === 0 || groupIndex + 4 >= batches.length) {
      writeFileSync(cacheFile, JSON.stringify(cached));
      console.log(`OpenAlex progress: ${Math.min(groupIndex + 4, batches.length)}/${batches.length}`);
    }
    await delay(400);
  }
  return cached;
}

async function fetchAll(supabase, table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function upsertBatches(supabase, table, rows, options, batchSize = 250) {
  let completed = 0;
  for (const batch of chunk(rows, batchSize)) {
    const { error } = await supabase.from(table).upsert(batch, options);
    if (error) throw new Error(`${table} upsert failed after ${completed}: ${error.message}`);
    completed += batch.length;
    if (completed % 5000 === 0 || completed === rows.length) console.log(`${table}: ${completed}/${rows.length}`);
  }
}

async function markDisappearedForReview(supabase, rows, batchSize = 250) {
  for (const batch of chunk(rows, batchSize)) {
    const { error } = await supabase.from("universities")
      .update({ source_review_required: true, active: false })
      .in("id", batch.map((row) => row.id));
    if (error) throw new Error(`universities review update failed: ${error.message}`);
  }
}

async function applyCatalog(universities, manifest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("--apply requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const countryRows = [...new Map(universities.filter((u) => u.iso2 && u.iso3).map((u) => [u.iso2, {
    iso2: u.iso2,
    iso3: u.iso3,
    name: u.country_name || u.iso2,
    slug: slugify(u.country_name || u.iso2),
    region: null,
    aliases: [],
    active: true,
  }])).values()];
  if (!FINALIZE_ONLY) await upsertBatches(supabase, "countries", countryRows, { onConflict: "iso2", ignoreDuplicates: false }, 200);
  const countries = await fetchAll(supabase, "countries", "id,iso2,iso3,name");
  const countryByIso2 = new Map(countries.map((country) => [country.iso2, country]));
  const existing = await fetchAll(supabase, "universities", "id,ror_id,normalized_name,country_id,slug,website,admissions_url,verified_url,verified_at,search_priority,country_display_rank_override,featured_override_verified");
  const existingByRor = new Map(existing.filter((row) => row.ror_id).map((row) => [row.ror_id, row]));
  const existingByNameCountry = new Map(existing.map((row) => [`${row.country_id}:${row.normalized_name}`, row]));
  let duplicateMerges = 0;

  const dbRows = universities.map((university) => {
    const country = countryByIso2.get(university.iso2);
    if (!country) return null;
    const existingRow = existingByRor.get(university.ror_id) || existingByNameCountry.get(`${country.id}:${university.normalized_name}`);
    if (existingRow && !existingRow.ror_id) duplicateMerges += 1;
    const urlConflict = Boolean(existingRow?.website && university.website && existingRow.website !== university.website);
    return {
      id: existingRow?.id || university.id,
      ror_id: university.ror_id,
      openalex_id: university.openalex_id,
      wikidata_id: university.wikidata_id,
      name: university.name,
      normalized_name: university.normalized_name,
      native_name: university.native_name,
      aliases: university.aliases,
      slug: existingRow?.slug || university.slug,
      country_id: country.id,
      city: university.city,
      state_or_region: university.state_or_region,
      latitude: university.latitude,
      longitude: university.longitude,
      website: existingRow?.website || university.website,
      admissions_url: existingRow?.admissions_url || null,
      institution_type: "OTHER",
      research_works_count: university.research_works_count,
      research_cited_by_count: university.research_cited_by_count,
      verified_url: Boolean(existingRow?.verified_url || existingRow?.website || university.verified_url),
      verified_at: existingRow?.verified_at || (university.verified_url ? manifest.source_date : null),
      search_priority: Math.max(existingRow?.search_priority || 0, university.search_priority),
      country_display_rank_override: existingRow?.country_display_rank_override || null,
      featured_override_verified: existingRow?.featured_override_verified || false,
      source_metadata: { ...university.source_metadata, source_version: manifest.source_version, url_conflict: urlConflict },
      source_last_seen_at: manifest.retrieved_at,
      source_review_required: urlConflict,
      active: true,
    };
  }).filter(Boolean);
  if (!FINALIZE_ONLY) await upsertBatches(supabase, "universities", dbRows, { onConflict: "id", ignoreDuplicates: false }, 250);

  const imported = await fetchAll(supabase, "universities", "id,ror_id,name,normalized_name,country_id");
  const importedByRor = new Map(imported.filter((row) => row.ror_id).map((row) => [row.ror_id, row]));
  const aliases = [];
  for (const university of universities) {
    const dbUniversity = importedByRor.get(university.ror_id);
    if (!dbUniversity) continue;
    for (const alias of university.aliases) {
      const normalizedAlias = normalize(alias);
      if (!normalizedAlias || normalizedAlias === university.normalized_name) continue;
      aliases.push({
        entity_type: "UNIVERSITY",
        entity_id: dbUniversity.id,
        alias,
        normalized_alias: normalizedAlias,
        language: "und",
        priority: alias.length <= 12 && alias === alias.toUpperCase() ? 90 : 70,
        source: `ROR_${manifest.source_version.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}`,
      });
    }
  }
  const uniqueAliases = [...new Map(aliases.map((alias) => [`${alias.entity_id}:${alias.normalized_alias}`, alias])).values()];
  if (!FINALIZE_ONLY) await upsertBatches(supabase, "search_aliases", uniqueAliases, { onConflict: "entity_type,entity_id,normalized_alias", ignoreDuplicates: false }, 500);

  const currentRorIds = new Set(universities.map((university) => university.ror_id));
  const disappeared = existing.filter((row) => row.ror_id && !currentRorIds.has(row.ror_id)).map((row) => ({ id: row.id, source_review_required: true, active: false }));
  if (disappeared.length) await markDisappearedForReview(supabase, disappeared);

  const { error: rankError } = await supabase.rpc("refresh_university_featured_ranks");
  if (rankError) throw rankError;
  const requirementsFile = join(DATA_DIR, "verified-admission-requirements.json");
  if (existsSync(requirementsFile)) await applyRequirements(supabase, imported, JSON.parse(readFileSync(requirementsFile, "utf8")));

  manifest.imported_record_count = dbRows.length;
  manifest.duplicate_merge_count = duplicateMerges;
  manifest.disappeared_records_marked_for_review = disappeared.length;
  const { error: runError } = await supabase.from("university_catalog_import_runs").upsert({
    source: manifest.source,
    source_version: manifest.source_version,
    source_date: manifest.source_date,
    license: manifest.license,
    retrieved_at: manifest.retrieved_at,
    raw_record_count: manifest.raw_record_count,
    eligible_record_count: manifest.eligible_record_count,
    imported_record_count: manifest.imported_record_count,
    rejected_record_count: manifest.rejected_record_count,
    duplicate_merge_count: duplicateMerges,
    openalex_match_count: manifest.openalex_match_count,
    manifest,
  }, { onConflict: "source,source_version" });
  if (runError) throw runError;
}

async function applyRequirements(supabase, universities, requirements) {
  const byIdentity = new Map(universities.map((university) => [university.ror_id, university]));
  const rows = requirements.map((requirement) => {
    const university = byIdentity.get(requirement.ror_id);
    if (!university) return null;
    return {
      id: deterministicUuid(`requirement:${requirement.ror_id}:${requirement.exam_code}:${requirement.scope}:${requirement.programme_name || ""}:${requirement.admissions_cycle || ""}`),
      university_id: university.id,
      exam_code: requirement.exam_code,
      status: requirement.status,
      scope: requirement.scope,
      programme_name: requirement.programme_name || null,
      academic_year: requirement.academic_year || null,
      admissions_cycle: requirement.admissions_cycle || null,
      summary_tr: requirement.summary_tr,
      summary_en: requirement.summary_en,
      official_source_url: requirement.official_source_url,
      source_title: requirement.source_title,
      verified_at: requirement.verified_at,
      expires_at: requirement.expires_at || null,
      confidence: "verified",
      source_excerpt: requirement.source_excerpt || null,
    };
  }).filter(Boolean);
  await upsertBatches(supabase, "university_admission_requirements", rows, { onConflict: "id", ignoreDuplicates: false }, 100);
}

async function main() {
  const zenodo = await fetchJson(ZENODO_CONCEPT_API);
  const archive = zenodo.files.find((file) => /v2\..*-ror-data\.zip$/i.test(file.key));
  if (!archive) throw new Error("Latest ROR v2 archive not found in Zenodo record");
  const sourceVersion = archive.key.match(/^(v[^-]+)-/)?.[1] || String(zenodo.id);
  const sourceDate = archive.key.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || zenodo.updated?.slice(0, 10);
  const zipPath = join(CACHE_DIR, archive.key);
  await download(archive.links.self, zipPath, archive.size);
  const jsonName = archive.key.replace(/\.zip$/, ".json");
  const jsonPath = join(CACHE_DIR, jsonName);
  if (!existsSync(jsonPath)) {
    const extracted = spawnSync("tar", ["-xf", zipPath, "-C", CACHE_DIR, jsonName], { stdio: "inherit" });
    if (extracted.status !== 0) throw new Error("Could not extract ROR JSON archive");
  }

  const raw = JSON.parse(readFileSync(jsonPath, "utf8"));
  const eligibleRor = [];
  const rejectionCounts = {};
  for (const record of raw) {
    const classification = classify(record);
    if (classification.eligible) eligibleRor.push(record);
    else rejectionCounts[classification.reason] = (rejectionCounts[classification.reason] || 0) + 1;
  }
  const openalexByRor = SKIP_OPENALEX ? {} : await enrichOpenAlex(eligibleRor);
  const transformed = eligibleRor.map((record) => transformRor(record, openalexByRor[record.id])).filter((record) => record.name && record.iso2 && record.iso3);
  const missingCountry = eligibleRor.length - transformed.length;
  if (missingCountry) rejectionCounts.missing_iso_country = missingCountry;
  const retrievedAt = new Date().toISOString();
  const manifest = {
    source: "Research Organization Registry (ROR)",
    source_version: sourceVersion,
    source_date: sourceDate,
    license: "CC0 1.0 Universal",
    retrieved_at: retrievedAt,
    source_url: archive.links.self,
    raw_record_count: raw.length,
    eligible_record_count: transformed.length,
    rejected_record_count: raw.length - transformed.length,
    rejection_counts: rejectionCounts,
    imported_record_count: APPLY ? 0 : null,
    duplicate_merge_count: APPLY ? 0 : null,
    openalex_source: "OpenAlex Institutions API",
    openalex_license: "CC0",
    openalex_match_count: transformed.filter((record) => record.openalex_id).length,
    wikidata_match_count: transformed.filter((record) => record.wikidata_id).length,
    official_url_count: transformed.filter((record) => record.website).length,
    countries_represented: new Set(transformed.map((record) => record.iso2)).size,
    alias_count: transformed.reduce((sum, record) => sum + record.aliases.length, 0),
    filtering_method: "active ROR education records, excluding obvious hospitals/clinics and non-university research entities",
  };

  if (APPLY) await applyCatalog(transformed, manifest);
  writeFileSync(join(DATA_DIR, "source-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const fixture = transformed.filter((record, index, all) => all.findIndex((candidate) => candidate.iso2 === record.iso2) === index).slice(0, 30);
  writeFileSync(join(DATA_DIR, "fixture.json"), `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
