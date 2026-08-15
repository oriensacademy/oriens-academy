import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { normalizeDomain, canonicalizeUrl, isWithinOfficialDomainBoundary } from "./domain-normalizer";
import { safeFetchUrl } from "./ssrf-fetcher";
import { getRobotsInfo } from "./robots-checker";
import { classifySourceUrl } from "./source-classifier";

export interface UniversityDiscoveryTarget {
  id: string;
  name: string;
  website: string | null;
  admissionsUrl: string | null;
  countryId?: string;
  popularityScore?: number | null;
}

export interface DiscoveredSourceRecord {
  universityId: string;
  sourceType: string;
  url: string;
  canonicalUrl: string;
  domain: string;
  pageTitle: string | null;
  isOfficial: boolean;
  provenanceType: string;
  verificationStatus: string;
  priority: number;
  httpStatus: number;
  contentType: string;
}

export interface DiscoveryRunResult {
  runId: string;
  universitiesProcessed: number;
  sourcesDiscovered: number;
  sourcesVerified: number;
  sourcesNeedingReview: number;
  sourcesRejected: number;
  failures: Array<{ universityId: string; name: string; reason: string }>;
}

const RELEVANT_LINK_KEYWORDS = [
  "course", "program", "degree", "study", "undergraduate", "graduate",
  "postgraduate", "admission", "international", "requirement", "entry",
  "english", "tuition", "fee", "apply", "bachelor", "master", "phd"
];

function extractHtmlLinksAndTitle(html: string, baseUrl: string): { title: string | null; links: Array<{ href: string; anchorText: string }> } {
  let title: string | null = null;
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim().replace(/\s+/g, " ");
  }

  const links: Array<{ href: string; anchorText: string }> = [];
  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const hrefRaw = match[1].trim();
    const rawAnchorText = match[2].replace(/<[^>]+>/g, "").trim().replace(/\s+/g, " ");

    if (!hrefRaw || hrefRaw.startsWith("#") || hrefRaw.startsWith("javascript:") || hrefRaw.startsWith("mailto:") || hrefRaw.startsWith("tel:")) {
      continue;
    }

    try {
      const resolved = new URL(hrefRaw, baseUrl).toString();
      links.push({ href: resolved, anchorText: rawAnchorText });
    } catch {
      // Ignore malformed URLs
    }
  }

  return { title, links };
}

export class SourceDiscoveryEngine {
  private supabase: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    if (supabaseClient) {
      this.supabase = supabaseClient;
    } else {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
      if (!key) throw new Error("A Supabase key is required for source discovery.");
      this.supabase = createClient(url, key);
    }
  }

  /**
   * Discovers and registers official program sources for a single university target.
   */
  async discoverUniversitySources(univ: UniversityDiscoveryTarget): Promise<DiscoveredSourceRecord[]> {
    const rawUrl = univ.website || univ.admissionsUrl;
    if (!rawUrl) {
      throw new Error(`NO_WEBSITE: University ${univ.name} has no website URL`);
    }

    console.log(`[DiscoveryEngine] Processing: ${univ.name} (${rawUrl})`);
    const normDomain = normalizeDomain(rawUrl);

    // 1. Persist/Verify University Domain in DB
    await this.supabase.from("university_domains").upsert(
      {
        university_id: univ.id,
        domain: normDomain.domain,
        root_domain: normDomain.rootDomain,
        source_url: rawUrl,
        is_primary: true,
        verification_status: "VERIFIED",
        verification_method: "OPENALEX_CANONICAL",
        verified_at: new Date().toISOString(),
      },
      { onConflict: "university_id,domain" }
    );

    // 2. Check Robots.txt
    await getRobotsInfo(normDomain.domain);

    const candidates = new Map<string, { url: string; anchorText: string; title?: string }>();

    // Add main website
    candidates.set(canonicalizeUrl(rawUrl), { url: rawUrl, anchorText: "Main Website" });
    if (univ.admissionsUrl) {
      candidates.set(canonicalizeUrl(univ.admissionsUrl), { url: univ.admissionsUrl, anchorText: "Admissions Portal" });
    }

    // 3. Fetch Home Page HTML via SSRF-safe fetcher (5s timeout)
    const fetchRes = await safeFetchUrl(rawUrl, { timeoutMs: 5000 });
    if (fetchRes.ok && fetchRes.body) {
      const { title, links } = extractHtmlLinksAndTitle(fetchRes.body, fetchRes.finalUrl);
      const homeCan = canonicalizeUrl(rawUrl);
      const existingHome = candidates.get(homeCan);
      if (existingHome) {
        existingHome.title = title || `${univ.name} Official Website`;
      }

      // Filter and prioritize top semantically relevant links (cap at 15)
      for (const link of links) {
        const canUrl = canonicalizeUrl(link.href);
        const lowerHref = link.href.toLowerCase();
        const lowerAnchor = link.anchorText.toLowerCase();

        const isRelevant = RELEVANT_LINK_KEYWORDS.some(
          (kw) => lowerHref.includes(kw) || lowerAnchor.includes(kw)
        );

        if (isRelevant && isWithinOfficialDomainBoundary(link.href, normDomain.domain)) {
          if (!candidates.has(canUrl) && candidates.size < 15) {
            candidates.set(canUrl, { url: link.href, anchorText: link.anchorText });
          }
        }
      }
    }

    // 4. Classify and Verify Candidate Sources
    const candidateEntries = Array.from(candidates.entries());
    const discoveredRecords: DiscoveredSourceRecord[] = [];

    // Parallelize health checks in batches of 4
    const batchSize = 4;
    for (let i = 0; i < candidateEntries.length; i += batchSize) {
      const batch = candidateEntries.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async ([canUrl, cand]) => {
          const classification = classifySourceUrl(cand.url, normDomain.domain, {
            title: cand.title,
            anchorText: cand.anchorText,
          });

          if (classification.verificationStatus === "REJECTED") {
            return;
          }

          let httpStatus = 200;
          let contentType = classification.contentType;

          if (cand.url === rawUrl && fetchRes.ok) {
            httpStatus = fetchRes.status;
          } else {
            const checkRes = await safeFetchUrl(cand.url, { timeoutMs: 4000 });
            httpStatus = checkRes.ok ? checkRes.status : checkRes.status || 404;
            if (checkRes.contentType.includes("pdf")) {
              contentType = "PDF";
            }
          }

          discoveredRecords.push({
            universityId: univ.id,
            sourceType: classification.sourceType,
            url: cand.url,
            canonicalUrl: canUrl,
            domain: normDomain.domain,
            pageTitle: cand.title || `${univ.name} - ${classification.sourceType.replace(/_/g, " ")}`,
            isOfficial: classification.isOfficial,
            provenanceType: classification.provenanceType,
            verificationStatus: classification.verificationStatus,
            priority: classification.priority,
            httpStatus,
            contentType,
          });
        })
      );
    }

    // 5. Persist Sources into DB Registry
    for (const rec of discoveredRecords) {
      await this.supabase.from("university_source_registry").upsert(
        {
          university_id: rec.universityId,
          source_type: rec.sourceType,
          url: rec.url,
          canonical_url: rec.canonicalUrl,
          domain: rec.domain,
          page_title: rec.pageTitle,
          is_official: rec.isOfficial,
          provenance_type: rec.provenanceType,
          verification_status: rec.verificationStatus,
          priority: rec.priority,
          http_status: rec.httpStatus,
          content_type: rec.contentType,
          last_checked_at: new Date().toISOString(),
        },
        { onConflict: "university_id,url" }
      );
    }

    console.log(`[DiscoveryEngine] Finished ${univ.name}: ${discoveredRecords.length} official sources registered.`);
    return discoveredRecords;
  }

  /**
   * Batch runner for executing discovery runs across multiple universities with telemetry tracking.
   */
  async runDiscoveryBatch(universities: UniversityDiscoveryTarget[], runType = "SOURCE_DISCOVERY"): Promise<DiscoveryRunResult> {
    const startedAt = new Date().toISOString();

    const { data: runData } = await this.supabase
      .from("ingestion_runs")
      .insert({
        run_type: runType,
        source: "OFFICIAL_SOURCE_DISCOVERY_ENGINE",
        started_at: startedAt,
        status: "RUNNING",
      })
      .select("id")
      .single();

    const runId = runData?.id || "run-local";

    let sourcesDiscovered = 0;
    let sourcesVerified = 0;
    let sourcesNeedingReview = 0;
    let sourcesRejected = 0;
    const failures: Array<{ universityId: string; name: string; reason: string }> = [];

    for (const univ of universities) {
      try {
        const records = await this.discoverUniversitySources(univ);
        sourcesDiscovered += records.length;

        for (const r of records) {
          if (r.verificationStatus === "VERIFIED") sourcesVerified++;
          else if (r.verificationStatus === "NEEDS_REVIEW") sourcesNeedingReview++;
          else if (r.verificationStatus === "REJECTED") sourcesRejected++;
        }
      } catch (err) {
        console.error(`[DiscoveryEngine] Error processing ${univ.name}:`, (err as Error).message);
        failures.push({
          universityId: univ.id,
          name: univ.name,
          reason: (err as Error).message,
        });
      }
    }

    const finishedAt = new Date().toISOString();
    const finalStatus = failures.length === universities.length ? "FAILED" : failures.length > 0 ? "PARTIAL_SUCCESS" : "COMPLETED";

    await this.supabase.from("ingestion_runs").update({
      finished_at: finishedAt,
      status: finalStatus,
      records_discovered: sourcesDiscovered,
      records_inserted: sourcesVerified,
      records_updated: sourcesNeedingReview,
      records_failed: failures.length,
      error_summary: { failures },
    }).eq("id", runId);

    return {
      runId,
      universitiesProcessed: universities.length,
      sourcesDiscovered,
      sourcesVerified,
      sourcesNeedingReview,
      sourcesRejected,
      failures,
    };
  }
}
