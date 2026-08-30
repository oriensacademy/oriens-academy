import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((line) => line && !line.startsWith("#") && line.includes("="))
  .map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")]; }));
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const expectedPrices = { single: 3200, package5: 15000, package10: 27000, package20: 51000, package30: 72000 };
const { data: packages, error: packageError } = await service.from("pricing_packages")
  .select("id,lesson_count,price_amount,discount_percentage,description_tr,description_en")
  .in("id", Object.keys(expectedPrices));
if (packageError) throw packageError;
for (const row of packages) assert.equal(Number(row.price_amount), expectedPrices[row.id], `${row.id} price changed`);
const package5 = packages.find((row) => row.id === "package5");
const package10 = packages.find((row) => row.id === "package10");
assert.equal(package5?.lesson_count, 5);
assert.equal(package10?.lesson_count, 10);
assert.equal(package5?.description_tr, "Düzenli çalışmaya başlamak ve kısa vadeli konu hedeflerini takip etmek için esnek paket.");
assert.equal(package5?.description_en, "A flexible package for starting structured study and tracking short-term topic goals.");
assert.equal(package10?.description_tr, "Sınav hazırlığını, konu takibini ve düzenli ilerleme değerlendirmesini birlikte yürüten dengeli paket.");
assert.equal(package10?.description_en, "A balanced package combining exam preparation, topic tracking and regular progress review.");

const { data: imported, error: testimonialError } = await service.from("testimonials")
  .select("id,source_hash,source_author,source_date,source_topic,imported_from_source,pinned_at,pin_order,archived_at")
  .eq("imported_from_source", true);
if (testimonialError) throw testimonialError;
assert.equal(imported.length, 110);
assert.equal(new Set(imported.map((row) => row.source_hash)).size, 110);
assert.ok(imported.every((row) => row.source_hash && row.source_author && row.source_date && row.source_topic));

const { data: publicRows, error: publicError } = await anon.from("testimonials")
  .select("active,verified,archived_at");
if (publicError) throw publicError;
assert.ok(publicRows.every((row) => row.active === true && row.verified === true && row.archived_at === null), "Public RLS exposed unapproved testimonials");

const { data: publicPackages, error: publicPackageError } = await anon.from("pricing_packages").select("id,active").eq("active", true);
if (publicPackageError) throw publicPackageError;
assert.ok(publicPackages.length >= 5, "Public pricing policy returned no active packages");

const { data: publicSearch, error: publicSearchError } = await anon.rpc("search_autocomplete_entities", { p_query: "IB", p_limit: 5 });
if (publicSearchError) throw publicSearchError;
assert.equal(publicSearch?.[0]?.title, "International Baccalaureate (IB)");

console.log(JSON.stringify({ status: "PASS", pricing: { unchanged: true, package5Copy: true, package10Copy: true }, testimonials: { imported: 110, uniqueHashes: 110, editorialColumns: true, publicApprovedOnly: true }, publicSearch: "PASS" }, null, 2));
