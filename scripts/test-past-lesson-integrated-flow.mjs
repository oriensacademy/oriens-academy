import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [component, client, migration, worker] = await Promise.all([
  read("src/components/admin/StudentLearningManager.tsx"),
  read("src/lib/admin/student-learning.ts"),
  read("supabase/migrations/20260917120000_integrated_past_lesson_report_flow.sql"),
  read("supabase/functions/process-notification-outbox/index.ts"),
]);
const studentLessonUpdates = migration.match(/update public\.student_lessons set[\s\S]*?;/gi) || [];

const checks = [
  ["Ders dropdown", component.includes('<option value="other">Diğer</option>')],
  ["custom Ders Adı", component.includes("Ders Adı") && component.includes("customTitle")],
  ["Konu free text", component.includes('placeholder="Örn. Integration by Parts"')],
  ["past report field", component.includes("pastForm.completionReport")],
  ["mail validation copy", component.includes("E-posta göndermek için ders sonu raporu girilmelidir.")],
  ["future title/subject separation", component.includes("title,\n      subject,")],
  ["client integrated RPC inputs", client.includes("p_completion_report") && client.includes("p_send_report_email")],
  ["legacy confirmation disabled", client.includes("p_send_email: false")],
  ["single linked -1 adjustment", migration.includes("linked_lesson_id") && migration.includes("'past_lesson_added'") && migration.includes(",-1,")],
  ["initial report version one", migration.includes("case when v_report is null then 0 else 1 end")],
  ["MAIL-027 dedupe", migration.includes("'lesson_report:'||v_lesson.id::text||':v'||v_lesson.report_version::text")],
  ["MAIL-027 canonical template", migration.includes("'lesson_completed_account_holder'")],
  ["empty report + email rejected before lock", migration.indexOf("REPORT_REQUIRED_FOR_EMAIL") < migration.indexOf("pg_advisory_xact_lock")],
  ["no historical mass update", studentLessonUpdates.length > 0 && studentLessonUpdates.every((statement) => /where id\s*=/.test(statement))],
  ["mail course/topic labels", worker.includes('"Lesson" : "Ders"') && worker.includes('"Subject" : "Konu"')],
];

for (const [name, passed] of checks) {
  assert.equal(passed, true, `FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}

console.log(`PASS: ${checks.length} integrated past-lesson invariants verified without mutating any user data.`);

if (process.argv.includes("--integration")) await runLocalIntegration();

async function runLocalIntegration() {
  const url = process.env.LOCAL_SUPABASE_URL || "http://127.0.0.1:54321";
  const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY;
  const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_KEY;
  assert.match(url, /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/, "Integration mode is LOCAL ONLY");
  assert.ok(anonKey && serviceKey, "LOCAL_SUPABASE_ANON_KEY and LOCAL_SUPABASE_SERVICE_KEY are required");

  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  // Local fixture plumbing only. Business mutations below still use the signed-in
  // admin JWT and therefore exercise public.is_admin() and normal RPC grants.
  localSql("/* LOCAL_QA_SETUP */ grant all on all tables in schema public to service_role; grant usage,select on all sequences in schema public to service_role;");
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const adminEmail = `qa-past-lesson-admin-${suffix}@example.test`;
  const studentEmail = `qa-past-lesson-student-${suffix}@example.test`;
  const password = `Qa!${crypto.randomUUID()}aA1`;
  const manifest = { adminId: null, studentId: null, packageIds: [], lessonIds: [], adjustmentIds: [], notificationIds: [], auditIds: [], topicIds: [], instructorIds: [], pricingPackageIds: [] };
  const results = [];
  const pass = (name, condition, detail = "") => {
    assert.ok(condition, `${name}${detail ? `: ${detail}` : ""}`);
    results.push(name);
    console.log(`PASS [integration]: ${name}`);
  };
  const one = (response) => response.data && typeof response.data === "object" ? response.data : {};
  const rpcOk = async (admin, name, args) => {
    assert.equal(args.p_student_id === undefined || args.p_student_id === manifest.studentId, true, "fixture guard: student_id");
    const response = await admin.rpc(name, args);
    assert.ifError(response.error && new Error(`${name}: ${response.error.message}`));
    assert.equal(one(response).success, true, `${name} returned success`);
    return one(response);
  };
  const packageRow = async (id) => {
    const response = await service.from("student_package_purchases").select("id,student_user_id,lesson_count,lessons_used,status").eq("id", id).single();
    assert.ifError(response.error);
    assert.equal(response.data.student_user_id, manifest.studentId, "fixture guard: package owner");
    return response.data;
  };
  const counts = async () => {
    const [lessons, adjustments, notifications, payments] = await Promise.all([
      service.from("student_lessons").select("id", { count: "exact", head: true }).eq("student_user_id", manifest.studentId),
      service.from("student_package_adjustments").select("id", { count: "exact", head: true }).eq("student_user_id", manifest.studentId),
      service.from("notification_deliveries").select("id", { count: "exact", head: true }).in("entity_id", manifest.lessonIds.length ? manifest.lessonIds : ["00000000-0000-0000-0000-000000000000"]),
      service.from("payment_transactions").select("id", { count: "exact", head: true }).eq("student_user_id", manifest.studentId),
    ]);
    return { lessons: lessons.count || 0, adjustments: adjustments.count || 0, notifications: notifications.count || 0, payments: payments.count || 0 };
  };
  const createPast = async (admin, { title, subject, report = null, email = false, key, topicId = null, packageId }) => {
    const before = await packageRow(packageId);
    const value = await rpcOk(admin, "admin_record_completed_lesson", {
      p_student_id: manifest.studentId, p_lesson_date: new Date(Date.now() - 3_600_000).toISOString(), p_duration_minutes: 60,
      p_title: title, p_subject: subject, p_teacher_note: null, p_package_purchase_id: packageId, p_existing_lesson_id: null,
      p_completion_source: "past", p_idempotency_key: key, p_lesson_timezone: "Europe/Istanbul", p_lesson_timezone_label: "TR",
      p_topic_id: topicId, p_instructor_id: manifest.instructorIds[0], p_send_email: false, p_completion_report: report, p_send_report_email: email,
    });
    if (!manifest.lessonIds.includes(value.lesson_id)) manifest.lessonIds.push(value.lesson_id);
    const after = await packageRow(packageId);
    assert.equal(after.lessons_used - before.lessons_used, value.already_completed ? 0 : 1, "one right per new lesson");
    return value;
  };

  let admin;
  let failureTriggerInstalled = false;
  try {
    const existing = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    assert.ifError(existing.error);
    pass("exact QA emails absent before creation", !existing.data.users.some((user) => user.email === adminEmail || user.email === studentEmail));

    const adminCreated = await service.auth.admin.createUser({ email: adminEmail, password, email_confirm: true, app_metadata: { role: "admin" }, user_metadata: { full_name: "QA Past Lesson Admin" } });
    assert.ifError(adminCreated.error); manifest.adminId = adminCreated.data.user.id;
    const studentCreated = await service.auth.admin.createUser({ email: studentEmail, password, email_confirm: true, app_metadata: { role: "student" }, user_metadata: { full_name: "QA Past Lesson Flow" } });
    assert.ifError(studentCreated.error); manifest.studentId = studentCreated.data.user.id;

    await must(service.from("admin_profiles").upsert({ user_id: manifest.adminId, display_name: "QA Past Lesson Admin", role: "admin", active: true }));
    await must(service.from("student_profiles").upsert({ id: manifest.studentId, full_name: "QA Past Lesson Flow", email: studentEmail, preferred_language: "tr", active: true }));
    await must(service.from("guardian_accounts").insert({ user_id: manifest.studentId, full_name: "QA Past Lesson Flow", email: studentEmail, preferred_language: "tr", email_verified_at: new Date().toISOString(), active: true }));
    await must(service.from("guardian_students").insert({ guardian_user_id: manifest.studentId, student_id: manifest.studentId, relationship_role: "self", is_primary: true, active: true, source: "qa" }));

    const authClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const signedIn = await authClient.auth.signInWithPassword({ email: adminEmail, password });
    assert.ifError(signedIn.error);
    assert.equal(signedIn.data.user.id, manifest.adminId, "fixture guard: admin actor");
    admin = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${signedIn.data.session.access_token}` } }, auth: { persistSession: false } });
    const adminCheck = await admin.rpc("is_admin");
    pass("canonical public.is_admin authorization", !adminCheck.error && adminCheck.data === true);

    const catalogId = `qa-past-${suffix}`;
    await must(service.from("pricing_packages").insert({ id: catalogId, name_tr: "QA 10 Derslik Paket", name_en: "QA 10 Lesson Package", billing_basis: "session", lesson_count: 10, price_amount: 0, currency: "TRY", purchase_mode: "consultation_only", active: true }));
    manifest.pricingPackageIds.push(catalogId);
    const topicRows = await must(service.from("lesson_topics").insert([{ label: `IB Math HL ${suffix}`, sort_order: 9001 }, { label: `SAT Math ${suffix}`, sort_order: 9002 }]).select("id,label"));
    manifest.topicIds.push(...topicRows.map((row) => row.id));
    const instructor = await must(service.from("instructors").insert({ name: `QA Instructor ${suffix}`, sort_order: 9001 }).select("id").single());
    manifest.instructorIds.push(instructor.id);

    const assign = async (label) => {
      const value = await rpcOk(admin, "admin_assign_student_package_v2", { p_student_id: manifest.studentId, p_package_id: catalogId, p_custom_package_name: label, p_start_date: new Date().toISOString().slice(0, 10), p_end_date: null, p_lesson_count: 10, p_price_amount: 0, p_currency: "TRY", p_payment_status: "waived", p_admin_notes: `local QA ${suffix}` });
      manifest.packageIds.push(value.purchase_id);
      return value.purchase_id;
    };
    const packageA = await assign("QA Package A");
    const packageB = await assign("QA Package B");
    pass("manual package starts with 10 rights", (await packageRow(packageA)).lessons_used === 0);

    const separated = await createPast(admin, { title: `IB Math HL ${suffix}`, subject: "Integration by Parts", key: `qa:separated:${suffix}`, topicId: manifest.topicIds[0], packageId: packageA });
    const separatedRow = await row(service, "student_lessons", separated.lesson_id, "title,subject");
    pass("Ders / Konu separation", separatedRow.title === `IB Math HL ${suffix}` && separatedRow.subject === "Integration by Parts");
    await assertSingleAdjustment(service, separated.lesson_id, manifest);

    const other = await createPast(admin, { title: "College Math", subject: "Functions and Graphs", key: `qa:other:${suffix}`, packageId: packageA });
    const otherRow = await row(service, "student_lessons", other.lesson_id, "title,subject");
    pass("Diğer custom title", otherRow.title === "College Math" && otherRow.subject === "Functions and Graphs" && otherRow.title !== "Diğer");

    const reportOff = await createPast(admin, { title: "IB Math HL", subject: "Mechanics", report: "QA report email off.", key: `qa:report-off:${suffix}`, packageId: packageA });
    const reportOffRow = await row(service, "student_lessons", reportOff.lesson_id, "completion_report,report_version,report_author_id");
    const reportOffMail = await count(service.from("notification_deliveries").select("id", { count: "exact", head: true }).eq("entity_id", reportOff.lesson_id).eq("event_type", "lesson.report_email"));
    pass("report + mail OFF", reportOffRow.completion_report === "QA report email off." && reportOffRow.report_version === 1 && reportOffRow.report_author_id === manifest.adminId && reportOffMail === 0);

    const reportOn = await createPast(admin, { title: "IB Math HL", subject: "Electromagnetism", report: "QA report email on.", email: true, key: `qa:report-on:${suffix}`, packageId: packageA });
    const reportOnDelivery = await must(service.from("notification_deliveries").select("id,template,event_type,payload,status,dedupe_key").eq("entity_id", reportOn.lesson_id).eq("event_type", "lesson.report_email").single());
    manifest.notificationIds.push(reportOnDelivery.id);
    pass("report + mail ON queues one MAIL-027", reportOnDelivery.template === "lesson_completed_account_holder" && reportOnDelivery.payload.lesson_title === "IB Math HL" && reportOnDelivery.payload.subject === "Electromagnetism");

    const beforeInvalid = await counts(); const packageBeforeInvalid = await packageRow(packageA);
    const invalid = await admin.rpc("admin_record_completed_lesson", { p_student_id: manifest.studentId, p_lesson_date: new Date(Date.now()-3600000).toISOString(), p_duration_minutes: 60, p_title: "IB Math HL", p_subject: "Invalid", p_teacher_note: null, p_package_purchase_id: packageA, p_existing_lesson_id: null, p_completion_source: "past", p_idempotency_key: `qa:invalid:${suffix}`, p_lesson_timezone: "Europe/Istanbul", p_lesson_timezone_label: "TR", p_topic_id: null, p_instructor_id: null, p_send_email: false, p_completion_report: null, p_send_report_email: true });
    const afterInvalid = await counts(); const packageAfterInvalid = await packageRow(packageA);
    pass("empty report + mail ON has zero mutations", !one(invalid).success && one(invalid).error_code === "REPORT_REQUIRED_FOR_EMAIL" && JSON.stringify(beforeInvalid) === JSON.stringify(afterInvalid) && packageBeforeInvalid.lessons_used === packageAfterInvalid.lessons_used);

    const emptyOff = await createPast(admin, { title: "IB Physics HL", subject: "Forces", key: `qa:empty-off:${suffix}`, packageId: packageA });
    const emptyOffRow = await row(service, "student_lessons", emptyOff.lesson_id, "completion_report,report_version");
    pass("empty report + mail OFF", emptyOffRow.completion_report === null && emptyOffRow.report_version === 0);

    const doubleKey = `qa:double:${suffix}`;
    const double1 = await createPast(admin, { title: "SAT Math", subject: "Algebra", report: "Double submit report.", email: true, key: doubleKey, packageId: packageA });
    const usedAfterFirst = (await packageRow(packageA)).lessons_used;
    const double2 = await createPast(admin, { title: "SAT Math", subject: "Algebra", report: "Double submit report.", email: true, key: doubleKey, packageId: packageA });
    const doubleAdjustments = await count(service.from("student_package_adjustments").select("id", { count: "exact", head: true }).eq("linked_lesson_id", double1.lesson_id));
    const doubleMail = await count(service.from("notification_deliveries").select("id", { count: "exact", head: true }).eq("entity_id", double1.lesson_id).eq("event_type", "lesson.report_email"));
    pass("double submit idempotency", double1.lesson_id === double2.lesson_id && (await packageRow(packageA)).lessons_used === usedAfterFirst && doubleAdjustments === 1 && doubleMail === 1);

    const beforeEdit = await packageRow(packageA); const adjBeforeEdit = await count(service.from("student_package_adjustments").select("id", { count: "exact", head: true }).eq("linked_lesson_id", reportOff.lesson_id));
    const edited = await rpcOk(admin, "admin_save_lesson_completion_report", { p_lesson_id: reportOff.lesson_id, p_report: "QA report edited after creation." });
    pass("report edit rights delta zero", edited.report_version === 2 && (await packageRow(packageA)).lessons_used === beforeEdit.lessons_used && await count(service.from("student_package_adjustments").select("id", { count: "exact", head: true }).eq("linked_lesson_id", reportOff.lesson_id)) === adjBeforeEdit);
    const resendBefore = (await packageRow(packageA)).lessons_used;
    const resent = await rpcOk(admin, "admin_save_and_send_lesson_report", { p_lesson_id: reportOff.lesson_id, p_report: "QA report edited after creation.", p_resend: true });
    manifest.notificationIds.push(resent.notification_delivery_id);
    pass("report resend rights delta zero", (await packageRow(packageA)).lessons_used === resendBefore && resent.report_version === 2);

    const futureBefore = (await packageRow(packageA)).lessons_used;
    const future = await rpcOk(admin, "admin_upsert_student_lesson", { p_student_id: manifest.studentId, p_lesson_id: null, p_package_purchase_id: packageA, p_title: `SAT Math ${suffix}`, p_subject: "Advanced Algebra", p_exam_code: "SAT", p_lesson_date: new Date(Date.now()+86400000).toISOString(), p_duration_minutes: 60, p_live_meeting_url: null, p_teacher_note: null, p_status: "scheduled", p_lesson_timezone: "Europe/Istanbul", p_lesson_timezone_label: "TR", p_topic_id: manifest.topicIds[1], p_instructor_id: manifest.instructorIds[0] });
    manifest.lessonIds.push(future.lesson_id);
    const futureRow = await row(service, "student_lessons", future.lesson_id, "title,subject,completion_report");
    pass("future lesson has zero entitlement mutation", futureRow.title === `SAT Math ${suffix}` && futureRow.subject === "Advanced Algebra" && futureRow.completion_report === null && (await packageRow(packageA)).lessons_used === futureBefore && await count(service.from("student_package_adjustments").select("id", { count: "exact", head: true }).eq("linked_lesson_id", future.lesson_id)) === 0);

    const metadataBefore = (await packageRow(packageA)).lessons_used; const metadataAdj = await count(service.from("student_package_adjustments").select("id", { count: "exact", head: true }).eq("linked_lesson_id", other.lesson_id));
    await rpcOk(admin, "admin_update_completed_lesson_v2", { p_lesson_id: other.lesson_id, p_topic_id: null, p_title: "College Mathematics", p_subject: "Functions, Graphs and Limits", p_lesson_date: new Date(Date.now()-7200000).toISOString(), p_lesson_timezone: "Europe/Istanbul", p_lesson_timezone_label: "TR", p_duration_minutes: 75, p_instructor_id: manifest.instructorIds[0], p_package_purchase_id: packageA });
    const metadataRow = await row(service, "student_lessons", other.lesson_id, "title,subject,duration_minutes");
    pass("completed metadata edit rights delta zero", metadataRow.title === "College Mathematics" && metadataRow.subject === "Functions, Graphs and Limits" && metadataRow.duration_minutes === 75 && (await packageRow(packageA)).lessons_used === metadataBefore && await count(service.from("student_package_adjustments").select("id", { count: "exact", head: true }).eq("linked_lesson_id", other.lesson_id)) === metadataAdj);

    const aBefore = await packageRow(packageA); const bBefore = await packageRow(packageB);
    await rpcOk(admin, "admin_update_completed_lesson_v2", { p_lesson_id: other.lesson_id, p_topic_id: null, p_title: metadataRow.title, p_subject: metadataRow.subject, p_lesson_date: new Date(Date.now()-7200000).toISOString(), p_lesson_timezone: "Europe/Istanbul", p_lesson_timezone_label: "TR", p_duration_minutes: 75, p_instructor_id: manifest.instructorIds[0], p_package_purchase_id: packageB });
    const aAfter = await packageRow(packageA); const bAfter = await packageRow(packageB);
    pass("package transfer preserves total consumption", aAfter.lessons_used === aBefore.lessons_used-1 && bAfter.lessons_used === bBefore.lessons_used+1 && aAfter.lessons_used+bAfter.lessons_used === aBefore.lessons_used+bBefore.lessons_used && await count(service.from("student_package_adjustments").select("id", { count: "exact", head: true }).eq("linked_lesson_id", other.lesson_id)) === 1);
    pass("MAIL-027 render keeps Ders/Konu independent", reportOnDelivery.payload.lesson_title === "IB Math HL" && reportOnDelivery.payload.subject === "Electromagnetism" && worker.includes('"Subject" : "Konu"'));

    const triggerSql = `create or replace function public.qa_fail_report_outbox_${manifest.studentId.replaceAll("-", "_")}() returns trigger language plpgsql as $$ begin if new.event_type='lesson.report_email' and new.payload->>'student_id'='${manifest.studentId}' then raise exception 'QA_FORCED_OUTBOX_FAILURE'; end if; return new; end $$; create trigger qa_fail_report_outbox_${manifest.studentId.replaceAll("-", "_")} before insert on public.notification_deliveries for each row execute function public.qa_fail_report_outbox_${manifest.studentId.replaceAll("-", "_")}();`;
    localSql(triggerSql); failureTriggerInstalled = true;
    const rollbackBefore = await counts(); const rollbackPackageBefore = await packageRow(packageA);
    const rollback = await admin.rpc("admin_record_completed_lesson", { p_student_id: manifest.studentId, p_lesson_date: new Date(Date.now()-3600000).toISOString(), p_duration_minutes: 60, p_title: "QA Rollback", p_subject: "Atomicity", p_teacher_note: null, p_package_purchase_id: packageA, p_existing_lesson_id: null, p_completion_source: "past", p_idempotency_key: `qa:rollback:${suffix}`, p_lesson_timezone: "Europe/Istanbul", p_lesson_timezone_label: "TR", p_topic_id: null, p_instructor_id: null, p_send_email: false, p_completion_report: "Must roll back completely.", p_send_report_email: true });
    const rollbackAfter = await counts(); const rollbackPackageAfter = await packageRow(packageA);
    pass("rollback and outbox atomicity", Boolean(rollback.error) && JSON.stringify(rollbackBefore) === JSON.stringify(rollbackAfter) && rollbackPackageBefore.lessons_used === rollbackPackageAfter.lessons_used);
    localSql(`drop trigger qa_fail_report_outbox_${manifest.studentId.replaceAll("-", "_")} on public.notification_deliveries; drop function public.qa_fail_report_outbox_${manifest.studentId.replaceAll("-", "_")}();`); failureTriggerInstalled = false;

    const paymentFinal = await count(service.from("payment_transactions").select("id", { count: "exact", head: true }).eq("student_user_id", manifest.studentId));
    pass("payment and PayTR mutations zero", paymentFinal === 0);
    console.log(JSON.stringify({ status: "PASS", environment: "LOCAL ONLY", qaAdmin: manifest.adminId, qaStudent: manifest.studentId, tests: results.length }, null, 2));
  } finally {
    if (failureTriggerInstalled && manifest.studentId) {
      try { localSql(`drop trigger if exists qa_fail_report_outbox_${manifest.studentId.replaceAll("-", "_")} on public.notification_deliveries; drop function if exists public.qa_fail_report_outbox_${manifest.studentId.replaceAll("-", "_")}();`); } catch {}
    }
    if (manifest.adminId) {
      const audits = await service.from("audit_logs").select("id").eq("actor_user_id", manifest.adminId);
      manifest.auditIds.push(...(audits.data || []).map((item) => item.id));
    }
    if (manifest.lessonIds.length) {
      const notifications = await service.from("notification_deliveries").select("id").in("entity_id", manifest.lessonIds);
      for (const item of notifications.data || []) if (!manifest.notificationIds.includes(item.id)) manifest.notificationIds.push(item.id);
      const adjustments = await service.from("student_package_adjustments").select("id").in("linked_lesson_id", manifest.lessonIds);
      manifest.adjustmentIds.push(...(adjustments.data || []).map((item) => item.id));
    }
    await exactDelete(service, "notification_deliveries", manifest.notificationIds);
    await exactDelete(service, "audit_logs", manifest.auditIds);
    await exactDelete(service, "student_package_adjustments", manifest.adjustmentIds);
    await exactDelete(service, "student_lessons", manifest.lessonIds);
    await exactDelete(service, "student_package_purchases", manifest.packageIds);
    if (manifest.studentId) await service.from("guardian_students").delete().eq("guardian_user_id", manifest.studentId).eq("student_id", manifest.studentId);
    if (manifest.studentId) await service.from("guardian_accounts").delete().eq("user_id", manifest.studentId);
    if (manifest.adminId) await service.from("admin_profiles").delete().eq("user_id", manifest.adminId);
    for (const id of [manifest.studentId, manifest.adminId].filter(Boolean)) await service.from("student_profiles").delete().eq("id", id);
    if (manifest.topicIds.length) {
      const ids = sqlUuidList(manifest.topicIds);
      localSql(`/* LOCAL_QA_CLEANUP */ alter table public.lesson_topics disable trigger trg_prevent_lesson_topic_delete; delete from public.lesson_topics where id in (${ids}); alter table public.lesson_topics enable trigger trg_prevent_lesson_topic_delete;`);
    }
    if (manifest.instructorIds.length) {
      const ids = sqlUuidList(manifest.instructorIds);
      localSql(`/* LOCAL_QA_CLEANUP */ alter table public.instructors disable trigger trg_prevent_instructor_delete; delete from public.instructors where id in (${ids}); alter table public.instructors enable trigger trg_prevent_instructor_delete;`);
    }
    for (const id of manifest.pricingPackageIds) await service.from("pricing_packages").delete().eq("id", id);
    for (const [id, email] of [[manifest.studentId, studentEmail], [manifest.adminId, adminEmail]]) {
      if (!id) continue;
      const current = await service.auth.admin.getUserById(id);
      assert.equal(current.data.user?.email, email, "exact auth cleanup guard");
      const deleted = await service.auth.admin.deleteUser(id);
      assert.ifError(deleted.error);
    }
    const residual = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    assert.equal(residual.data.users.some((user) => user.id === manifest.adminId || user.id === manifest.studentId), false, "residual QA auth");
    console.log("PASS [integration]: exact-ID try/finally cleanup; residual QA auth = 0");
  }
}

async function must(query) {
  const { data, error } = await query;
  assert.ifError(error);
  return data;
}
async function row(service, table, id, columns) { return must(service.from(table).select(columns).eq("id", id).single()); }
async function count(query) { const { count: value, error } = await query; assert.ifError(error); return value || 0; }
async function assertSingleAdjustment(service, lessonId, manifest) {
  const data = await must(service.from("student_package_adjustments").select("id,student_user_id,lesson_delta").eq("linked_lesson_id", lessonId));
  assert.equal(data.length, 1); assert.equal(data[0].student_user_id, manifest.studentId); assert.equal(data[0].lesson_delta, -1);
}
async function exactDelete(service, table, ids) {
  if (!ids.length) return;
  const unique = [...new Set(ids)];
  const { error } = await service.from(table).delete().in("id", unique);
  assert.ifError(error);
}
function localSql(sql) {
  assert.ok(sql.includes("qa_fail_report_outbox_") || sql.includes("LOCAL_QA_SETUP") || sql.includes("LOCAL_QA_CLEANUP"), "local SQL guard");
  execFileSync("docker", ["exec", "supabase_db_oriens-academy.com", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: "pipe" });
}
function sqlUuidList(ids) {
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  return [...new Set(ids)].map((id) => `'${id}'`).join(",");
}
