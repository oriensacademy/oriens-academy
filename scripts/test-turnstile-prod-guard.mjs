import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Exercises scripts/check-turnstile-prod-key.mjs against throwaway fixtures.
// Fixture keys are synthetic; no real key is read or printed.
const guard = path.resolve("scripts/check-turnstile-prod-key.mjs");
const fakeProductionKey = "0x4AAAAAAA" + "FIXTUREONLY000";
const testSiteKey = "1x" + "0".repeat(20) + "AA";
const invisibleTestSiteKey = "1x" + "0".repeat(20) + "BB";

const env = { ...process.env };
delete env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function run(args) {
  const result = spawnSync(process.execPath, [guard, ...args], { env, encoding: "utf8" });
  const output = `${result.stdout}${result.stderr}`;
  assert.doesNotMatch(output, /0x4AAAAAAAFIXTUREONLY/, "guard must not print key values");
  assert.doesNotMatch(output, /[123]x0{20}/, "guard must not print key values");
  return result.status;
}

const root = mkdtempSync(path.join(tmpdir(), "turnstile-guard-"));
try {
  const envRoot = (name, content) => {
    const dir = path.join(root, name);
    mkdirSync(dir, { recursive: true });
    if (content) writeFileSync(path.join(dir, ".env.production.local"), content);
    return dir;
  };

  assert.equal(run(["--env", "--root", envRoot("test-key", `NEXT_PUBLIC_TURNSTILE_SITE_KEY=${testSiteKey}\n`)]), 1);
  assert.equal(run(["--env", "--root", envRoot("invisible-test-key", `NEXT_PUBLIC_TURNSTILE_SITE_KEY=${invisibleTestSiteKey}\n`)]), 1);
  assert.equal(run(["--env", "--root", envRoot("missing")]), 1);
  assert.equal(run(["--env", "--root", envRoot("prod-key", `NEXT_PUBLIC_TURNSTILE_SITE_KEY=${fakeProductionKey}\n`)]), 0);

  // .env.local carries the dev test key, .env.production.local overrides it for builds.
  const layered = envRoot("layered", `NEXT_PUBLIC_TURNSTILE_SITE_KEY=${fakeProductionKey}\n`);
  writeFileSync(path.join(layered, ".env.local"), `NEXT_PUBLIC_TURNSTILE_SITE_KEY=${testSiteKey}\n`);
  assert.equal(run(["--env", "--root", layered]), 0);
  console.log("TURNSTILE_GUARD_ENV=PASS");

  const outDir = (name, js) => {
    const dir = path.join(root, name, "_next", "static", "chunks");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "page.js"), js);
    return path.join(root, name);
  };
  assert.equal(run(["--out", outDir("out-test-key", `render({sitekey:"${testSiteKey}"})`)]), 1);
  assert.equal(run(["--out", outDir("out-clean", `render({sitekey:"${fakeProductionKey}"})`)]), 0);
  console.log("TURNSTILE_GUARD_BUNDLE=PASS");
  console.log("TURNSTILE TEST KEY PROD GUARD=PASS");
} finally {
  rmSync(root, { recursive: true, force: true });
}
