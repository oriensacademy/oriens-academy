/**
 * Oriens Academy — Domain & URL Normalization Utilities
 */

export interface NormalizedDomain {
  domain: string;
  rootDomain: string;
  isSubdomain: boolean;
  hostname: string;
}

/**
 * Normalizes an arbitrary domain or URL string into canonical hostname and root domain representations.
 * Examples:
 *  "https://www.ox.ac.uk/admissions/" -> domain: "ox.ac.uk", rootDomain: "ox.ac.uk"
 *  "http://admissions.stanford.edu"   -> domain: "admissions.stanford.edu", rootDomain: "stanford.edu"
 */
export function normalizeDomain(input: string): NormalizedDomain {
  let raw = (input || "").trim().toLowerCase();

  if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
    raw = `https://${raw}`;
  }

  try {
    const parsed = new URL(raw);
    let hostname = parsed.hostname.toLowerCase();

    // Strip leading www.
    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }

    const parts = hostname.split(".");
    let rootDomain = hostname;

    // Handle common two-part TLDs (e.g. .ac.uk, .edu.au, .gov.uk, .co.uk, .edu.tr)
    if (parts.length > 2) {
      const secondToLast = parts[parts.length - 2];
      const last = parts[parts.length - 1];

      if (["ac", "co", "edu", "gov", "org", "net", "com"].includes(secondToLast) && last.length === 2) {
        if (parts.length >= 3) {
          rootDomain = parts.slice(parts.length - 3).join(".");
        }
      } else {
        rootDomain = parts.slice(parts.length - 2).join(".");
      }
    }

    const isSubdomain = hostname !== rootDomain;

    return {
      domain: hostname,
      rootDomain,
      isSubdomain,
      hostname: parsed.hostname.toLowerCase(),
    };
  } catch {
    const sanitized = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split("?")[0];
    return {
      domain: sanitized || "unknown",
      rootDomain: sanitized || "unknown",
      isSubdomain: false,
      hostname: sanitized || "unknown",
    };
  }
}

/**
 * Canonicalizes a URL for deduplication and comparison.
 * - Strips fragment identifier (#...)
 * - Normalizes scheme and hostname to lowercase
 * - Strips trailing slash on path unless root
 * - Alphabetically sorts query parameters
 */
export function canonicalizeUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr.trim());
    url.hash = "";

    // Lowercase host and strip leading www.
    let host = url.hostname.toLowerCase();
    if (host.startsWith("www.")) {
      host = host.slice(4);
    }
    url.hostname = host;

    // Normalize path
    let pathname = url.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    url.pathname = pathname;

    // Sort search parameters
    url.searchParams.sort();

    return url.toString();
  } catch {
    return urlStr.trim();
  }
}

/**
 * Checks if a target URL's domain belongs to the official university domain or a verified institutional subdomain.
 */
export function isWithinOfficialDomainBoundary(targetUrl: string, officialDomain: string): boolean {
  try {
    const targetNorm = normalizeDomain(targetUrl);
    const officialNorm = normalizeDomain(officialDomain);

    if (targetNorm.rootDomain === officialNorm.rootDomain) {
      return true;
    }

    if (targetNorm.domain.endsWith(`.${officialNorm.rootDomain}`)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
