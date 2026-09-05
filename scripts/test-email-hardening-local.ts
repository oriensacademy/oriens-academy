import assert from "node:assert";
import {
  normalizeLocale,
  renderAccountPasswordRecoveryEmail,
  renderStudentWelcomeEmail,
} from "../supabase/functions/_shared/email/templates";

console.log("=== Oriens Academy Email Hardening Local Verification ===");

// 1. Test normalizeLocale
console.log("\n[TEST 1] Testing normalizeLocale...");
assert.strictEqual(normalizeLocale("tr"), "tr");
assert.strictEqual(normalizeLocale("en"), "en");
assert.strictEqual(normalizeLocale(null), "tr");
assert.strictEqual(normalizeLocale(undefined), "tr");
assert.strictEqual(normalizeLocale(""), "tr");
assert.strictEqual(normalizeLocale("es" as unknown as "tr" | "en"), "tr");
assert.strictEqual(normalizeLocale("de" as unknown as "tr" | "en"), "tr");
console.log("✓ normalizeLocale passed all edge cases without throwing.");

// 2. renderStudentPaymentReminderEmail was decommissioned with the orphaned
// payment-mail renderers (MAIL-011/012/013): nothing dispatches it any more.

// 3. Test renderAccountPasswordRecoveryEmail (Zero Plaintext Passwords)
console.log("\n[TEST 3] Testing renderAccountPasswordRecoveryEmail (Plaintext Password Elimination)...");
const testPlaintext = "SuperSecret123!Temporary";
const recoveryWithLegacyString = renderAccountPasswordRecoveryEmail("user@example.com", testPlaintext, "tr");
// Verification: Plaintext password MUST NOT appear in the email output
assert.strictEqual(
  recoveryWithLegacyString.html.includes(testPlaintext),
  false,
  "FAIL: Plaintext password was found in HTML output!"
);
assert.strictEqual(
  recoveryWithLegacyString.text.includes(testPlaintext),
  false,
  "FAIL: Plaintext password was found in text output!"
);
assert.ok(recoveryWithLegacyString.html.includes("/tr/sifre-yenile"));
assert.ok(recoveryWithLegacyString.html.includes("Yeni Şifre Belirle"));

// When passed a real action URL
const secureActionUrl = "https://oriens-academy.com/tr/sifre-yenile#token=abc-123-xyz";
const recoveryWithActionUrl = renderAccountPasswordRecoveryEmail("user@example.com", secureActionUrl, "tr");
assert.ok(recoveryWithActionUrl.html.includes(secureActionUrl));
assert.ok(recoveryWithActionUrl.text.includes(secureActionUrl));
console.log("✓ renderAccountPasswordRecoveryEmail safely eliminates plaintext passwords and provides secure action URLs.");

// 4. Test renderStudentWelcomeEmail
console.log("\n[TEST 4] Testing renderStudentWelcomeEmail...");
const welcomeTr = renderStudentWelcomeEmail({
  studentName: "Ali Veli",
  studentEmail: "ali@example.com",
  locale: "tr",
});
assert.ok(welcomeTr.subject.includes("Oriens Academy"));
assert.ok(welcomeTr.html.includes("Ali Veli"));
assert.ok(welcomeTr.html.includes("/tr/hesabim"));

const welcomeEn = renderStudentWelcomeEmail({
  studentName: "Sarah Smith",
  studentEmail: "sarah@example.com",
  locale: "en",
});
assert.ok(welcomeEn.subject.includes("Oriens Academy"));
assert.ok(welcomeEn.html.includes("Sarah Smith"));
assert.ok(welcomeEn.html.includes("/en/account"));
console.log("✓ renderStudentWelcomeEmail verified.");

// 5. renderStudentLessonCompletedEmail was decommissioned: MAIL-027 is rendered
// by process-notification-outbox from the durable outbox row, not by a template.

console.log("\n>>> ALL LOCAL TESTS PASSED SUCCESSFULLY! <<<\n");
