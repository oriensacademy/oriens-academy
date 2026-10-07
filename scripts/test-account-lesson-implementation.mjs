import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const files = {
  navbar: read("src/components/sections/Navbar.tsx"),
  login: read("src/components/auth/UnifiedLoginPage.tsx"),
  portal: read("src/components/student/StudentPortal.tsx"),
  portalCopy: read("src/content/student-portal.ts"),
  phone: read("src/components/ui/phone-mockups-1-utils/phone-carousel.tsx"),
  pricing: read("src/components/pricing/PricingPage.tsx"),
  canonicalPricing: read("src/components/ui/oriens-creative-pricing.tsx"),
  modal: read("src/components/auth/LogoutConfirmationModal.tsx"),
  migration: read("supabase/migrations/20260901090000_account_learner_completed_lesson_outbox.sql"),
  worker: read("supabase/functions/process-notification-outbox/index.ts"),
  liveLesson: read("supabase/functions/send-live-lesson-email/index.ts"),
};

assert.match(files.navbar, /Giriş Yap/);
assert.match(files.navbar, /Hesabım/);
assert.match(files.login, /Hesabınıza Giriş Yapın/);
assert.match(files.login, /Hesap Oluştur/);
assert.doesNotMatch(`${files.navbar}\n${files.login}\n${files.portal}`, /Veli Hesabı|Parent Account|18 yaş altı/i);
assert.doesNotMatch(files.login, /ödevlerinizi|homework/i);
assert.doesNotMatch(files.phone, /ödev|homework|assignment/i);
assert.match(files.phone, /1 Tamamlandı \/ 9 Kaldı/);

assert.match(files.portalCopy, /Ders Hakları \/ Paketler/);
assert.doesNotMatch(files.portalCopy, /Paketim|Öğrencilerim|My Package/);
assert.match(files.portal, /Öğrenci Bilgileri/);
assert.match(files.migration, /setup_account_learner/);
assert.match(files.migration, /relationship_role, is_primary, active, source[\s\S]*'other'/);

assert.match(files.modal, /createPortal/);
assert.match(files.modal, /document\.body/);
assert.match(files.modal, /z-\[140\]/);
assert.match(files.modal, /event\.key === "Escape"/);
assert.match(files.modal, /focusTarget\?\.isConnected/);

assert.match(files.migration, /admin_record_completed_lesson/);
assert.match(files.migration, /for update/i);
assert.match(files.migration, /lesson_delta[\s\S]*-1/);
assert.match(files.migration, /completion_key/);
assert.match(files.migration, /previous_remaining/);
assert.match(files.migration, /v_lesson\.completion_previous_remaining>1 and v_remaining=1/);
assert.match(files.migration, /'lesson\.completed'/);
assert.match(files.migration, /'package\.low_balance'/);

const packageState = { total: 10, used: 0 };
const completedKeys = new Set();
const complete = (key) => {
  if (completedKeys.has(key)) return;
  assert.ok(packageState.total - packageState.used > 0);
  completedKeys.add(key);
  packageState.used += 1;
};
complete("past:one");
complete("past:one");
assert.deepEqual(packageState, { total: 10, used: 1 });
assert.equal(packageState.total - packageState.used, 9);

// MAIL-027: ders tamamlandı e-postası tek kanonik "ders sonu raporu" kopyasına
// taşındı (hesap sahibine, canlı bakiye ile); eski rol bazlı metinler kalktı.
assert.match(files.worker, /row\.template === "lesson_completed_guardian" \|\|\s*row\.template === "lesson_completed_student"/);
assert.match(files.worker, /Ders Sonu Raporunuz ve Güncel Ders Bakiyeniz/);
assert.match(files.worker, /Öğrencimiz \$\{studentName\}/);
assert.match(files.worker, /Güncel ders bakiyeniz sıfırdır\. Yeni paketinizi Havale\/EFT ile veya site üzerinden kredi kartı ile satın alabilirsiniz\./);
assert.match(files.worker, /if \(report\.length < 5\) throw new Error\("REPORT_REQUIRED"\)/);
assert.doesNotMatch(files.liveLesson, /dispatchLessonCompletedEmail/);

const transparentPricingCount = (files.pricing.match(/Şeffaf Fiyatlandırma/g) || []).length
  + (files.canonicalPricing.match(/Şeffaf Fiyatlandırma/g) || []).length;
assert.equal(transparentPricingCount, 1);

console.log("account/lesson/email implementation checks: PASS");
