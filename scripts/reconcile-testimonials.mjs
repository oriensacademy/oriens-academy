#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseTestimonialSource } from "./lib/testimonial-source.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = process.env.TESTIMONIAL_SOURCE || "C:\\Users\\merto\\Desktop\\yorumlar.txt";
const APPLY = process.argv.includes("--apply");
const WRITE_STATIC = process.argv.includes("--write-static");
const IMPORT_ID = "yorumlar.txt:2026-08-29";

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const index = raw.indexOf("=");
    if (index < 1) continue;
    const key = raw.slice(0, index).trim();
    let value = raw.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

loadEnv(join(ROOT, ".env.local"));

async function main() {
  const parsed = parseTestimonialSource(SOURCE);
  const migration = readFileSync(join(ROOT, "supabase", "migrations", "20260830000002_import_all_testimonials.sql"), "utf8");
  const priorIds = new Set([...migration.matchAll(/VALUES \('([0-9a-f-]{36})'/g)].map((match) => match[1]));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment is required for reconciliation QA");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: dbRows, error } = await supabase.from("testimonials").select("*").order("created_at", { ascending: false });
  if (error) throw error;

  const backupDir = join(ROOT, "local-backups");
  mkdirSync(backupDir, { recursive: true });
  const backupFile = join(backupDir, `testimonials-before-reconciliation-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(backupFile, `${JSON.stringify(dbRows, null, 2)}\n`);

  const priorImported = dbRows.filter((row) => priorIds.has(row.id));
  const nonImported = dbRows.filter((row) => !priorIds.has(row.id));
  const matches = [];
  const unmatched = [];
  for (const source of parsed.uniqueRecords) {
    const candidates = priorImported.filter((row) =>
      row.name === source.author && row.quote === source.body &&
      (row.source_topic || row.context || "") === source.topic &&
      String(row.created_at || "").slice(0, 10) === source.dateIso
    );
    if (candidates.length) matches.push({ source, canonical: candidates[0], duplicates: candidates.slice(1) });
    else unmatched.push(source);
  }

  const provenDuplicateRows = matches.flatMap((match) => match.duplicates).filter((row) => priorIds.has(row.id));
  if (WRITE_STATIC) {
    const staticFile = join(ROOT, "src", "data", "imported-testimonials.json");
    const existingStatic = JSON.parse(readFileSync(staticFile, "utf8"));
    const reconciledStatic = parsed.uniqueRecords.map((source, index) => {
      const existing = existingStatic.find((row) =>
        row.name === source.author && row.quote === source.body && row.dateStr === source.dateText
      );
      if (!existing) throw new Error(`Static testimonial match missing for source block ${source.rawBlockIndex}`);
      return { ...existing, sourceHash: source.sourceHash, displayOrder: index + 1 };
    });
    writeFileSync(staticFile, `${JSON.stringify(reconciledStatic, null, 2)}\n`);
  }
  if (APPLY) {
    for (const batch of chunks(matches, 10)) {
      await Promise.all(batch.map(async ({ source, canonical }) => {
        const { error: updateError } = await supabase.from("testimonials").update({
          source_hash: source.sourceHash,
          source_author: source.author,
          source_date: source.dateIso,
          source_import_id: IMPORT_ID,
          imported_from_source: true,
        }).eq("id", canonical.id);
        if (updateError) throw updateError;
      }));
    }
    for (const row of provenDuplicateRows) {
      const { error: deleteError } = await supabase.from("testimonials").delete().eq("id", row.id);
      if (deleteError) throw deleteError;
    }
  }

  const report = {
    source: SOURCE,
    raw_parsed_blocks: parsed.rawBlocks.length,
    valid_testimonial_records: parsed.validRecords.length,
    unique_source_hash_records: parsed.uniqueRecords.length,
    duplicate_blocks_in_file: parsed.duplicateBlocks,
    db_testimonials_before_reconciliation: dbRows.length,
    prior_import_records: priorImported.length,
    non_imported_existing_testimonials: nonImported.length,
    matched_unique_source_records: matches.length,
    unmatched_source_records: unmatched.length,
    proven_duplicate_importer_rows: provenDuplicateRows.length,
    duplicate_importer_rows_removed: APPLY ? provenDuplicateRows.length : 0,
    original_texts_modified: 0,
    backup_file: backupFile,
    applied: APPLY,
    static_dataset_written: WRITE_STATIC,
  };
  writeFileSync(join(ROOT, "data", "testimonials-reconciliation-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (unmatched.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
