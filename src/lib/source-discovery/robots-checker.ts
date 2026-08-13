import { safeFetchUrl } from "./ssrf-fetcher";
import { normalizeDomain } from "./domain-normalizer";

export interface RobotsInfo {
  disallowedPaths: string[];
  sitemaps: string[];
  crawlDelayMs?: number;
  isAllowed: (pathname: string) => boolean;
}

const robotsCache = new Map<string, RobotsInfo>();

/**
 * Fetches and parses robots.txt for a given university domain safely.
 */
export async function getRobotsInfo(domainOrUrl: string): Promise<RobotsInfo> {
  const norm = normalizeDomain(domainOrUrl);
  const cacheKey = norm.domain;

  if (robotsCache.has(cacheKey)) {
    return robotsCache.get(cacheKey)!;
  }

  const robotsUrl = `https://${norm.domain}/robots.txt`;
  const result = await safeFetchUrl(robotsUrl, { timeoutMs: 5000, maxSizeBytes: 1024 * 1024 });

  const disallowedPaths: string[] = [];
  const sitemaps: string[] = [];
  let crawlDelayMs: number | undefined;

  if (result.ok && result.body) {
    const lines = result.body.split("\n");
    let isTargetUserAgent = true;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) continue;

      const key = trimmed.slice(0, colonIndex).trim().toLowerCase();
      const value = trimmed.slice(colonIndex + 1).trim();

      if (key === "user-agent") {
        const agent = value.toLowerCase();
        isTargetUserAgent = agent === "*" || agent.includes("oriens") || agent.includes("bot");
      } else if (key === "disallow" && isTargetUserAgent) {
        if (value) {
          disallowedPaths.push(value);
        }
      } else if (key === "sitemap") {
        if (value.startsWith("http://") || value.startsWith("https://")) {
          sitemaps.push(value);
        }
      } else if (key === "crawl-delay" && isTargetUserAgent) {
        const parsedDelay = parseFloat(value);
        if (!isNaN(parsedDelay) && parsedDelay > 0) {
          crawlDelayMs = Math.min(parsedDelay * 1000, 10000); // Cap max crawl delay at 10s
        }
      }
    }
  }

  // Always check standard fallback sitemaps if none specified
  if (sitemaps.length === 0) {
    sitemaps.push(`https://${norm.domain}/sitemap.xml`);
    sitemaps.push(`https://${norm.domain}/sitemap_index.xml`);
  }

  const isAllowed = (pathname: string): boolean => {
    for (const dis of disallowedPaths) {
      if (dis === "/") return false;
      if (dis && pathname.startsWith(dis)) return false;
    }
    return true;
  };

  const info: RobotsInfo = {
    disallowedPaths,
    sitemaps,
    crawlDelayMs,
    isAllowed,
  };

  robotsCache.set(cacheKey, info);
  return info;
}

/**
 * Utility delay for rate limiting between requests.
 */
export async function enforceRateLimit(delayMs = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
