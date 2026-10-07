/**
 * Regression matrix for the canonical lesson-report / manual MAIL-027 flow.
 * Source-only: it sends no email and mutates no database rows.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (file) => readFileSync(path.resolve(process.cwd(), file), "utf8");
const migration = read("supabase/migrations/20260909090000_lesson_report_manual_notification_flow.sql");
const outbox = read("supabase/functions/process-notification-outbox/index.ts");
const manager = read("src/components/admin/StudentLearningManager.tsx");
const detail = read("src/components/admin/StudentDetailSheet.tsx");
const client = read("src/lib/admin/student-learning.ts");
const completion = migration.slice(
  migration.indexOf("create or replace function public.admin_record_completed_lesson"),
  migration.indexOf("create or replace function public.admin_save_lesson_completion_report")
);
const sendRpc = migration.slice(migration.indexOf("create or replace function public.admin_save_and_send_lesson_report"));

let passed = 0;
const failed = [];
function check(id, name, condition) {
  if (condition) {
    passed++;
    console.log(`  PASS  TEST ${id} — ${name}`);
  } else {
    failed.push(`TEST ${id} — ${name}`);
    console.log(`  FAIL  TEST ${id} — ${name}`);
  }
}

console.log("\nLESSON REPORT MANUAL EMAIL FLOW");
check("A", "scheduled completion deducts one right and produces no automatic mail",
  /lessons_used=lessons_used\+1/.test(completion) && /'lesson_completed'/.test(completion) && !/enqueue_email_notification/.test(completion));
check("B", "past completion deducts one right and produces no automatic mail",
  /'past_lesson_added'/.test(completion) && !/pastForm\.sendNotification/.test(manager));
check("C", "appointment completion has no completion-email dispatch",
  !/sendLessonCompletedEmail/.test(detail) && /admin_record_completed_lesson/.test(read("supabase/migrations/20260905160000_unify_appointment_completion_into_canonical_path.sql")));
check("D", "empty report is rejected before enqueue", /REPORT_REQUIRED/.test(sendRpc) && sendRpc.indexOf("REPORT_REQUIRED") < sendRpc.indexOf("enqueue_email_notification"));
check("E", "save-only RPC persists a report and contains no enqueue", /admin_save_lesson_completion_report/.test(migration) && !/enqueue_email_notification/.test(migration.slice(migration.indexOf("admin_save_lesson_completion_report"), migration.indexOf("admin_save_and_send_lesson_report"))));
check("F", "save-and-send enqueues exactly one MAIL-027 template", (sendRpc.match(/'lesson_completed_account_holder'/g) || []).length === 1);
check("G", "email payload and renderer contain the report", /'completion_report',v_report/.test(sendRpc) && /p\.completion_report/.test(outbox));
check("H", "remaining rights come from the canonical server calculator", /calculate_student_usable_remaining_lessons\(v_lesson\.student_user_id\)/.test(sendRpc));
check("I", "double click is locked and deduped per report version", /pg_advisory_xact_lock/.test(sendRpc) && /v_existing_delivery/.test(sendRpc));
check("J", "editing increments report_version and enables intentional resend", /report_version=report_version\+1/.test(sendRpc) && /Güncellenmiş Raporu Tekrar Gönder/.test(manager));
check("K", "enqueue failure retains the previously committed report", /saveLessonCompletionReport/.test(client) && /This is intentionally called after/.test(client) && /EMAIL_ENQUEUE_FAILED/.test(sendRpc));
check("L", "zero remaining shows renewal notice and pricing CTA", /remaining === 0/.test(outbox) && /Ders Haklarını Yenile/.test(outbox));
check("M", "one remaining shows warning", /remaining === 1/.test(outbox) && /Kalan toplam ders hakkınız 1'e düştü/.test(outbox));
check("N", "missing verified account holder rejects email but preserves report", /NO_VERIFIED_ACCOUNT_HOLDER/.test(sendRpc) && /'report_saved',true/.test(sendRpc));
check("O", "report HTML is escaped before newline conversion", /escapeHtml\(report\)\.replace\(\/\\r\?\\n\/g, "<br \/>"\)/.test(outbox));

console.log(`\n${passed} passed, ${failed.length} failed`);
if (failed.length) {
  failed.forEach((item) => console.log("  - " + item));
  process.exit(1);
}
console.log("LESSON REPORT MANUAL EMAIL FLOW: PASS");
