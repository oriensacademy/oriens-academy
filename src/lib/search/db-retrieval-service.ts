import { getSupabaseClient } from "@/lib/supabase/client";
import type { GroupedSearchResults, SearchResultItem, SearchResultType } from "./retrieval-engine";
import { emptySearchResults, retrieveCanonicalExamFallback } from "./canonical-exam-fallback";
import { parseQuery } from "./query-parser";
import { normalizeQuery } from "./query-normalizer";
import { searchCache } from "./search-cache";

type SearchLimits = {
  universities: number;
  programs: number;
  qualifications: number;
  countries: number;
};

interface DatabaseSearchRow {
  entity_id: string;
  entity_type: SearchResultType;
  title: string;
  subtitle: string | null;
  slug: string;
  match_layer: 1 | 2 | 3 | 4 | 5 | 6;
  score: number | string;
  country_iso2: string | null;
  country_name: string | null;
  badge: string | null;
  official_url: string | null;
}

const DEFAULT_LIMITS: SearchLimits = {
  universities: 8,
  programs: 4,
  qualifications: 3,
  countries: 3,
};

// The public search must stay usable when the remote autocomplete RPC is slow
// or unavailable. After this bounded wait the deterministic local index below
// supplies the same canonical exam results.
export const SEARCH_RPC_TIMEOUT_MS = 4_000;
const SEARCH_RPC_FETCH_LIMIT = 10;
const SEARCH_RESULT_CACHE_TTL_MS = 60_000;

function toSearchResult(row: DatabaseSearchRow): SearchResultItem {
  return {
    id: row.entity_id,
    type: row.entity_type,
    title: row.title,
    subtitle: row.subtitle || undefined,
    slug: row.slug,
    score: Math.round(Number(row.score)),
    matchLayer: row.match_layer,
    badge: row.badge || undefined,
    countryIso2: row.country_iso2 || undefined,
    countryName: row.country_name || undefined,
    officialUrl: row.official_url || undefined,
  };
}

export async function retrieveSearchResultsFromDatabase(
  rawQuery: string,
  limits: SearchLimits = DEFAULT_LIMITS,
  signal?: AbortSignal,
): Promise<GroupedSearchResults> {
  const cleanQuery = rawQuery.trim();
  const normalized = normalizeQuery(cleanQuery);

  if (!normalized) return emptySearchResults("");

  const parsedQuery = parseQuery(cleanQuery, { includePredefinedUniversities: false });
  const canonicalExamMatches = retrieveCanonicalExamFallback(cleanQuery).groups.qualifications;
  const countryIso2 = parsedQuery.countries[0]?.iso2 || null;
  const cacheKey = `university-search-v2:${countryIso2 || "ALL"}:${normalized}`;
  const cached = searchCache.get<GroupedSearchResults>(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) throw new DOMException("Search request aborted", "AbortError");
  signal?.addEventListener("abort", abortFromCaller, { once: true });
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const supabase = getSupabaseClient();
    // Supabase's abort signal is advisory, so the race also bounds the wait.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcRequest = (supabase as any)
      .rpc("search_autocomplete_entities_v2", {
        p_query: normalized,
        p_limit: SEARCH_RPC_FETCH_LIMIT,
        p_country_iso2: countryIso2,
      })
      .abortSignal(controller.signal);
    const clientTimeout = new Promise<{ data: null; error: { code: string } }>((resolve) => {
      timeoutId = setTimeout(() => {
        controller.abort("CLIENT_TIMEOUT");
        resolve({ data: null, error: { code: "CLIENT_TIMEOUT" } });
      }, SEARCH_RPC_TIMEOUT_MS);
    });
    const response = await Promise.race([rpcRequest, clientTimeout]);
    if (signal?.aborted) throw new DOMException("Search request aborted", "AbortError");
    if (response.error || !Array.isArray(response.data)) throw response.error || new Error("Invalid search response");

    const rows = (response.data as DatabaseSearchRow[])
      .sort((left, right) => left.match_layer - right.match_layer || Number(right.score) - Number(left.score));

    const grouped = {
      universities: [] as SearchResultItem[],
      programs: [] as SearchResultItem[],
      countries: [] as SearchResultItem[],
      qualifications: [] as SearchResultItem[],
    };

    for (const row of rows) {
      const result = toSearchResult(row);
      if (result.type === "UNIVERSITY" && grouped.universities.length < limits.universities) {
        grouped.universities.push(result);
      } else if (result.type === "PROGRAM" && grouped.programs.length < limits.programs) {
        grouped.programs.push(result);
      } else if (result.type === "COUNTRY" && grouped.countries.length < limits.countries) {
        grouped.countries.push(result);
      } else if (result.type === "QUALIFICATION" && grouped.qualifications.length < limits.qualifications) {
        grouped.qualifications.push(result);
      }
    }

    const qualificationSlugs = new Set(grouped.qualifications.map((item) => item.slug));
    for (const exam of canonicalExamMatches) {
      if (grouped.qualifications.length >= limits.qualifications) break;
      if (!qualificationSlugs.has(exam.slug)) {
        grouped.qualifications.push(exam);
        qualificationSlugs.add(exam.slug);
      }
    }

    const resolvedIntent = parsedQuery.intent === "MIXED" && grouped.universities.length > 0
      ? "UNIVERSITY_SEARCH"
      : parsedQuery.intent;

    const result: GroupedSearchResults = {
      query: cleanQuery,
      intent: resolvedIntent,
      confidence: resolvedIntent === "UNIVERSITY_SEARCH"
        ? Math.max(parsedQuery.confidence, 0.9)
        : parsedQuery.confidence,
      parsedQuery,
      sourceStatus: "database",
      groups: grouped,
      totalCount:
        grouped.universities.length + grouped.programs.length +
        grouped.countries.length + grouped.qualifications.length,
    };
    searchCache.set(cacheKey, result, SEARCH_RESULT_CACHE_TTL_MS);
    return result;
  } catch (error) {
    if (signal?.aborted) throw new DOMException("Search request aborted", "AbortError");
    return retrieveCanonicalExamFallback(cleanQuery);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
