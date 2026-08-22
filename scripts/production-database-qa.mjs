import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const projectRef = "mwbrlfmdpbkmdjroxhcc";
const projectUrl = `https://${projectRef}.supabase.co`;
const raw = execSync(`npx supabase projects api-keys --project-ref ${projectRef}`, { encoding: "utf8", windowsHide: true });
const keys = JSON.parse(raw.slice(raw.indexOf("{"))).keys;
const anonKey = keys.find((key) => key.id === "anon")?.api_key;
const serviceKey = keys.find((key) => key.id === "service_role")?.api_key;
if (!anonKey || !serviceKey) throw new Error("Project API keys are unavailable.");

const service = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = `Qa!${crypto.randomUUID()}aA1`;
const emails = { admin: `qa-admin-${suffix}@example.test`, a: `qa-student-a-${suffix}@example.test`, b: `qa-student-b-${suffix}@example.test` };
const ids = { users: [], bookings: [], slots: [], lessons: [], homework: [], purchases: [], payments: [], notes: [], packageId: `qa-package-${suffix}` };
const checks = [];
const check = (name, condition, detail = "") => { checks.push({ name, pass: Boolean(condition), detail }); if (!condition) throw new Error(`${name}${detail ? `: ${detail}` : ""}`); };
const resultOf = (value) => value?.data && typeof value.data === "object" ? value.data : null;
const clientFor = async (email) => { const base = createClient(projectUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }); const { data, error } = await base.auth.signInWithPassword({ email, password }); if (error || !data.session) throw error || new Error("Sign-in failed"); return createClient(projectUrl, anonKey, { global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }, auth: { persistSession: false, autoRefreshToken: false } }); };
const insertPayment = async (studentId, method, provider, label) => { const { data, error } = await service.from("payment_transactions").insert({ student_user_id: studentId, package_id: ids.packageId, public_reference: `QA-${label}-${suffix}`, status_token_hash: `qa-hash-${suffix}-${label}`, provider, amount: 1000, currency: "TRY", status: "pending", payment_method: method, payer_name: "QA Student", payer_email: emails.a, metadata: { qa: true, run: suffix } }).select().single(); if (error) throw error; ids.payments.push(data.id); return data; };

async function cleanup() {
  try {
    const { data, error } = await service.rpc("cleanup_student_system_qa", { p_suffix: suffix });
    if (error || data?.success !== true) throw error || new Error("QA cleanup RPC failed.");
    const [{ data: users }, { count: packageCount, error: packageCheckError }] = await Promise.all([
      service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      service.from("pricing_packages").select("id", { count: "exact", head: true }).eq("id", ids.packageId),
    ]);
    const remainingUsers = users?.users.filter((user) => Object.values(emails).includes(user.email)).length || 0;
    if (packageCheckError || remainingUsers !== 0 || packageCount !== 0) throw packageCheckError || new Error("QA cleanup verification failed.");
    console.log(JSON.stringify({ cleanup: "PASS", qaUsersRemaining: remainingUsers, qaPackagesRemaining: packageCount }));
  } catch (error) { console.error("QA cleanup failed without exposing credentials:", error.message); process.exitCode = 1; }
}

async function cleanupPreviousQaRuns() {
  const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const suffixes = new Set(data.users.map((user) => user.email?.match(/^qa-(?:admin|student-a|student-b)-(\d{13}-[a-z0-9]{6})@example\.test$/)?.[1]).filter(Boolean));
  for (const previousSuffix of suffixes) {
    const { error: cleanupError } = await service.rpc("cleanup_student_system_qa", { p_suffix: previousSuffix });
    if (cleanupError) throw cleanupError;
  }
}

try {
  await cleanupPreviousQaRuns();
  for (const [kind, email] of Object.entries(emails)) {
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: kind === "admin" ? { role: "admin" } : { role: "student" }, user_metadata: kind === "admin" ? { full_name: "QA Admin" } : { full_name: `QA Student ${kind.toUpperCase()}`, preferred_language: kind === "a" ? "tr" : "en" } });
    if (error || !data.user) throw error || new Error("User creation failed"); ids.users.push(data.user.id); ids[kind] = data.user.id;
  }
  const { error: packageError } = await service.from("pricing_packages").insert({ id: ids.packageId, billing_basis: "custom", currency: "TRY", active: true, featured: false, display_order: 9999, name_tr: "QA Paketi", name_en: "QA Package", lesson_count: 10, current_total: 1000, purchase_mode: "purchasable" }); if (packageError) throw packageError;
  const [admin, studentA] = await Promise.all([clientFor(emails.admin), clientFor(emails.a), clientFor(emails.b)]);

  const anon = createClient(projectUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const table of ["student_profiles", "student_lessons", "student_homework", "student_package_purchases", "payment_transactions"]) { const { data, error } = await anon.from(table).select("*").limit(1); const denied = error?.code === "42501" || error?.message?.includes("permission denied"); check(`anon ${table} isolated`, denied || (!error && data.length === 0), error && !denied ? error.message : ""); }

  const unauthorizedCalls = [
    studentA.rpc("admin_update_student_profile", { p_student_id: ids.a, p_full_name: "Blocked", p_phone: "", p_school: "", p_target_exam: "SAT", p_target_university: "", p_target_country: "", p_preferred_language: "tr", p_active: true }),
    studentA.rpc("admin_assign_student_package", { p_student_id: ids.a, p_package_id: ids.packageId, p_start_date: "2036-01-01", p_end_date: null, p_lesson_count: 10, p_price_amount: 1000, p_currency: "TRY", p_payment_status: "pending", p_payment_transaction_id: null }),
    studentA.rpc("admin_create_student_booking", { p_student_id: ids.a, p_full_name: "Blocked", p_email: emails.a, p_phone: "", p_exam: "SAT", p_subject: "Math", p_starts_at: "2036-01-01T10:00:00Z", p_ends_at: "2036-01-01T11:00:00Z", p_privacy_consent: true, p_notes: "", p_status: "confirmed" }),
    studentA.rpc("admin_complete_student_appointment", { p_booking_id: crypto.randomUUID(), p_package_purchase_id: null, p_title: "Blocked", p_subject: "Blocked", p_exam_code: "SAT", p_duration_minutes: 60, p_teacher_note: "" }),
    studentA.rpc("admin_review_bank_transfer", { p_payment_id: crypto.randomUUID(), p_decision: "approved" }),
    studentA.from("student_homework").insert({ student_user_id: ids.a, title: "Blocked", description: "Blocked", status: "assigned" }),
  ];
  const unauthorized = await Promise.all(unauthorizedCalls); check("all privileged student calls rejected", unauthorized.every((item) => item.error));

  const profileRpc = await admin.rpc("admin_update_student_profile", { p_student_id: ids.a, p_full_name: "QA Student A Updated", p_phone: "+905550000000", p_school: "QA School", p_target_exam: "SAT", p_target_university: "QA University", p_target_country: "UK", p_preferred_language: "tr", p_active: true }); check("admin profile update accepted", !profileRpc.error && resultOf(profileRpc)?.success, profileRpc.error?.message);
  const assign = async (studentId, count = 10) => { const response = await admin.rpc("admin_assign_student_package", { p_student_id: studentId, p_package_id: ids.packageId, p_start_date: "2036-01-01", p_end_date: "2036-12-31", p_lesson_count: count, p_price_amount: 1000, p_currency: "TRY", p_payment_status: "pending", p_payment_transaction_id: null }); check("admin package assignment accepted", !response.error && resultOf(response)?.success, response.error?.message); const purchaseId = resultOf(response).purchase_id; ids.purchases.push(purchaseId); return purchaseId; };
  const purchaseA = await assign(ids.a); const purchaseClose = await assign(ids.a); const purchaseB = await assign(ids.b, 3);

  const createBooking = async (studentId, email, day) => { const response = await admin.rpc("admin_create_student_booking", { p_student_id: studentId, p_full_name: "QA Student", p_email: email, p_phone: "+905550000000", p_exam: "SAT", p_subject: "Mathematics", p_starts_at: `2036-02-${String(day).padStart(2, "0")}T10:00:00Z`, p_ends_at: `2036-02-${String(day).padStart(2, "0")}T11:00:00Z`, p_privacy_consent: true, p_notes: "QA controlled test", p_status: "confirmed" }); check("admin appointment creation accepted", !response.error && resultOf(response)?.success, response.error?.message); ids.bookings.push(resultOf(response).booking_id); ids.slots.push(resultOf(response).slot_id); return resultOf(response).booking_id; };
  const bookingA = await createBooking(ids.a, emails.a, 10); const bookingClose = await createBooking(ids.a, emails.a, 11); const bookingB = await createBooking(ids.b, emails.b, 12);

  const complete = async (bookingId, purchaseId) => admin.rpc("admin_complete_student_appointment", { p_booking_id: bookingId, p_package_purchase_id: purchaseId, p_title: "QA Lesson", p_subject: "Mathematics", p_exam_code: "SAT", p_duration_minutes: 60, p_teacher_note: "QA" });
  const first = await complete(bookingA, purchaseA); check("first lesson completion accepted", !first.error && resultOf(first)?.success && !resultOf(first)?.already_completed, first.error?.message); ids.lessons.push(resultOf(first).lesson_id);
  const second = await complete(bookingA, purchaseA); check("second lesson completion idempotent", !second.error && resultOf(second)?.success && resultOf(second)?.already_completed, second.error?.message);
  const { data: usage } = await service.from("student_package_purchases").select("lessons_used,status").eq("id", purchaseA).single(); check("idempotent lessons_used remains one", usage?.lessons_used === 1, JSON.stringify(usage));
  const { count: lessonCount } = await service.from("student_lessons").select("id", { count: "exact", head: true }).eq("booking_id", bookingA); check("one lesson row per booking", lessonCount === 1, String(lessonCount));
  const { count: lessonAuditCount } = await service.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "lesson.completed").contains("metadata", { booking_id: bookingA }); check("one lesson.completed audit side effect", lessonAuditCount === 1, String(lessonAuditCount));

  await service.from("student_package_purchases").update({ lessons_used: 9 }).eq("id", purchaseClose);
  const finalFirst = await complete(bookingClose, purchaseClose); check("final lesson completion accepted", !finalFirst.error && !resultOf(finalFirst)?.already_completed, finalFirst.error?.message); ids.lessons.push(resultOf(finalFirst).lesson_id);
  const finalSecond = await complete(bookingClose, purchaseClose); check("final lesson repeat idempotent", !finalSecond.error && resultOf(finalSecond)?.already_completed, finalSecond.error?.message);
  const { data: completedPackage } = await service.from("student_package_purchases").select("lessons_used,status").eq("id", purchaseClose).single(); check("package completes at configured total", completedPackage?.lessons_used === 10 && completedPackage?.status === "completed", JSON.stringify(completedPackage));

  const bComplete = await complete(bookingB, purchaseB); if (resultOf(bComplete)?.lesson_id) ids.lessons.push(resultOf(bComplete).lesson_id); check("Student B lesson prepared", !bComplete.error && resultOf(bComplete)?.success, bComplete.error?.message);
  const createHomework = async (studentId, label) => { const { data, error } = await admin.from("student_homework").insert({ student_user_id: studentId, title: `QA Homework ${label}`, description: "Controlled QA", status: "assigned" }).select().single(); check(`homework ${label} assigned`, !error, error?.message); ids.homework.push(data.id); return data.id; };
  const homeworkA = await createHomework(ids.a, "A"); const homeworkB = await createHomework(ids.b, "B"); const review = await admin.from("student_homework").update({ status: "reviewed", teacher_feedback: "QA reviewed" }).eq("id", homeworkA).select().single(); check("homework reviewed", !review.error && review.data?.status === "reviewed", review.error?.message);
  const note = await admin.from("student_admin_notes").insert({ student_user_id: ids.a, note: "Controlled private QA note", created_by: ids.admin }).select().single(); check("private admin note accepted", !note.error, note.error?.message); ids.notes.push(note.data.id);

  const bank = await insertPayment(ids.a, "bank_transfer", "manual_bank_transfer", "BANK"); const card = await insertPayment(ids.a, "card", "qa_card_provider", "CARD"); const paymentB = await insertPayment(ids.b, "bank_transfer", "manual_bank_transfer", "BANK-B");
  const approve = await admin.rpc("admin_review_bank_transfer", { p_payment_id: bank.id, p_decision: "approved" }); check("manual bank transfer approved", !approve.error && resultOf(approve)?.success, approve.error?.message); if (resultOf(approve)?.purchase_id) ids.purchases.push(resultOf(approve).purchase_id);
  const forgeCard = await admin.rpc("admin_review_bank_transfer", { p_payment_id: card.id, p_decision: "approved" }); check("card manual approval blocked", !forgeCard.error && resultOf(forgeCard)?.success === false && resultOf(forgeCard)?.error_code === "MANUAL_REVIEW_NOT_ALLOWED", forgeCard.error?.message);
  const browserForge = await admin.from("payment_transactions").update({ status: "paid" }).eq("id", card.id).select(); check("browser direct payment update blocked", Boolean(browserForge.error));
  const { data: cardState } = await service.from("payment_transactions").select("status").eq("id", card.id).single(); check("card status unchanged", cardState?.status === "pending", cardState?.status);

  const ownAndCross = [
    [studentA, "student_profiles", ids.a, ids.b], [studentA, "student_lessons", ids.a, ids.b], [studentA, "student_homework", ids.a, ids.b],
    [studentA, "student_package_purchases", ids.a, ids.b], [studentA, "payment_transactions", ids.a, ids.b],
  ];
  for (const [client, table, ownId, otherId] of ownAndCross) { const own = await client.from(table).select("id").eq(table === "student_profiles" ? "id" : "student_user_id", ownId); const cross = await client.from(table).select("id").eq(table === "student_profiles" ? "id" : "student_user_id", otherId); check(`student own ${table} readable`, !own.error && own.data.length > 0, own.error?.message); check(`cross-student ${table} blocked`, !cross.error && cross.data.length === 0, cross.error?.message); }
  const adminRead = await admin.from("student_profiles").select("id").in("id", [ids.a, ids.b]); check("admin CRM read accepted", !adminRead.error && adminRead.data.length === 2, adminRead.error?.message);
  const { data: audits, error: auditError } = await service.from("audit_logs").select("action").in("action", ["student.updated", "package.assigned", "appointment.created", "lesson.completed", "homework.assigned", "homework.reviewed", "package.completed", "bank_transfer.approved", "payment.reviewed"]); const actionSet = new Set((audits || []).map((row) => row.action)); check("required audit actions present", !auditError && ["student.updated", "package.assigned", "appointment.created", "lesson.completed", "homework.assigned", "homework.reviewed", "package.completed", "bank_transfer.approved", "payment.reviewed"].every((action) => actionSet.has(action)), auditError?.message);
  check("payment B exists for cross-isolation", Boolean(paymentB.id)); check("homework B exists for cross-isolation", Boolean(homeworkB));
  console.log(JSON.stringify({ result: "PASS", projectRef, checks, summary: { firstLessonsUsed: usage.lessons_used, repeatLessonsUsed: usage.lessons_used, completedLessonsUsed: completedPackage.lessons_used, completedStatus: completedPackage.status, duplicateLessonRows: lessonCount, lessonAuditSideEffects: lessonAuditCount, cardManualApprovalBlocked: true } }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ result: "FAIL", message: error.message, checks }, null, 2)); process.exitCode = 1;
} finally { await cleanup(); }
