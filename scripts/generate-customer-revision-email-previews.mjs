import { mkdirSync, writeFileSync } from "node:fs";
import { renderEmailShell, actionButton } from "../supabase/functions/_shared/email/templates.ts";

const outputDir = "scratch/customer-revision-email-previews";
mkdirSync(outputDir, { recursive: true });
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const fixtures = {
  tr: { guardian: "Yeşim Alaeddinoğlu", student: "Ali Can Yılmaz", date: "12 Eylül 2026 Cumartesi", time: "18.00 NL", package: "10 Derslik Uluslararası Akademik Hazırlık Paketi", start: "11 Eylül 2026" },
  en: { guardian: "Yesim Alaeddinoglu", student: "Ali Can Yilmaz", date: "Saturday, September 12, 2026", time: "18.00 NL", package: "10-Lesson International Academic Preparation Package", start: "September 11, 2026" },
};

function report(locale) {
  const f = fixtures[locale];
  const tr = locale === "tr";
  const row = (label, value) => '<tr><td style="padding:7px 12px;color:#557064;width:34%;">' + escapeHtml(label) + '</td><td style="padding:7px 12px;font-weight:600;color:#10271B;">' + escapeHtml(value) + "</td></tr>";
  const title = tr ? "Ders Sonu Raporunuz ve Güncel Ders Bakiyeniz" : "Your Lesson Report and Current Lesson Balance";
  const bodyHtml =
    '<p style="margin:0 0 6px 0;">' + (tr ? "Merhaba " : "Hello ") + escapeHtml(f.guardian) + ',</p>' +
    '<p style="margin:0 0 18px 0;">' + escapeHtml(tr ? f.student + " öğrencimizin tamamlanan dersine ilişkin değerlendirme raporu ile güncel ders bakiyenize aşağıda yer verilmiştir." : "The evaluation report for " + f.student + "'s completed lesson and your current lesson balance are provided below.") + "</p>" +
    '<h3 style="margin:0 0 8px;color:#10271B;font-size:14px;">' + (tr ? "DERS BİLGİLERİ" : "LESSON DETAILS") + "</h3>" +
    '<table role="presentation" width="100%" style="border-collapse:collapse;background:#F6F8F7;margin-bottom:20px;">' +
    row(tr ? "Ders" : "Lesson", tr ? "Birebir Canlı Ders" : "Live 1-on-1 Lesson") +
    row(tr ? "Branş / Konu" : "Subject", "SAT Mathematics") + row(tr ? "Tarih" : "Date", f.date) +
    row(tr ? "Saat" : "Time", f.time) + row(tr ? "Süre" : "Duration", tr ? "60 dakika" : "60 minutes") + "</table>" +
    '<h3 style="margin:0 0 8px;color:#10271B;font-size:14px;">' + (tr ? "DERS SONU RAPORU" : "LESSON REPORT") + "</h3>" +
    '<div style="margin:0 0 20px;padding:14px;border-left:3px solid #2F6B4F;background:#F6F8F7;">' + escapeHtml(tr ? "Öğrencimiz derse hazırlıklı katıldı ve hedeflenen kazanımları başarıyla tamamladı." : "Our student arrived prepared and successfully completed the planned learning outcomes.") + "</div>" +
    '<h3 style="margin:0 0 8px;color:#10271B;font-size:14px;">' + (tr ? "GÜNCEL DERS BAKİYESİ" : "CURRENT LESSON BALANCE") + '</h3><p style="font-size:20px;font-weight:700;">10 ' + (tr ? "Ders" : "lessons") + "</p>" +
    actionButton(tr ? "Hesabıma Git" : "Go to My Account", tr ? "https://oriens-academy.com/tr/hesabim/" : "https://oriens-academy.com/en/account/");
  return renderEmailShell({ locale, eyebrow: "Oriens Academy", title, bodyHtml, footerEmail: "info@oriens-academy.com" });
}

function packageMail(locale) {
  const f = fixtures[locale];
  const tr = locale === "tr";
  const row = (label, value) => '<tr><td style="padding:7px 0;color:#557064;white-space:nowrap;">' + escapeHtml(label) + '</td><td style="padding:7px 10px;color:#557064;text-align:center;width:18px;">:</td><td style="padding:7px 0;font-weight:600;color:#10271B;">' + escapeHtml(value) + "</td></tr>";
  const bodyHtml = '<p style="margin:0 0 6px 0;">' + (tr ? "Merhaba " : "Hello ") + escapeHtml(f.guardian) + ',</p>' +
    '<p style="margin:0 0 18px 0;">' + escapeHtml(tr ? f.student + " için aşağıdaki ders paketi tanımlanmıştır." : "The lesson package below has been assigned for " + f.student + ".") + "</p>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#F6F8F7;margin-bottom:18px;">' +
    row(tr ? "Paket" : "Package", f.package) + row(tr ? "Güncel Ders Bakiyesi" : "Current Lesson Balance", tr ? "10 Ders" : "10 lessons") +
    row(tr ? "Başlangıç Tarihi" : "Start Date", f.start) + "</table>" +
    "<p>" + (tr ? "Derslerinizi ve güncel bakiyenizi dilediğiniz zaman hesabınızdan takip edebilirsiniz." : "You can follow your lessons and current balance from your account at any time.") + "</p>" +
    actionButton(tr ? "Hesabıma Git" : "Go to My Account", tr ? "https://oriens-academy.com/tr/hesabim/" : "https://oriens-academy.com/en/account/");
  return renderEmailShell({ locale, eyebrow: "Oriens Academy", title: tr ? "Ders Paketiniz Tanımlandı" : "Your Lesson Package Has Been Assigned", bodyHtml, footerEmail: "info@oriens-academy.com" });
}

function rightsMail(locale) {
  const tr = locale === "tr";
  const holder = tr ? "Beren Berkun" : "Beren Berkun";
  const student = tr ? "Beren Berkun" : "Beren Berkun";
  const date = tr ? "13 Eylül 2026 Pazar" : "Sunday, September 13, 2026";
  const row = (label, value) => '<tr><td style="padding:5px 0;font-weight:700;color:#10271B;vertical-align:top;">' + escapeHtml(label) + '</td><td style="width:18px;padding:5px;text-align:center;color:#557064;vertical-align:top;">:</td><td style="padding:5px 0;font-weight:400;color:#10271B;vertical-align:top;">' + escapeHtml(value) + '</td></tr>';
  const bodyHtml = '<p style="margin:0 0 12px 0;">' + (tr ? "Merhaba " : "Hello ") + escapeHtml(holder) + '.</p>' +
    '<p style="margin:0 0 18px 0;">' + (tr ? "Mevcut ders haklarınız aşağıdaki gibidir." : "Your current lesson rights are listed below.") + '</p>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">' +
    row(tr ? "Öğrenci" : "Student", student) +
    row(tr ? "Toplam kalan ders hakkı" : "Total remaining lesson rights", "31") +
    row(tr ? "Tarih" : "Date", date) + '</table>';
  return renderEmailShell({
    locale,
    eyebrow: "Oriens Academy",
    title: tr ? "Güncel Ders Haklarınız" : "Current Lesson Rights",
    bodyHtml,
    footerEmail: "info@oriens-academy.com",
  });
}

for (const locale of ["tr", "en"]) {
  writeFileSync(outputDir + "/MAIL-027-" + locale.toUpperCase() + ".html", report(locale), "utf8");
  writeFileSync(outputDir + "/MAIL-041-" + locale.toUpperCase() + ".html", packageMail(locale), "utf8");
  writeFileSync(outputDir + "/PACKAGE-RIGHTS-" + locale.toUpperCase() + ".html", rightsMail(locale), "utf8");
}
console.log("Generated 6 previews in " + outputDir);
