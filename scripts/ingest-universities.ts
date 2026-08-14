import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import isoCountries from "i18n-iso-countries";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SOURCE = "OPENALEX";
const API_ROOT = "https://api.openalex.org";
const PAGE_SIZE = 200;
const WRITE_BATCH_SIZE = 200;
const MAX_RETRIES = 5;
const maxRecordsArg = process.argv.find((value) => value.startsWith("--max="));
const MAX_RECORDS = maxRecordsArg ? Number(maxRecordsArg.split("=")[1]) : Number.POSITIVE_INFINITY;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openAlexApiKey = process.env.OPENALEX_API_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

if (!Number.isFinite(MAX_RECORDS) && maxRecordsArg) {
  throw new Error("--max must be a positive number");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface OpenAlexCountry {
  display_name: string;
  country_code: string;
  display_name_alternatives: string[];
  continent: { display_name: string } | null;
}

interface OpenAlexInstitution {
  id: string;
  ror: string | null;
  display_name: string;
  country_code: string | null;
  type: string;
  homepage_url: string | null;
  display_name_acronyms: string[];
  display_name_alternatives: string[];
  works_count: number;
  geo: {
    city: string | null;
    region: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

interface OpenAlexPage {
  meta: { count: number; next_cursor: string | null };
  results: OpenAlexInstitution[];
}

interface ExistingUniversity {
  id: string;
  external_id: string | null;
  normalized_name: string;
  country_id: string;
  slug: string;
}

interface Counters {
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
  aliases: number;
}

interface AliasCandidate {
  alias: string;
  priority: number;
  source: "OPENALEX_ACRONYM" | "OPENALEX_ALTERNATE_NAME";
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function slugify(value: string) {
  return normalize(value).replace(/\s+/g, "-").slice(0, 140) || "institution";
}

function externalId(value: string) {
  return value.replace(/^https?:\/\/openalex\.org\//i, "");
}

function rorId(value: string | null) {
  return value?.replace(/^https?:\/\/ror\.org\//i, "") || null;
}

async function fetchJson<T>(url: URL, attempt = 0): Promise<T> {
  if (openAlexApiKey) url.searchParams.set("api_key", openAlexApiKey);

  const response = await fetch(url, {
    headers: { "User-Agent": "OriensAcademy/1.0 (institution discovery ingestion)" },
  });

  if (response.ok) return response.json() as Promise<T>;

  if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 500 * 2 ** attempt + Math.floor(Math.random() * 250);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchJson<T>(url, attempt + 1);
  }

  throw new Error(`OpenAlex request failed: ${response.status} ${response.statusText}`);
}

async function loadCountries() {
  const countries: OpenAlexCountry[] = [];
  for (let page = 1; ; page += 1) {
    const url = new URL(`${API_ROOT}/countries`);
    url.searchParams.set("per_page", "200");
    url.searchParams.set("page", String(page));
    const payload = await fetchJson<{ results: OpenAlexCountry[] }>(url);
    countries.push(...payload.results);
    if (payload.results.length < 200) break;
  }

  const usable = countries.flatMap((country) => {
    const iso3 = isoCountries.alpha2ToAlpha3(country.country_code);
    if (!iso3) return [];
    return [{
      iso2: country.country_code,
      iso3,
      name: country.display_name,
      slug: slugify(country.display_name),
      region: country.continent?.display_name || null,
      aliases: Array.from(new Set(country.display_name_alternatives || [])).slice(0, 20),
      active: true,
    }];
  });

  for (let index = 0; index < usable.length; index += WRITE_BATCH_SIZE) {
    const { error } = await supabase.from("countries").upsert(
      usable.slice(index, index + WRITE_BATCH_SIZE),
      { onConflict: "iso2" },
    );
    if (error) throw new Error(`Country upsert failed: ${error.message}`);
  }

  const { data, error } = await supabase.from("countries").select("id,iso2");
  if (error) throw new Error(`Country lookup failed: ${error.message}`);
  return new Map((data || []).map((country) => [country.iso2, country.id]));
}

async function loadExistingUniversities() {
  const existing: ExistingUniversity[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("universities")
      .select("id,external_id,normalized_name,country_id,slug")
      .range(offset, offset + 999);
    if (error) throw new Error(`Existing university lookup failed: ${error.message}`);
    existing.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return existing;
}

function safeAliases(institution: OpenAlexInstitution) {
  const canonical = normalize(institution.display_name);
  const acronyms = (institution.display_name_acronyms || [])
    .filter((value) => /^[A-Z0-9][A-Z0-9.&-]{1,14}$/.test(value));
  const alternatives = (institution.display_name_alternatives || [])
    .filter((value) => value.trim().length >= 4 && value.trim().length <= 160);
  const byNormalizedValue = new Map<string, AliasCandidate>();
  for (const value of acronyms) {
    const normalizedValue = normalize(value);
    if (normalizedValue && normalizedValue !== canonical && !byNormalizedValue.has(normalizedValue)) {
      byNormalizedValue.set(normalizedValue, {
        alias: value.trim(),
        priority: 40,
        source: "OPENALEX_ACRONYM",
      });
    }
  }
  for (const value of alternatives) {
    const normalizedValue = normalize(value);
    if (normalizedValue && normalizedValue !== canonical && !byNormalizedValue.has(normalizedValue)) {
      byNormalizedValue.set(normalizedValue, {
        alias: value.trim(),
        priority: 60,
        source: "OPENALEX_ALTERNATE_NAME",
      });
    }
  }
  return Array.from(byNormalizedValue.values()).slice(0, 20);
}

async function run() {
  const counters: Counters = {
    fetched: 0, inserted: 0, updated: 0, unchanged: 0, skipped: 0, failed: 0, aliases: 0,
  };

  console.log("ORIENS OPENALEX UNIVERSITY INGESTION");
  console.log("Source filter: type=education, has_ror=true");

  const countryIds = await loadCountries();
  const existing = await loadExistingUniversities();
  const byExternalId = new Map(existing.filter((row) => row.external_id).map((row) => [row.external_id!, row]));
  const byCanonical = new Map(existing.map((row) => [`${row.country_id}:${row.normalized_name}`, row]));
  const usedSlugs = new Map(existing.map((row) => [row.slug, row.id]));
  let cursor = "*";
  let page = 0;
  let sourceCount = 0;

  while (cursor && counters.fetched < MAX_RECORDS) {
    const url = new URL(`${API_ROOT}/institutions`);
    url.searchParams.set("filter", "type:education,has_ror:true");
    url.searchParams.set("sort", "works_count:desc");
    url.searchParams.set("per_page", String(PAGE_SIZE));
    url.searchParams.set("cursor", cursor);
    url.searchParams.set("select", "id,ror,display_name,country_code,type,homepage_url,display_name_acronyms,display_name_alternatives,works_count,geo");

    const payload = await fetchJson<OpenAlexPage>(url);
    sourceCount ||= payload.meta.count;
    const pageRows = payload.results.slice(0, Math.max(0, MAX_RECORDS - counters.fetched));
    counters.fetched += pageRows.length;
    page += 1;

    const universityRows: Record<string, unknown>[] = [];
    const pageAliases = new Map<string, AliasCandidate[]>();

    for (const institution of pageRows) {
      const countryId = institution.country_code ? countryIds.get(institution.country_code) : undefined;
      if (!countryId || !institution.ror || institution.type !== "education" || !institution.display_name.trim()) {
        counters.skipped += 1;
        continue;
      }

      const id = externalId(institution.id);
      const normalizedName = normalize(institution.display_name);
      const prior = byExternalId.get(id) || byCanonical.get(`${countryId}:${normalizedName}`);
      let slug = prior?.slug || slugify(institution.display_name);
      const slugOwner = usedSlugs.get(slug);
      if (slugOwner && slugOwner !== prior?.id) slug = `${slug}-${id.toLowerCase()}`;

      const row = {
        id: prior?.id || crypto.randomUUID(),
        name: institution.display_name.trim(),
        normalized_name: normalizedName,
        slug,
        country_id: countryId,
        city: institution.geo?.city || null,
        state_or_region: institution.geo?.region || null,
        website: institution.homepage_url || null,
        admissions_url: null,
        institution_type: "OTHER",
        ranking_value: null,
        popularity_score: Math.min(100, Math.max(0, Math.log10(institution.works_count + 1) * 15)),
        active: true,
        external_source: SOURCE,
        external_id: id,
        ror_id: rorId(institution.ror),
        latitude: institution.geo?.latitude || null,
        longitude: institution.geo?.longitude || null,
      };

      universityRows.push(row);
      pageAliases.set(id, safeAliases(institution));
      usedSlugs.set(slug, prior?.id || id);
      if (prior) counters.updated += 1;
      else counters.inserted += 1;
    }

    for (let index = 0; index < universityRows.length; index += WRITE_BATCH_SIZE) {
      const batch = universityRows.slice(index, index + WRITE_BATCH_SIZE);
      const { error } = await supabase.from("universities").upsert(batch, { onConflict: "id" });
      if (error) {
        counters.failed += batch.length;
        throw new Error(`University upsert failed: ${error.message}`);
      }
    }

    const externalIds = universityRows.map((row) => row.external_id as string);
    if (externalIds.length) {
      const { data: resolved, error } = await supabase
        .from("universities")
        .select("id,external_id")
        .eq("external_source", SOURCE)
        .in("external_id", externalIds);
      if (error) throw new Error(`University identity lookup failed: ${error.message}`);

      const aliasRows = (resolved || []).flatMap((university) =>
        (pageAliases.get(university.external_id) || []).map((candidate) => ({
          entity_type: "UNIVERSITY",
          entity_id: university.id,
          alias: candidate.alias,
          normalized_alias: normalize(candidate.alias),
          language: "und",
          priority: candidate.priority,
          source: candidate.source,
        })),
      );

      for (let index = 0; index < aliasRows.length; index += WRITE_BATCH_SIZE) {
        const batch = aliasRows.slice(index, index + WRITE_BATCH_SIZE);
        const { error: aliasError } = await supabase
          .from("search_aliases")
          .upsert(batch, {
            onConflict: "entity_type,entity_id,normalized_alias",
            ignoreDuplicates: true,
          });
        if (aliasError) throw new Error(`Alias upsert failed: ${aliasError.message}`);
        counters.aliases += batch.length;
      }
    }

    cursor = payload.meta.next_cursor || "";
    console.log(JSON.stringify({ page, sourceCount, ...counters, cursorRemaining: Boolean(cursor) }));
  }

  console.log("INGESTION_COMPLETE " + JSON.stringify({ sourceCount, ...counters }));
}

run().catch((error) => {
  console.error("INGESTION_FAILED", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
