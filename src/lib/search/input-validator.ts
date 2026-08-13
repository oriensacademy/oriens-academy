/**
 * Input Validation and Security Hardening for Oriens Search Engine.
 */

const MAX_QUERY_LENGTH = 200;
const MAX_PAGE_SIZE = 50;

const ALLOWED_MATCH_CATEGORIES = new Set([
  "ALL",
  "ELIGIBLE",
  "STRONG_MATCH",
  "MATCH",
  "REACH",
  "REQUIREMENT_GAP",
  "MISSING_INFORMATION",
  "UNKNOWN",
]);

const ALLOWED_COUNTRIES = new Set([
  "ALL",
  "GB",
  "US",
  "IT",
  "NL",
  "CH",
  "FR",
]);

export interface SanitizedSearchParams {
  query: string;
  page: number;
  pageSize: number;
  country: string;
  matchCategory: string;
}

export function sanitizeSearchInput(
  rawQuery?: string | null,
  rawPage?: string | number | null,
  rawPageSize?: string | number | null,
  rawCountry?: string | null,
  rawCategory?: string | null
): SanitizedSearchParams {
  // 1. Sanitize Query
  let query = (rawQuery || "").trim();
  // Strip control characters & HTML tags
  query = query.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").replace(/<[^>]*>/g, "");
  if (query.length > MAX_QUERY_LENGTH) {
    query = query.substring(0, MAX_QUERY_LENGTH);
  }

  // 2. Sanitize Pagination
  let page = typeof rawPage === "number" ? rawPage : parseInt(String(rawPage || "1"), 10);
  if (isNaN(page) || page < 1) page = 1;

  let pageSize = typeof rawPageSize === "number" ? rawPageSize : parseInt(String(rawPageSize || "10"), 10);
  if (isNaN(pageSize) || pageSize < 1) pageSize = 10;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  // 3. Sanitize Enums
  let country = (rawCountry || "ALL").toUpperCase().trim();
  if (!ALLOWED_COUNTRIES.has(country)) country = "ALL";

  let matchCategory = (rawCategory || "ALL").toUpperCase().trim();
  if (!ALLOWED_MATCH_CATEGORIES.has(matchCategory)) matchCategory = "ALL";

  return {
    query,
    page,
    pageSize,
    country,
    matchCategory,
  };
}
