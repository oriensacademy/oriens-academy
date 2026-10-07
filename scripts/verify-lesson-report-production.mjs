/** Controlled production smoke test. Creates isolated example.test fixtures,
 * cancels queued mail immediately, and removes the fixtures in finally. */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) throw new Error("Supabase environment is incomplete.");

const service = createClient(url, serviceKey, { auth: { persistSession: false } });
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = `Qa!${crypto.randomUUID()}aA1`;
const adminEmail = `qa-admin-${suffix}@example.test`;
const studentEmail = `qa-student-a-${suffix}@example.test`;
const checks = [];
const check = (name, condition, detail = "") => {
  checks.push({ name, pass: Boolean(condition), detail });
  if (!condition) throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
};
const result = (response) => response?.data && typeof response.data === "object" ? response.data : null;

async function cleanupEmails(emails) {
  const { data: listed } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = (listed?.users || []).filter((user) => emails.includes(user.email));
  const userIds = users.map((user) => user.id);
  if (!userIds.length) return;
  const { data: lessonRows } = await service.from("student_lessons").select("id").in("student_user_id", userIds);
  const lessonIds = (lessonRows || []).map((row) => row.id);
  const { data: purchaseRows } = await service.from("student_package_purchases").select("id,payment_transaction_id").in("student_user_id", userIds);
  const purchaseIds = (purchaseRows || []).map((row) => row.id);
  const paymentIds = (purchaseRows || []).map((row) => row.payment_transaction_id).filter(Boolean);
  if (lessonIds.length) {
    await service.from("notification_deliveries").delete().in("entity_id", lessonIds);
    await service.from("student_package_adjustments").delete().in("linked_lesson_id", lessonIds);
    await service.from("audit_logs").delete().in("entity_id", lessonIds);
    await service.from("student_lessons").delete().in("id", lessonIds);
  }
  await service.from("student_package_adjustments").delete().in("student_user_id", userIds);
  if (purchaseIds.length) await service.from("student_package_purchases").delete().in("id", purchaseIds);
  if (paymentIds.length) await service.from("payment_transactions").delete().in("id", paymentIds);
  await service.from("audit_logs").delete().in("actor_user_id", userIds);
  await service.from("guardian_students").delete().or(`guardian_user_id.in.(${userIds.join(",")}),student_id.in.(${userIds.join(",")})`);
  await service.from("guardian_accounts").delete().in("user_id", userIds);
  await service.from("student_profiles").delete().in("id", userIds);
  await service.from("admin_profiles").delete().in("user_id", userIds);
  for (const user of users) await service.auth.admin.deleteUser(user.id);
}

async function cleanup() {
  await cleanupEmails([adminEmail, studentEmail]);
}

try {
  const { data: existingUsers } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const staleEmails = (existingUsers?.users || [])
    .map((user) => user.email)
    .filter((email) => /^qa-(?:admin|student-a)-\d{13}-[a-z0-9]{6}@example\.test$/.test(email || ""));
  if (staleEmails.length) await cleanupEmails(staleEmails);
  const adminCreated = await service.auth.admin.createUser({
    email: adminEmail, password, email_confirm: true,
    app_metadata: { role: "admin" }, user_metadata: { full_name: "QA Report Admin" },
  });
  if (adminCreated.error) throw adminCreated.error;
  const studentCreated = await service.auth.admin.createUser({
    email: studentEmail, password, email_confirm: true,
    app_metadata: { role: "student" }, user_metadata: { full_name: "QA Report Student", preferred_language: "tr" },
  });
  if (studentCreated.error) throw studentCreated.error;
  const adminId = adminCreated.data.user.id;
  const studentId = studentCreated.data.user.id;

  await service.from("admin_profiles").upsert({ user_id: adminId, display_name: "QA Report Instructor", role: "admin", active: true });
  await service.from("student_profiles").upsert({ id: studentId, full_name: "QA Report Student", email: studentEmail, preferred_language: "tr", active: true });
  await service.from("guardian_accounts").upsert({ user_id: studentId, full_name: "QA Report Account Holder", email: studentEmail, preferred_language: "tr", email_verified_at: new Date().toISOString(), active: true });
  await service.from("guardian_students").upsert({ guardian_user_id: studentId, student_id: studentId, relationship_role: "self", is_primary: true, active: true, source: "qa" });

  const auth = createClient(url, anonKey, { auth: { persistSession: false } });
  const signedIn = await auth.auth.signInWithPassword({ email: adminEmail, password });
  if (signedIn.error) throw signedIn.error;
  const admin = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${signedIn.data.session.access_token}` } },
    auth: { persistSession: false },
  });

  const packages = await service.from("pricing_packages").select("id").eq("active", true).limit(1).single();
  if (packages.error) throw packages.error;
  const assigned = await admin.rpc("admin_assign_student_package", {
    p_student_id: studentId, p_package_id: packages.data.id,
    p_start_date: new Date().toISOString().slice(0, 10), p_end_date: null,
    p_lesson_count: 3, p_price_amount: 0, p_currency: "TRY",
    p_payment_status: "waived", p_payment_transaction_id: null,
  });
  check("fixture package assigned", !assigned.error && result(assigned)?.success, assigned.error?.message);
  const purchaseId = result(assigned).purchase_id;

  const completed = await admin.rpc("admin_record_completed_lesson", {
    p_student_id: studentId, p_lesson_date: new Date(Date.now() - 3_600_000).toISOString(),
    p_duration_minutes: 60, p_title: "QA Rapor Dersi", p_subject: "Matematik",
    p_teacher_note: "QA", p_package_purchase_id: purchaseId, p_existing_lesson_id: null,
    p_completion_source: "past", p_idempotency_key: `qa-report:${suffix}`,
  });
  check("past completion accepted", !completed.error && result(completed)?.success, completed.error?.message);
  const lessonId = result(completed).lesson_id;
  const purchase = await service.from("student_package_purchases").select("lessons_used").eq("id", purchaseId).single();
  check("rights deducted exactly once", purchase.data?.lessons_used === 1, JSON.stringify(purchase.data));
  const automatic = await service.from("notification_deliveries").select("id", { count: "exact", head: true }).eq("entity_id", lessonId).eq("event_type", "lesson.remaining_rights");
  check("completion created zero MAIL-040", automatic.count === 0, String(automatic.count));

  const report1 = "İşlenen konular: cebir.\nÖğrenci gelişimi olumlu; <script>alert(1)</script> çalışmamalı.";
  const saved = await admin.rpc("admin_save_lesson_completion_report", { p_lesson_id: lessonId, p_report: report1 });
  check("report saved without email", !saved.error && result(saved)?.success, saved.error?.message);
  const beforeSend = await service.from("notification_deliveries").select("id", { count: "exact", head: true }).eq("entity_id", lessonId).eq("event_type", "lesson.report_email");
  check("save-only email count is zero", beforeSend.count === 0, String(beforeSend.count));

  const firstSend = await admin.rpc("admin_save_and_send_lesson_report", { p_lesson_id: lessonId, p_report: report1, p_resend: false });
  check("first MAIL-027 queued", !firstSend.error && result(firstSend)?.success && !result(firstSend)?.suppressed, firstSend.error?.message);
  const firstDeliveryId = result(firstSend).notification_delivery_id;
  const delivery = await service.from("notification_deliveries").select("id,template,payload,status,dedupe_key").eq("id", firstDeliveryId).single();
  check("payload contains report", delivery.data?.payload?.completion_report === report1);
  check("payload remaining is authoritative", Number(delivery.data?.payload?.total_remaining_lessons) === 2, JSON.stringify(delivery.data?.payload));
  await service.from("notification_deliveries").update({ status: "cancelled", last_error_code: "QA_CANCELLED" }).eq("id", firstDeliveryId).eq("status", "pending");

  const duplicate = await admin.rpc("admin_save_and_send_lesson_report", { p_lesson_id: lessonId, p_report: report1, p_resend: false });
  check("same-version double click suppressed", !duplicate.error && result(duplicate)?.suppressed, duplicate.error?.message);
  const report2 = report1 + "\nSonraki ders için ek çalışma önerildi.";
  const save2 = await admin.rpc("admin_save_lesson_completion_report", { p_lesson_id: lessonId, p_report: report2 });
  const resend = await admin.rpc("admin_save_and_send_lesson_report", { p_lesson_id: lessonId, p_report: report2, p_resend: true });
  check("edited report increments version", result(save2)?.report_version === 2, JSON.stringify(result(save2)));
  check("intentional resend queues new delivery", !resend.error && result(resend)?.success && result(resend)?.notification_delivery_id !== firstDeliveryId, resend.error?.message);
  await service.from("notification_deliveries").update({ status: "cancelled", last_error_code: "QA_CANCELLED" }).eq("id", result(resend).notification_delivery_id).eq("status", "pending");

  console.log(JSON.stringify({ status: "PASS", project: "mwbrlfmdpbkmdjroxhcc", checks }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", error: error.message, checks }, null, 2));
  process.exitCode = 1;
} finally {
  try { await cleanup(); } catch (error) { console.error("Fixture cleanup failed:", error.message); process.exitCode = 1; }
}
