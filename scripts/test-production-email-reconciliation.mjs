import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  renderEmailShell,
  renderPurchaseEmailVerificationOtpEmail,
  turkishGenitiveSuffix,
} from "../supabase/functions/_shared/email/templates.ts";
import { renderAccountCreatedEmail } from "../supabase/functions/_shared/email/account-created.ts";
import { renderPaymentSuccessEmail } from "../supabase/functions/_shared/email/payment-success.ts";
import { renderLessonReportEmail } from "../supabase/functions/_shared/email/lesson-report.ts";

const verification = renderPurchaseEmailVerificationOtpEmail({
  otp: "482731",
  locale: "tr",
  expiresInMinutes: 10,
});
assert.match(verification.html, /#F4F3EE/i);
assert.match(verification.html, /#E6E3D8/i);
assert.match(verification.html, /linear-gradient\(90deg,#9C7C34 0%,#D6B46A 50%,#9C7C34 100%\)/i);
assert.match(verification.html, /font-size:40px/);
assert.match(verification.html, /letter-spacing:12px/);
assert.match(verification.html, />\s*482731\s*</);
assert.doesNotMatch(verification.html, /magic.?link|tek tık|one.?click/i);

const account = renderAccountCreatedEmail({ account_holder_name: "Test Veli" }, "tr");
const accountHtml = renderEmailShell({
  locale: "tr",
  eyebrow: "Oriens Academy",
  title: account.title,
  bodyHtml: account.bodyHtml,
  visualVariant: account.visualVariant,
});
assert.match(accountHtml, /#F3F1EC/i);
assert.match(accountHtml, /#E6E2D8/i);
assert.match(accountHtml, /width="170"/);
assert.match(accountHtml, /#FAF8F3/i);
assert.match(accountHtml, /Test Veli/);
assert.doesNotMatch(accountHtml, /Engin Peker/);

const payment = renderPaymentSuccessEmail("guardian", {
  reference: "TEST-REF-1042",
  payer_name: "Test Veli",
  package_name: "Test Ders Paketi",
  amount: 30000,
  currency: "TRY",
}, "tr");
const paymentHtml = renderEmailShell({
  locale: "tr",
  eyebrow: "Oriens Academy",
  title: payment.title,
  bodyHtml: payment.bodyHtml,
  visualVariant: "payment-confirmation",
});
assert.match(paymentHtml, /#F3F5F1/i);
assert.match(paymentHtml, /#E4E7E2/i);
assert.match(paymentHtml, /#E8F3EC/i);
assert.match(paymentHtml, /#F7F8F6/i);
assert.match(paymentHtml, /TEST-REF-1042/);
assert.doesNotMatch(payment.bodyHtml, /Ödeme Tarihi|Payment Date/);

const lessonPayload = {
  account_holder_name: "Test Veli",
  student_name: "Efe Alaeddinoğlu",
  lesson_title: "Test Dersi",
  subject: "Test Konusu",
  lesson_date: "2026-10-02T10:30:00.000Z",
  lesson_timezone: "Europe/Istanbul",
  lesson_timezone_label: "TSİ",
  duration_minutes: 60,
  completion_report: "Test ders değerlendirmesi ve gelişim notları.",
  total_remaining_lessons: 4,
  locale: "tr",
};
const initial = renderLessonReportEmail("lesson_completed_account_holder", lessonPayload);
const resend = renderLessonReportEmail("lesson_completed_account_holder", {
  ...lessonPayload,
  completion_report: "Güncellenmiş test ders değerlendirmesi ve gelişim notları.",
});
assert.equal(initial.title, "Ders Sonu Raporunuz ve Güncel Ders Bakiyeniz");
assert.match(initial.bodyHtml, /Öğrencimiz <strong[^>]*>Efe Alaeddinoğlu<\/strong>&#039;nun tamamlanan dersine ait/);
assert.match(initial.bodyHtml, /GÜNCEL DERS BAKİYESİ/);
assert.match(initial.bodyHtml, /background-color:#141B2D/i);
assert.doesNotMatch(initial.bodyHtml, /border-left/i);
assert.equal(turkishGenitiveSuffix("Efe Alaeddinoğlu"), "'nun");
assert.equal(turkishGenitiveSuffix("Beren Berkün"), "'ün");
const normalizeReport = (html) => html.replace(/Test ders değerlendirmesi ve gelişim notları\.|Güncellenmiş test ders değerlendirmesi ve gelişim notları\./g, "{{REPORT}}");
assert.equal(normalizeReport(initial.bodyHtml), normalizeReport(resend.bodyHtml));

const outbox = readFileSync("supabase/functions/process-notification-outbox/index.ts", "utf8");
const lessonRenderer = readFileSync("supabase/functions/_shared/email/lesson-report.ts", "utf8");
const reportMigration = readFileSync("supabase/migrations/20260913120000_guardian_students_lesson_timezones_mail_cleanup.sql", "utf8");
assert.match(outbox, /renderLessonReportEmail\(row\.template, p, liveRemaining\)/);
assert.match(outbox, /row\.template === "lesson_completed_account_holder"/);
assert.match(lessonRenderer, /Ders Sonu Raporunuz ve Güncel Ders Bakiyeniz/);
assert.doesNotMatch(lessonRenderer, /border-left/);
assert.match(reportMigration, /p_resend/);
assert.match(reportMigration, /'lesson_completed_account_holder'/);
assert.equal((reportMigration.match(/'lesson_completed_account_holder'/g) || []).length, 1);

console.log("production email reconciliation: PASS");
