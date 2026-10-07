/** Controlled production verification for the canonical lesson archive flow. */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) throw new Error("Production fixture environment is incomplete.");

const service = createClient(url, serviceKey, { auth: { persistSession: false } });
const suffix = process.env.QA_CLEANUP_SUFFIX || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const adminEmail = `qa-admin-${suffix}@example.test`;
const studentEmail = `qa-student-a-${suffix}@example.test`;
const password = `Qa!${crypto.randomUUID()}aA1`;
let studentId = "";
const deliveryIds = [];
const checks = [];
const result = (response) => response?.data && typeof response.data === "object" ? response.data : null;
function check(name, condition, detail = "") {
  checks.push({ name, pass: Boolean(condition), detail });
  if (!condition) throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
}

async function cancelDelivery(id) {
  if (!id) return;
  deliveryIds.push(id);
  await service.from("notification_deliveries").update({ status: "cancelled", last_error_code: "QA_CANCELLED" }).eq("id", id).eq("status", "pending");
}

async function cleanup() {
  const { data: users } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const namespaceEmails = new Set([`qa-admin-${suffix}@example.test`, `qa-student-a-${suffix}@example.test`, `qa-student-b-${suffix}@example.test`]);
  const userIds = (users?.users || []).filter((user) => namespaceEmails.has(user.email || "")).map((user) => user.id);
  const { data: lessonRows } = userIds.length
    ? await service.from("student_lessons").select("id").in("student_user_id", userIds)
    : { data: [] };
  const lessonIds = (lessonRows || []).map((lesson) => lesson.id);
  if (deliveryIds.length) await service.from("notification_deliveries").delete().in("id", deliveryIds);
  if (lessonIds.length) {
    await service.from("notification_deliveries").delete().in("entity_id", lessonIds);
    await service.from("student_package_adjustments").delete().in("linked_lesson_id", lessonIds);
  }
  if (userIds.length) {
    await service.from("student_package_adjustments").delete().in("student_user_id", userIds);
    await service.from("guardian_students").delete().or(`guardian_user_id.in.(${userIds.join(",")}),student_id.in.(${userIds.join(",")})`);
    await service.from("guardian_accounts").delete().in("user_id", userIds);
  }
  const cleaned = await service.rpc("cleanup_student_system_qa", { p_suffix: suffix });
  if (cleaned.error) throw cleaned.error;
  const { data: afterUsers } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const residue = (afterUsers?.users || []).filter((user) => namespaceEmails.has(user.email || ""));
  if (residue.length) throw new Error(`fixture auth residue: ${studentEmail}`);
}

if (process.env.QA_CLEANUP_ONLY === "1") {
  await cleanup();
  console.log(JSON.stringify({ cleanup: "PASS", suffix }));
  process.exit(0);
}

try {
  const createdAdmin = await service.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true,
    app_metadata: { role: "admin" },
    user_metadata: { full_name: "QA Archive Admin" },
  });
  if (createdAdmin.error) throw createdAdmin.error;
  await service.from("admin_profiles").upsert({ user_id: createdAdmin.data.user.id, display_name: "QA Archive Admin", role: "admin", active: true });
  const adminAuth = createClient(url, anonKey, { auth: { persistSession: false } });
  const signedIn = await adminAuth.auth.signInWithPassword({ email: adminEmail, password });
  if (signedIn.error) throw signedIn.error;
  const admin = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${signedIn.data.session.access_token}` } },
    auth: { persistSession: false },
  });

  const created = await service.auth.admin.createUser({
    email: studentEmail,
    password,
    email_confirm: true,
    app_metadata: { role: "student" },
    user_metadata: { full_name: "QA Archive Student", preferred_language: "tr" },
  });
  if (created.error) throw created.error;
  studentId = created.data.user.id;
  await service.from("student_profiles").upsert({ id: studentId, full_name: "QA Archive Student", email: studentEmail, preferred_language: "tr", active: true });
  await service.from("guardian_accounts").upsert({ user_id: studentId, full_name: "QA Archive Student", email: studentEmail, preferred_language: "tr", email_verified_at: new Date().toISOString(), active: true });
  await service.from("guardian_students").upsert({ guardian_user_id: studentId, student_id: studentId, relationship_role: "self", is_primary: true, active: true, source: "qa" });

  const packageRow = await service.from("pricing_packages").select("id").eq("active", true).limit(1).single();
  if (packageRow.error) throw packageRow.error;
  const assigned = await admin.rpc("admin_assign_student_package", {
    p_student_id: studentId, p_package_id: packageRow.data.id,
    p_start_date: new Date().toISOString().slice(0, 10), p_end_date: null,
    p_lesson_count: 3, p_price_amount: 0, p_currency: "TRY",
    p_payment_status: "waived", p_payment_transaction_id: null,
  });
  check("fixture package assigned", !assigned.error && result(assigned)?.success, assigned.error?.message);
  const purchaseId = result(assigned).purchase_id;

  const futureDate = new Date(Date.now() + 86_400_000).toISOString();
  const scheduled = await admin.rpc("admin_upsert_student_lesson", {
    p_student_id: studentId, p_lesson_id: null, p_package_purchase_id: purchaseId,
    p_title: "QA Archive Lesson", p_subject: "Matematik", p_exam_code: "SAT",
    p_lesson_date: futureDate, p_duration_minutes: 60, p_live_meeting_url: null,
    p_teacher_note: null, p_status: "scheduled",
  });
  check("scheduled lesson created", !scheduled.error && result(scheduled)?.success, scheduled.error?.message);
  const lessonId = result(scheduled).lesson_id;
  const upcoming = await service.from("student_lessons").select("id,status,lesson_date").eq("id", lessonId).single();
  check("scheduled lesson appears in canonical upcoming source", upcoming.data?.status === "scheduled" && Date.parse(upcoming.data.lesson_date) > Date.now());

  const completed = await admin.rpc("admin_complete_student_lesson", {
    p_lesson_id: lessonId, p_package_purchase_id: purchaseId, p_teacher_note: null,
  });
  check("scheduled lesson completed", !completed.error && result(completed)?.success, completed.error?.message);
  const archived = await service.from("student_lessons").select("status,teacher_note,completion_report,report_version").eq("id", lessonId).single();
  check("completed lesson appears in canonical past source", archived.data?.status === "completed");
  check("completion authored no teacher note", archived.data?.teacher_note === null);
  const autoMail = await service.from("notification_deliveries").select("id", { count: "exact", head: true }).eq("entity_id", lessonId).eq("event_type", "lesson.remaining_rights");
  check("automatic completion email count is zero", autoMail.count === 0, String(autoMail.count));

  const report1 = "QA arşiv raporu: cebir konusu tamamlandı.";
  const saved = await admin.rpc("admin_save_lesson_completion_report", { p_lesson_id: lessonId, p_report: report1 });
  check("archive report saved", !saved.error && result(saved)?.success, saved.error?.message);
  const firstSend = await admin.rpc("admin_save_and_send_lesson_report", { p_lesson_id: lessonId, p_report: report1, p_resend: false });
  check("archive report queued manually", !firstSend.error && result(firstSend)?.success, firstSend.error?.message);
  await cancelDelivery(result(firstSend).notification_delivery_id);

  const report2 = `${report1} Güncellenmiş çalışma önerisi eklendi.`;
  const savedAgain = await admin.rpc("admin_save_lesson_completion_report", { p_lesson_id: lessonId, p_report: report2 });
  const resent = await admin.rpc("admin_save_and_send_lesson_report", { p_lesson_id: lessonId, p_report: report2, p_resend: true });
  check("report edit increments version", Number(result(savedAgain)?.report_version) === 2, JSON.stringify(result(savedAgain)));
  check("updated report queues a distinct resend", !resent.error && result(resent)?.success && result(resent)?.notification_delivery_id !== result(firstSend)?.notification_delivery_id, resent.error?.message);
  await cancelDelivery(result(resent).notification_delivery_id);

  const linkedRows = await service.from("student_lessons").select("id,booking_id").eq("id", lessonId);
  check("canonical completed lesson has one row", linkedRows.data?.length === 1);
  console.log(JSON.stringify({ status: "PASS", project: "mwbrlfmdpbkmdjroxhcc", fixture: studentEmail, checks }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", error: error.message, fixture: studentEmail, checks }, null, 2));
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
    console.log(JSON.stringify({ cleanup: "PASS", fixture: studentEmail }));
  } catch (error) {
    console.error(JSON.stringify({ cleanup: "FAIL", fixture: studentEmail, error: error.message }));
    process.exitCode = 1;
  }
}
