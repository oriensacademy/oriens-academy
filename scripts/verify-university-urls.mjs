#!/usr/bin/env node

import { lookup } from "node:dns/promises";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const LIMIT = numberArg("--limit", 300, 1, 2000);
const CONCURRENCY = numberArg("--concurrency", 4, 1, 8);
const REQUEST_TIMEOUT_MS = numberArg("--timeout-ms", 8000, 2000, 30000);
const RATE_DELAY_MS = numberArg("--delay-ms", 150, 0, 5000);
const AFTER = stringArg("--after");
const OUTPUT = stringArg("--output") || join(ROOT, ".cache", "universities", "url-verification-qa.json");

loadEnv(join(ROOT, ".env.local"));

function numberArg(name, fallback, min, max) {
  const raw = args.find((arg) => arg.startsWith(`${name}=`))?.split("=")[1];
  const parsed = Number(raw ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function stringArg(name) {
  return args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1) || null;
}

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const split = line.indexOf("=");
    if (split < 1) continue;
    const key = line.slice(0, split).trim();
    let value = line.slice(split + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function sleep(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function normalizeHost(hostname) {
  return hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

function evidenceDomains(row) {
  const raw = row.source_metadata?.official_domain_evidence;
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return [...new Set(values.map((value) => {
    try {
      return normalizeHost(String(value).includes("://") ? new URL(String(value)).hostname : String(value));
    } catch {
      return "";
    }
  }).filter(Boolean))];
}

function hostMatches(hostname, domains) {
  const host = normalizeHost(hostname);
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`));
}

function candidateFor(row) {
  const source = row.verified_official_url || row.website || null;
  if (!source) return null;
  try {
    const parsed = new URL(source);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    parsed.protocol = "https:";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

async function requestWithRedirects(candidate, maxRedirects = 5) {
  const chain = [candidate];
  let current = candidate;
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const response = await fetch(current, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { "User-Agent": "OriensAcademy-OfficialUrlVerifier/2.0 (+https://oriens-academy.com)" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) return { status: response.status, finalUrl: current, chain, failure: "redirect_without_location" };
      current = new URL(location, current).toString();
      chain.push(current);
      continue;
    }
    return { status: response.status, finalUrl: current, chain, failure: null };
  }
  return { status: null, finalUrl: current, chain, failure: "redirect_limit" };
}

async function verify(row) {
  const checkedAt = new Date().toISOString();
  const candidate = candidateFor(row);
  const domains = evidenceDomains(row);
  if (!candidate) return result(row, { candidate: null, finalUrl: null, status: "missing", checkedAt, reason: "no_source_candidate", domains });

  try {
    await lookup(new URL(candidate).hostname);
  } catch (error) {
    return result(row, { candidate, finalUrl: null, status: "broken", checkedAt, reason: `dns:${error.code || "lookup_failed"}`, domains });
  }

  try {
    const response = await requestWithRedirects(candidate);
    const finalHost = new URL(response.finalUrl).hostname;
    const identityMatch = domains.length > 0 && hostMatches(finalHost, domains);
    const redirected = response.chain.length > 1;
    let status = "unverified";
    let reason = response.failure;
    let retryAfter = null;

    if (response.status && response.status >= 200 && response.status < 400 && identityMatch) {
      status = redirected ? "redirect_verified" : "verified";
    } else if (response.status && [404, 410].includes(response.status) && identityMatch) {
      status = "broken";
      reason = `http_${response.status}`;
    } else if (response.status && response.status >= 200 && response.status < 400 && domains.length > 0 && !identityMatch) {
      status = "wrong_domain";
      reason = "final_domain_mismatches_source_evidence";
    } else {
      reason = reason || `http_${response.status || "unknown"}`;
      retryAfter = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }

    return result(row, {
      candidate,
      finalUrl: response.finalUrl,
      status,
      checkedAt,
      reason,
      domains,
      redirectChain: response.chain,
      httpStatus: response.status,
      retryAfter,
      identityMatch,
    });
  } catch (error) {
    const transient = error?.name === "TimeoutError" || error?.name === "AbortError" || /timeout|fetch failed/i.test(String(error?.message));
    return result(row, {
      candidate,
      finalUrl: null,
      status: "unverified",
      checkedAt,
      reason: transient ? `transient:${error.name || "network"}` : `network:${error.code || error.name || "failure"}`,
      domains,
      retryAfter: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }
}

function result(row, values) {
  return { universityId: row.id, name: row.name, rorId: row.ror_id, ...values };
}

async function applyResult(supabase, verification) {
  const candidateUrl = verification.candidate || verification.finalUrl;
  if (!candidateUrl) return;
  const ledger = {
    university_id: verification.universityId,
    candidate_url: candidateUrl,
    source: "resumable verifier v2: existing source candidate",
    retrieved_at: verification.checkedAt,
    redirect_chain: verification.redirectChain || [],
    final_domain: verification.finalUrl ? normalizeHost(new URL(verification.finalUrl).hostname) : null,
    verification_status: verification.status,
    verified_at: ["verified", "redirect_verified"].includes(verification.status) ? verification.checkedAt : null,
    verified_by: "worker:verify-university-urls-v2",
    final_url: ["verified", "redirect_verified"].includes(verification.status) ? verification.finalUrl : null,
    http_status: verification.httpStatus || null,
    failure_reason: verification.reason || null,
    evidence: { official_domain_evidence: verification.domains, identity_match: verification.identityMatch ?? false },
    checked_at: verification.checkedAt,
    retry_after: verification.retryAfter || null,
  };
  const { error: ledgerError } = await supabase.from("university_url_verifications").insert(ledger);
  if (ledgerError) throw ledgerError;

  const verified = ["verified", "redirect_verified"].includes(verification.status);
  const { error: updateError } = await supabase.from("universities").update({
    verified_official_url: verified ? verification.finalUrl : null,
    verified_url: verified,
    verified_at: verified ? verification.checkedAt : null,
    url_verification_status: verification.status,
    url_verification_source: "resumable verifier v2",
    url_checked_at: verification.checkedAt,
    url_verified_by: "worker:verify-university-urls-v2",
  }).eq("id", verification.universityId);
  if (updateError) throw updateError;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = APPLY ? process.env.SUPABASE_SERVICE_ROLE_KEY : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);
  if (!url || !key) throw new Error(APPLY ? "--apply requires Supabase URL and service-role key" : "Dry-run requires Supabase URL and anon key");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const makeQuery = (columns) => {
    let query = supabase.from("universities").select(columns)
      .eq("active", true).eq("eligibility_status", "eligible").order("id").limit(LIMIT);
    if (AFTER) query = query.gt("id", AFTER);
    return query;
  };
  let { data: rows, error } = await makeQuery("id,name,ror_id,website,verified_official_url,url_verification_status,url_checked_at,source_metadata");
  if (error?.message?.includes("verified_official_url")) {
    ({ data: rows, error } = await makeQuery("id,name,ror_id,website,url_verification_status,url_checked_at,source_metadata"));
    rows = (rows || []).map((row) => ({ ...row, verified_official_url: null }));
  }
  if (error) throw error;
  rows ||= [];

  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const index = cursor++;
      if (index > 0 && RATE_DELAY_MS) await sleep(RATE_DELAY_MS);
      const verification = await verify(rows[index]);
      if (APPLY) await applyResult(supabase, verification);
      results[index] = verification;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length || 1) }, () => worker()));

  const counts = Object.fromEntries(["present","verified","redirect_verified","unverified","broken","wrong_domain","missing"]
    .map((status) => [status, status === "present"
      ? results.filter((item) => item.candidate).length
      : results.filter((item) => item.status === status).length]));
  const report = {
    generatedAt: new Date().toISOString(), apply: APPLY, requested: LIMIT, sampled: results.length,
    concurrency: CONCURRENCY, delayMs: RATE_DELAY_MS, timeoutMs: REQUEST_TIMEOUT_MS,
    after: AFTER, lastId: rows.at(-1)?.id || null, counts, results,
  };
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
