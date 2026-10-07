import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import {
  escapeHtml,
  renderEmailShell,
  renderPurchaseEmailVerificationOtpEmail,
} from "../supabase/functions/_shared/email/templates.ts";
import { renderPaymentSuccessEmail } from "../supabase/functions/_shared/email/payment-success.ts";
import { renderAccountCreatedEmail } from "../supabase/functions/_shared/email/account-created.ts";
import { renderLessonReportEmail } from "../supabase/functions/_shared/email/lesson-report.ts";

const outputDir = path.resolve("scratch/mail-preview");
mkdirSync(outputDir, { recursive: true });

function actionButton(label, visualVariant) {
  const color = visualVariant === "lesson-report" ? "#B8975A" : "#1B2A22";
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="${color}" style="border-radius:10px;"><a href="https://oriens-academy.com/tr/hesabim/" style="display:inline-block;padding:14px 28px;font-size:15px;line-height:20px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;">${escapeHtml(label)} &rarr;</a></td></tr></table>`;
}

function renderOutboxResult(result, { centered = false, footerNote } = {}) {
  return renderEmailShell({
    locale: "tr",
    eyebrow: "Oriens Academy",
    title: result.title,
    bodyHtml: `<div style="font-size:14px;line-height:1.65;color:#10271B;">${result.bodyHtml}<div style="margin-top:28px;${centered ? "display:flex;justify-content:center;" : ""}">${actionButton("Hesabıma Git", result.visualVariant)}</div></div>`,
    footerEmail: "info@oriens-academy.com",
    footerNote,
    visualVariant: result.visualVariant,
  });
}

const verification = renderPurchaseEmailVerificationOtpEmail({
  otp: "482731",
  locale: "tr",
  expiresInMinutes: 10,
});
const account = renderAccountCreatedEmail({ account_holder_name: "Test Veli" }, "tr");
const payment = renderPaymentSuccessEmail("guardian", {
  reference: "TEST-REF-1042",
  payer_name: "Test Veli",
  package_id: "test-package",
  package_name: "Test Ders Paketi",
  lesson_count: 10,
  amount: 30000,
  currency: "TRY",
}, "tr");
const baseLessonPayload = {
  account_holder_name: "Test Veli",
  student_name: "Test Öğrenci",
  lesson_title: "Test Dersi",
  subject: "Test Konusu",
  lesson_date: "2026-10-02T10:30:00.000Z",
  lesson_timezone: "Europe/Istanbul",
  lesson_timezone_label: "TSİ",
  duration_minutes: 60,
  total_remaining_lessons: 4,
  locale: "tr",
};
const initialReport = renderLessonReportEmail("lesson_completed_account_holder", {
  ...baseLessonPayload,
  completion_report: "Test ders değerlendirmesi ve gelişim notları.",
  report_version: 1,
});
const resendReport = renderLessonReportEmail("lesson_completed_account_holder", {
  ...baseLessonPayload,
  completion_report: "Güncellenmiş test ders değerlendirmesi ve gelişim notları.",
  report_version: 2,
});

const previews = {
  verification: verification.html,
  "account-created": renderOutboxResult(account, { footerNote: "Bu otomatik bir bilgilendirme e-postasıdır." }),
  "payment-success": renderOutboxResult({ ...payment, visualVariant: "payment-confirmation" }, { centered: true, footerNote: "Bu otomatik bir bilgilendirme e-postasıdır." }),
  "lesson-report-initial": renderOutboxResult(initialReport),
  "lesson-report-resend": renderOutboxResult(resendReport),
};

for (const [name, html] of Object.entries(previews)) {
  writeFileSync(path.join(outputDir, `${name}.html`), html, "utf8");
}

const structuralFingerprint = (html) => createHash("sha256")
  .update(html
    .replace(/Test ders değerlendirmesi ve gelişim notları\.|Güncellenmiş test ders değerlendirmesi ve gelişim notları\./g, "{{REPORT}}")
    .replace(/report_version[^<]*/g, "report_version"))
  .digest("hex");
const initialFingerprint = structuralFingerprint(previews["lesson-report-initial"]);
const resendFingerprint = structuralFingerprint(previews["lesson-report-resend"]);
if (initialFingerprint !== resendFingerprint) throw new Error("INITIAL_RESEND_LAYOUT_MISMATCH");

console.log(`Rendered ${Object.keys(previews).length} no-send HTML previews in ${outputDir}`);
console.log(`INITIAL_RESEND_STRUCTURAL_SHA256=${initialFingerprint}`);

const browser = await chromium.launch({ headless: true });
for (const name of Object.keys(previews)) {
  for (const width of [760, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.join(outputDir, `${name}.html`)).href, { waitUntil: "domcontentloaded", timeout: 10_000 });
    await page.screenshot({ path: path.join(outputDir, `${name}-${width}.png`), fullPage: true });
    await page.close();
  }
}
await Promise.race([
  browser.close(),
  new Promise((resolve) => setTimeout(resolve, 5_000)),
]);
console.log(`Rendered ${Object.keys(previews).length * 2} desktop/mobile snapshots in ${outputDir}`);
process.exit(0);
