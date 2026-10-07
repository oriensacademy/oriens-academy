import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const migration = read("supabase/migrations/20260906250000_safe_discount_coupon_deletion.sql");
const client = read("src/lib/coupons/client.ts");
const page = read("src/app/admin/indirim-kuponlari/page.tsx");

assert.match(migration, /add column if not exists archived_at timestamptz/i);
assert.match(migration, /from public\.discount_coupon_redemptions[\s\S]*where coupon_id = p_coupon_id/i);
assert.match(migration, /set active = false,[\s\S]*archived_at = coalesce/i);
assert.match(migration, /if v_has_redemptions then[\s\S]*return 'archived'/i);
assert.match(migration, /delete from public\.discount_coupons[\s\S]*return 'deleted'/i);
assert.doesNotMatch(migration, /discount_coupon_redemptions[\s\S]{0,120}on delete cascade/i);
assert.match(client, /\.is\("archived_at", null\)/);
assert.match(client, /\.rpc\("admin_delete_discount_coupon", \{ p_coupon_id: id \}\)/);
assert.doesNotMatch(client, /from\("discount_coupons"\)[\s\S]{0,100}\.delete\(\)[\s\S]{0,80}\.eq\("id", id\)/);
assert.match(page, /Daha önce bu kuponla yapılmış ödemeler etkilenmez/);
assert.match(page, /deleteAdminCoupon\(/);

console.log("Coupon deletion resilience assertions passed.");
