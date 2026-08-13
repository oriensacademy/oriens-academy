import dns from "dns/promises";
import net from "net";

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxSizeBytes?: number;
  headers?: Record<string, string>;
  allowRedirects?: boolean;
  maxRedirects?: number;
}

export interface SafeFetchResult {
  ok: boolean;
  status: number;
  finalUrl: string;
  contentType: string;
  body: string;
  redirectCount: number;
  headers: Record<string, string>;
  error?: string;
}

export const CRAWLER_USER_AGENT = "OriensAcademyBot/1.0 (+https://oriens-academy.com/bot)";
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validates whether an IP address is in a private, loopback, or cloud metadata subnet.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (!net.isIP(ip)) {
    return true; // Malformed IP is treated as unsafe
  }

  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;

    // Loopback 127.0.0.0/8
    if (a === 127) return true;
    // 0.0.0.0/8
    if (a === 0) return true;
    // Private 10.0.0.0/8
    if (a === 10) return true;
    // Private 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // Private 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // Link-local / Cloud Metadata 169.254.0.0/16
    if (a === 169 && b === 254) return true;
    // Carrier Grade NAT 100.64.0.0/10
    if (a === 100 && b >= 64 && b <= 127) return true;
    // Multicast 224.0.0.0/4
    if (a >= 224 && a <= 239) return true;
    // Reserved / Broadcast
    if (a >= 240) return true;

    return false;
  }

  if (net.isIPv6(ip)) {
    const norm = ip.toLowerCase();
    // Loopback ::1
    if (norm === "::1" || norm === "0:0:0:0:0:0:0:1") return true;
    // Link-local fe80::/10
    if (norm.startsWith("fe8") || norm.startsWith("fe9") || norm.startsWith("fea") || norm.startsWith("feb")) return true;
    // Unique local fc00::/7
    if (norm.startsWith("fc") || norm.startsWith("fd")) return true;
    // Site-local fec0::/10
    if (norm.startsWith("fec") || norm.startsWith("fed") || norm.startsWith("fee") || norm.startsWith("fef")) return true;

    return false;
  }

  return true;
}

/**
 * Validates a target URL for SSRF vulnerabilities before initiating network connection.
 */
export async function validateUrlForSsrf(urlStr: string): Promise<{ valid: boolean; resolvedIp?: string; error?: string }> {
  try {
    const parsed = new URL(urlStr);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, error: `UNSUPPORTED_SCHEME: ${parsed.protocol}` };
    }

    const hostname = parsed.hostname.toLowerCase();

    if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
      return { valid: false, error: `BLOCKED_LOCALHOST: ${hostname}` };
    }

    // Direct IP input check
    if (net.isIP(hostname)) {
      if (isPrivateOrReservedIp(hostname)) {
        return { valid: false, resolvedIp: hostname, error: `BLOCKED_PRIVATE_IP: ${hostname}` };
      }
      return { valid: true, resolvedIp: hostname };
    }

    // DNS pre-flight resolution check
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      for (const addr of addresses) {
        if (isPrivateOrReservedIp(addr.address)) {
          return { valid: false, resolvedIp: addr.address, error: `BLOCKED_PRIVATE_IP_DNS: ${hostname} resolved to ${addr.address}` };
        }
      }
      return { valid: true, resolvedIp: addresses[0]?.address };
    } catch {
      return { valid: false, error: `DNS_RESOLUTION_FAILED: ${hostname}` };
    }
  } catch (err) {
    return { valid: false, error: `INVALID_URL: ${(err as Error).message}` };
  }
}

/**
 * Performs a safe, SSRF-protected HTTP request with size and time limits.
 */
export async function safeFetchUrl(urlStr: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxSizeBytes = options.maxSizeBytes || DEFAULT_MAX_SIZE_BYTES;
  const maxRedirects = options.maxRedirects || 5;

  let currentUrl = urlStr;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    const ssrfCheck = await validateUrlForSsrf(currentUrl);
    if (!ssrfCheck.valid) {
      return {
        ok: false,
        status: 0,
        finalUrl: currentUrl,
        contentType: "",
        body: "",
        redirectCount,
        headers: {},
        error: ssrfCheck.error,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(currentUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": CRAWLER_USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.8,*/*;q=0.7",
          "Accept-Language": "en-US,en;q=0.9",
          ...(options.headers || {}),
        },
        redirect: "manual", // Handle redirects manually for SSRF security on each hop
      });

      clearTimeout(timer);

      const contentType = res.headers.get("content-type") || "";
      const headersObj: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        headersObj[k.toLowerCase()] = v;
      });

      // Handle Redirects safely
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get("location");
        if (location) {
          const nextUrl = new URL(location, currentUrl).toString();
          redirectCount++;
          currentUrl = nextUrl;
          continue;
        }
      }

      // Enforce Size limit stream check
      const contentLengthHeader = res.headers.get("content-length");
      if (contentLengthHeader && parseInt(contentLengthHeader, 10) > maxSizeBytes) {
        return {
          ok: false,
          status: res.status,
          finalUrl: currentUrl,
          contentType,
          body: "",
          redirectCount,
          headers: headersObj,
          error: "RESPONSE_SIZE_EXCEEDED",
        };
      }

      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > maxSizeBytes) {
        return {
          ok: false,
          status: res.status,
          finalUrl: currentUrl,
          contentType,
          body: "",
          redirectCount,
          headers: headersObj,
          error: "RESPONSE_SIZE_EXCEEDED",
        };
      }

      const bodyText = new TextDecoder("utf-8").decode(buffer);

      return {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        finalUrl: currentUrl,
        contentType,
        body: bodyText,
        redirectCount,
        headers: headersObj,
      };
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = (err as Error).name === "AbortError";
      return {
        ok: false,
        status: 0,
        finalUrl: currentUrl,
        contentType: "",
        body: "",
        redirectCount,
        headers: {},
        error: isTimeout ? "FETCH_TIMEOUT" : `FETCH_ERROR: ${(err as Error).message}`,
      };
    }
  }

  return {
    ok: false,
    status: 0,
    finalUrl: currentUrl,
    contentType: "",
    body: "",
    redirectCount,
    headers: {},
    error: "TOO_MANY_REDIRECTS",
  };
}
