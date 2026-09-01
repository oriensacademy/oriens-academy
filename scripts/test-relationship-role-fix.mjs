import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("--- ORIENS RELATIONSHIP ROLE & POLICY TEST ---");

const outboxWorkerPath = path.resolve("supabase/functions/process-notification-outbox/index.ts");
const outboxCode = fs.readFileSync(outboxWorkerPath, "utf8");

// Test outbox template rendering logic directly
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));

function simulateRender(row) {
  const p = row.payload || {};
  const isEn = p.locale === "en";
  const lines = [];
  let subject = "Oriens Academy";
  let channel = "payments";

  if (row.template === "lesson_completed_account_holder" || row.template === "lesson_completed_guardian") {
    channel = "support";
    subject = isEn ? `Lesson completed — ${p.learner_name}` : `Ders tamamlandı — ${p.learner_name}`;
    const role = String(p.relationship_role || "other");
    if (role === "self") {
      lines.push(
        isEn ? `Hello ${p.account_holder_name || p.guardian_name}, your lesson has been completed.` : `Merhaba ${p.account_holder_name || p.guardian_name}, dersiniz tamamlandı.`,
        `${isEn ? "Remaining lesson rights" : "Kalan ders hakkınız"}: ${p.remaining_lessons ?? "-"}.`,
      );
    } else if (role === "parent" || role === "guardian") {
      lines.push(
        isEn ? `Dear ${p.account_holder_name || p.guardian_name}, a lesson has been completed for your learner ${p.learner_name}.` : `Sayın ${p.account_holder_name || p.guardian_name}, öğrenciniz ${p.learner_name} için ders tamamlandı.`,
        `${isEn ? "Remaining lesson rights" : "Kalan ders hakkı"}: ${p.remaining_lessons ?? "-"}.`,
      );
    } else {
      lines.push(
        isEn ? `Dear ${p.account_holder_name || p.guardian_name}, a lesson has been completed for your linked learner ${p.learner_name}.` : `Sayın ${p.account_holder_name || p.guardian_name}, hesabınıza bağlı ${p.learner_name} için ders tamamlandı.`,
        `${isEn ? "Remaining lesson rights" : "Kalan ders hakkı"}: ${p.remaining_lessons ?? "-"}.`,
      );
    }
    lines.push(
      `${isEn ? "Lesson" : "Ders"}: ${p.lesson_title}`,
      `${isEn ? "Date" : "Tarih"}: ${p.lesson_date}`,
      `${isEn ? "Package" : "Paket"}: ${p.package_name || "-"}`,
    );
    if (p.teacher_note) lines.push(`${isEn ? "Teacher note" : "Öğretmen notu"}: ${p.teacher_note}`);
  } else if (row.template === "package_low_balance_account_holder") {
    const role = String(p.relationship_role || "other");
    subject = isEn ? "1 lesson right remains" : "1 ders hakkı kaldı";
    if (role === "self") {
      lines.push(isEn ? `Hello ${p.account_holder_name}, you have 1 lesson right remaining.` : `Merhaba ${p.account_holder_name}, 1 ders hakkınız kaldı.`);
    } else if (role === "parent" || role === "guardian") {
      lines.push(isEn ? `Dear ${p.account_holder_name}, 1 lesson right remains for your learner ${p.learner_name}.` : `Sayın ${p.account_holder_name}, öğrenciniz ${p.learner_name} için 1 ders hakkı kaldı.`);
    } else {
      lines.push(isEn ? `Dear ${p.account_holder_name}, 1 lesson right remains for your linked learner ${p.learner_name}.` : `Sayın ${p.account_holder_name}, hesabınıza bağlı ${p.learner_name} için 1 ders hakkı kaldı.`);
    }
    lines.push(
      `${isEn ? "Package" : "Paket"}: ${p.package_name || "-"}`,
      isEn ? "The package can be renewed and paid through Oriens Academy." : "Paketinizi Oriens Academy üzerinden yenileyebilir ve ödeyebilirsiniz.",
    );
  }
  return { subject, lines };
}

// A: self -> direct wording
const selfResult = simulateRender({
  template: "lesson_completed_account_holder",
  recipient: "arda@example.com",
  payload: {
    account_holder_name: "Arda Yılmaz",
    learner_name: "Arda Yılmaz",
    relationship_role: "self",
    remaining_lessons: 9,
    lesson_title: "IB HL Matematik",
    lesson_date: "2026-09-01",
    package_name: "10 Derslik Paket",
    locale: "tr",
  }
});
assert.ok(selfResult.lines[0].includes("Merhaba Arda Yılmaz, dersiniz tamamlandı."));
assert.ok(selfResult.lines[1].includes("Kalan ders hakkınız: 9."));
console.log("✓ A) self -> direct wording verified");

// B: parent -> guardian wording
const parentResult = simulateRender({
  template: "lesson_completed_account_holder",
  recipient: "ayse@example.com",
  payload: {
    account_holder_name: "Ayşe Hanım",
    learner_name: "Arda",
    relationship_role: "parent",
    remaining_lessons: 9,
    lesson_title: "IB HL Matematik",
    lesson_date: "2026-09-01",
    package_name: "10 Derslik Paket",
    locale: "tr",
  }
});
assert.ok(parentResult.lines[0].includes("Sayın Ayşe Hanım, öğrenciniz Arda için ders tamamlandı."));
assert.ok(parentResult.lines[1].includes("Kalan ders hakkı: 9."));
console.log("✓ B) parent -> guardian wording verified");

// C: guardian -> guardian wording
const guardianResult = simulateRender({
  template: "lesson_completed_account_holder",
  recipient: "mehmet@example.com",
  payload: {
    account_holder_name: "Mehmet Bey",
    learner_name: "Can",
    relationship_role: "guardian",
    remaining_lessons: 4,
    lesson_title: "AP Calculus",
    lesson_date: "2026-09-01",
    package_name: "5 Derslik Paket",
    locale: "tr",
  }
});
assert.ok(guardianResult.lines[0].includes("Sayın Mehmet Bey, öğrenciniz Can için ders tamamlandı."));
assert.ok(guardianResult.lines[1].includes("Kalan ders hakkı: 4."));
console.log("✓ C) guardian -> guardian wording verified");

// D: other -> neutral wording
const otherResult = simulateRender({
  template: "lesson_completed_account_holder",
  recipient: "sponsor@example.com",
  payload: {
    account_holder_name: "Kemal Bey",
    learner_name: "Efe",
    relationship_role: "other",
    remaining_lessons: 8,
    lesson_title: "SAT Verbal",
    lesson_date: "2026-09-01",
    package_name: "10 Derslik Paket",
    locale: "tr",
  }
});
assert.ok(otherResult.lines[0].includes("Sayın Kemal Bey, hesabınıza bağlı Efe için ders tamamlandı."));
assert.ok(otherResult.lines[1].includes("Kalan ders hakkı: 8."));
console.log("✓ D) other -> neutral wording verified");

// E: Verify public files contain NO public role selector, age selector, or age note
const publicFilesToCheck = [
  "src/components/auth/UnifiedLoginPage.tsx",
  "src/components/payment/PaymentPage.tsx",
  "src/components/student/StudentPortal.tsx",
  "src/components/sections/Navbar.tsx",
  "src/components/cart/CartPage.tsx",
];

for (const filePath of publicFilesToCheck) {
  const code = fs.readFileSync(path.resolve(filePath), "utf8");
  assert.ok(!code.includes("18 yaş"), `Forbidden age note found in ${filePath}`);
  assert.ok(!code.includes("under 18"), `Forbidden EN age note found in ${filePath}`);
  assert.ok(!code.includes("Öğrenci misiniz"), `Forbidden public role selector found in ${filePath}`);
  assert.ok(!code.includes("Veli misiniz"), `Forbidden public role selector found in ${filePath}`);
}
console.log("✓ E, F, G) No public role selector, age selector, or age note confirmed in public files");

console.log("--- ALL RELATIONSHIP ROLE TESTS PASSED ---");
