import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const portal = read("src/components/student/StudentPortal.tsx");
const studentData = read("src/lib/student/data.ts");
const learning = read("src/components/admin/StudentLearningManager.tsx");
const detail = read("src/components/admin/StudentDetailSheet.tsx");
const dashboard = read("src/app/admin/page.tsx");
const dashboardData = read("src/lib/admin/dashboard.ts");
const packageMail = read("supabase/migrations/20260906170000_human_package_names_in_notifications.sql");

assert.match(portal, /hasActivePackage \? entitlement\.totalRemainingLessons : 0/);
assert.match(portal, /packageDisplayName\(purchase, locale\)/);
assert.match(studentData, /"paid_at"/);
assert.match(studentData, /package_owner_student_id\.eq\.\$\{userId\}/);
assert.match(portal, /p\.paid_at \|\| p\.created_at/);
assert.match(portal, /Ödeme tarihi/);

assert.match(learning, /Ders Kaydı Ekle/);
assert.match(learning, /İleri Tarihli Ders Planla/);
assert.doesNotMatch(learning, />\s*Ders Hakkı Azalt\s*</);
assert.doesNotMatch(detail, />\s*Ders Hakkı Azalt\s*</);
assert.match(learning, /pastForm\.sendEmail/);
assert.match(learning, /form\.sendNotification/);
assert.match(learning, /sendReportEmail: pastForm\.sendEmail/);

// Referans dashboard: KPI "Bu ay tahsilat" + 6 aylık "Gelir trendi".
assert.match(dashboard, /Bu ay tahsilat/);
assert.match(dashboard, /Gelir trendi/);
assert.match(dashboard, /href="\/admin\/mali-akis"/);
assert.doesNotMatch(dashboard, /Resend e-posta/);
assert.match(dashboardData, /remainingLessonRights/);
assert.match(dashboardData, /revenueTrend/);

assert.match(packageMail, /nullif\(btrim\(v_purchase\.custom_package_name\), ''\), v_package_name/);
assert.match(packageMail, /Derslik Paket/);

console.log("PASS: müşteri toplam hak, ödeme tarihi, ders akışı, bildirim seçenekleri, paket adı ve dashboard değişmezleri doğrulandı.");
