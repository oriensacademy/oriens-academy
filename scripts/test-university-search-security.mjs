#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = resolve(import.meta.dirname, "..");
const env = Object.fromEntries(readFileSync(resolve(root, ".env.local"), "utf8")
  .split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("="))
  .map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
  }));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = env.ADMIN_AUTH_EMAIL;
if (!url || !anonKey || !serviceKey || !adminEmail) throw new Error("Missing security-test configuration");

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const anon = createClient(url, anonKey, options);
const service = createClient(url, serviceKey, options);
const rpc = (client, query, limit = 10, country = null) => client.rpc("search_autocomplete_entities_v2", {
  p_query: query, p_limit: limit, p_country_iso2: country,
});
const forbidden = /Bristol and Bath Science Park|Middle School|School District|Training Cent(er|re)|Professional Society/i;
const expectedColumns = ["badge","country_iso2","country_name","entity_id","entity_type","match_layer","official_url","score","slug","subtitle","title"];

const anonBristol = await rpc(anon, "bristol");
assert.ifError(anonBristol.error);
assert.equal(anonBristol.data?.filter((row) => row.entity_type === "UNIVERSITY")[0]?.title, "University of Bristol");
assert.ok(anonBristol.data.every((row) => !forbidden.test(row.title)));
assert.deepEqual(Object.keys(anonBristol.data[0]).sort(), expectedColumns);

const clamped = await rpc(anon, "bristol", 999);
assert.ifError(clamped.error);
assert.ok(clamped.data.filter((row) => row.entity_type === "UNIVERSITY").length <= 10, "public limit clamp");
const injection = await rpc(anon, "' OR 1=1; --", 999, "GB' OR '1'='1");
assert.ifError(injection.error);
assert.ok(injection.data.length <= 20);
assert.ok(injection.data.every((row) => !forbidden.test(row.title)));
const crafted = await rpc(anon, "bristol and bath science park", 10, "GB");
assert.ifError(crafted.error);
assert.ok(crafted.data.every((row) => !forbidden.test(row.title)));

const ineligibleLookup = await service.from("universities").select("id")
  .eq("normalized_name", "bristol and bath science park").maybeSingle();
assert.ifError(ineligibleLookup.error);
assert.ok(ineligibleLookup.data?.id, "known ineligible fixture exists");
const direct = await anon.from("universities").select("id,name")
  .eq("id", ineligibleLookup.data.id);
assert.ifError(direct.error);
assert.equal(direct.data.length, 0, "direct-table RLS still hides ineligible institution");

// Generate (do not send) a one-time link for an existing admin, then exchange
// its hash for an authenticated session. No user, password, or email is changed.
const generated = await service.auth.admin.generateLink({ type: "magiclink", email: adminEmail });
assert.ifError(generated.error);
const tokenHash = generated.data?.properties?.hashed_token;
assert.ok(tokenHash, "authenticated test token hash");
const authenticated = createClient(url, anonKey, options);
const verified = await authenticated.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
assert.ifError(verified.error);
const authBristol = await rpc(authenticated, "bristol");
assert.ifError(authBristol.error);
assert.equal(authBristol.data?.filter((row) => row.entity_type === "UNIVERSITY")[0]?.title, "University of Bristol");
assert.ok(authBristol.data.every((row) => !forbidden.test(row.title)));
await authenticated.auth.signOut({ scope: "local" });

console.log("University search anon/authenticated security regression: PASS");
