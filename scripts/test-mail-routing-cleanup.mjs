import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const read = (file) => readFileSync(path.join(process.cwd(), file), "utf8");
const legacyPaymentMailbox = ["payments", "oriens-academy.com"].join("@");
const infoMailbox = "info@oriens-academy.com";
const adminMailbox = "admin@oriens-academy.com";

const service = read("supabase/functions/_shared/email/service.ts");
const templates = read("supabase/functions/_shared/email/templates.ts");
const outbox = read("supabase/functions/process-notification-outbox/index.ts");
const catalog = read("scripts/generate-mail-v5.mjs");
const paymentProducer = read("supabase/migrations/20260922120000_single_canonical_payment_success_delivery.sql");
const refundProducer = read("supabase/migrations/20260906240000_refund_entitlement_and_notification_hardening.sql");
const settingMigration = read("supabase/migrations/20260922130000_canonical_payment_notification_mailbox.sql");

const paymentIdentity = service.match(/case "payments": \{([\s\S]*?)\n\s*\}\n\s*case "admin":/i)?.[1] || "";
assert.match(paymentIdentity, /fromName:\s*"Oriens Academy"/);
assert.match(paymentIdentity, /fromEmail:\s*INFO_EMAIL/);
assert.match(paymentIdentity, /fromAddress:\s*`Oriens Academy <\$\{INFO_EMAIL\}>`/);
assert.match(paymentIdentity, /replyTo:\s*INFO_EMAIL/);
assert.doesNotMatch(paymentIdentity, new RegExp(legacyPaymentMailbox.replace(".", "\\."), "i"));

assert.match(service, /EMAIL_ARCHIVE_BCC\s*=\s*ADMIN_EMAIL/);
assert.match(service, /toEmails\.includes\(archiveAddress\)[\s\S]*ccEmails\.includes\(archiveAddress\)[\s\S]*explicitBccEmails\.includes\(archiveAddress\)/);
assert.match(service, /new Set\(\[\.\.\.explicitBccEmails, archiveAddress\]\)/);
assert.match(service, /bcc:\s*effectiveBccHeader/);
assert.equal((service.match(/gmail\.googleapis\.com\/gmail\/v1\/users\/me\/messages\/send/g) || []).length, 1);

assert.match(outbox, /row\.template === "payment_success_guardian"/);
assert.match(outbox, /row\.template === "payment_refunded_account_holder"/);
assert.match(outbox, /let channel: "payments" \| "support" = "payments"/);
assert.match(outbox, /to:\s*row\.recipient[\s\S]*channel:\s*message\.channel/);
assert.doesNotMatch(outbox, /\bcc\s*:/);

assert.equal((paymentProducer.match(/enqueue_email_notification\s*\(/g) || []).length, 1);
assert.match(paymentProducer, /'payment_success_guardian'/);
assert.doesNotMatch(paymentProducer, /payment_success_admin/);
assert.match(refundProducer, /ga\.email_verified_at is not null/);
assert.match(refundProducer, /v_holder\.email,'payment_refunded_account_holder'/);
assert.match(refundProducer, /'payment\.refunded:'\|\|v_refund\.id\|\|':account_holder'/);

assert.equal((catalog.match(/row\("MAIL-/g) || []).length, 27);
assert.equal((catalog.match(/, INACTIVE,/g) || []).length, 2);
assert.match(catalog, /row\("MAIL-010",[\s\S]*?INACTIVE/);
assert.match(catalog, /row\("MAIL-040",[\s\S]*?INACTIVE/);
assert.match(catalog, /const FROM_PAYMENTS = FROM_GENERAL/);
assert.match(catalog, new RegExp(`const ADMIN_BCC = "${adminMailbox.replace(".", "\\.")}"`));

assert.doesNotMatch(templates, new RegExp(legacyPaymentMailbox.replace(".", "\\."), "i"));
assert.match(templates, /renderPurchaseEmailVerificationOtpEmail[\s\S]*footerEmail:\s*"info@oriens-academy\.com"/);

for (const file of [
  "src/config/email.ts",
  "src/config/contact.ts",
  "src/config/legal.ts",
  "scripts/preview-all-emails.mjs",
  "scripts/test-all-email-types.mjs",
]) {
  assert.doesNotMatch(read(file), new RegExp(legacyPaymentMailbox.replace(".", "\\."), "i"), `${file} still contains the retired mailbox`);
}

assert.match(settingMigration, /update public\.site_settings/);
assert.match(settingMigration, /where key = 'notification\.payment_email'/);
assert.match(settingMigration, /info@oriens-academy\.com/);
assert.doesNotMatch(settingMigration, /update\s+public\.site_settings\s*(?:;|$)/i);

const functionRoot = path.join(process.cwd(), "supabase/functions");
const directConsumers = readdirSync(functionRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .filter((entry) => {
    const indexPath = path.join(functionRoot, entry.name, "index.ts");
    try {
      return readFileSync(indexPath, "utf8").includes("../_shared/email/service.ts");
    } catch {
      return false;
    }
  })
  .map((entry) => entry.name)
  .sort();

assert.deepEqual(directConsumers, [
  "admin-password-reset",
  "create-booking",
  "create-contact",
  "email-preview-delivery",
  "process-notification-outbox",
  "request-email-change",
  "request-password-recovery",
  "request-purchase-email-verification",
  "send-contact-reply",
  "send-live-lesson-email",
  "send-student-appointment",
  "send-welcome-email",
  "verify-email-change",
]);

console.log("mail routing cleanup: all assertions PASS");
console.log(`customer FROM=${infoMailbox}`);
console.log(`customer REPLY-TO=${infoMailbox}`);
console.log(`admin BCC=${adminMailbox}`);
console.log("CC=none");
console.log("MAIL-010=inactive; MAIL-040=inactive; active=25; inactive=2; total=27");
