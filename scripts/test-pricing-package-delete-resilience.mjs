import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const migration = read("supabase/migrations/20260906260000_safe_pricing_package_deletion.sql");
const client = read("src/lib/admin/pricing.ts");
const page = read("src/app/admin/fiyatlandirma/page.tsx");

assert.match(migration, /add column if not exists archived_at timestamptz/i);
assert.match(migration, /from public\.payment_transactions where package_id = p_package_id/i);
assert.match(migration, /from public\.student_package_purchases where package_id = p_package_id/i);
assert.match(migration, /set active = false,[\s\S]*featured = false,[\s\S]*archived_at = coalesce/i);
assert.match(migration, /if v_has_history then[\s\S]*return 'archived'/i);
assert.match(migration, /delete from public\.pricing_packages where id = p_package_id;[\s\S]*return 'deleted'/i);
assert.match(client, /\.is\("archived_at", null\)/);
assert.match(client, /\.rpc\("admin_delete_pricing_package", \{ p_package_id: id \}\)/);
assert.doesNotMatch(client, /from\("pricing_packages"\)[\s\S]{0,100}\.delete\(\)[\s\S]{0,80}\.eq\("id", id\)/);
assert.match(page, /ödeme kayıtları etkilenmez/);
assert.match(page, /deleteAdminPricingPackage\(/);

console.log("Pricing package deletion resilience assertions passed.");
