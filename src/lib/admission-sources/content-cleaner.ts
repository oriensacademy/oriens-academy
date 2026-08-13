import { createHash } from "crypto";

export interface CleanedContentResult {
  sanitizedHtml: string;
  excerpt: string;
  contentHash: string;
  extractedLinks: Array<{ url: string; text: string }>;
}

/**
 * HTML content cleaner for university admission source pages.
 * Preserves structured headings, paragraphs, lists, and tables while stripping site chrome.
 */
export function cleanAdmissionHtml(html: string, baseUrl?: string): CleanedContentResult {
  if (!html || typeof html !== "string") {
    return {
      sanitizedHtml: "",
      excerpt: "",
      contentHash: createHash("sha256").update("").digest("hex"),
      extractedLinks: [],
    };
  }

  // 1. Extract Links Before Noise Removal
  const extractedLinks: Array<{ url: string; text: string }> = [];
  const seenUrls = new Set<string>();
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const rawHref = match[1].trim();
    const linkText = match[2].replace(/<[^>]+>/g, "").trim().replace(/\s+/g, " ");

    if (rawHref && !rawHref.startsWith("#") && !rawHref.startsWith("javascript:") && !rawHref.startsWith("mailto:")) {
      try {
        const resolved = baseUrl ? new URL(rawHref, baseUrl).toString() : rawHref;
        if (!seenUrls.has(resolved) && linkText.length > 1) {
          seenUrls.add(resolved);
          extractedLinks.push({ url: resolved, text: linkText });
        }
      } catch {
        // Skip invalid URL resolution
      }
    }
  }

  // 2. Remove Noise Elements (Scripts, Styles, Nav, Header, Footer, Banners)
  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // 3. Keep Semantically Relevant Tags: H1-H6, P, UL, OL, LI, TABLE, THEAD, TBODY, TR, TH, TD, DL, DT, DD, BLOCKQUOTE, B, STRONG
  // Convert noisy containers into clean block elements
  clean = clean.replace(/<div\b[^>]*>/gi, "\n").replace(/<\/div>/gi, "\n");
  clean = clean.replace(/<section\b[^>]*>/gi, "\n").replace(/<\/section>/gi, "\n");
  clean = clean.replace(/<main\b[^>]*>/gi, "\n").replace(/<\/main>/gi, "\n");

  // Sanitize tags strictly
  clean = clean.replace(/<(?!\/?(h[1-6]|p|ul|ol|li|table|thead|tbody|tr|th|td|dl|dt|dd|blockquote|b|strong|em|span|a)\b)[^>]+>/gi, " ");

  // Normalize multi-whitespace and empty lines
  clean = clean
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();

  // 4. Generate Excerpt (First ~500 chars of visible plain text)
  const plainText = clean.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const excerpt = plainText.length > 500 ? plainText.slice(0, 497) + "..." : plainText;

  // 5. Generate Content Hash
  const contentHash = createHash("sha256").update(clean).digest("hex");

  return {
    sanitizedHtml: clean,
    excerpt,
    contentHash,
    extractedLinks,
  };
}
