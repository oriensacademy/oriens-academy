// Panel "Yeni Öğrenci" ve "Arşive taşı (neden + Geri al)" testi (izole).
//
// 1. Kaynak düzeyi: istemci akışı yalnızca admin_create_student /
//    admin_archive_member_with_reason RPC'lerini çağırır; auth kullanıcısı,
//    e-posta, paket veya ödeme oluşturmaz; çift tıklama korumaları yerinde.
// 2. Veritabanı düzeyi: migration SQL'i, bellek içi PGlite (gerçek Postgres)
//    üzerinde, depodaki gerçek write_audit_event / admin_archive_member /
//    admin_restore_member tanımlarıyla birlikte çalıştırılır. Uzak veritabanına
//    bağlanılmaz; gerçek kullanıcı / öğrenci / e-posta yoktur.
//
// Çalıştırma: node scripts/test-admin-new-student-archive.mjs
// PGlite proje bağımlılığı değildir; yoksa PGLITE_MODULE ile modül yolu
// verilir (ör. PGLITE_MODULE=/tmp/pgl/node_modules/@electric-sql/pglite/dist/index.js).
// Modül bulunamazsa veritabanı bölümü FAIL sayılır (sessizce atlanmaz).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failures += 1;
};

const MIGRATION = "supabase/migrations/20261007100000_admin_create_student_and_archive_reason.sql";
const REFERENCE_REASONS = ["Kaydı bıraktı", "Mezun oldu", "Test kaydı", "Diğer"];

// ---------------------------------------------------------------- kaynak
const studentsTs = read("src/lib/admin/students.ts");
const dialog = read("src/components/admin/NewStudentDialog.tsx");
const page = read("src/app/admin/ogrenciler/page.tsx");
const toastTsx = read("src/components/ui/toast.tsx");
const migration = read(MIGRATION);

const createFn = studentsTs.slice(studentsTs.indexOf("export async function adminCreateStudent("));
const createBody = createFn.slice(0, createFn.indexOf("\nexport ", 10));
check(/\.rpc\("admin_create_student"/.test(createBody), "adminCreateStudent tek RPC: admin_create_student");
check(!/signUp|auth\.admin|functions\.invoke|email_outbox|send[A-Z]\w*Email/.test(createBody), "adminCreateStudent auth kullanıcısı / e-posta / edge çağrısı yapmıyor");
check(/p_request_id/.test(createBody), "adminCreateStudent istek anahtarını iletiyor");
check(/useState\(newRequestId\)/.test(dialog), "istek anahtarı pencere başına bir kez üretiliyor");
check(/if \(savingRef\.current\) return;/.test(dialog), "kaydet çift tıklamaya karşı kilitli");
check(!/package|paket_|paytr|payment/i.test(dialog.replace(/\/\/.*$/gm, "")), "Yeni Öğrenci penceresi paket / ödeme oluşturmuyor");

const reasonsMatch = /ARCHIVE_REASONS\s*=\s*\[([^\]]+)\]/.exec(studentsTs);
const clientReasons = reasonsMatch ? [...reasonsMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
check(JSON.stringify(clientReasons) === JSON.stringify(REFERENCE_REASONS), `istemci arşiv nedenleri referansla birebir (${clientReasons.join(" / ")})`);
const sqlReasons = /v_reason not in \(([^)]+)\)/.exec(migration);
check(sqlReasons && JSON.stringify([...sqlReasons[1].matchAll(/'([^']+)'/g)].map((m) => m[1])) === JSON.stringify(REFERENCE_REASONS), "sunucu arşiv nedenleri referansla birebir");
const refHtml = path.resolve(ROOT, "..", "oriens - entegre", "oriens-admin_6.html");
if (fs.existsSync(refHtml)) {
  const html = fs.readFileSync(refHtml, "utf8");
  const refReasons = [...html.matchAll(/data-neden="([^"]+)"/g)].map((m) => m[1]);
  check(JSON.stringify(refReasons) === JSON.stringify(REFERENCE_REASONS), "referans dosyasındaki #arc-dialog seçenekleri aynı");
  check(/act \? 6000 : 2600/.test(html), "referans Geri al süresi 6000 ms");
}
check(/const ACTION_DURATION = 6000;/.test(toastTsx), "toast eylem süresi 6000 ms (referans listToast)");
check(/if \(usedRef\.current[^)]*\) return;\s*usedRef\.current = true;/.test(toastTsx), "toast eylemi en fazla bir kez çalışıyor");
check(/label: "Geri al"/.test(page) && /restore\(o, `\$\{o\.fullName\} geri alındı`\)/.test(page), "arşiv toast'ı Geri al → kanonik geri alma");
check(/if \([^)]*busyRef\.current\) return;\s*busyRef\.current = true;/.test(page), "arşiv / geri al çift tıklamaya karşı kilitli");

const stripped = migration.replace(/--.*$/gm, "");
check(!/\b(drop\s+(table|column|function|policy)|truncate|delete\s+from)\b/i.test(stripped), "migration: DROP / TRUNCATE / DELETE yok");
check(!/auth\.users/i.test(stripped), "migration: auth.users'a dokunmuyor");
check(!/email_outbox|notification_outbox|pg_net|http_post/i.test(stripped), "migration: e-posta / dış çağrı yok");
check(!/update\s+public\.student_profiles/i.test(stripped), "migration: toplu öğrenci güncellemesi yok");
check((stripped.match(/update\s+public\.audit_logs/gi) || []).length === 1 && /where id = v_audit_id/.test(stripped), "migration: tek güncelleme, yalnız bu çağrının denetim satırı");

// ---------------------------------------------------------------- veritabanı
let PGlite = null;
for (const spec of [process.env.PGLITE_MODULE, "@electric-sql/pglite"].filter(Boolean)) {
  try {
    const mod = await import(fs.existsSync(spec) ? pathToFileURL(spec).href : spec);
    PGlite = mod.PGlite;
    break;
  } catch {
    /* sonraki aday */
  }
}
check(Boolean(PGlite), "PGlite yüklendi (izole Postgres)");

function extractFunction(sql, signatureStart) {
  const start = sql.indexOf(signatureStart);
  if (start < 0) throw new Error(`tanım yok: ${signatureStart}`);
  const tagMatch = /as\s+(\$[a-z]*\$)/i.exec(sql.slice(start));
  const tag = tagMatch[1];
  const bodyStart = start + tagMatch.index + tagMatch[0].length;
  const end = sql.indexOf(`${tag};`, bodyStart);
  return sql.slice(start, end + tag.length + 1);
}

if (PGlite) {
  const db = new PGlite();
  const archiveSql = read("supabase/migrations/20260913140000_customer_revision_archives_safe_reset.sql");
  const auditSql = read("supabase/migrations/20260916090000_customer_revisions_v2.sql");

  // Üretimdeki şemanın bu akışa dokunan kısmı (kolonlar ve kısıtlar migration
  // geçmişinden). auth.* yalnızca oturum değişkenlerini okuyan sahte fonksiyonlar.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('test.role', true), ''), 'authenticated') $$;
    create table public.admin_profiles (user_id uuid primary key);
    create function public.is_admin() returns boolean language sql stable as $$ select exists (select 1 from public.admin_profiles where user_id = auth.uid()) $$;
    create table public.audit_logs (
      id bigserial primary key, actor_user_id uuid, action text not null, entity_type text, entity_id text,
      metadata jsonb not null default '{}'::jsonb, severity text not null default 'info', category text not null default 'system',
      correlation_id text, created_at timestamptz not null default now()
    );
    create table public.email_outbox (id bigserial primary key, recipient text);
    create table public.student_grade_options (id uuid primary key default gen_random_uuid(), label text not null, active boolean not null default true, sort_order int not null default 0);
    create table public.student_profiles (
      id uuid primary key,
      full_name text not null check (char_length(full_name) between 2 and 100),
      email text not null, phone text, date_of_birth date,
      preferred_language text not null default 'tr' check (preferred_language in ('tr','en')),
      school text, grade_level text, education_program text, exams_taken text[] not null default '{}',
      target_country text, target_countries text[] not null default '{}', target_university text, target_exam text, target_exams text[] not null default '{}',
      onboarding_completed boolean not null default false, active boolean not null default true, archived_at timestamptz,
      legacy_auth_user_id uuid, migration_source text not null default 'native_learner',
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table public.guardian_accounts (user_id uuid primary key, full_name text, active boolean not null default true, archived_at timestamptz, updated_at timestamptz not null default now());
    create table public.guardian_students (guardian_user_id uuid, student_id uuid, active boolean not null default true, updated_at timestamptz not null default now());
    insert into public.admin_profiles values ('00000000-0000-4000-8000-00000000a001');
    insert into public.student_grade_options (label, active) values ('10. sınıf', true), ('Eski sınıf', false);
  `);
  await db.exec(extractFunction(auditSql, "create or replace function public.write_audit_event("));
  await db.exec(extractFunction(archiveSql, "create or replace function public.admin_archive_member(p_user_id uuid)"));
  await db.exec(extractFunction(archiveSql, "create or replace function public.admin_restore_member(p_user_id uuid)"));
  await db.exec(migration);
  check(true, "migration SQL izole Postgres'te hatasız uygulandı");
  await db.exec(migration);
  check(true, "migration ikinci kez uygulanabiliyor (idempotent DDL)");

  const ADMIN = "00000000-0000-4000-8000-00000000a001";
  const OUTSIDER = "00000000-0000-4000-8000-00000000c001";
  const as = async (uid, sql, params = []) => {
    await db.query(`select set_config('test.uid', $1, false)`, [uid ?? ""]);
    return db.query(sql, params);
  };
  const count = async (sql) => Number((await db.query(sql)).rows[0].n);
  const snapshot = async () => ({
    students: await count("select count(*) n from public.student_profiles"),
    audits: await count("select count(*) n from public.audit_logs"),
    users: await count("select count(*) n from auth.users"),
    outbox: await count("select count(*) n from public.email_outbox"),
    guardians: await count("select count(*) n from public.guardian_accounts"),
  });
  const create = (uid, requestId, args = {}) => as(uid,
    `select public.admin_create_student($1::uuid, $2, $3, $4, $5, $6::text[], $7, $8, $9) r`,
    [requestId, args.name ?? "Deniz Yılmaz", args.school ?? null, args.grade ?? null, args.program ?? null, args.exams ?? [], args.guardian ?? null, args.phone ?? null, args.email ?? null]
  ).then((res) => res.rows[0].r);
  const rejects = async (fn, code) => {
    try {
      await fn();
      return false;
    } catch (error) {
      return String(error.message).includes(code);
    }
  };

  // Yetki
  const before0 = await snapshot();
  check(await rejects(() => create(null, "11111111-1111-4111-8111-111111111110"), "ADMIN_REQUIRED"), "oturumsuz çağrı reddedildi");
  check(await rejects(() => create(OUTSIDER, "11111111-1111-4111-8111-111111111111"), "ADMIN_REQUIRED"), "admin olmayan çağrı reddedildi");
  check(JSON.stringify(await snapshot()) === JSON.stringify(before0), "reddedilen çağrılar: 0 mutasyon");

  // Geçerli kayıt
  const REQ = "22222222-2222-4222-8222-222222222222";
  const valid = await create(ADMIN, REQ, { name: "  Deniz   Yılmaz ", school: "Robert Kolej", grade: "10. sınıf", program: "IB Diploma", exams: ["SAT", " SAT ", "IELTS", ""], guardian: "Ayşe Yılmaz", phone: "+90 532 000 00 00", email: "Veli@Example.invalid" });
  check(valid.success === true && valid.replayed === false && valid.student_id, "geçerli kayıt oluşturuldu");
  const row = (await db.query("select * from public.student_profiles where id = $1", [valid.student_id])).rows[0];
  check(row?.full_name === "Deniz Yılmaz", "ad soyad normalize edildi");
  check(row?.school === "Robert Kolej" && row?.grade_level === "10. sınıf" && row?.education_program === "IB Diploma", "okul / sınıf / eğitim programı kaydedildi");
  check(JSON.stringify(row?.exams_taken) === JSON.stringify(["SAT", "IELTS"]), "aldığı sınavlar kırpıldı ve tekrarsız kaydedildi");
  check(row?.contact_guardian_name === "Ayşe Yılmaz" && row?.phone === "+90 532 000 00 00" && row?.email === "veli@example.invalid", "veli ilişkisi (iletişim kişisi) / telefon / e-posta kaydedildi");
  check(row?.active === true && row?.archived_at === null && row?.migration_source === "admin_created_v1", "aktif öğrenci, kaynak admin_created_v1");
  const audits1 = (await db.query("select * from public.audit_logs where action = 'student.created'")).rows;
  check(audits1.length === 1 && audits1[0].entity_id === valid.student_id && audits1[0].actor_user_id === ADMIN && audits1[0].category === "student", "tek denetim kaydı: student.created");
  check(audits1[0]?.correlation_id === `admin_create_student:${REQ}`, "denetim kaydı istek anahtarına bağlı");
  check(!JSON.stringify(audits1[0]?.metadata).includes("example.invalid") && !JSON.stringify(audits1[0]?.metadata).includes("532"), "denetim kaydında e-posta / telefon yok");
  const after1 = await snapshot();
  check(after1.users === 0 && after1.guardians === 0, "auth kullanıcısı / veli hesabı açılmadı");
  check(after1.outbox === 0, "e-posta kuyruğuna kayıt yok (REAL EMAIL = 0)");

  // Çift tıklama / tekrar
  const replay = await create(ADMIN, REQ, { name: "Deniz Yılmaz", email: "veli@example.invalid" });
  check(replay.success === true && replay.replayed === true && replay.student_id === valid.student_id, "aynı istek anahtarı: ilk sonuç döndü");
  check(JSON.stringify(await snapshot()) === JSON.stringify(after1), "tekrar: 0 ek mutasyon");

  // Yinelenen öğrenci
  const dup = await create(ADMIN, "33333333-3333-4333-8333-333333333333", { name: "deniz yılmaz", email: "veli@example.invalid" });
  check(dup.success === false && dup.error_code === "DUPLICATE_STUDENT", "aynı ad + e-posta: DUPLICATE_STUDENT");
  check(JSON.stringify(await snapshot()) === JSON.stringify(after1), "yinelenen kayıt: 0 mutasyon");

  // Doğrulama hataları
  const invalidCases = [
    [{ name: "D" }, "INVALID_STUDENT_NAME"],
    [{ name: "x".repeat(101) }, "INVALID_STUDENT_NAME"],
    [{ name: "Ali Veli", guardian: "A" }, "INVALID_GUARDIAN_NAME"],
    [{ name: "Ali Veli", email: "not-an-email" }, "INVALID_EMAIL"],
    [{ name: "Ali Veli", phone: "123" }, "INVALID_PHONE"],
    [{ name: "Ali Veli", grade: "Eski sınıf" }, "GRADE_UNAVAILABLE"],
    [{ name: "Ali Veli", grade: "Uydurma" }, "GRADE_UNAVAILABLE"],
    [{ name: "Ali Veli", exams: Array.from({ length: 21 }, (_, i) => `S${i}`) }, "INVALID_EXAMS"],
  ];
  let n = 0;
  for (const [args, code] of invalidCases) {
    const res = await create(ADMIN, `44444444-4444-4444-8444-4444444444${String(n++).padStart(2, "0")}`, args);
    check(res.success === false && res.error_code === code, `geçersiz giriş → ${code}`);
  }
  check(JSON.stringify(await snapshot()) === JSON.stringify(after1), "doğrulama hataları: 0 mutasyon");

  // Atomiklik: denetim yazılamazsa öğrenci de oluşmaz.
  await db.exec(`alter table public.audit_logs add constraint tmp_block check (action <> 'student.created') not valid`);
  check(await rejects(() => create(ADMIN, "55555555-5555-4555-8555-555555555555", { name: "Atomik Test" }), "tmp_block"), "denetim hatası çağrıyı düşürdü");
  check(JSON.stringify(await snapshot()) === JSON.stringify(after1), "denetim hatası: öğrenci kaydı geri alındı (atomik)");
  await db.exec(`alter table public.audit_logs drop constraint tmp_block`);

  // Arşiv nedeni
  const sid = valid.student_id;
  const archive = (reason, note) => as(ADMIN, "select public.admin_archive_member_with_reason($1::uuid, $2, $3) r", [sid, reason, note]).then((r) => r.rows[0].r);
  check(await rejects(() => as(OUTSIDER, "select public.admin_archive_member_with_reason($1::uuid, 'Mezun oldu', null)", [sid]), "ADMIN_REQUIRED"), "admin olmayan arşiv reddedildi");
  const badReason = await archive("Uydurma neden", null);
  check(badReason.success === false && badReason.error_code === "INVALID_ARCHIVE_REASON", "referans dışı neden reddedildi");
  const longNote = await archive("Diğer", "x".repeat(121));
  check(longNote.success === false && longNote.error_code === "INVALID_ARCHIVE_NOTE", "120 karakterden uzun açıklama reddedildi");
  check((await db.query("select active from public.student_profiles where id = $1", [sid])).rows[0].active === true, "reddedilen arşiv: öğrenci aktif kaldı");
  const archived = await archive("Mezun oldu", "  2026   mezunu ");
  check(archived.success === true && archived.archive_reason === "Mezun oldu", "arşive taşındı (neden: Mezun oldu)");
  const arow = (await db.query("select active, archived_at from public.student_profiles where id = $1", [sid])).rows[0];
  check(arow.active === false && arow.archived_at !== null, "öğrenci silinmedi, arşiv işaretlendi");
  const arcAudits = (await db.query("select metadata from public.audit_logs where action = 'member_archived' and entity_id = $1", [sid])).rows;
  check(arcAudits.length === 1 && arcAudits[0].metadata.archive_reason === "Mezun oldu" && arcAudits[0].metadata.archive_note === "2026 mezunu", "neden ve açıklama denetim kaydı metadata'sında");
  check(arcAudits[0]?.metadata.student_rows === 1, "kanonik admin_archive_member metadata'sı korundu");
  check(await rejects(() => archive("Mezun oldu", null), "MEMBER_NOT_FOUND_OR_ALREADY_ARCHIVED"), "ikinci arşiv tıklaması reddedildi");
  check((await db.query("select count(*) n from public.audit_logs where action = 'member_archived'")).rows[0].n == 1, "çift arşiv: ek denetim kaydı yok");

  // Geri al (kanonik admin_restore_member)
  const restored = (await as(ADMIN, "select public.admin_restore_member($1::uuid) r", [sid])).rows[0].r;
  check(restored.success === true, "Geri al: admin_restore_member başarılı");
  const rrow = (await db.query("select active, archived_at from public.student_profiles where id = $1", [sid])).rows[0];
  check(rrow.active === true && rrow.archived_at === null, "öğrenci aktif listeye döndü");
  check(await rejects(() => as(ADMIN, "select public.admin_restore_member($1::uuid) r", [sid]), "MEMBER_NOT_FOUND"), "ikinci Geri al tıklaması reddedildi (süresi geçmiş / tekrar)");
  const trail = (await db.query("select action from public.audit_logs where entity_id = $1 order by id", [sid])).rows.map((r) => r.action);
  check(JSON.stringify(trail) === JSON.stringify(["student.created", "member_archived", "member_restored"]), `denetim izi korundu (${trail.join(" → ")})`);
  const finalSnap = await snapshot();
  check(finalSnap.students === 1 && finalSnap.users === 0 && finalSnap.outbox === 0, "son durum: 1 izole öğrenci, 0 auth kullanıcısı, 0 e-posta");
  await db.close();
}

console.log(failures === 0 ? "\nADMIN NEW STUDENT + ARCHIVE: PASS" : `\nADMIN NEW STUDENT + ARCHIVE: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
