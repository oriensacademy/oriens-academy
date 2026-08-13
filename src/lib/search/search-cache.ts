/**
 * Safe In-Memory Metadata Cache for Static Search Definitions.
 * Prevents re-fetching static country/qualification records while ensuring
 * user-specific eligibility results are never cross-cached.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SearchCacheManager {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTTLMs = 1000 * 60 * 15; // 15 Minutes

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  public set<T>(key: string, data: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs || this.defaultTTLMs);
    this.cache.set(key, { data, expiresAt });
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const searchCache = new SearchCacheManager();
