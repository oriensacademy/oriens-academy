import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync("supabase/migrations/20260914123000_exact_doguhan_payment_history_archive.sql", "utf8");
const resetSql = fs.readFileSync("supabase/migrations/20260914100000_correct_test_account_notification_scope.sql", "utf8");
const adminPayments = fs.readFileSync("src/lib/admin/payments.ts", "utf8");
const studentData = fs.readFileSync("src/lib/student/data.ts", "utf8");

assert.match(sql, /v_email constant text := 'mail\.doguhan@gmail\.com'/);
assert.doesNotMatch(sql, /\blike\b|\bilike\b/i);
assert.match(sql, /lower\(btrim\(payer_email\)\) = v_email/g);
assert.match(sql, /v_auth_count <> 0/);
assert.match(sql, /v_payment_count <> 3/);
assert.match(sql, /v_active_payment_count <> 2/);
assert.match(sql, /v_updated_count <> 2/);
assert.match(sql, /security definer/);
assert.match(sql, /not public\.is_admin\(\)/);
assert.match(sql, /revoke all .* from public, anon/);
assert.match(sql, /grant execute .* to authenticated/);
assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
assert.doesNotMatch(sql, /update\s+auth\.|insert\s+into\s+auth\.|delete\s+from\s+auth\./i);
assert.doesNotMatch(sql, /update\s+public\.(?!payment_transactions)/i);
assert.match(sql, /set is_archived = true/);
assert.match(sql, /test_account_operational_reset/);
assert.doesNotMatch(sql, /jsonb_build_object\([\s\S]*v_email/);

assert.match(resetSql, /where not is_archived and lower\(btrim\(recipient\)\) = v_email/);
assert.match(adminPayments, /eq\("is_archived", false\)/);
assert.match(studentData, /eq\("is_archived", false\)/);

console.log("EXACT_EMAIL_ONLY=PASS");
console.log("NO_PHYSICAL_DELETE=PASS");
console.log("AUTH_AND_PASSWORD_IMMUTABLE=PASS");
console.log("FINANCIAL_ARCHIVE_ONLY=PASS");
console.log("VISIBLE_HISTORY_FILTER=PASS");
console.log("TWO_PROFILE_RESET_FOCUSED_TEST=PASS");
