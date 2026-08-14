import { getSupabaseClient } from "@/lib/supabase/client";
import type { GroupedSearchResults, SearchResultItem, SearchResultType } from "./retrieval-engine";
import { parseQuery } from "./query-parser";
import { normalizeQuery } from "./query-normalizer";

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
  match_layer: 1 | 2 | 3 | 4;
  score: number | string;
  country_iso2: string | null;
  country_name: string | null;
  badge: string | null;
  official_url: string | null;
}

const DEFAULT_LIMITS: SearchLimits = {
  universities: 5,
  programs: 4,
  qualifications: 3,
  countries: 3,
};

function emptyResults(rawQuery: string): GroupedSearchResults {
  const parsedQuery = parseQuery(rawQuery, { includePredefinedUniversities: false });

  return {
    query: rawQuery,
    intent: parsedQuery.intent,
    confidence: parsedQuery.confidence,
    parsedQuery,
    groups: {
      universities: [],
      programs: [],
      countries: [],
      qualifications: [],
    },
    totalCount: 0,
  };
}

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
): Promise<GroupedSearchResults> {
  const cleanQuery = rawQuery.trim();
  const normalized = normalizeQuery(cleanQuery);

  if (!normalized) return emptyResults("");

  // Production retrieval must not use the legacy in-memory university fixture;
  // university identity and ranking come exclusively from PostgreSQL rows.
  const parsedQuery = parseQuery(cleanQuery, { includePredefinedUniversities: false });
  const perTypeLimit = Math.max(
    limits.universities,
    limits.programs,
    limits.qualifications,
    limits.countries,
  );

  const recognizedTerms = [
    ...parsedQuery.universities.map((entity) => entity.matchedTerm),
    // Country matches may be recognized via a Turkish alias or a fuzzy match
    // (e.g. "amerika" -> United States) whose raw text won't appear in the
    // database's English-language rows. Search on the canonical English name
    // too so the recognized country still resolves to a real result.
    ...parsedQuery.countries.flatMap((entity) => [entity.matchedTerm, entity.name]),
    ...parsedQuery.qualifications.map((entity) => entity.code || entity.matchedTerm),
    ...parsedQuery.fieldsOfStudy.map((entity) => entity.matchedTerm),
    ...parsedQuery.programs.map((entity) => entity.matchedTerm),
  ];
  const normalizedRecognizedTerms = recognizedTerms.map(normalizeQuery).filter(Boolean);
  const residualTerm = normalizedRecognizedTerms
    .reduce((remaining, term) => remaining.replace(new RegExp(`(?:^|\\s)${escapeRegExp(term)}(?=\\s|$)`, "g"), " "), normalized)
    .replace(/\s+/g, " ")
    .trim();
  const searchTerms = [...new Set([
    normalized,
    ...normalizedRecognizedTerms,
    residualTerm,
  ].filter(Boolean))];

  // Each RPC is bounded and ranked inside PostgreSQL. Recognized entity terms
  // are queried separately so natural-language input can still return its real
  // country/qualification rows without treating the entire sentence as a name.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseClient() as any;
  const responses = await Promise.all(searchTerms.map((term) =>
    supabase.rpc("search_autocomplete_entities", {
      p_query: term,
      p_limit: perTypeLimit,
    })
  ));

  const failedResponse = responses.find((response) => response.error);
  if (failedResponse?.error) {
    throw new Error("Search database query failed", { cause: failedResponse.error });
  }

  const rowsByEntity = new Map<string, DatabaseSearchRow>();
  const matchedTermsByEntity = new Map<string, Set<string>>();
  for (let responseIndex = 0; responseIndex < responses.length; responseIndex++) {
    const response = responses[responseIndex];
    for (const row of (response.data || []) as DatabaseSearchRow[]) {
      const key = `${row.entity_type}:${row.entity_id}`;
      const matchedTerms = matchedTermsByEntity.get(key) || new Set<string>();
      matchedTerms.add(searchTerms[responseIndex]);
      matchedTermsByEntity.set(key, matchedTerms);
      const previous = rowsByEntity.get(key);
      if (!previous
        || row.match_layer < previous.match_layer
        || (row.match_layer === previous.match_layer && Number(row.score) > Number(previous.score))) {
        rowsByEntity.set(key, row);
      }
    }
  }

  const hasStructuredEntity = parsedQuery.countries.length > 0 || parsedQuery.qualifications.length > 0;
  const hasUniversityEntity = parsedQuery.universities.length > 0;
  const explicitUniversity = residualTerm
    ? [...rowsByEntity.values()]
      .filter((row) => row.entity_type === "UNIVERSITY" && matchedTermsByEntity.get(`UNIVERSITY:${row.entity_id}`)?.has(residualTerm))
      .sort((left, right) => left.match_layer - right.match_layer || Number(right.score) - Number(left.score))[0]
    : undefined;
  const countryIso2 = parsedQuery.countries[0]?.iso2;
  const fieldTerms = new Set(parsedQuery.fieldsOfStudy.map((entity) => normalizeQuery(entity.matchedTerm)));
  const rows = [...rowsByEntity.values()]
    .filter((row) => {
      if (row.entity_type === "PROGRAM") {
        const rowTerms = matchedTermsByEntity.get(`PROGRAM:${row.entity_id}`);
        if (fieldTerms.size > 0 && ![...fieldTerms].some((term) => rowTerms?.has(term))) return false;
        if (explicitUniversity && !row.subtitle?.toLowerCase().startsWith(explicitUniversity.title.toLowerCase())) return false;
        if (countryIso2 && row.country_iso2 !== countryIso2) return false;
      }
      if (row.entity_type !== "UNIVERSITY") return true;
      // Country/qualification/admission language must not be presented as an
      // unrelated university-name fuzzy match. University candidates remain
      // available for explicit university discovery queries.
      return !hasStructuredEntity || hasUniversityEntity;
    })
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

  const resolvedIntent = parsedQuery.intent === "MIXED" && grouped.universities.length > 0
    ? "UNIVERSITY_SEARCH"
    : parsedQuery.intent;

  return {
    query: cleanQuery,
    intent: resolvedIntent,
    confidence: resolvedIntent === "UNIVERSITY_SEARCH"
      ? Math.max(parsedQuery.confidence, 0.9)
      : parsedQuery.confidence,
    parsedQuery,
    groups: grouped,
    totalCount:
      grouped.universities.length
      + grouped.programs.length
      + grouped.countries.length
      + grouped.qualifications.length,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
