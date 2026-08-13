import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { safeFetchUrl } from "../source-discovery/ssrf-fetcher";
import { normalizeDomain } from "../source-discovery/domain-normalizer";
import { AdapterRegistry } from "./adapter-registry";
import { ExtractedProgramRecord, AdapterContext } from "./adapter-interface";

export interface ProgramIngestionRunResult {
  runId: string;
  universitiesProcessed: number;
  sourcesProcessed: number;
  programLinksDiscovered: number;
  programsInserted: number;
  programsUpdated: number;
  programsSkipped: number;
  programsFailed: number;
  admissionRequirementsInserted: 0;
  failures: Array<{ universityId: string; sourceUrl: string; reason: string }>;
}

export class ProgramIngestionEngine {
  private supabase: SupabaseClient;
  private registry: AdapterRegistry;

  constructor(supabaseClient?: SupabaseClient) {
    if (supabaseClient) {
      this.supabase = supabaseClient;
    } else {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
      this.supabase = createClient(url, key);
    }
    this.registry = new AdapterRegistry();
  }

  /**
   * Ingests real programs for a single university from its verified source registry.
   */
  async ingestUniversityPrograms(universityId: string): Promise<{
    discovered: number;
    inserted: number;
    updated: number;
    skipped: number;
    failed: number;
  }> {
    // 1. Fetch university name
    const { data: univ } = await this.supabase
      .from("universities")
      .select("id, name, website")
      .eq("id", universityId)
      .single();

    if (!univ) {
      throw new Error(`UNIVERSITY_NOT_FOUND: ${universityId}`);
    }

    // 2. Fetch verified program catalog sources
    const { data: sources } = await this.supabase
      .from("university_source_registry")
      .select("*")
      .eq("university_id", universityId)
      .in("verification_status", ["VERIFIED", "HIGH_CONFIDENCE"]);

    if (!sources || sources.length === 0) {
      console.log(`[ProgramIngestionEngine] SKIP — NO VERIFIED PROGRAM SOURCE for ${univ.name}`);
      return { discovered: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 };
    }

    // Filter out non-program sources (e.g. entry requirements)
    const catalogSources = sources.filter(
      (s) =>
        s.source_type !== "ENTRY_REQUIREMENTS" &&
        s.source_type !== "ENGLISH_LANGUAGE_REQUIREMENTS" &&
        s.source_type !== "COUNTRY_REQUIREMENTS"
    );

    if (catalogSources.length === 0) {
      return { discovered: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 };
    }

    console.log(`[ProgramIngestionEngine] Ingesting programs for: ${univ.name} (${catalogSources.length} verified sources)`);

    let totalDiscovered = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const source of catalogSources) {
      const normDomain = normalizeDomain(source.url);
      const adapter = this.registry.getAdapter(source.url, normDomain.domain);

      const ctx: AdapterContext = {
        universityId: univ.id,
        universityName: univ.name,
        officialDomain: normDomain.domain,
        sourceId: source.id,
        sourceUrl: source.url,
      };

      // Fetch Catalog HTML via SSRF proxy
      const fetchRes = await safeFetchUrl(source.url, { timeoutMs: 7000 });
      if (!fetchRes.ok || !fetchRes.body) {
        totalFailed++;
        continue;
      }

      // Discover Program Links
      const links = await adapter.discoverProgramLinks(fetchRes.body, fetchRes.finalUrl, ctx);
      totalDiscovered += links.length;

      // Extract and ingest each program page (cap at 10 pages per source)
      const targetLinks = links.slice(0, 10);
      const batchSize = 5;

      for (let i = 0; i < targetLinks.length; i += batchSize) {
        const batch = targetLinks.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (link) => {
            try {
              const progRes = await safeFetchUrl(link.url, { timeoutMs: 4000 });
              if (!progRes.ok || !progRes.body) {
                totalSkipped++;
                return;
              }

              const extracted = await adapter.extractProgram(progRes.body, progRes.finalUrl, ctx);
              if (!extracted) {
                totalSkipped++;
                return;
              }

              // Idempotent Upsert into programs table
              const upsertRes = await this.upsertProgram(extracted, source.id);
              if (upsertRes.status === "INSERTED") totalInserted++;
              else if (upsertRes.status === "UPDATED") totalUpdated++;
              else totalSkipped++;
            } catch (err) {
              totalFailed++;
            }
          })
        );
      }
    }

    console.log(`[ProgramIngestionEngine] Finished ${univ.name}: ${totalInserted} inserted, ${totalUpdated} updated.`);

    return {
      discovered: totalDiscovered,
      inserted: totalInserted,
      updated: totalUpdated,
      skipped: totalSkipped,
      failed: totalFailed,
    };
  }

  /**
   * Idempotent program upsert using official_program_url or (university_id, normalized_name, degree_level).
   */
  private async upsertProgram(
    extracted: ExtractedProgramRecord,
    registrySourceId: string
  ): Promise<{ id: string; status: "INSERTED" | "UPDATED" | "SKIPPED" }> {
    // 0. Ensure an official admission_sources row exists for source provenance FK
    let dbSourceId: string | null = null;
    const { data: sourceRow } = await this.supabase
      .from("admission_sources")
      .select("id")
      .eq("url", extracted.officialProgramUrl)
      .maybeSingle();

    if (sourceRow) {
      dbSourceId = sourceRow.id;
    } else {
      const { data: newSource } = await this.supabase
        .from("admission_sources")
        .insert({
          url: extracted.officialProgramUrl,
          canonical_url: extracted.officialProgramUrl,
          source_type: "OFFICIAL_PROGRAM_PAGE",
          university_id: extracted.universityId,
          is_official: true,
          verified: true,
          publisher_type: "OFFICIAL_UNIVERSITY",
          last_retrieved_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      dbSourceId = newSource?.id || null;
    }

    // 1. Check existing by official_program_url
    const { data: existingUrl } = await this.supabase
      .from("programs")
      .select("id")
      .eq("university_id", extracted.universityId)
      .eq("official_program_url", extracted.officialProgramUrl)
      .maybeSingle();

    if (existingUrl) {
      await this.supabase
        .from("programs")
        .update({
          name: extracted.name,
          degree_title: extracted.degreeTitle,
          degree_level: extracted.degreeLevel,
          field_of_study_id: extracted.fieldOfStudyId,
          study_mode: extracted.studyMode,
          language: extracted.language,
          duration_value: extracted.durationValue,
          duration_unit: extracted.durationUnit,
          source_id: dbSourceId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingUrl.id);

      return { id: existingUrl.id, status: "UPDATED" };
    }

    // 2. Check existing by (university_id, normalized_name, degree_level)
    const { data: existingName } = await this.supabase
      .from("programs")
      .select("id")
      .eq("university_id", extracted.universityId)
      .eq("normalized_name", extracted.normalizedName)
      .eq("degree_level", extracted.degreeLevel)
      .maybeSingle();

    if (existingName) {
      await this.supabase
        .from("programs")
        .update({
          official_program_url: extracted.officialProgramUrl,
          degree_title: extracted.degreeTitle,
          source_id: dbSourceId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingName.id);

      return { id: existingName.id, status: "UPDATED" };
    }

    // 3. Insert New Program
    const { data: inserted, error } = await this.supabase
      .from("programs")
      .insert({
        university_id: extracted.universityId,
        name: extracted.name,
        normalized_name: extracted.normalizedName,
        slug: `${extracted.slug}-${Math.floor(1000 + Math.random() * 9000)}`,
        degree_level: extracted.degreeLevel,
        degree_title: extracted.degreeTitle,
        field_of_study_id: extracted.fieldOfStudyId,
        campus: extracted.campus,
        study_mode: extracted.studyMode,
        language: extracted.language,
        duration_value: extracted.durationValue,
        duration_unit: extracted.durationUnit,
        official_program_url: extracted.officialProgramUrl,
        source_id: dbSourceId,
        active: true,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      throw new Error(`INSERT_PROGRAM_FAILED: ${error?.message}`);
    }

    // Insert External Identifier record
    if (extracted.externalId) {
      await this.supabase.from("program_external_identifiers").upsert(
        {
          program_id: inserted.id,
          source_type: "OFFICIAL_URL",
          external_id: extracted.externalId,
          source_url: extracted.officialProgramUrl,
          metadata: extracted.rawEvidence,
        },
        { onConflict: "program_id,source_type,external_id" }
      );
    }

    // Insert Search Aliases for Fast Compound Search
    const cleanUnivName = (extracted.rawEvidence?.university as string || "")
      .toLowerCase()
      .replace(/university of |university college |college /g, "")
      .trim();

    const aliasesToInsert = [
      {
        entity_type: "PROGRAM",
        entity_id: inserted.id,
        alias: extracted.name,
        normalized_alias: extracted.normalizedName,
        language: "en",
        priority: 10,
      },
    ];

    if (cleanUnivName) {
      aliasesToInsert.push({
        entity_type: "PROGRAM",
        entity_id: inserted.id,
        alias: `${cleanUnivName} ${extracted.name}`,
        normalized_alias: `${cleanUnivName} ${extracted.normalizedName}`,
        language: "en",
        priority: 20,
      });
    }

    for (const a of aliasesToInsert) {
      await this.supabase.from("search_aliases").upsert(a, { onConflict: "entity_type,alias" });
    }

    return { id: inserted.id, status: "INSERTED" };
  }

  /**
   * Runs pilot program ingestion across representative universities.
   */
  async runPilotIngestion(): Promise<ProgramIngestionRunResult> {
    const startedAt = new Date().toISOString();

    const { data: runData } = await this.supabase
      .from("ingestion_runs")
      .insert({
        run_type: "PROGRAM_INGESTION",
        source: "OFFICIAL_PROGRAM_INGESTION_ENGINE",
        started_at: startedAt,
        status: "RUNNING",
      })
      .select("id")
      .single();

    const runId = runData?.id || "run-program-local";

    const { data: univs } = await this.supabase
      .from("universities")
      .select("id, name")
      .in("name", [
        "University of Oxford",
        "University of Cambridge",
        "University College London",
        "Imperial College London",
        "Harvard University",
        "Stanford University",
        "Bocconi University",
        "Massachusetts Institute of Technology",
        "ETH Zurich",
      ]);

    let totalDiscovered = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    const failures: Array<{ universityId: string; sourceUrl: string; reason: string }> = [];

    for (const u of univs || []) {
      try {
        const res = await this.ingestUniversityPrograms(u.id);
        totalDiscovered += res.discovered;
        totalInserted += res.inserted;
        totalUpdated += res.updated;
        totalSkipped += res.skipped;
        totalFailed += res.failed;
      } catch (err) {
        failures.push({ universityId: u.id, sourceUrl: u.name, reason: (err as Error).message });
      }
    }

    const finishedAt = new Date().toISOString();

    await this.supabase.from("ingestion_runs").update({
      finished_at: finishedAt,
      status: "COMPLETED",
      records_discovered: totalDiscovered,
      records_inserted: totalInserted,
      records_updated: totalUpdated,
      records_skipped: totalSkipped,
      records_failed: totalFailed,
      error_summary: { failures },
    }).eq("id", runId);

    return {
      runId,
      universitiesProcessed: univs?.length || 0,
      sourcesProcessed: (univs?.length || 0) * 2,
      programLinksDiscovered: totalDiscovered,
      programsInserted: totalInserted,
      programsUpdated: totalUpdated,
      programsSkipped: totalSkipped,
      programsFailed: totalFailed,
      admissionRequirementsInserted: 0,
      failures,
    };
  }
}
