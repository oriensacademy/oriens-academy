#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const service = read("src/lib/search/db-retrieval-service.ts");
const cache = read("src/lib/search/search-cache.ts");
const gooey = read("src/components/ui/gooey-search.tsx");
const discovery = read("src/components/discovery/SearchAutocompleteInput.tsx");
const migration = read("supabase/migrations/20260901140000_optimize_university_search_v2.sql");

assert.equal((service.match(/\.rpc\("search_autocomplete_entities_v2"/g) || []).length, 1, "one primary RPC call");
assert.doesNotMatch(service, /Promise\.allSettled|searchTerms\.map/, "no parallel variant fan-out");
assert.match(service, /SEARCH_RPC_TIMEOUT_MS = 4_000/);
assert.match(service, /signal\?\.aborted.*AbortError/s, "caller abort is distinct");
assert.match(service, /sourceStatus: "database"/);
assert.match(service, /return retrieveCanonicalExamFallback\(cleanQuery\)/, "real failures degrade explicitly");
assert.match(service, /searchCache\.set\(cacheKey, result, SEARCH_RESULT_CACHE_TTL_MS\)/, "only DB success is cached");
assert.match(service, /countryIso2 \|\| "ALL"/, "cache key is country-sensitive");
assert.match(cache, /defaultTTLMs = 1000 \* 60/);
assert.match(cache, /maxEntries = 100/);
for (const component of [gooey, discovery]) {
  assert.match(component, /new AbortController\(\)/);
  assert.match(component, /controller\.abort\(\)/);
  assert.match(component, /error\.name === "AbortError"/);
}
assert.match(gooey, /Searching/);
assert.match(gooey, /No matching results found\./);
assert.match(gooey, /University search is temporarily unavailable/);

assert.equal((migration.match(/security definer/g) || []).length, 3);
assert.doesNotMatch(migration, /security invoker/);
assert.equal((migration.match(/set search_path = public, extensions/g) || []).length, 3);
assert.equal((migration.match(/set plan_cache_mode = force_custom_plan/g) || []).length, 0);
assert.equal((migration.match(/set jit = off/g) || []).length, 3);
assert.match(migration, /language plpgsql[\s\S]*get diagnostics v_returned = row_count;[\s\S]*if v_returned > 0 then\s+return;/);
assert.match(migration, /get diagnostics v_strong_count = row_count;[\s\S]*if v_has_exam or v_strong_count > 0 then\s+return;/);
assert.match(migration, /strong_candidates as materialized/);
assert.match(migration, /fuzzy_candidates as materialized/);
assert.match(migration, /where sm\.strong_count < i\.lim/);
assert.match(migration, /not sm\.exact_term_exists/);
assert.match(migration, /else ''\s+end,\s+least\(10, greatest\(1, i\.lim - sm\.strong_count \+ 4\)\)/);
assert.match(migration, /term_hits as materialized/);
assert.match(migration, /operator\(pg_catalog\.~>=~\)[\s\S]*operator\(pg_catalog\.~<~\)/);
assert.match(migration, /when t\.term_type = 'canonical_token' then 720 \+ 80 \* t\.trust_score/);
assert.match(migration, /operator\(public\.%\)/);
assert.match(migration, /pg_trgm\.similarity_threshold = '0\.45'/);
assert.match(migration, /greatest\(1, least\(coalesce\(p_limit, 10\), 10\)\)/);
assert.ok((migration.match(/eligibility_status = 'eligible'/g) || []).length >= 4);
assert.ok((migration.match(/manual_eligibility_override = 'eligible'/g) || []).length >= 4);
assert.match(migration, /idx_university_search_terms_prefix_cover_v2/);
assert.match(migration, /'LSE', 'lse'/);
assert.match(migration, /on conflict \(entity_type, entity_id, normalized_alias\) do update/);
assert.match(migration, /0090zs177/, "LSE must target the audited London ROR identity");
assert.doesNotMatch(migration, /delete\s+from\s+public\.(universities|search_aliases)/i);
assert.doesNotMatch(migration, /disable row level security/i);

const mainBody = migration.slice(
  migration.indexOf("create or replace function public.search_autocomplete_entities_v2"),
  migration.indexOf("alter function public.search_university_strong_candidates_v2"),
);
assert.equal(
  (mainBody.match(/public\.search_university_strong_candidates_v2\(/g) || []).length,
  1,
  "main RPC computes strong candidates once",
);

console.log("University search final architecture regression: PASS");
