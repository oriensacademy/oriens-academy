import { canonicalExams } from "@/content/canonical-exams";
import type { GroupedSearchResults, SearchResultItem } from "./retrieval-engine";
import { normalizeQuery } from "./query-normalizer";
import { parseQuery } from "./query-parser";

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

export function emptySearchResults(rawQuery = ""): GroupedSearchResults {
  const parsedQuery = parseQuery(rawQuery, { includePredefinedUniversities: false });
  return {
    query: rawQuery,
    intent: parsedQuery.intent,
    confidence: parsedQuery.confidence,
    parsedQuery,
    groups: { universities: [], programs: [], countries: [], qualifications: [] },
    totalCount: 0,
  };
}

/**
 * Small, canonical-only degradation path. It deliberately contains no
 * university records, so a database outage cannot silently replace the
 * worldwide database with a competing client-side corpus.
 */
export function retrieveCanonicalExamFallback(rawQuery: string): GroupedSearchResults {
  const cleanQuery = rawQuery.trim();
  const normalized = normalizeQuery(cleanQuery);
  if (!normalized) return emptySearchResults("");

  const matches: SearchResultItem[] = canonicalExams
    .flatMap((exam): SearchResultItem[] => {
      const names = [
        exam.code,
        exam.slug,
        exam.canonicalName,
        exam.displayNameTr,
        exam.displayNameEn,
        ...exam.aliases.map((alias) => alias.alias),
      ].map(normalizeQuery);
      const exact = names.some((name) => name === normalized);
      const prefix = names.some((name) => name.startsWith(normalized) || normalized.startsWith(name));
      const contains = names.some((name) => name.includes(normalized) || normalized.includes(name));
      const fuzzy = normalized.length >= 4 && Math.min(...names.map((name) => editDistance(name, normalized))) <= 2;
      const matchLayer = exact ? 1 : prefix ? 3 : contains ? 4 : fuzzy ? 6 : null;
      if (matchLayer === null) return [];
      return [{
        id: `canonical-exam-${exam.slug}`,
        type: "QUALIFICATION" as const,
        title: exam.displayNameEn,
        subtitle: exam.canonicalName,
        slug: exam.slug,
        score: 1_000 - matchLayer * 100 - exam.displayOrder,
        matchLayer,
        badge: exam.code,
      } satisfies SearchResultItem];
    })
    .sort((left, right) => left.matchLayer - right.matchLayer || right.score - left.score)
    .slice(0, 5);

  const result = emptySearchResults(cleanQuery);
  return {
    ...result,
    sourceStatus: "local-exams",
    groups: { ...result.groups, qualifications: matches },
    totalCount: matches.length,
  };
}
