// Denetim merkezi SQL testi: migration'lar yerel PGlite üzerinde, sahte şema ve
// sahte verilerle çalıştırılır. Üretime bağlanmaz, mail/ödeme oluşturmaz.
//   node supabase/tests/audit-center-sql.mjs
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = [
  "supabase/migrations/20261007120000_account_audit_events.sql",
  "supabase/migrations/20261007130000_admin_audit_center.sql",
  "supabase/migrations/20261007140000_cart_checkout_audit.sql",
];

const FIXTURE = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
create table auth.users (
  id uuid primary key, email varchar(255), raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}'
);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid, action text not null, entity_type text, entity_id text, metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  severity text not null default 'info' check (severity in ('info','warning','error','critical')),
  category text not null default 'system' check (category in ('auth','admin','student','lesson','package','payment','email','blog','contact','database','edge','system')),
  correlation_id text
);
create table public.auth_login_events (
  id bigint generated always as identity primary key, user_id uuid, email text, role text check (role in ('veli','yonetici')),
  result text check (result in ('ok','fail')), device text, created_at timestamptz not null default now()
);
create table public.admin_profiles (user_id uuid primary key, display_name text, role text, active boolean default true, created_at timestamptz default now());
create table public.guardian_accounts (
  user_id uuid primary key, full_name text, email text, phone text, contact_address text, preferred_language text,
  email_verified_at timestamptz, active boolean default true, migration_source text,
  created_at timestamptz default now(), updated_at timestamptz default now(), archived_at timestamptz
);
create table public.student_profiles (
  id uuid primary key, full_name text, email text, phone text, school text, target_country text, target_university text,
  target_exam text, target_exams text[], target_countries text[], education_program text, exams_taken text[],
  grade_level text, contact_guardian_name text, preferred_language text, active boolean default true,
  archived_at timestamptz, created_at timestamptz default now()
);
create table public.guardian_students (guardian_user_id uuid, student_id uuid, is_primary boolean, active boolean default true, primary key (guardian_user_id, student_id));
create table public.pricing_packages (id text primary key, name_tr text, name_en text, lesson_count int, current_total numeric, price_amount numeric, currency text default 'TRY');
create table public.payment_transactions (
  id uuid primary key, student_user_id uuid, package_id text, public_reference text unique, status_token_hash text,
  provider text, provider_transaction_id text, amount numeric, currency text, status text, payment_method text,
  installment_count int, payer_name text, payer_email text, payer_phone text, payer_address text, metadata jsonb default '{}',
  created_at timestamptz default now(), paid_at timestamptz, auth_actor_user_id uuid, purchaser_guardian_user_id uuid,
  package_owner_student_id uuid, refunded_amount numeric, refund_status text, last_refunded_at timestamptz,
  last_refund_reason text, paytr_refund_reference text, is_archived boolean default false, is_preload boolean default false
);
create table public.student_package_purchases (
  id uuid primary key, student_user_id uuid, package_id text, payment_transaction_id uuid, lesson_count int,
  lessons_used int, end_date date, status text, payment_status text, assignment_source text, price_amount numeric,
  currency text, custom_package_name text, is_archived boolean default false, created_at timestamptz default now()
);
create table public.instructors (id uuid primary key, name text);
create table public.lesson_topics (id uuid primary key, label text);
create table public.student_lessons (
  id uuid primary key, student_user_id uuid, package_purchase_id uuid, title text, subject text, exam_code text,
  lesson_date timestamptz, duration_minutes int, status text, teacher_note text, completed_at timestamptz,
  completion_previous_remaining int, completion_report text, report_updated_at timestamptz,
  report_email_sent_at timestamptz, report_version int, lesson_timezone_label text, is_archived boolean default false,
  topic_id uuid, instructor_id uuid
);
create table public.notification_deliveries (
  id uuid primary key, channel text, event_type text, entity_type text, entity_id text, recipient text, provider text,
  provider_message_id text, status text, attempt_count int default 0, last_error_code text, last_error text,
  created_at timestamptz default now(), sent_at timestamptz, next_attempt_at timestamptz, subject text, template text,
  payload jsonb, dedupe_key text, is_archived boolean default false
);
create table public.email_change_challenges (
  id uuid primary key default gen_random_uuid(), user_id uuid, old_email text, new_email text, code_hash text,
  created_at timestamptz default now()
);
create function public.record_login_failure(p_email text, p_device text) returns void language sql as $$ select $$;
`;

const ID = {
  admin: "00000000-0000-4000-8000-00000000000a",
  guardian: "00000000-0000-4000-8000-000000000001",
  student: "00000000-0000-4000-8000-000000000002",
  payment: "00000000-0000-4000-8000-000000000003",
  purchase: "00000000-0000-4000-8000-000000000004",
  lesson: "00000000-0000-4000-8000-000000000005",
  mail: "00000000-0000-4000-8000-000000000006",
  otpMail: "00000000-0000-4000-8000-000000000007",
  instructor: "00000000-0000-4000-8000-000000000008",
  topic: "00000000-0000-4000-8000-000000000009",
  stranger: "00000000-0000-4000-8000-00000000000b",
};

const SEED = `
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('${ID.admin}', 'mert@oriens.test', '{"role":"admin"}', '{}'),
  ('${ID.guardian}', 'ayse@example.com', '{}', '{"full_name":"Metadata Adı"}'),
  ('${ID.stranger}', 'kayitsiz@example.com', '{}', '{}');
insert into public.admin_profiles (user_id, display_name, role) values ('${ID.admin}', 'Mert Ömeroğlu', 'admin');
insert into public.guardian_accounts (user_id, full_name, email, phone, email_verified_at)
  values ('${ID.guardian}', 'Ayşe Yılmaz', 'ayse@example.com', '+905321234512', now());
insert into public.student_profiles (id, full_name, phone) values ('${ID.student}', 'Can Yılmaz', '05321234567');
insert into public.guardian_students values ('${ID.guardian}', '${ID.student}', true, true);
insert into public.pricing_packages values ('pkg5', '5 Derslik Paket', 'Five Lesson Package', 5);
insert into public.payment_transactions (id, student_user_id, package_id, public_reference, status_token_hash, provider,
  provider_transaction_id, amount, currency, status, payer_name, payer_email, payer_phone, payer_address, metadata, created_at,
  paid_at, purchaser_guardian_user_id, package_owner_student_id, paytr_refund_reference)
values ('${ID.payment}', '${ID.student}', 'pkg5', 'ORI-ABC123', 'HASHSECRET', 'paytr', 'TX-998', 4500, 'TRY', 'paid',
  'Ayşe Yılmaz', 'ayse@example.com', '+905321234512', 'Gizli Sokak 5',
  '{"iframe_token":"SECRET-IFRAME","status_token":"SECRET-STATUS","coupon_code":"YAZ10","discount_kurus":50000,"paytr_callback":{"hash":"SECRET-CB"}}',
  now() - interval '10 minutes', now() - interval '8 minutes', '${ID.guardian}', '${ID.student}', 'REFSECRET');
insert into public.student_package_purchases (id, student_user_id, package_id, payment_transaction_id, lesson_count, lessons_used, status, payment_status)
  values ('${ID.purchase}', '${ID.student}', 'pkg5', '${ID.payment}', 5, 1, 'active', 'paid');
insert into public.instructors values ('${ID.instructor}', 'Elif Hoca');
insert into public.lesson_topics values ('${ID.topic}', 'Türev');
insert into public.student_lessons (id, student_user_id, package_purchase_id, title, subject, lesson_date, duration_minutes,
  status, teacher_note, completion_report, completion_previous_remaining, report_version, instructor_id, topic_id)
values ('${ID.lesson}', '${ID.student}', '${ID.purchase}', 'Matematik - Türev', 'Matematik', now(), 60, 'completed',
  'GIZLI-NOT', 'GIZLI-RAPOR-METNI', 5, 1, '${ID.instructor}', '${ID.topic}');
insert into public.notification_deliveries (id, channel, event_type, entity_type, entity_id, recipient, provider,
  provider_message_id, status, attempt_count, created_at, sent_at, subject, template, payload, dedupe_key)
values
  ('${ID.mail}', 'email', 'payment.success', 'payment_transaction', '${ID.payment}', 'ayse@example.com', 'google_workspace',
   'msg-1', 'sent', 1, now() - interval '7 minutes', now() - interval '6 minutes', null, 'payment_success_guardian',
   '{"otp":"999999"}', 'payment-success:${ID.payment}'),
  ('${ID.otpMail}', 'email', 'purchase.email_verification_otp', 'user', '${ID.stranger}', 'kayitsiz@example.com', 'google_workspace',
   null, 'failed', 8, now() - interval '3 minutes', null, 'Doğrulama kodunuz 654321', 'purchase.email_verification_otp',
   '{"code":"654321"}', 'otp:x');
insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata, created_at, severity, category, correlation_id) values
  ('${ID.guardian}', 'payment_session_requested', 'payment_transaction', 'ORI-ABC123', '{"public_reference":"ORI-ABC123","package_name":"5 Derslik Paket"}', now() - interval '10 minutes', 'info', 'payment', 'corr-1'),
  (null, 'paytr_callback_received', 'payment_transaction', 'ORI-ABC123', '{"provider_status":"success","hash":"SECRET-HASH"}', now() - interval '8 minutes', 'info', 'payment', null),
  (null, 'payment_completed', 'payment_transaction', 'ORI-ABC123', '{"transaction_id":"${ID.payment}"}', now() - interval '8 minutes', 'info', 'payment', 'corr-1'),
  (null, 'email.sent', 'notification_delivery', '${ID.mail}', '{"delivery_id":"${ID.mail}"}', now() - interval '6 minutes', 'info', 'email', null),
  ('${ID.admin}', 'lesson.report_saved', 'student_lesson', '${ID.lesson}', '{}', now() - interval '5 minutes', 'info', 'lesson', null),
  ('${ID.admin}', 'student.profile.updated', 'student_profile', '${ID.student}',
   '{"password":"PLAIN-PW","nested":{"access_token":"AT-SECRET","list":[{"otp":"111222"}]},"phone":"05321234567","note":"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk","failure_code":"x1"}',
   now() - interval '4 minutes', 'info', 'student', null),
  (null, 'email.failed', 'notification_delivery', '${ID.otpMail}', '{"delivery_id":"${ID.otpMail}"}', now() - interval '3 minutes', 'error', 'email', null),
  ('${ID.guardian}', 'payment_session_requested', 'payment_transaction', 'ORI-OLD', '{}', now() - interval '40 days', 'info', 'payment', null);
insert into public.auth_login_events (user_id, email, role, result, device, created_at) values
  ('${ID.guardian}', 'ayse@example.com', 'veli', 'ok', 'Chrome 140 · Windows 11 · Masaüstü', now() - interval '12 minutes');
`;

let failures = 0;
let passes = 0;
function check(name, condition, detail) {
  if (condition) {
    passes += 1;
    console.log(`PASS ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL ${name}${detail === undefined ? "" : ` :: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
  }
}

async function expectError(db, sql, params = []) {
  try {
    await db.query(sql, params);
    return null;
  } catch (error) {
    return error;
  }
}

const db = new PGlite();
await db.exec(FIXTURE);
for (const file of MIGRATIONS) {
  await db.exec(readFileSync(file, "utf8"));
}
await db.exec(SEED);

const asAdmin = () => db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: ID.admin, app_metadata: { role: "admin" } })]);
const asGuardian = () => db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: ID.guardian, app_metadata: {} })]);
const asNobody = () => db.query(`select set_config('request.jwt.claims', '', false)`);

const FEED = `select * from public.admin_audit_feed($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9)`;
const feed = async ({ search = null, terms = null, category = null, status = null, from = null, to = null, person = null, limit = 50, offset = 0 } = {}) =>
  (await db.query(FEED, [search, terms ? JSON.stringify(terms) : null, category, status, from, to, person, limit, offset])).rows;

// --- Yetki -------------------------------------------------------------------
await asGuardian();
check("ADMIN ONLY feed (non-admin rejected)", Boolean(await expectError(db, FEED, [null, null, null, null, null, null, null, 50, 0])));
check("ADMIN ONLY detail (non-admin rejected)", Boolean(await expectError(db, `select public.admin_audit_detail('a1')`)));
check("ADMIN ONLY stats (non-admin rejected)", Boolean(await expectError(db, `select public.admin_audit_stats()`)));
await db.exec(`set role anon`);
check("ANON cannot execute feed", Boolean(await expectError(db, FEED, [null, null, null, null, null, null, null, 50, 0])));
check("ANON cannot read audit_changes", Boolean(await expectError(db, `select * from public.audit_changes`)));
await db.exec(`reset role`);
await db.exec(`set role authenticated`);
check("AUTHENTICATED cannot call internal admin_audit_rows", Boolean(await expectError(db, `select * from public.admin_audit_rows(null, null, null)`)));
await db.exec(`reset role`);

// --- Liste ---------------------------------------------------------------------
await asAdmin();
const all = await feed();
const byAction = (rows, action) => rows.find((row) => row.action === action);
check("FEED merges audit + login rows", all.some((row) => row.source === "login") && all.some((row) => row.source === "audit"));
// 8 audit + 1 giriş + seed sırasında tetikleyicinin yazdığı account.created = 10
check("PAGINATION total_count", Number(all[0]?.total_count) === 10, all[0]?.total_count);
check("ORDER newest first", all.every((row, index) => index === 0 || new Date(all[index - 1].created_at) >= new Date(row.created_at)));

const paid = byAction(all, "payment_completed");
check("PAYMENT resolves by transaction_id", paid?.payment_id === ID.payment && paid?.public_reference === "ORI-ABC123", paid);
check("PAYMENT subject is guardian (canonical name, not metadata)", paid?.subject_name === "Ayşe Yılmaz" && paid?.subject_role === "veli", paid?.subject_name);
check("PAYMENT student + package", paid?.student_name === "Can Yılmaz" && paid?.package_name === "5 Derslik Paket", paid);
check("PAYMENT status success", paid?.feed_status === "success" && paid?.feed_category === "payment");
const session = all.find((row) => row.action === "payment_session_requested");
check("PAYMENT resolves by public_reference entity_id", session?.payment_id === ID.payment && session?.amount == 4500, session);
check("PAYMENT session pending", session?.feed_status === "pending");
const callback = byAction(all, "paytr_callback_received");
check("CALLBACK provider_status success → success", callback?.feed_status === "success");
check("CALLBACK hash redacted in list metadata", callback?.metadata?.hash === "[gizlendi]", callback?.metadata);

const mail = byAction(all, "email.sent");
check("MAIL resolves delivery + recipient", mail?.delivery_id === ID.mail && mail?.mail_recipient === "ayse@example.com" && mail?.mail_template === "payment_success_guardian", mail);
check("MAIL resolves payment via delivery entity", mail?.payment_id === ID.payment && mail?.subject_name === "Ayşe Yılmaz");
const failedMail = byAction(all, "email.failed");
check("MAIL failed → error status", failedMail?.feed_status === "error" && failedMail?.feed_category === "mail");
check("MAIL unregistered recipient: email kept, no guessed name", failedMail?.subject_name == null && failedMail?.subject_email === "kayitsiz@example.com", failedMail);

const lesson = byAction(all, "lesson.report_saved");
check("LESSON resolves lesson/student/package", lesson?.lesson_id === ID.lesson && lesson?.student_name === "Can Yılmaz" && lesson?.package_name === "5 Derslik Paket", lesson);
check("ACTOR admin resolved by admin_profiles", lesson?.actor_name === "Mert Ömeroğlu" && lesson?.actor_role === "admin", lesson);
check("SUBJECT for admin action = primary guardian", lesson?.subject_name === "Ayşe Yılmaz", lesson?.subject_name);
check("LESSON does not link payment (no timeline noise)", lesson?.payment_id == null);

const login = byAction(all, "auth.login");
check("LOGIN row resolved", login?.subject_name === "Ayşe Yılmaz" && login?.subject_role === "veli" && login?.login_device?.includes("Chrome"), login);
check("LOGIN row student via guardian", login?.student_name === "Can Yılmaz");

const profile = byAction(all, "student.profile.updated");
const metaText = JSON.stringify(profile?.metadata);
check("SANITIZE password", profile?.metadata?.password === "[gizlendi]", profile?.metadata);
check("SANITIZE nested token + array otp", profile?.metadata?.nested?.access_token === "[gizlendi]" && profile?.metadata?.nested?.list?.[0]?.otp === "[gizlendi]");
check("SANITIZE phone masked", profile?.metadata?.phone === "0" + "5** *** **67", profile?.metadata?.phone);
check("SANITIZE JWT-like string", profile?.metadata?.note === "[gizlendi]");
check("SANITIZE keeps failure_code", profile?.metadata?.failure_code === "x1");
const nested = (await db.query(`select public.audit_redact('{"parent_phone":{"old":"+90 532 123 45 67","new":"05329876543"},"full_name":{"old":"A","new":"B"}}'::jsonb) as v`)).rows[0].v;
check("SANITIZE nested phone (before/after)", nested.parent_phone.old === "+90 5** *** **67" && nested.parent_phone.new === "05** *** **43" && nested.full_name.new === "B", nested);
check("SANITIZE no secret values in list", !/PLAIN-PW|AT-SECRET|111222|SECRET-HASH/.test(JSON.stringify(all)), metaText);

// --- Filtre / arama / sayfa ---------------------------------------------------------
check("FILTER category payment", (await feed({ category: "payment" })).every((row) => row.feed_category === "payment"));
check("FILTER status error", (await feed({ status: "error" })).map((row) => row.action).sort().join() === "email.failed");
const recent = await feed({ from: new Date(Date.now() - 30 * 86400000).toISOString() });
check("FILTER time range excludes 40-day-old row", recent.every((row) => row.public_reference !== "ORI-OLD") && recent.length === 9, recent.length);
check("SEARCH folded Turkish name (ayse yilmaz)", (await feed({ search: "AYŞE yılmaz" })).length >= 5);
check("SEARCH by payment reference", (await feed({ search: "ori-abc123" })).every((row) => row.public_reference === "ORI-ABC123"));
check("SEARCH by transaction id", (await feed({ search: "tx-998" })).length >= 3);
check("SEARCH by student name", (await feed({ search: "can" })).some((row) => row.action === "lesson.report_saved"));
check("SEARCH by package", (await feed({ search: "5 derslik" })).length >= 3);
check("SEARCH by correlation id", (await feed({ search: "corr-1" })).length === 2);
const byTerm = await feed({ search: "giris", terms: { giris: ["auth.login", "auth.login_failed"] } });
check("SEARCH by Turkish event title via term map", byTerm.length === 1 && byTerm[0].action === "auth.login", byTerm.map((row) => row.action));
check("SEARCH LIKE wildcard escaped", (await feed({ search: "%" })).length === 0);
check("PERSON filter by email", (await feed({ person: "ayse@example.com" })).length >= 5);
check("PERSON filter by uuid", (await feed({ person: ID.student })).some((row) => row.action === "lesson.report_saved"));
const page1 = await feed({ limit: 3, offset: 0 });
const page2 = await feed({ limit: 3, offset: 3 });
check("PAGINATION pages disjoint", page1.length === 3 && page2.length === 3 && !page1.some((row) => page2.some((other) => other.event_id === row.event_id)));
check("PAGINATION limit capped at 200", (await feed({ limit: 100000 })).length === 10);

// --- Ayrıntı ---------------------------------------------------------------------
const detailOf = async (eventId) => (await db.query(`select public.admin_audit_detail($1) as d`, [eventId])).rows[0].d;
const paidDetail = await detailOf(paid.event_id);
const paidText = JSON.stringify(paidDetail);
check("DETAIL payment block", paidDetail?.payment?.public_reference === "ORI-ABC123" && paidDetail?.payment?.provider_transaction_id === "TX-998" && paidDetail?.payment?.coupon_code === "YAZ10");
check("DETAIL payment callback arrived", paidDetail?.payment?.callback?.provider_status === "success" && Boolean(paidDetail?.payment?.callback?.at));
check("DETAIL payment rights assigned (+5)", paidDetail?.payment?.purchases?.[0]?.lesson_count === 5);
check("DETAIL payment mails", paidDetail?.payment?.mails?.[0]?.status === "sent" && paidDetail?.payment?.mails?.[0]?.recipient === "ayse@example.com");
check("DETAIL payment no secrets", !/SECRET-IFRAME|SECRET-STATUS|SECRET-CB|HASHSECRET|REFSECRET|Gizli Sokak|\+905321234512/.test(paidText), paidText);
check("DETAIL subject full email + students", paidDetail?.subject?.email === "ayse@example.com" && paidDetail?.subject?.students?.[0]?.name === "Can Yılmaz");
const timelineActions = (paidDetail?.timeline ?? []).map((item) => item.action);
check("TIMELINE correlates payment steps", ["payment_session_requested", "paytr_callback_received", "payment_completed", "email.sent"].every((action) => timelineActions.includes(action)), timelineActions);
check("TIMELINE excludes unrelated", !timelineActions.includes("lesson.report_saved") && !timelineActions.includes("auth.login"));
check("TIMELINE ascending + current marked", (paidDetail?.timeline ?? []).filter((item) => item.is_current).length === 1);

const mailDetail = await detailOf(failedMail.event_id);
check("DETAIL mail delivery block", mailDetail?.delivery?.attempt_count === 8 && mailDetail?.delivery?.max_attempts === 8 && mailDetail?.delivery?.provider === "google_workspace");
check("DETAIL mail no payload / OTP", !/654321|999999/.test(JSON.stringify(mailDetail)) && mailDetail?.delivery?.payload === undefined, mailDetail?.delivery);

const lessonDetail = await detailOf(lesson.event_id);
check("DETAIL lesson block", lessonDetail?.lesson?.instructor === "Elif Hoca" && lessonDetail?.lesson?.topic === "Türev" && lessonDetail?.lesson?.previous_remaining === 5 && lessonDetail?.lesson?.has_report === true);
check("DETAIL lesson no report/note text", !/GIZLI-RAPOR|GIZLI-NOT/.test(JSON.stringify(lessonDetail)));

const loginDetail = await detailOf(login.event_id);
check("DETAIL login event", loginDetail?.event?.action === "auth.login" && loginDetail?.event?.login_device?.includes("Windows"));
check("DETAIL unknown id → null", (await detailOf("a999999")) === null && (await detailOf("x; drop")) === null);

// --- Önce / sonra ------------------------------------------------------------------
await db.exec(`update public.student_profiles set phone = '05329998877', school = 'Yeni Lise' where id = '${ID.student}'`);
const change = (await db.query(`select changes, changed_by from public.audit_changes order by id desc limit 1`)).rows[0];
check("CHANGES captured only changed fields", Object.keys(change?.changes ?? {}).sort().join() === "phone,school", change);
check("CHANGES phone masked", change?.changes?.phone?.old === "05** *** **67" && change?.changes?.phone?.new === "05** *** **77", change?.changes?.phone);
check("CHANGES actor = admin jwt", change?.changed_by === ID.admin);
await db.query(`insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata, category) values ($1, 'student.profile.updated', 'student_profile', $2, '{}', 'student')`, [ID.admin, ID.student]);
const newest = (await feed({ limit: 1 }))[0];
const changeDetail = await detailOf(newest.event_id);
check("DETAIL shows before/after", changeDetail?.changes?.[0]?.changes?.school?.new === "Yeni Lise", changeDetail?.changes);
await db.exec(`update public.student_profiles set teacher_free_text_does_not_exist = 1 where false`).catch(() => null);
await db.exec(`update public.student_lessons set completion_report = 'baska rapor' where id = '${ID.lesson}'`);
check("CHANGES ignores non-allowlisted fields (report text)", !(await db.query(`select 1 from public.audit_changes where changes ? 'completion_report'`)).rows.length);

// --- Yeni olay üreticileri ---------------------------------------------------------
await asNobody();
await db.exec(`insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000c1', 'yeni@example.com')`);
await db.exec(`insert into public.guardian_accounts (user_id, full_name, email) values ('00000000-0000-4000-8000-0000000000c1', 'Yeni Veli', 'yeni@example.com')`);
const created = (await db.query(`select * from public.audit_logs where action = 'account.created' and entity_id = '00000000-0000-4000-8000-0000000000c1'`)).rows[0];
check("PRODUCER account.created", created?.actor_user_id === "00000000-0000-4000-8000-0000000000c1" && created?.metadata?.source === "self_service" && created?.category === "auth");
await db.exec(`insert into public.email_change_challenges (user_id, old_email, new_email, code_hash) values ('${ID.guardian}', 'ayse@example.com', 'ayse.yeni@example.com', 'h')`);
await db.exec(`insert into public.email_change_challenges (user_id, old_email, new_email, code_hash) values ('${ID.guardian}', 'ayse@example.com', 'ayse.yeni@example.com', 'h')`);
const ecr = (await db.query(`select * from public.audit_logs where action = 'account.email_change_requested'`)).rows;
check("PRODUCER email_change_requested masked + deduped", ecr.length === 1 && ecr[0].metadata.new_email_masked === "a***@example.com" && !JSON.stringify(ecr[0]).includes("ayse.yeni"), ecr);
await asGuardian();
await db.query(`select public.record_account_event('logout', 'Chrome 140 · Windows 11 · Masaüstü')`);
await db.query(`select public.record_account_event('password_changed', null)`);
await db.query(`select public.record_account_event('evil', null)`);
const accountEvents = (await db.query(`select action from public.audit_logs where action like 'auth.%' order by id`)).rows.map((row) => row.action);
check("PRODUCER logout + password_changed (only allowlisted)", accountEvents.join() === "auth.logout,auth.password_changed", accountEvents);

await asNobody();
await db.query(`select public.record_login_failure('Ayse@Example.com', 'Safari 18 · iOS · Mobil')`);
await db.query(`select public.record_login_failure('ayse@example.com', 'x', 'email_not_confirmed')`);
await db.query(`select public.record_login_failure('ayse@example.com', 'x', 'drop table')`);
await db.query(`select public.record_login_failure('nobody@example.com', 'x', 'invalid_credentials')`);
const fails = (await db.query(`select email, reason from public.auth_login_events where result = 'fail' order by id`)).rows;
check("LOGIN failure reasons allowlisted (+2-arg compat)", fails.map((row) => row.reason).join() === "invalid_credentials,email_not_confirmed,other" && fails.length === 3, fails);

await asAdmin();
const failRows = await feed({ search: "giris", terms: { giris: ["auth.login_failed"] }, status: "error" });
const failRow = failRows.find((row) => row.login_reason === "invalid_credentials");
check("LOGIN failure in feed with reason", failRows.length === 3 && failRow?.action === "auth.login_failed" && failRow?.login_reason === "invalid_credentials" && failRow?.subject_name === "Ayşe Yılmaz", failRow);

const stats = (await db.query(`select public.admin_audit_stats() as s`)).rows[0].s;
check("STATS from DB", stats.logins === 1 && stats.login_failures === 3 && stats.payments_paid === 1 && stats.mails_sent === 1 && stats.mails_failed === 1, stats);

// --- Sepet / ödeme başlangıcı (record_cart_event) -----------------------------------
const CART = "00000000-0000-4000-8000-00000000ca01";
const TX2 = "00000000-0000-4000-8000-0000000000d2";
await asNobody();
await db.exec(`
  update public.pricing_packages set current_total = 4500, price_amount = 5000 where id = 'pkg5';
  insert into public.pricing_packages (id, name_tr, name_en, lesson_count, current_total, price_amount) values ('pkg10', '10 Derslik Paket', 'Ten Lesson Package', 10, 8500, 9000);
  insert into public.payment_transactions (id, package_id, public_reference, provider, amount, currency, status, payer_name, payer_email,
    metadata, auth_actor_user_id, purchaser_guardian_user_id, package_owner_student_id)
  values ('${TX2}', 'pkg5', 'ORI-CART1', 'paytr', 4050, 'TRY', 'paid', 'Ayşe Yılmaz', 'ayse@example.com',
    '{"iframe_token":"SECRET-IFRAME2","status_token":"SECRET-STATUS2","coupon_code":"YAZ10","base_amount":4500,"discount_amount":450,
      "checkout_items":[{"package_id":"pkg5","package_name":"5 Derslik Paket","lesson_count":5,"base_amount":4500,"discount_amount":450,"final_amount":4050}]}',
    '${ID.guardian}', '${ID.guardian}', '${ID.student}');
`);
const cartCall = async (kind, ids, extra = {}) => (await db.query(
  `select public.record_cart_event($1, $2, $3::text[], $4::uuid, $5, $6, $7, $8) as ok`,
  [kind, extra.cart ?? CART, ids, extra.student ?? null, extra.reference ?? null, extra.result ?? null, extra.error ?? null, extra.source ?? null])).rows[0].ok;

check("CART anonymous (no session) ignored", (await cartCall("cart_item_added", ["pkg5"])) === false);
await db.exec(`set role anon`);
check("CART anon role cannot execute", Boolean(await expectError(db, `select public.record_cart_event('cart_item_added', '${CART}', array['pkg5'])`)));
await db.exec(`reset role`);
await asGuardian();
check("CART ADD pkg5", (await cartCall("cart_item_added", ["pkg5"], { source: "pricing" })) === true);
check("CART ADD pkg10", (await cartCall("cart_item_added", ["pkg10"], { source: "pricing" })) === true);
check("CART REMOVE pkg10", (await cartCall("cart_item_removed", ["pkg10"], { source: "cart" })) === true);
check("CART CLEAR (separate cart)", (await cartCall("cart_cleared", ["pkg5", "pkg10"], { cart: "00000000-0000-4000-8000-00000000ca02", source: "cart" })) === true);
check("CHECKOUT opened", (await cartCall("checkout_opened", ["pkg5"], { student: ID.student, source: "payment" })) === true);
check("CHECKOUT opened deduped (refresh)", (await cartCall("checkout_opened", ["pkg5"], { student: ID.student })) === false);
check("CHECKOUT started (linked to own payment)", (await cartCall("checkout_started", ["pkg5"], { student: ID.student, reference: "ORI-CART1", source: "payment" })) === true);
check("CHECKOUT start failure recorded", (await cartCall("checkout_started", ["pkg5"], { cart: "00000000-0000-4000-8000-00000000ca03", result: "session_failed", error: "PAYTR_SESSION_FAILED" })) === true);
check("CART rejects unknown kind", (await cartCall("cart_hacked", ["pkg5"])) === false);
check("CART rejects bad cart id", (await cartCall("cart_item_added", ["pkg5"], { cart: "not-a-uuid" })) === false);
check("CART rejects unknown package", (await cartCall("cart_item_added", ["nope"])) === false);
check("CART add needs exactly one package", (await cartCall("cart_item_added", ["pkg5", "pkg10"])) === false);
check("CART error code allowlisted", (await cartCall("checkout_started", ["pkg5"], { cart: "00000000-0000-4000-8000-00000000ca06", error: "<script>x" })) === true
  && !(await db.query(`select metadata from public.audit_logs where correlation_id = '00000000-0000-4000-8000-00000000ca06'`)).rows[0]?.metadata?.error_code);
await asNobody();
await db.exec(`insert into public.payment_transactions (id, package_id, public_reference, amount, currency, status, metadata, auth_actor_user_id, purchaser_guardian_user_id)
  values ('00000000-0000-4000-8000-0000000000d3', 'pkg10', 'ORI-OTHER', 8500, 'TRY', 'pending', '{"coupon_code":"GIZLI"}', '${ID.stranger}', '${ID.stranger}')`);
await asGuardian();
await cartCall("checkout_started", ["pkg10"], { cart: "00000000-0000-4000-8000-00000000ca04", reference: "ORI-OTHER" });
const foreign = (await db.query(`select metadata from public.audit_logs where correlation_id = '00000000-0000-4000-8000-00000000ca04'`)).rows[0]?.metadata;
check("CHECKOUT cannot attach someone else's payment", foreign && !foreign.transaction_id && !foreign.coupon_code && foreign.result === "session_failed", foreign);

await asNobody();
await db.exec(`insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata, severity, category, correlation_id) values
  ('${ID.guardian}', 'payment_session_requested', 'payment_transaction', 'ORI-CART1', '{"transaction_id":"${TX2}","public_reference":"ORI-CART1"}', 'info', 'payment', '${TX2}'),
  (null, 'paytr_callback_received', 'payment_transaction', 'ORI-CART1', '{"transaction_id":"${TX2}","provider_status":"success"}', 'info', 'payment', '${TX2}'),
  (null, 'payment_status_paid', 'payment_transaction', 'ORI-CART1', '{"transaction_id":"${TX2}"}', 'info', 'payment', '${TX2}'),
  (null, 'package.assigned', 'payment_transaction', 'ORI-CART1', '{"transaction_id":"${TX2}"}', 'info', 'package', '${TX2}'),
  (null, 'email.queued', 'payment_transaction', 'ORI-CART1', '{"transaction_id":"${TX2}"}', 'info', 'email', '${TX2}'),
  (null, 'email.sent', 'payment_transaction', 'ORI-CART1', '{"transaction_id":"${TX2}"}', 'info', 'email', '${TX2}')`);

await asAdmin();
const cartRows = await feed({ search: CART, limit: 100 });
const cartAdded = cartRows.find((row) => row.action === "cart_item_added" && row.metadata?.package_id === "pkg5");
check("CART ADD in feed: payment category, guardian + student", cartAdded?.feed_category === "payment" && cartAdded?.subject_name === "Ayşe Yılmaz" && cartAdded?.subject_email === "ayse@example.com" && cartAdded?.actor_name === "Ayşe Yılmaz" && cartAdded?.student_name === "Can Yılmaz", cartAdded);
check("CART ADD metadata (package, lessons, price, cart id)", cartAdded?.package_name === "5 Derslik Paket" && cartAdded?.metadata?.lesson_count === 5 && Number(cartAdded?.metadata?.price) === 4500 && cartAdded?.metadata?.currency === "TRY" && cartAdded?.metadata?.quantity === 1 && cartAdded?.metadata?.cart_id === CART && cartAdded?.correlation_id === CART, cartAdded?.metadata);
const removed = cartRows.find((row) => row.action === "cart_item_removed");
check("CART REMOVE in feed (10 Derslik, 8500)", removed?.package_name === "10 Derslik Paket" && Number(removed?.metadata?.price) === 8500, removed);
const cleared = (await feed({ search: "00000000-0000-4000-8000-00000000ca02" })).find((row) => row.action === "cart_cleared");
check("CART CLEAR lists items + total", cleared?.metadata?.items?.length === 2 && Number(cleared?.metadata?.total) === 13000 && cleared?.metadata?.item_count === 2, cleared?.metadata);
const started = cartRows.find((row) => row.action === "checkout_started");
check("CHECKOUT started: authoritative total/coupon/items from payment", started?.payment_id === TX2 && started?.public_reference === "ORI-CART1" && Number(started?.metadata?.total) === 4050 && started?.metadata?.coupon_code === "YAZ10" && Number(started?.metadata?.discount) === 450 && started?.metadata?.items?.[0]?.lesson_count === 5 && started?.metadata?.result === "session_created", started);
check("CHECKOUT started: no token/card data", !/SECRET-IFRAME2|SECRET-STATUS2|iframe_token|status_token/.test(JSON.stringify(cartRows)));
const startFail = (await feed({ search: "00000000-0000-4000-8000-00000000ca03" }))[0];
check("CHECKOUT start failure → warning + safe error code", startFail?.feed_status === "warning" && startFail?.metadata?.error_code === "PAYTR_SESSION_FAILED", startFail);
check("SEARCH cart by package name", (await feed({ search: "10 derslik", category: "payment" })).some((row) => row.action === "cart_item_added"));
check("SEARCH cart by payment reference", (await feed({ search: "ori-cart1" })).some((row) => row.action === "checkout_started"));
check("FILTER payment category includes cart events", (await feed({ category: "payment", limit: 200 })).filter((row) => row.action.startsWith("cart_") || row.action.startsWith("checkout_")).length >= 6);

const cartDetail = await detailOf(cartAdded.event_id);
const cartTimeline = (cartDetail?.timeline ?? []).map((item) => item.action);
const CHAIN = ["cart_item_added", "cart_item_removed", "checkout_opened", "checkout_started", "payment_session_requested", "paytr_callback_received", "payment_status_paid", "package.assigned", "email.queued", "email.sent"];
check("TIMELINE cart → payment → rights → mail (from cart event)", CHAIN.every((action) => cartTimeline.includes(action)), cartTimeline);
check("TIMELINE cart chain excludes other carts", !(cartDetail?.timeline ?? []).some((item) => item.action === "cart_cleared"));
check("DETAIL cart_id exposed", cartDetail?.cart_id === CART);
const paidCart = (await feed({ search: "ori-cart1" })).find((row) => row.action === "payment_status_paid");
const paidCartDetail = await detailOf(paidCart.event_id);
const paidTimeline = (paidCartDetail?.timeline ?? []).map((item) => item.action);
check("TIMELINE reverse bridge (payment → cart adds)", CHAIN.every((action) => paidTimeline.includes(action)) && paidCartDetail?.cart_id === CART, paidTimeline);
check("DETAIL payment items list with prices", paidCartDetail?.payment?.items?.[0]?.package_name === "5 Derslik Paket" && Number(paidCartDetail?.payment?.items?.[0]?.final) === 4050, paidCartDetail?.payment?.items);
check("DETAIL payment items no secrets", !/SECRET-IFRAME2|SECRET-STATUS2/.test(JSON.stringify(paidCartDetail)));
const ordered = (paidCartDetail?.timeline ?? []).map((item) => item.created_at);
check("TIMELINE chronological", ordered.every((at, index) => index === 0 || new Date(ordered[index - 1]) <= new Date(at)));

await asGuardian();
let limited = 0;
for (let index = 0; index < 70; index += 1) {
  if (!(await cartCall("cart_item_added", ["pkg5"], { cart: "00000000-0000-4000-8000-00000000ca05" }))) limited += 1;
}
check("CART rate limit (60 / 10 min per user)", limited > 0 && limited < 70, limited);

// --- Tetikleyici asıl yazmayı bozmaz -----------------------------------------------
await db.exec(`alter table public.audit_changes rename to audit_changes_off`);
await db.exec(`update public.student_profiles set school = 'Hata Toleransı' where id = '${ID.student}'`);
const stillUpdated = (await db.query(`select school from public.student_profiles where id = '${ID.student}'`)).rows[0];
check("TRIGGER failure never blocks the real update", stillUpdated.school === "Hata Toleransı");
await db.exec(`alter table public.audit_changes_off rename to audit_changes`);

console.log(`\n${passes} PASS, ${failures} FAIL`);
await db.close();
process.exit(failures ? 1 : 0);
