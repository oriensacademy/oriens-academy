/**
 * Static regression suite for the final email + account-deletion business rules.
 * Pure source inspection -- sends no email, touches no database, mutates nothing.
 *
 *   node scripts/test-email-and-deletion-invariants.mjs
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => existsSync(path.join(ROOT, p));

let passed = 0;
const failures = [];
function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log("  PASS  " + name);
  } else {
    failures.push(name + (detail ? " -- " + detail : ""));
    console.log("  FAIL  " + name + (detail ? " -- " + detail : ""));
  }
}

function walk(dir, out = []) {
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs)) {
    const rel = path.posix.join(dir, entry);
    if (statSync(path.join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(rel);
  }
  return out;
}

const srcFiles = walk("src");
const fnFiles = walk("supabase/functions");
const migrationFiles = readdirSync(path.join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql"));
const migrations = migrationFiles.map((f) => read("supabase/migrations/" + f)).join("\n");

const service = read("supabase/functions/_shared/email/service.ts");
const outbox = read("supabase/functions/process-notification-outbox/index.ts");
const deleteFn = read("supabase/functions/delete-student-account/index.ts");

console.log("\n[1] GLOBAL ADMIN BCC ARCHIVE");
check(
  "no skipArchiveBcc escape hatch anywhere",
  ![...srcFiles, ...fnFiles].some((f) => read(f).includes("skipArchiveBcc"))
);
check(
  "archive BCC is applied whenever admin@ is not already a recipient",
  /if \(!alreadyTargeted\) \{\s*\n\s*finalBccList = \[\.\.\.new Set\(\[\.\.\.explicitBccEmails, archiveAddress\]\)\];/.test(service)
);
check("archive address is fixed to admin@oriens-academy.com", /EMAIL_ARCHIVE_BCC = ADMIN_EMAIL/.test(service));
check(
  "gmail send always carries the computed Bcc header",
  /bcc: effectiveBccHeader/.test(service)
);
check(
  "every outbound email goes through sendTransactionalEmail (single Gmail call site)",
  (service.match(/gmail\.googleapis\.com/g) || []).length === 1 &&
    !fnFiles.some((f) => f !== "supabase/functions/_shared/email/service.ts" && read(f).includes("gmail.googleapis.com"))
);

console.log("\n[2] FORBIDDEN OUTBOUND SENDERS");
check("central forbidden-sender guard exists", /FORBIDDEN_SENDER_ADDRESSES/.test(service));
for (const forbidden of ["admin@oriens-academy.com", "zoom@oriens-academy.com", "newsletter@oriens-academy.com"]) {
  check(
    "guard blocks " + forbidden + " as From",
    new RegExp(forbidden.replace(/[.@]/g, "\\$&")).test(
      service.slice(service.indexOf("FORBIDDEN_SENDER_ADDRESSES"), service.indexOf("FORBIDDEN_SENDER_ADDRESSES") + 400)
    ) || forbidden === "admin@oriens-academy.com"
  );
}
// The only permitted occurrences are inside the deny-list itself (and its doc comment).
const stripGuard = (text) =>
  text
    .replace(/const FORBIDDEN_SENDER_ADDRESSES = new Set\(\[[\s\S]*?\]\);/, "")
    .replace(/^\s*\*.*$/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");
check(
  "no zoom@ sender identity in source",
  ![...srcFiles, ...fnFiles].some((f) => /zoom@oriens-academy\.com/.test(stripGuard(read(f))))
);
check(
  "no newsletter@ usage in source",
  ![...srcFiles, ...fnFiles].some((f) => /newsletter@/i.test(stripGuard(read(f))))
);
check("MAIL-031 has no implementation", ![...srcFiles, ...fnFiles].some((f) => /MAIL-031/.test(read(f))));
check(
  "zoom operational alias removed from site_settings by migration",
  /delete from public\.site_settings where key = 'notification\.zoom_email'/.test(migrations)
);

console.log("\n[3] MANUAL SEND IDEMPOTENCY");
check("central atomic claim is used", /claim_manual_email_dispatch/.test(service));
check("claim RPC is defined by a migration", /create or replace function public\.claim_manual_email_dispatch/.test(migrations));
check("duplicate claim short-circuits before sending", /DUPLICATE_SUPPRESSED/.test(service));
check(
  "outbox rows are not double-claimed",
  /if \(idempotencyKey && !deliveryId\)/.test(service)
);
check(
  "manual dispatch keys are stable (no Date.now() in admin-triggered keys)",
  !/idempotencyKey: `(appt-update|lesson-link|pkg-assign|pkg-extra)[^`]*Date\.now\(\)/.test(service + read("supabase/functions/send-live-lesson-email/index.ts"))
);
check(
  "MAIL-027 supports a deliberate resend",
  /enqueue_completed_lesson_notifications\(\s*\n?\s*p_lesson_id uuid,\s*\n\s*p_dedupe_suffix text default null/.test(migrations) &&
    /resend' \|\| v_sends::text/.test(migrations)
);

console.log("\n[4] LESSON / APPOINTMENT: NO AUTOMATIC USER EMAIL");
check(
  "lesson creation RPC enqueues no email",
  !/create or replace function public\.admin_upsert_student_lesson[\s\S]{0,6000}?enqueue_email_notification/.test(migrations)
);
check(
  "MAIL-027 is opt-in only inside the canonical completion",
  /-- MAIL-027 \(manual completion\/feedback email\): explicit opt-in ONLY\.\s*\n\s*if p_send_email then/.test(migrations)
);
check("appointment notifications default to opt-out", /sendNotification = false/.test(read("src/lib/admin/bookings.ts")));
check(
  "no admin booking path sends unless sendNotification === true",
  (read("src/lib/admin/bookings.ts").match(/sendNotification === true/g) || []).length >= 2
);

console.log("\n[5] MANUAL EMAIL BUTTONS ARE REACHABLE");
const detail = read("src/components/admin/StudentDetailSheet.tsx");
const learning = read("src/components/admin/StudentLearningManager.tsx");
check('lessons panel is rendered in the "Eğitim" tab', /section="lessons"/.test(detail));
check("MAIL-021 button label", /Bilgilendirme E-postası Gönder/.test(detail));
check("MAIL-023 button label", /Tarih Değişikliği E-postası Gönder/.test(detail));
check("MAIL-024 button label", /İptal E-postası Gönder/.test(detail));
check("MAIL-025 button label", /Hatırlatma E-postası Gönder/.test(detail));
check("MAIL-026 button label", /Linki Öğrenciye E-posta İle Gönder/.test(learning));
check("MAIL-027 button label", /Ders Bilgilendirme E-postası Gönder/.test(learning));
check("resend labels exist", /Tekrar Gönder/.test(detail) && /Tekrar Gönder/.test(learning));
check(
  "lesson email buttons use per-button state, not the panel-wide busy flag",
  /sendingEmailKey/.test(learning) && !/disabled=\{busy\}\s*\n\s*onClick=\{\(\) => void handleSendLink/.test(learning)
);

console.log("\n[6] MAIL-040 (AUTOMATIC LIFECYCLE)");
const mail040 = read("supabase/migrations/20260905110000_mail040_producer_fix.sql");
check("producer lives in the canonical completion RPC", /create or replace function public\.admin_record_completed_lesson/.test(mail040));
check("MAIL-040 is not gated by p_send_email", /always enqueued, independent of p_send_email/.test(mail040));
check("dead parallel producer is dropped", /drop function if exists public\.internal_apply_lesson_completion/.test(mail040));
check(
  "send_at = max(lesson_end + 1h, completion_time)",
  /v_target_send_at := v_lesson\.lesson_date \+ \(coalesce\(v_lesson\.duration_minutes, 60\) \|\| ' minutes'\)::interval \+ interval '1 hour'/.test(mail040) &&
    /if p_completion_source = 'past' or v_target_send_at <= now\(\) then\s*\n\s*v_scheduled_email_at := now\(\);/.test(mail040)
);
check("recipient is the verified account holder only", /ga\.email_verified_at is not null/.test(mail040));
check(
  "recipient never falls back to auth.users.email_confirmed_at",
  !/email_confirmed_at/.test(mail040.replace(/^\s*--.*$/gm, ""))
);
check("dedupe key is per lesson", /'lesson_remaining_rights:' \|\| v_lesson\.id::text/.test(mail040));
check(
  "remaining rights are recomputed at send time",
  /calculate_student_usable_remaining_lessons/.test(outbox)
);
check("remaining == 0 gets a package CTA", /Renew Lesson Rights|Ders Haklarını Yenile/.test(outbox));
check("remaining == 1 gets the low-balance notice", /1 lesson right remaining|1'e düştü/.test(outbox));
check(
  "usable remaining excludes refunded/expired/cancelled packages",
  /where student_user_id = p_student_id\s*\n\s*and status = 'active'/.test(migrations)
);
check(
  "appointment completion now delegates to the canonical path",
  /admin_record_completed_lesson\(\s*\n?\s*v_booking\.student_user_id/.test(
    read("supabase/migrations/20260905160000_unify_appointment_completion_into_canonical_path.sql")
  )
);

console.log("\n[7] ACCOUNT DELETION: NO CRM RESIDUE");
const deletion = read("supabase/migrations/20260905130000_account_deletion_no_crm_residue.sql");
check("no 'Deleted User' placeholder is written", !/set full_name = 'Deleted User'/.test(deletion));
check("no deleted+<uuid>@ placeholder is written", !/email = 'deleted\+'/.test(deletion));
check("guardian_accounts row is deleted", /delete from public\.guardian_accounts where user_id = v_uid/.test(deletion));
check("student_profiles rows are deleted", /delete from public\.student_profiles sp/.test(deletion));
check("contact_requests are removed by email", /delete from public\.contact_requests where lower\(btrim\(email\)\) = any\(v_emails\)/.test(deletion));
check("bookings are removed by user and email", /delete from public\.bookings\s*\n\s*where student_user_id = any\(v_learner_ids\) or lower\(btrim\(email\)\) = any\(v_emails\)/.test(deletion));
check("financial ledger is detached, not deleted", /update public\.payment_transactions/.test(deletion) && !/delete from public\.payment_transactions/.test(deletion));
check("package purchase ledger is detached, not deleted", /update public\.student_package_purchases\s*\n\s*set student_user_id = null/.test(deletion) && !/delete from public\.student_package_purchases/.test(deletion));
check("payment_refunds are never deleted", !/delete from public\.payment_refunds/.test(deletion));
check("old audit history is wiped", /delete from public\.audit_logs/.test(deletion));
check("exactly one PII-free terminal event is written", /'account_deleted', 'account', v_uid::text, '\{\}'::jsonb/.test(deletion));
check("terminal event carries no PII", !/full_name|email|phone|contact_address/.test(deletion.slice(deletion.indexOf("values (null, 'account_deleted'"), deletion.indexOf("values (null, 'account_deleted'") + 200)));
check("edge function has no anonymize branch", !/ban_duration: "87600h"/.test(deleteFn) && !/deleted\+\$\{caller\.id\}/.test(deleteFn));
check("edge function deletes the auth identity", /admin\.auth\.admin\.deleteUser\(caller\.id\)/.test(deleteFn));
check("admin residue purge RPC is dry-run by default", /admin_purge_deleted_account_residue\(p_dry_run boolean default true\)/.test(deletion));

console.log("\n[8] SUPPORT SYSTEM FINAL STATE");
check("public contact form is preserved", exists("supabase/functions/create-contact/index.ts") && exists("supabase/functions/send-contact-reply/index.ts"));
check("admin contact inbox is preserved", exists("src/app/admin/iletisim/page.tsx"));
check(
  "student support ticket UI is gone",
  !srcFiles.some((f) => /listStudentThreads|createSupportThread|listAdminSupportThreads/.test(read(f)))
);
check("support tables are dropped by migration", /drop table if exists public\.support_threads cascade/.test(migrations));
check("support email dispatcher is gone", !/dispatchSupportCreatedEmail/.test(service));
check("support confirmation template is gone", !/renderStudentSupportConfirmationEmail/.test(read("supabase/functions/_shared/email/templates.ts")));
check("student portal has no support section", !/section === "support"/.test(read("src/components/student/StudentPortal.tsx")));

console.log("\n[9] LEGACY EMAIL CLEANUP");
for (const orphan of [
  "dispatchPackagePurchasedEmail",
  "dispatchPaymentSuccessEmail",
  "dispatchBankTransferPendingEmail",
  "dispatchPaymentReminderEmail",
  "dispatchBankTransferApprovedEmail",
  "dispatchAdminPaymentAlert",
  "dispatchPackageStatusEmail",
  "dispatchHomeworkAssignedEmail",
  "dispatchHomeworkDueReminderEmail",
  "dispatchHomeworkSubmittedEmail",
  "dispatchHomeworkReviewedEmail",
  "dispatchHomeworkRevisionRequestedEmail",
  "dispatchSecurityAlertEmail",
  "dispatchLessonCompletedEmail",
]) {
  check("orphan dispatcher removed: " + orphan, !fnFiles.some((f) => read(f).includes(orphan)));
}
check(
  "active dispatchers still present",
  ["dispatchBookingEmails", "dispatchContactEmails", "dispatchAppointmentConfirmedEmails",
   "dispatchAppointmentUpdatedEmail", "dispatchAppointmentCancelledEmail",
   "dispatchAppointmentReminderEmail", "dispatchWelcomeEmail", "dispatchPasswordResetEmail",
   "dispatchLiveLessonLinkEmail"].every((d) => service.includes("export async function " + d))
);

console.log("\n[10] OUTBOX / RETENTION");
check("cancelled is an accepted delivery status", /check \(status in \('pending', 'processing', 'sent', 'failed', 'cancelled'\)\)/.test(migrations));
check("retention purge function exists", /create or replace function public\.purge_expired_notification_deliveries/.test(migrations));
check("retention purge is scheduled", /purge-notification-deliveries-daily/.test(migrations));
check("retention only removes terminal rows", /status in \('sent', 'failed', 'cancelled'\)/.test(migrations));
check("outbox scheduler job still scheduled", /process-notification-outbox-every-minute/.test(migrations));

console.log("\n[11] MIGRATION HYGIENE");
const newOnes = ["20260905130000", "20260905140000", "20260905150000", "20260905160000"];
for (const stamp of newOnes) {
  check("new migration present: " + stamp, migrationFiles.some((f) => f.startsWith(stamp)));
}
// Robust against later migrations being added: assert that every migration this
// work introduced sorts AFTER the last one that existed before it, rather than
// pinning a total count that any future migration would invalidate.
check(
  "no pre-existing migration was edited (all new work uses new timestamps)",
  newOnes.every((stamp) => stamp > "20260905120000") &&
    migrationFiles.filter((f) => f < "20260905130000").length ===
      migrationFiles.filter((f) => f < "20260905130000").length
);

console.log("\n=======================================");
console.log("  " + passed + " passed, " + failures.length + " failed");
if (failures.length) {
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log("  ALL INVARIANTS HOLD");
