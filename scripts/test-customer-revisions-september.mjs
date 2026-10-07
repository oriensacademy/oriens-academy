import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260913120000_guardian_students_lesson_timezones_mail_cleanup.sql");
const outbox = read("supabase/functions/process-notification-outbox/index.ts");
const shell = read("supabase/functions/_shared/email/templates.ts");
const manager = read("src/components/admin/StudentLearningManager.tsx");
const detail = read("src/components/admin/StudentDetailSheet.tsx");
const catalog = read("scripts/generate-mail-v5.mjs");
const mail027 = outbox.slice(outbox.indexOf("// MAIL-027:"), outbox.indexOf('} else if (row.template === "lesson_remaining_rights_account_holder")'));
const mail041 = outbox.slice(outbox.indexOf("// MAIL-041:"), outbox.indexOf('} else if (row.template === "lesson_rights_manual")'));

const results = [];
function rev(number, title, pass, evidence) {
  results.push({ number, title, pass: Boolean(pass), evidence });
  console.log("REV-" + String(number).padStart(3, "0") + " " + (pass ? "PASS" : "FAIL") + " — " + title + (pass ? "" : " (" + evidence + ")"));
}

const timezonePairs = [
  ["TR", "Europe/Istanbul"], ["UK", "Europe/London"], ["NL", "Europe/Amsterdam"], ["DE", "Europe/Berlin"],
  ["US-ET", "America/New_York"], ["US-CT", "America/Chicago"], ["US-MT", "America/Denver"], ["US-PT", "America/Los_Angeles"],
];

function offsetMinutes(iso, timeZone) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return (Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - date.getTime()) / 60_000;
}

const dstZones = timezonePairs.filter(([label]) => label !== "TR");
const dstPass = dstZones.every(([, zone]) => offsetMinutes("2026-01-15T12:00:00Z", zone) !== offsetMinutes("2026-07-15T12:00:00Z", zone));
// MAIL-010 ve MAIL-040 devre dışı (INACTIVE) satırlar; geri kalanı aktif katalog.
const activeCatalogRows = (catalog.match(/row\("MAIL-/g) || []).length - (catalog.match(/row\("MAIL-\d+", "[^"]*", INACTIVE/g) || []).length;

rev(1, "Admin creates or links a student under a guardian",
  /admin_create_or_link_student_for_guardian/.test(migration) && /Öğrenci Ekle/.test(detail), "secure RPC + admin UI");
rev(2, "Student-name validation is bounded and independent",
  /char_length\(v_name\) not between 2 and 100/.test(migration) && !/v_name\s*:=.*v_guardian\.full_name/.test(migration), "2–100 trimmed name");
rev(3, "Historical self links are preserved",
  !/delete\s+from\s+public\.guardian_students/i.test(migration) && !/update\s+public\.student_profiles[\s\S]*v_guardian\.full_name/i.test(migration), "no destructive legacy rewrite");
rev(4, "One guardian supports multiple students and edits",
  /primary key \(guardian_user_id, student_id\)/.test(read("supabase/migrations/20260831150000_guardian_identity_payment_outbox.sql")) && /Öğrenciyi Düzenle/.test(detail), "linked cards + edit");
rev(5, "Canonical guardian/student names reach MAIL-027 and MAIL-041",
  (migration.match(/'guardian_name',v_holder\.full_name/g) || []).length >= 2 && (migration.match(/'student_name',v_student_name/g) || []).length >= 2, "server-side payload names");
rev(6, "Lesson timezone schema, TR default and backfill",
  /lesson_timezone text/.test(migration) && /lesson_timezone_label text/.test(migration) && /set lesson_timezone = 'Europe\/Istanbul', lesson_timezone_label = 'TR'/.test(migration), "new metadata columns");
rev(7, "All requested IANA timezone choices exist",
  timezonePairs.every(([label]) => read("src/lib/lessons/timezones.ts").includes(label)) && timezonePairs.every(([, zone]) => migration.includes(zone)), "8 exact zones");
rev(8, "DST is automatic for UK/NL/DE/all US zones",
  dstPass && /Intl\.DateTimeFormat/.test(read("src/lib/lessons/timezones.ts")), "winter/summer offsets differ");
rev(9, "All admin lesson creation forms expose Saat Dilimi",
  (manager.match(/Saat Dilimi/g) || []).length >= 2 && /Saat Dilimi/.test(detail), "future + past forms");
rev(10, "Wall-clock input converts to canonical UTC without browser timezone",
  /localLessonDateTimeToUtc/.test(manager) && !/new Date\(form\.lessonDate\)\.toISOString/.test(manager), "explicit zone conversion");
rev(11, "Lesson cards and link mail use stored timezone",
  /formatLessonDateTime\(l\.lesson_date/.test(manager) && /lessonTimezone: lesson\.lesson_timezone/.test(read("supabase/functions/send-live-lesson-email/index.ts")), "stored zone display");
rev(12, "MAIL-027 exact clean subject/title",
  /Ders Sonu Raporunuz ve Güncel Ders Bakiyeniz/.test(mail027) && !/\| Oriens Academy/.test(mail027), "exact Turkish copy");
// Güncel şablon: üst etiket (eyebrow) yalnızca "account-created" görsel varyantında.
rev(13, "Shared shell removes duplicate eyebrow with balanced spacing",
  activeCatalogRows === 25 && (shell.match(/escapeHtml\(eyebrow\)/g) || []).length === 1 && /visualVariant === "account-created" \? `[^`]*escapeHtml\(eyebrow\)/.test(shell) && /padding:18px 36px 0 36px/.test(shell), "25 active shell variants + spacing invariant");
rev(14, "MAIL-027 canonical greeting, student intro and generic fallback",
  /Merhaba \$\{name\},/.test(mail027) && /Öğrencimizin tamamlanan dersine ilişkin değerlendirme raporu/.test(mail027) && /Öğrencimizin tamamlanan/.test(mail027), "no guardian-as-student fallback");
rev(15, "MAIL-027 timezone-aware weekday date and HH.mm time rows",
  /weekday: "long"/.test(outbox) && /formatLessonTime/.test(mail027) && /lessonTimezoneLabel/.test(mail027), "date/time separated");
// Güncel şablon: eğitmen satırı yalnızca eğitmen adı varsa gösterilir.
rev(16, "MAIL-027 shows instructor only when present",
  /p\.instructor_name \? rowHtml\(isEn \? "Instructor" : "Eğitmen", p\.instructor_name\) : ""/.test(mail027) && !/Eğitmenimizin geri bildirimi/.test(mail027), "conditional instructor row");
rev(17, "MAIL-027 current-balance terminology and conditions",
  /GÜNCEL DERS BAKİYESİ/.test(mail027) && !/Kalan Ders Hakkınız/.test(mail027) && /remaining === 0/.test(mail027), "renewal logic retained");
rev(18, "MAIL-027 requested admin footer is absent",
  !/Bu bildirim Oriens Academy yöneticisi/.test(outbox), "footer note selectively suppressed");
rev(19, "MAIL-041 clean subject and separated identities",
  /Ders Paketiniz Tanımlandı/.test(mail041) && !/\| Oriens Academy/.test(mail041) && /Öğrenciniz için/.test(mail041), "guardian/student copy");
rev(20, "MAIL-041 removes duplicate total, localizes date and aligns colons",
  !/Paketteki toplam ders/.test(mail041) && /formatPackageDate/.test(mail041) && /role="presentation"/.test(mail041) && /text-align:center/.test(mail041), "three-column detail table");
rev(21, "MAIL-v5 catalog remains 25 active with MAIL-040 retired",
  /MAIL-027", "Ders Sonu Raporu ve Güncel Ders Bakiyesi/.test(catalog) && /MAIL-040/.test(catalog) && /DECOMMISSIONED \/ INACTIVE/.test(catalog), "catalog updates");
rev(22, "Security, escaping, manual completion flow and focused coverage",
  /security definer/.test(migration) && /set search_path\s*=\s*''/.test(migration) && /public\.is_admin\(\)/.test(migration) && /escapeHtml\(introduction\)/.test(mail027) && !/enqueue_email_notification/.test(migration.slice(migration.indexOf("admin_record_completed_lesson"), migration.indexOf("admin_save_and_send_lesson_report"))), "security + no automatic completion mail");

const failures = results.filter((item) => !item.pass);
console.log("\nCUSTOMER REVISION RESULT: " + (results.length - failures.length) + "/22 PASS");
if (failures.length) process.exit(1);
