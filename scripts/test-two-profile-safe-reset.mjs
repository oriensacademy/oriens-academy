import assert from "node:assert/strict";
import fs from "node:fs";

// 20260914123000 was a one-off, record-specific production data correction. The repository
// only carries a data-free tombstone for that version so fresh clones match remote history.
const tombstone = fs.readFileSync("supabase/migrations/20260914123000_one_off_payment_history_archive_tombstone.sql", "utf8");
const resetSql = fs.readFileSync("supabase/migrations/20260914100000_correct_test_account_notification_scope.sql", "utf8");
const adminPayments = fs.readFileSync("src/lib/admin/payments.ts", "utf8");
const studentData = fs.readFileSync("src/lib/student/data.ts", "utf8");

const tombstoneSql = tombstone
  .split(/\r?\n/)
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .trim();

assert.equal(tombstoneSql, "select 1;");
assert.doesNotMatch(tombstone, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
assert.doesNotMatch(tombstone, /\b(insert|update|delete|create|alter|drop|grant|revoke)\b\s/i);

assert.match(resetSql, /where not is_archived and lower\(btrim\(recipient\)\) = v_email/);
assert.match(adminPayments, /eq\("is_archived", false\)/);
assert.match(studentData, /eq\("is_archived", false\)/);

console.log("TOMBSTONE_DATA_FREE=PASS");
console.log("TOMBSTONE_NO_OP=PASS");
console.log("VISIBLE_HISTORY_FILTER=PASS");
console.log("TWO_PROFILE_RESET_FOCUSED_TEST=PASS");
