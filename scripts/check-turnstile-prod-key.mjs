// Production build guard for the Cloudflare Turnstile public site key.
//
//   node scripts/check-turnstile-prod-key.mjs --env [--root <dir>]   (prebuild)
//   node scripts/check-turnstile-prod-key.mjs --out [<out dir>]      (postbuild)
//
// --env resolves NEXT_PUBLIC_TURNSTILE_SITE_KEY exactly as `next build` does
// (.env.production.local > .env.local > .env.production > .env, process.env wins)
// and fails when it is missing or one of Cloudflare's published test keys.
// --out scans the exported bundle for test keys. Test keys stay allowed in
// `next dev`, which never runs these hooks. Key values are never printed.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";

// Cloudflare test sitekeys (1x/2x/3x + 20 zeros + AA|AB|BB|FF) and test secrets (+31 zeros).
const TEST_KEY_PATTERN = /\b[123]x0{20}(?:AA|AB|BB|FF)\b|\b[123]x0{31}AA\b/;
const SCANNED_EXTENSIONS = new Set([".js", ".html", ".txt", ".json", ".css"]);

function fail(reason) {
  console.error(`TURNSTILE_PROD_KEY=FAIL ${reason}`);
  process.exit(1);
}

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

async function checkEnv() {
  const root = path.resolve(argValue("--root") || ".");
  nextEnv.loadEnvConfig(root, false, { info: () => {}, error: () => {} });
  const siteKey = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "").trim();
  if (!siteKey) fail("NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set for the production build.");
  if (TEST_KEY_PATTERN.test(siteKey)) {
    fail("NEXT_PUBLIC_TURNSTILE_SITE_KEY is a Cloudflare test key; set the production site key in .env.production.local.");
  }
  console.log("TURNSTILE_PROD_KEY=PASS (env)");
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(entryPath));
    else if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) files.push(entryPath);
  }
  return files;
}

async function checkOut() {
  const outRoot = path.resolve(argValue("--out") || "out");
  const offenders = [];
  for (const file of await filesBelow(outRoot)) {
    if (TEST_KEY_PATTERN.test(await readFile(file, "utf8"))) offenders.push(path.relative(outRoot, file));
  }
  if (offenders.length) {
    fail(`Cloudflare Turnstile test key found in ${offenders.length} exported file(s): ${offenders.slice(0, 5).join(", ")}`);
  }
  console.log("TURNSTILE_PROD_KEY=PASS (bundle)");
}

if (process.argv.includes("--env")) await checkEnv();
else if (process.argv.includes("--out")) await checkOut();
else fail("usage: --env [--root <dir>] | --out [<out dir>]");
