import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { renderEmailShell } from "../supabase/functions/_shared/email/templates.ts";
import { renderPaymentSuccessEmail } from "../supabase/functions/_shared/email/payment-success.ts";

const outputDir = path.resolve("scratch/target-email-visual-previews");
mkdirSync(outputDir, { recursive: true });
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const accountUrl = "https://oriens-academy.com/tr/hesabim/";

function button(label, variant) {
  const color = variant === "lesson-report" ? "#B8975A" : "#1B2A22";
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="${color}" style="border-radius:10px;"><a href="${accountUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;line-height:20px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;">${escapeHtml(label)} &rarr;</a></td></tr></table>`;
}

function wrap({ title, bodyHtml, visualVariant, centered = false, footerNote }) {
  return renderEmailShell({
    locale: "tr",
    eyebrow: "Oriens Academy",
    title,
    bodyHtml: `<div style="font-size:14px;line-height:1.65;color:#10271B;">${bodyHtml}<div style="margin-top:28px;${centered ? "display:flex;justify-content:center;" : ""}">${button("Hesabıma Git", visualVariant)}</div></div>`,
    footerEmail: "info@oriens-academy.com",
    footerNote,
    visualVariant,
  });
}

const payment = renderPaymentSuccessEmail("guardian", {
  reference: "ORI-2026-1042",
  payer_name: "Engin Peker",
  package_id: "package10",
  lesson_count: 10,
  amount: 30000,
  currency: "TRY",
}, "tr");

const welcomeLines = [
  "Sayın Engin Peker, Oriens Academy hesabınız başarıyla oluşturuldu.",
  "Ders, paket ve ödeme işlemlerinizi hesabınızdan yönetebilirsiniz.",
];
const welcomeBody = `<p style="margin:0 0 16px 0;font-size:16px;line-height:26px;color:#3D4A43;">${escapeHtml(welcomeLines[0])}</p><div style="padding:18px 20px;background-color:#FAF8F3;border:1px solid #EFE9DC;border-radius:12px;font-size:14px;line-height:22px;color:#3D4A43;">${escapeHtml(welcomeLines[1])}</div>`;

function lessonReport({ guardian, student, lesson, subject, date, time, report, remaining }) {
  const row = (label, value, first = false) => {
    const labelPadding = first ? "16px 0 10px 20px" : "10px 0 10px 20px";
    const valuePadding = first ? "16px 20px 10px 0" : "10px 20px 10px 0";
    const divider = first ? "" : "border-top:1px solid #EBEBE6;";
    return `<tr><td width="34%" style="padding:${labelPadding};color:#6B7078;${divider}">${escapeHtml(label)}</td><td style="padding:${valuePadding};font-weight:600;color:#141B2D;${divider}">${escapeHtml(value)}</td></tr>`;
  };
  const details = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${row("Ders", lesson, true)}${row("Konu", subject)}${row("Tarih", date)}${row("Saat", time)}${row("Süre", "60 dakika")}</table>`;
  const heading = (label) => `<div style="margin:0 0 12px 0;font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.5px;color:#B8975A;text-transform:uppercase;">${label}</div>`;
  return `<p style="margin:0 0 12px 0;font-size:15px;line-height:24px;color:#2B2F36;">Merhaba ${escapeHtml(guardian)},</p>
    <p style="margin:0 0 28px 0;font-size:15px;line-height:24px;color:#4A4F57;">${escapeHtml(`${student} öğrencimizin tamamlanan dersine ilişkin değerlendirme raporu ile güncel ders bakiyenize aşağıda yer verilmiştir.`)}</p>
    ${heading("DERS BİLGİLERİ")}<div style="margin:0 0 28px 0;background-color:#F7F7F4;border-radius:12px;overflow:hidden;">${details}</div>
    ${heading("DERS SONU RAPORU")}<div style="margin:0 0 28px 0;background-color:#F7F7F4;border-radius:12px;overflow:hidden;"><div style="border-left:3px solid #B8975A;padding:18px 20px;font-size:14px;line-height:23px;color:#2B2F36;">${escapeHtml(report)}</div></div>
    ${heading("GÜNCEL DERS BAKİYESİ")}<div style="margin:0;background-color:#141B2D;border-radius:12px;padding:20px 24px;"><span style="font-size:38px;line-height:42px;font-weight:700;color:#FFFFFF;">${remaining}</span><span style="padding-left:6px;font-size:16px;line-height:42px;font-weight:600;color:#D9C39A;">Ders</span></div>`;
}

const title = "Ders Sonu Raporunuz ve Güncel Ders Bakiyeniz";
const previews = {
  "payment-confirmation": wrap({ title: payment.title, bodyHtml: payment.bodyHtml, visualVariant: "payment-confirmation", centered: true, footerNote: "Bu otomatik bir bilgilendirme e-postasıdır." }),
  "account-created": wrap({ title: "Oriens Academy hesabınız hazır", bodyHtml: welcomeBody, visualVariant: "account-created", footerNote: "Bu otomatik bir bilgilendirme e-postasıdır." }),
  "lesson-report-initial": wrap({ title, visualVariant: "lesson-report", bodyHtml: lessonReport({ guardian: "Yeşim Hanım", student: "Efe Alaeddinoğlu", lesson: "College Math", subject: "Geometry", date: "1 Ekim 2026 Perşembe", time: "13.30 TR", report: "Bugünkü derste işlenen konular, öğrencinin gelişimi ve bir sonraki derse kadar öneriler bu bölümde yer alır.", remaining: 4 }) }),
  "lesson-report-resend": wrap({ title, visualVariant: "lesson-report", bodyHtml: lessonReport({ guardian: "Burak Bey", student: "Beren Berkün", lesson: "AP Biology", subject: "Yağ · Protein · DNA", date: "26 Eylül 2026 Cumartesi", time: "19.30 TR", report: "Güncellenen ders değerlendirmesi ve öğretmenin son önerileri bu bölümde yer alır.", remaining: 24 }) }),
};

for (const [name, html] of Object.entries(previews)) writeFileSync(path.join(outputDir, `${name}.html`), html, "utf8");

const browser = await chromium.launch({ headless: true });
for (const name of Object.keys(previews)) {
  for (const width of [760, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.join(outputDir, `${name}.html`)).href, { waitUntil: "domcontentloaded", timeout: 10_000 });
    await page.screenshot({ path: path.join(outputDir, `${name}-${width}.png`), fullPage: true });
    await page.close();
  }
}
await browser.close();
console.log(`Rendered ${Object.keys(previews).length} HTML previews and 8 desktop/mobile snapshots in ${outputDir}`);
