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
  private defaultTTLMs = 1000 * 60;
  private maxEntries = 100;

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Map insertion order is the LRU order.
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data as T;
  }

  public set<T>(key: string, data: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs || this.defaultTTLMs);
    this.cache.delete(key);
    this.cache.set(key, { data, expiresAt });
    while (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      this.cache.delete(oldestKey);
    }
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const searchCache = new SearchCacheManager();
