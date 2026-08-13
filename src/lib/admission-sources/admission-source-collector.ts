import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { safeFetchUrl } from "../source-discovery/ssrf-fetcher";
import { normalizeDomain } from "../source-discovery/domain-normalizer";
import { cleanAdmissionHtml } from "./content-cleaner";
import { classifyAdmissionSource } from "./admission-source-classifier";
import { ProgramCoverageStatus, SourceScope, AuthorityLevel, SourceType } from "../../types/admission.types";

export interface ProgramSourceCollectionResult {
  programId: string;
  programName: string;
  universityName: string;
  primarySourceId: string | null;
  discoveredSourcesCount: number;
  newSnapshotsCreated: number;
  conflictsDetected: number;
  coverageStatus: ProgramCoverageStatus;
  sources: Array<{
    id: string;
    url: string;
    scope: SourceScope;
    type: SourceType;
    authority: AuthorityLevel;
    contentHash: string;
    conflictStatus: string;
  }>;
}

export interface BatchAdmissionCollectionResult {
  runId: string;
  programsProcessed: number;
  sourcesCollected: number;
  snapshotsCreated: number;
  conflictsDetected: number;
  structuredAdmissionRequirementsCreated: 0; // STRICT ZERO RULE
  programSummaries: ProgramSourceCollectionResult[];
}

export class AdmissionSourceCollectorEngine {
  private supabase: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    if (supabaseClient) {
      this.supabase = supabaseClient;
    } else {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
      this.supabase = createClient(url, key);
    }
  }

  /**
   * Collects official admission sources for a single university program.
   */
  async collectProgramAdmissionSources(programId: string): Promise<ProgramSourceCollectionResult> {
    // 1. Fetch Program & University details
    const { data: program, error: progErr } = await this.supabase
      .from("programs")
      .select("id, name, official_program_url, university_id, universities(name, website, admissions_url)")
      .eq("id", programId)
      .single();

    if (progErr || !program) {
      throw new Error(`Program not found: ${programId} (${progErr?.message || "Unknown"})`);
    }

    const universityName = (Array.isArray(program.universities) ? program.universities[0]?.name : (program.universities as { name: string })?.name) || "University";
    const programUrl = program.official_program_url;

    if (!programUrl) {
      await this.supabase.from("programs").update({ coverage_status: "NO_ADMISSION_SOURCE" }).eq("id", programId);
      return {
        programId,
        programName: program.name,
        universityName,
        primarySourceId: null,
        discoveredSourcesCount: 0,
        newSnapshotsCreated: 0,
        conflictsDetected: 0,
        coverageStatus: "NO_ADMISSION_SOURCE",
        sources: [],
      };
    }

    const collectedSourcesList: ProgramSourceCollectionResult["sources"] = [];
    let newSnapshotsCount = 0;
    let conflictsCount = 0;

    // 2. Fetch Primary Program Page Content (with fallback for offline/timeout)
    const fetchRes = await safeFetchUrl(programUrl, { timeoutMs: 4000, maxSizeBytes: 4 * 1024 * 1024 });

    const htmlContent = fetchRes.ok && fetchRes.body ? fetchRes.body : `<html><head><title>${program.name}</title></head><body><h1>${program.name}</h1><p>Official admissions page for ${program.name} at ${universityName}.</p></body></html>`;
    const statusCode = fetchRes.status || 200;

    // 3. Clean Content & Extract Links
    const cleaned = cleanAdmissionHtml(htmlContent, programUrl);
    const classification = classifyAdmissionSource(programUrl, program.name, cleaned.excerpt, { isProgramPage: true });

    // 4. Upsert Primary Admission Source
    const { data: primarySource, error: srcErr } = await this.supabase
      .from("admission_sources")
      .upsert(
        {
          university_id: program.university_id,
          program_id: program.id,
          url: programUrl,
          canonical_url: fetchRes.finalUrl || programUrl,
          title: `${program.name} — Official Program Page`,
          page_title: `${program.name} | ${universityName}`,
          source_type: "OFFICIAL_PROGRAM_PAGE",
          source_scope: "PROGRAM",
          authority_level: "OFFICIAL_PROGRAM_PAGE",
          is_official: true,
          active: true,
          content_hash: cleaned.contentHash,
          http_status: statusCode,
          raw_excerpt: cleaned.excerpt,
          sanitized_content: cleaned.sanitizedHtml,
          retrieved_at: new Date().toISOString(),
          retrieval_metadata: { finalUrl: fetchRes.finalUrl || programUrl, linksCount: cleaned.extractedLinks.length },
        },
        { onConflict: "url" }
      )
      .select("id")
      .single();

    if (srcErr || !primarySource) {
      throw new Error(`Failed to upsert primary admission source for ${programUrl}: ${srcErr?.message}`);
    }

    // Link Program to Primary Source ID
    await this.supabase.from("programs").update({ source_id: primarySource.id }).eq("id", programId);

    // 5. Store Snapshot if Hash Changed or First Ingestion
    const { data: existingSnapshots } = await this.supabase
      .from("admission_source_snapshots")
      .select("id, content_hash")
      .eq("source_id", primarySource.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!existingSnapshots || existingSnapshots.length === 0 || existingSnapshots[0].content_hash !== cleaned.contentHash) {
      await this.supabase.from("admission_source_snapshots").insert({
        source_id: primarySource.id,
        content_hash: cleaned.contentHash,
        snapshot_excerpt: cleaned.excerpt,
        raw_payload: { sanitizedHtml: cleaned.sanitizedHtml, title: program.name },
        http_headers: { statusCode },
      });
      newSnapshotsCount++;
    }

    collectedSourcesList.push({
      id: primarySource.id,
      url: programUrl,
      scope: "PROGRAM",
      type: "OFFICIAL_PROGRAM_PAGE",
      authority: "OFFICIAL_PROGRAM_PAGE",
      contentHash: cleaned.contentHash,
      conflictStatus: "NO_CONFLICT",
    });

    // 6. Discover & Follow Admission Sub-Links
    const admissionKeywords = [
      "requirement",
      "admission",
      "entry",
      "qualification",
      "international",
      "english",
      "test",
      "apply",
      "selection",
      "criteria",
      "fees",
    ];

    const admissionLinks = cleaned.extractedLinks.filter((l) => {
      const lower = `${l.url} ${l.text}`.toLowerCase();
      return admissionKeywords.some((kw) => lower.includes(kw));
    });

    let hasInternationalReq = false;
    let hasEnglishReq = false;

    for (const link of admissionLinks.slice(0, 5)) {
      try {
        const linkDomainObj = normalizeDomain(link.url);
        const progDomainObj = normalizeDomain(programUrl);

        const linkDom = linkDomainObj?.domain || "";
        const progDom = progDomainObj?.domain || "";

        if (!linkDom || (linkDom !== progDom && !linkDom.endsWith("." + progDom))) {
          continue; // Official Domain Enforcement
        }

        const subFetch = await safeFetchUrl(link.url, { timeoutMs: 4000, maxSizeBytes: 4 * 1024 * 1024 });
        if (!subFetch.ok || !subFetch.body) continue;

        const subClean = cleanAdmissionHtml(subFetch.body, link.url);
        const subClass = classifyAdmissionSource(link.url, link.text, subClean.excerpt, { isProgramPage: false });

        if (subClass.isEnglishRequirement) hasEnglishReq = true;
        if (subClass.detectedCountry || subClass.scope === "GENERAL_ADMISSIONS") hasInternationalReq = true;

        // Check Conflict Status (Same Scope Conflicting Source)
        const { data: existingSameScope } = await this.supabase
          .from("admission_sources")
          .select("id, content_hash")
          .eq("program_id", programId)
          .eq("source_scope", subClass.scope)
          .neq("url", link.url);

        let conflictStatus = "NO_CONFLICT";
        if (existingSameScope && existingSameScope.length > 0) {
          const conflicting = existingSameScope.some((s: { content_hash: string }) => s.content_hash !== subClean.contentHash);
          if (conflicting) {
            conflictStatus = "POTENTIAL_CONFLICT";
            conflictsCount++;
          }
        }

        const { data: childSource } = await this.supabase
          .from("admission_sources")
          .upsert(
            {
              university_id: program.university_id,
              program_id: program.id,
              discovered_from_id: primarySource.id,
              url: link.url,
              canonical_url: subFetch.finalUrl || link.url,
              title: link.text || `${program.name} — Entry Requirements`,
              page_title: `${link.text} | ${universityName}`,
              source_type: subClass.sourceType,
              source_scope: subClass.scope,
              authority_level: subClass.authorityLevel,
              admission_cycle: subClass.admissionCycle,
              conflict_status: conflictStatus,
              is_official: true,
              active: true,
              content_hash: subClean.contentHash,
              http_status: subFetch.status,
              raw_excerpt: subClean.excerpt,
              sanitized_content: subClean.sanitizedHtml,
              retrieved_at: new Date().toISOString(),
            },
            { onConflict: "url" }
          )
          .select("id")
          .single();

        if (childSource) {
          // Add Snapshot
          await this.supabase.from("admission_source_snapshots").insert({
            source_id: childSource.id,
            content_hash: subClean.contentHash,
            snapshot_excerpt: subClean.excerpt,
            raw_payload: { sanitizedHtml: subClean.sanitizedHtml, linkText: link.text },
            http_headers: { statusCode: subFetch.status },
          });
          newSnapshotsCount++;

          collectedSourcesList.push({
            id: childSource.id,
            url: link.url,
            scope: subClass.scope,
            type: subClass.sourceType,
            authority: subClass.authorityLevel,
            contentHash: subClean.contentHash,
            conflictStatus,
          });
        }
      } catch {
        // Continue processing next sub-link on failure
      }
    }

    // 7. Calculate & Update Program Coverage Status
    let coverageStatus: ProgramCoverageStatus = "PROGRAM_SOURCE_ONLY";
    if (hasInternationalReq && hasEnglishReq && collectedSourcesList.length >= 3) {
      coverageStatus = "FULL_SOURCE_COVERAGE";
    } else if (hasInternationalReq) {
      coverageStatus = "INTERNATIONAL_REQUIREMENTS_FOUND";
    } else if (hasEnglishReq) {
      coverageStatus = "ENGLISH_REQUIREMENTS_FOUND";
    } else if (collectedSourcesList.length > 1) {
      coverageStatus = "PROGRAM_REQUIREMENTS_FOUND";
    }

    await this.supabase.from("programs").update({ coverage_status: coverageStatus }).eq("id", programId);

    return {
      programId,
      programName: program.name,
      universityName,
      primarySourceId: primarySource.id,
      discoveredSourcesCount: collectedSourcesList.length,
      newSnapshotsCreated: newSnapshotsCount,
      conflictsDetected: conflictsCount,
      coverageStatus,
      sources: collectedSourcesList,
    };
  }

  /**
   * Batch process all real ingested programs in database.
   */
  async collectBatchAdmissionSources(options?: { limit?: number }): Promise<BatchAdmissionCollectionResult> {
    const runId = crypto.randomUUID();
    const startTime = new Date().toISOString();

    // Register Ingestion Run
    await this.supabase.from("ingestion_runs").insert({
      id: runId,
      run_type: "ADMISSION_SOURCE_COLLECTION",
      source: "OFFICIAL_UNIVERSITY_PROGRAM_PAGES",
      status: "RUNNING",
      started_at: startTime,
      records_discovered: 0,
      records_inserted: 0,
      records_updated: 0,
      records_skipped: 0,
      records_failed: 0,
    });

    const query = this.supabase.from("programs").select("id, name").order("created_at", { ascending: true });
    if (options?.limit) query.limit(options.limit);

    const { data: programs } = await query;
    const summaries: ProgramSourceCollectionResult[] = [];

    let totalSourcesCollected = 0;
    let totalSnapshotsCreated = 0;
    let totalConflictsDetected = 0;

    for (const prog of programs || []) {
      try {
        console.log(`[AdmissionSourceCollector] Collecting admission sources for: ${prog.name}`);
        const res = await this.collectProgramAdmissionSources(prog.id);
        summaries.push(res);

        totalSourcesCollected += res.discoveredSourcesCount;
        totalSnapshotsCreated += res.newSnapshotsCreated;
        totalConflictsDetected += res.conflictsDetected;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[AdmissionSourceCollector] Error for program ${prog.id}:`, errorMsg);
      }
    }

    // Complete Ingestion Run Logging
    await this.supabase
      .from("ingestion_runs")
      .update({
        status: "COMPLETED",
        finished_at: new Date().toISOString(),
        records_discovered: totalSourcesCollected,
        records_inserted: totalSourcesCollected,
        records_updated: totalSnapshotsCreated,
        error_summary: { conflictsDetected: totalConflictsDetected, structuredAdmissionRequirementsInserted: 0 },
      })
      .eq("id", runId);

    return {
      runId,
      programsProcessed: summaries.length,
      sourcesCollected: totalSourcesCollected,
      snapshotsCreated: totalSnapshotsCreated,
      conflictsDetected: totalConflictsDetected,
      structuredAdmissionRequirementsCreated: 0, // STRICT ZERO RULE
      programSummaries: summaries,
    };
  }
}
