import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const pass = (number, test) => {
  test();
  console.log(`REV-${String(number).padStart(3, "0")} PASS`);
};

const examsTr = read("src/content/tr/exams.ts");
const examsEn = read("src/content/en/exams.ts");
const examHub = read("src/components/exams/ExamHub.tsx");
const homeTr = read("src/content/tr/home.ts");
const homeEn = read("src/content/en/home.ts");
const destination = read("src/components/discovery/DestinationSelector.tsx");
const destinationSection = read("src/components/discovery/StudyDestinationSection.tsx");
const universityTr = read("src/content/tr/university-support.ts");
const universityEn = read("src/content/en/university-support.ts");
const aboutTr = read("src/content/tr/about.ts");
const aboutEn = read("src/content/en/about.ts");
const studentsPage = read("src/app/admin/ogrenciler/page.tsx");
const contactsPage = read("src/app/admin/iletisim/page.tsx");
const contactSheet = read("src/components/admin/ContactDetailSheet.tsx");
const auditPage = read("src/app/admin/denetim/page.tsx");
const notificationsPage = read("src/app/admin/bildirimler/page.tsx");
const packageDisplay = read("src/lib/packages/display.ts");
const learningManager = read("src/components/admin/StudentLearningManager.tsx");
const mailWorker = read("supabase/functions/process-notification-outbox/index.ts");
const mailService = read("supabase/functions/_shared/email/service.ts");
const adminKeyHelper = read("supabase/functions/_shared/supabase-admin.ts");
const migration = read("supabase/migrations/20260913140000_customer_revision_archives_safe_reset.sql");
const archivePolicy = read("docs/ADMIN_ARCHIVE_POLICY.md");
const catalog = read("scripts/generate-mail-v5.mjs");

pass(1, () => {
  assert.match(examsTr, /Oriens Academy Desteği/);
  assert.match(examsTr, /Kullanım Amacı/);
  assert.match(examsEn, /Oriens Academy Support/);
  assert.match(examsEn, /Purpose/);
  assert.doesNotMatch(examHub, /text-\[10px\][^"\n]*uppercase/);
});

pass(2, () => {
  assert.match(homeTr, /Calculus, Lineer Cebir, Diferansiyel Denklemler, İstatistik, Fizik I-II ve Biyoloji takviyesi\./);
  assert.match(homeEn, /Calculus, Linear Algebra, Differential Equations, Statistics, Physics I-II, and Biology/);
});

pass(3, () => {
  assert.match(destination, /w-full/);
  assert.match(destination, /flex-wrap/);
  assert.match(destination, /xl:justify-between/);
  assert.match(destinationSection, /w-full min-w-0/);
  assert.doesNotMatch(destinationSection, /className=\{`overflow-hidden border-y/);
});

pass(4, () => {
  assert.match(universityTr, /Oriens Academy, üniversite öğrencilerine/);
  assert.match(universityEn, /Oriens Academy guides university students/);
});

pass(5, () => {
  assert.doesNotMatch(aboutTr, /matematik ve fizik odaklı/i);
  assert.doesNotMatch(aboutEn, /mathematics and physics-focused/i);
});

pass(6, () => {
  assert.match(migration, /guardian_accounts[\s\S]*archived_at timestamptz/);
  assert.match(migration, /student_profiles[\s\S]*archived_at timestamptz/);
  assert.match(migration, /admin_archive_member\(p_user_id uuid\)/);
  assert.match(studentsPage, /Trash2/);
});

pass(7, () => {
  assert.match(studentsPage, /Bu üye kalıcı olarak silinmeyecek, arşive taşınacaktır\. Emin misiniz\?/);
  assert.match(studentsPage, /Arşive Taşı/);
});

pass(8, () => {
  assert.match(migration, /admin_restore_member\(p_user_id uuid\)/);
  assert.match(studentsPage, /Aktif/);
  assert.match(studentsPage, /Arşiv/);
  assert.match(studentsPage, /Geri Yükle/);
});

pass(9, () => {
  assert.match(archivePolicy, /Audit logs and transactional notification deliveries are immutable evidence/);
  assert.match(migration, /revoke execute on function public\.admin_clear_audit_logs\(\) from authenticated/);
  assert.match(migration, /revoke execute on function public\.admin_clear_contact_history\(\) from authenticated/);
  assert.doesNotMatch(auditPage, /admin_delete_audit_log|deleteAdminAuditLog/);
  assert.doesNotMatch(notificationsPage, /admin_delete_notification_delivery|deleteAdminNotification/);
});

pass(10, () => {
  assert.match(migration, /admin_archive_contact_request\(p_contact_id uuid\)/);
  assert.match(migration, /where id = p_contact_id and not is_archived/);
  assert.doesNotMatch(migration, /mazhar194@yahoo\.com/i);
});

pass(11, () => {
  assert.match(migration, /contact_requests[\s\S]*is_archived boolean not null default false/);
  assert.match(migration, /admin_restore_contact_request\(p_contact_id uuid\)/);
  assert.match(contactsPage, /Aktif/);
  assert.match(contactsPage, /Arşiv/);
  assert.match(contactSheet, /Arşive Taşı/);
  assert.match(contactSheet, /Geri Yükle/);
});

pass(12, () => {
  for (const value of ["single", "package5", "package10", "package20", "package30", "custom"]) {
    assert.match(packageDisplay, new RegExp(`${value}:`));
  }
  for (const label of ["1 Ders", "5 Derslik Paket", "10 Derslik Paket", "20 Derslik Paket", "30 Derslik Paket", "Özel Paket"]) {
    assert.match(packageDisplay, new RegExp(label));
  }
  assert.match(learningManager, /packageDisplayName/);
});

pass(13, () => {
  assert.match(mailWorker, /packageDisplayName\(p, isEn\)/);
  assert.match(migration, /pp\.name_tr package_name_tr,pp\.name_en package_name_en/);
  assert.match(mailWorker, /30-Lesson Package/);
});

pass(14, () => {
  assert.match(mailWorker, /subject = isEn \? "Current Lesson Rights \| Oriens Academy" : "Güncel Ders Haklarınız \| Oriens Academy"/);
  assert.match(mailWorker, /title = isEn \? "Current Lesson Rights" : "Güncel Ders Haklarınız"/);
  assert.match(mailWorker, /title \|\| subject/);
});

pass(15, () => {
  assert.match(mailWorker, /<table role="presentation"/);
  assert.match(mailWorker, /width:18px/);
  assert.match(mailWorker, />:<\/td>/);
});

pass(16, () => {
  assert.match(mailWorker, /font-weight:700/);
  assert.match(mailWorker, /font-weight:400/);
});

pass(17, () => {
  assert.match(mailWorker, /formatLessonDate\(p\.current_date, isEn \? "en" : "tr", "Europe\/Istanbul"\)/);
  assert.match(mailWorker, /`\$\{part\("day"\)\} \$\{part\("month"\)\} \$\{part\("year"\)\} \$\{part\("weekday"\)\}`/);
  assert.doesNotMatch(mailWorker, /packages\.map[\s\S]{0,300}kullanılan/);
});

pass(18, () => {
  assert.match(mailService, /fromName: "Oriens Academy"/);
  assert.match(mailService, /info@oriens-academy\.com/);
  assert.match(mailService, /payments@oriens-academy\.com/);
  assert.doesNotMatch(mailService, /fromName: "Oriens Academy (Öğrenci Destek|Ödemeler)"/);
  assert.match(adminKeyHelper, /SUPABASE_SECRET_KEYS/);
  assert.doesNotMatch(adminKeyHelper, /SUPABASE_SERVICE_ROLE_KEY/);
});

pass(19, () => {
  assert.match(migration, /admin_redact_payment_admin_delivery_email/);
  assert.match(migration, /template = 'payment_success_admin'/);
  assert.match(migration, /jsonb_set\(payload, '\{payer_email\}'/);
  assert.doesNotMatch(migration, /update public\.payment_transactions[\s\S]{0,300}payer_email/);
});

pass(20, () => {
  assert.match(migration, /admin_reset_test_account_operational_state\(p_user_id uuid\)/);
  assert.match(migration, /v_purchase_count <> 5/);
  assert.match(migration, /v_lesson_count <> 2/);
  assert.match(migration, /v_adjustment_count <> 5/);
  assert.match(migration, /v_payment_count <> 2/);
  assert.match(migration, /v_notification_count <> 9/);
  assert.match(migration, /update public\.student_lessons set is_archived = true/);
  assert.match(migration, /update public\.payment_transactions set is_archived = true/);
  assert.doesNotMatch(migration, /delete from public\.(student_lessons|student_package_purchases|payment_transactions|audit_logs)/);
});

const catalogRows = (catalog.match(/row\("MAIL-/g) || []).length;
assert.equal(catalogRows - 1, 24, "mail catalog must retain 24 active rows");
assert.match(catalog, /const INACTIVE = "DECOMMISSIONED \/ INACTIVE"/);
assert.match(catalog, /row\("MAIL-040",[^\n]*INACTIVE/);
assert.match(catalog, /const FROM_SUPPORT = "Oriens Academy <info@oriens-academy\.com>"/);
assert.match(catalog, /const FROM_PAYMENTS = "Oriens Academy <payments@oriens-academy\.com>"/);
console.log("ALL 20 REVISIONS PASS");
