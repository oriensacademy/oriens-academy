/**
 * Üniversite önerileri: Hero aramasındaki (GooeySearchBar) veri yolunun
 * yalnızca üniversite kısmı.
 *
 * Aynı `retrieveSearchResultsFromDatabase` çağrısı kullanılır; böylece
 * normalizasyon, RPC katman sıralaması ve paylaşılan sonuç önbelleği tek
 * yerde kalır. RPC ulaşılamadığında veya sonuç dönmediğinde doğrulanmış
 * resmî üniversite kaydı katmanlı (exact -> prefix -> token -> fuzzy) bir
 * eşleşmeyle devreye girer.
 */
import { VERIFIED_OFFICIAL_UNIVERSITY_URLS } from "@/data/official-universities";
import { retrieveSearchResultsFromDatabase } from "./db-retrieval-service";
import { editDistance, normalizeQuery } from "./query-normalizer";
import type { SearchResultItem } from "./retrieval-engine";

export const UNIVERSITY_SUGGESTION_LIMIT = 8;

type MatchLayer = SearchResultItem["matchLayer"];

interface RegistryEntry {
  title: string;
  officialUrl: string;
  normalized: string;
  tokens: string[];
  order: number;
}

const REGISTRY: RegistryEntry[] = Object.entries(VERIFIED_OFFICIAL_UNIVERSITY_URLS).map(
  ([title, officialUrl], order) => {
    const normalized = normalizeQuery(title);
    return { title, officialUrl, normalized, tokens: normalized.split(" ").filter(Boolean), order };
  },
);

function fuzzyTolerance(token: string): number {
  return token.length >= 7 ? 2 : 1;
}

/**
 * Katman numaraları RPC ile aynı anlamı taşır: küçük olan daha güçlü eşleşme.
 */
function registryMatchLayer(entry: RegistryEntry, normalized: string, queryTokens: string[]): MatchLayer | null {
  if (entry.normalized === normalized) return 1;
  if (entry.normalized.startsWith(normalized)) return 2;
  if (queryTokens.every((token) => entry.tokens.includes(token))) return 3;
  if (queryTokens.every((token) => entry.tokens.some((entryToken) => entryToken.startsWith(token)))) return 4;
  if (entry.normalized.includes(normalized)) return 5;

  const fuzzyMatchesEveryToken = queryTokens.every((token) => {
    // Kısa parçalar ("of", "de") yazım hatası toleransına girmez; onlar için
    // birebir/önek eşleşmesi aranır, uzun parçalar düzeltilebilir.
    if (token.length < 4) return entry.tokens.some((entryToken) => entryToken.startsWith(token));
    return entry.tokens.some((entryToken) => editDistance(entryToken, token) <= fuzzyTolerance(token));
  });
  return fuzzyMatchesEveryToken ? 6 : null;
}

function toRegistryResult(entry: RegistryEntry, matchLayer: MatchLayer): SearchResultItem {
  return {
    id: `verified-university-${entry.normalized.replace(/ /g, "-")}`,
    type: "UNIVERSITY",
    title: entry.title,
    slug: entry.normalized.replace(/ /g, "-"),
    score: 1_000 - matchLayer * 100 - entry.order,
    matchLayer,
    officialUrl: entry.officialUrl,
  };
}

/**
 * Aynı resmî adrese işaret eden kısaltma kayıtlarını ("MIT" ve
 * "Massachusetts Institute of Technology (MIT)") tek satırda birleştirir;
 * en güçlü katmanı korur, gösterim için uzun/kanonik adı tercih eder.
 */
function dedupeByOfficialUrl(matches: { entry: RegistryEntry; matchLayer: MatchLayer }[]) {
  const byUrl = new Map<string, { entry: RegistryEntry; matchLayer: MatchLayer }>();
  for (const match of matches) {
    const existing = byUrl.get(match.entry.officialUrl);
    if (!existing) {
      byUrl.set(match.entry.officialUrl, match);
      continue;
    }
    byUrl.set(match.entry.officialUrl, {
      entry: match.entry.title.length > existing.entry.title.length ? match.entry : existing.entry,
      matchLayer: Math.min(match.matchLayer, existing.matchLayer) as MatchLayer,
    });
  }
  return [...byUrl.values()];
}

export function matchVerifiedUniversityRegistry(rawQuery: string, limit = UNIVERSITY_SUGGESTION_LIMIT): SearchResultItem[] {
  const normalized = normalizeQuery(rawQuery);
  if (!normalized) return defaultUniversitySuggestions(limit);

  const queryTokens = normalized.split(" ").filter(Boolean);
  const matches = REGISTRY.flatMap((entry) => {
    const matchLayer = registryMatchLayer(entry, normalized, queryTokens);
    return matchLayer === null ? [] : [{ entry, matchLayer }];
  });

  return dedupeByOfficialUrl(matches)
    .sort((left, right) => left.matchLayer - right.matchLayer || left.entry.order - right.entry.order)
    .slice(0, limit)
    .map(({ entry, matchLayer }) => toRegistryResult(entry, matchLayer));
}

/** Kullanıcı henüz yazmadan gösterilen başlangıç önerileri. */
export function defaultUniversitySuggestions(limit = UNIVERSITY_SUGGESTION_LIMIT): SearchResultItem[] {
  return dedupeByOfficialUrl(REGISTRY.map((entry) => ({ entry, matchLayer: 3 as MatchLayer })))
    .slice(0, limit)
    .map(({ entry }) => toRegistryResult(entry, 3));
}

export interface UniversitySuggestions {
  items: SearchResultItem[];
  /** "database": RPC yanıtı kullanıldı. "local": doğrulanmış kayda düşüldü. */
  source: "database" | "local";
}

export async function retrieveUniversitySuggestions(
  rawQuery: string,
  signal?: AbortSignal,
  limit = UNIVERSITY_SUGGESTION_LIMIT,
): Promise<UniversitySuggestions> {
  const cleanQuery = rawQuery.trim();
  if (!normalizeQuery(cleanQuery)) {
    return { items: defaultUniversitySuggestions(limit), source: "local" };
  }

  let databaseItems: SearchResultItem[] = [];
  try {
    // Hero ile birebir aynı çağrı: limitler varsayılan bırakılır, böylece
    // paylaşılan önbellek girdisi her iki arama için de geçerli kalır.
    const grouped = await retrieveSearchResultsFromDatabase(cleanQuery, undefined, signal);
    databaseItems = grouped.groups.universities.slice(0, limit);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
  }

  if (databaseItems.length >= limit) return { items: databaseItems, source: "database" };

  // RPC az sonuç döndürdüyse doğrulanmış kayıttan tamamla.
  const seen = new Set(databaseItems.map((item) => normalizeQuery(item.title)));
  const topUp = matchVerifiedUniversityRegistry(cleanQuery, limit).filter((item) => {
    const key = normalizeQuery(item.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const items = [...databaseItems, ...topUp].slice(0, limit);
  return { items, source: databaseItems.length > 0 ? "database" : "local" };
}
