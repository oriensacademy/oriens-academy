/**
 * Validates C:/Users/merto/Desktop/mail-v5.xlsx against the actual source tree.
 * Re-opens the generated workbook and cross-checks every claim it makes.
 *
 *   node scripts/test-mail-v5-excel.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const ROOT = process.cwd();
const FILE = "C:/Users/merto/Desktop/mail-v5.xlsx";
const LEGACY = "C:/Users/merto/Desktop/ORIENS_TUM_MAILLER_GUNCEL.xlsx";
const SHEET = "TÜM MAİLLER";
const ADMIN_BCC = "admin@oriens-academy.com";

const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

let passed = 0;
const failures = [];
function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log("  PASS  " + name);
  } else {
    failures.push(name + (detail ? " -- " + detail : ""));
    console.log("  FAIL  " + name + (detail ? " -- " + detail : ""));
  }
}

console.log("\n[1] WORKBOOK STRUCTURE");
check("mail-v5.xlsx exists", existsSync(FILE));
// The legacy workbook is only a style reference and lives outside this repo, so
// its absence is reported but never fails the run: mail-v5 is generated from
// source, not derived from that file.
console.log(
  (existsSync(LEGACY) ? "  INFO  reference workbook present" : "  INFO  reference workbook not on disk (not required)") +
    " -- " + LEGACY
);

// cellStyles is required for the writer's !cols / !rows metadata to round-trip.
const wb = XLSX.readFile(FILE, { cellStyles: true });
check("workbook opens", Boolean(wb));
check("expected sheet exists", wb.SheetNames.includes(SHEET), wb.SheetNames.join(", "));
check("no stray extra sheets", wb.SheetNames.length === 1, wb.SheetNames.join(", "));

const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1, defval: "" });
const header = rows[0];
const data = rows.slice(1).filter((r) => String(r[1] || "").trim());

const EXPECTED_HEADER = [
  "No", "Mail ID", "Mail Tipi", "Gönderim Şekli", "Ne Tetikliyor?", "Mail Başlığı",
  "Kim Gönderiyor?", "Kime Gidiyor?", "BCC (Arşiv Kopyası)", "Üretici (Producer)",
  "Şablon / Renderer", "Admin UI Butonu", "Notlar",
];
check("headers are correct", JSON.stringify(header) === JSON.stringify(EXPECTED_HEADER), JSON.stringify(header));
const rawSheetXml = Buffer.from(
  XLSX.CFB.find(XLSX.CFB.read(readFileSync(FILE), { type: "buffer" }), "/xl/worksheets/sheet1.xml").content
).toString("utf8");
check("header row is frozen", /state="frozen"/.test(rawSheetXml));
check("freeze keeps Mail ID column visible", /xSplit="2"[^>]*ySplit="1"/.test(rawSheetXml));
const rawStylesXml = Buffer.from(
  XLSX.CFB.find(XLSX.CFB.read(readFileSync(FILE), { type: "buffer" }), "/xl/styles.xml").content
).toString("utf8");
check("a wrapping cell format is defined", /<alignment vertical="top" wrapText="1"\/>/.test(rawStylesXml));
check("a bold wrapping header format is defined", /applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"\/>/.test(rawStylesXml));
check("every cell carries a style index", (rawSheetXml.match(/<c r="[A-Z]+\d+" s="\d+"/g) || []).length === (rawSheetXml.match(/<c r="[A-Z]+\d+"/g) || []).length);
check("autofilter is set", Boolean(wb.Sheets[SHEET]["!autofilter"]));
check("column widths are set", (wb.Sheets[SHEET]["!cols"] || []).length === EXPECTED_HEADER.length);
check("row heights are set for wrapped text", (wb.Sheets[SHEET]["!rows"] || []).length === data.length + 1);

const col = (name) => EXPECTED_HEADER.indexOf(name);
const ids = data.map((r) => String(r[col("Mail ID")]).trim());

console.log("\n[2] ROW INTEGRITY");
check("at least one row", data.length > 0);
check("duplicate Mail IDs = 0", new Set(ids).size === ids.length, ids.filter((v, i) => ids.indexOf(v) !== i).join(", "));
check("No column is contiguous 1..n", data.every((r, i) => Number(r[col("No")]) === i + 1));
check("every row has a producer", data.every((r) => String(r[col("Üretici (Producer)")]).trim().length > 5));
check("every row has a renderer", data.every((r) => String(r[col("Şablon / Renderer")]).trim().length > 3));
check("every row has a subject", data.every((r) => String(r[col("Mail Başlığı")]).trim().length > 3));

console.log("\n[3] SENDER RULE");
const senders = [...new Set(data.map((r) => String(r[col("Kim Gönderiyor?")])))];
check("zoom@ outbound = 0", !senders.some((s) => /zoom@/i.test(s)));
check("admin@ outbound = 0", !senders.some((s) => /admin@oriens-academy\.com/i.test(s)));
check("newsletter@ outbound = 0", !senders.some((s) => /newsletter@/i.test(s)));
check(
  "only info@ / payments@ are used as senders",
  senders.every((s) => /<info@oriens-academy\.com>|<payments@oriens-academy\.com>/.test(s)),
  senders.join(" | ")
);

console.log("\n[4] ADMIN BCC COVERAGE");
const withBcc = data.filter((r) => String(r[col("BCC (Arşiv Kopyası)")]).includes(ADMIN_BCC));
check("ACTIVE_WITH_ADMIN_BCC === ACTIVE_PRODUCTION_EMAIL_COUNT", withBcc.length === data.length);
check("MISSING_ADMIN_BCC = 0", data.length - withBcc.length === 0);
const adminPrimary = data.filter((r) => String(r[col("BCC (Arşiv Kopyası)")]).includes("zaten birincil alıcı"));
check("admin-as-primary rows are annotated, not left blank", adminPrimary.length === 1 && String(adminPrimary[0][col("Mail ID")]) === "MAIL-010");

console.log("\n[5] DECOMMISSIONED / REMOVED FLOWS ABSENT");
for (const dead of ["MAIL-004", "MAIL-011", "MAIL-012", "MAIL-013", "MAIL-015", "MAIL-016", "MAIL-017", "MAIL-018", "MAIL-031", "MAIL-032", "MAIL-033", "MAIL-034", "MAIL-035", "MAIL-036", "MAIL-037"]) {
  check("absent from active table: " + dead, !ids.includes(dead));
}
const allText = JSON.stringify(data);
check("no support-ticket flow row", !/support_thread|destek talebi|support ticket/i.test(allText));
check("no newsletter row", !/newsletter/i.test(allText));
check("no preview/test-only flow row", !/email-preview-delivery|preview\.delivery/i.test(allText));
check("no stub function referenced as active", !/send-homework-email|send-exam-result-email|send-support-email/i.test(allText));

console.log("\n[6] REQUIRED ROWS PRESENT");
for (const required of ["MAIL-006", "MAIL-040", "MAIL-021", "MAIL-023", "MAIL-024", "MAIL-025", "MAIL-026", "MAIL-027"]) {
  check("present: " + required, ids.includes(required));
}

console.log("\n[7] AUTOMATIC / MANUAL MATCHES SOURCE");
const byId = Object.fromEntries(data.map((r) => [String(r[col("Mail ID")]), r]));
const modeOf = (id) => String(byId[id][col("Gönderim Şekli")]);
const buttonOf = (id) => String(byId[id][col("Admin UI Butonu")]);

for (const id of ["MAIL-021", "MAIL-023", "MAIL-024", "MAIL-025", "MAIL-026", "MAIL-027", "MAIL-003", "MAIL-014", "MAIL-030"]) {
  check(id + " is MANUEL (ADMIN)", modeOf(id) === "MANUEL (ADMIN)", modeOf(id));
  check(id + " names a real admin action", buttonOf(id) !== "—" && buttonOf(id).length > 3);
}
for (const id of ["MAIL-001", "MAIL-002", "MAIL-005", "MAIL-006", "MAIL-007", "MAIL-009", "MAIL-010", "MAIL-019", "MAIL-020", "MAIL-028", "MAIL-029", "MAIL-039", "MAIL-040"]) {
  check(id + " is automatic", modeOf(id).startsWith("OTOMATİK"), modeOf(id));
  check(id + " has no admin button", buttonOf(id) === "—");
}

console.log("\n[8] MANUAL BUTTON LABELS MATCH THE UI SOURCE");
const detailSheet = read("src/components/admin/StudentDetailSheet.tsx");
const learningManager = read("src/components/admin/StudentLearningManager.tsx");
const uiSource = detailSheet + learningManager;
const LABELS = {
  "MAIL-021": ["Bilgilendirme E-postası Gönder", "Bilgilendirme E-postasını Tekrar Gönder"],
  "MAIL-023": ["Tarih Değişikliği E-postası Gönder", "Tarih Değişikliği E-postasını Tekrar Gönder"],
  "MAIL-024": ["İptal E-postası Gönder", "İptal E-postasını Tekrar Gönder"],
  "MAIL-025": ["Hatırlatma E-postası Gönder", "Hatırlatma E-postasını Tekrar Gönder"],
  "MAIL-026": ["Linki Öğrenciye E-posta İle Gönder", "Linki Öğrenciye Tekrar Gönder"],
  "MAIL-027": ["Ders Bilgilendirme E-postası Gönder", "Bilgilendirme E-postasını Tekrar Gönder"],
};
for (const [id, labels] of Object.entries(LABELS)) {
  for (const label of labels) {
    check(`${id} label exists in UI source: "${label}"`, uiSource.includes(label));
    check(`${id} label recorded in Excel: "${label}"`, buttonOf(id).includes(label));
  }
}

console.log("\n[9] PRODUCERS EXIST IN THE SOURCE TREE");
const service = read("supabase/functions/_shared/email/service.ts");
const outbox = read("supabase/functions/process-notification-outbox/index.ts");
const templates = read("supabase/functions/_shared/email/templates.ts");
const FN_DIR = "supabase/functions";
for (const fn of ["request-purchase-email-verification", "request-password-recovery", "request-email-change", "verify-email-change", "send-contact-reply", "send-live-lesson-email", "send-student-appointment", "create-booking", "create-contact", "process-notification-outbox"]) {
  check("edge function exists: " + fn, existsSync(path.join(ROOT, FN_DIR, fn, "index.ts")));
}
for (const renderer of ["renderPurchaseEmailVerificationOtpEmail", "renderPasswordResetActionEmail", "renderEmailChangeOtpEmail", "renderEmailChangeSecurityNoticeEmail", "renderContactReplyEmail", "renderStudentLiveLessonLinkEmail", "renderStudentBookingEmail", "renderAdminBookingEmail", "renderStudentContactEmail", "renderAdminContactEmail", "renderStudentAppointmentConfirmedEmail", "renderAdminAppointmentCreatedEmail", "renderStudentAppointmentUpdatedEmail", "renderStudentAppointmentCancelledEmail", "renderStudentAppointmentReminderEmail"]) {
  check("renderer still exists: " + renderer, templates.includes("export function " + renderer));
}
for (const tpl of ["payment_success_guardian", "payment_success_admin", "payment_refunded_account_holder", "lesson_completed_account_holder", "lesson_remaining_rights_account_holder", "guardian_welcome"]) {
  check("outbox template handled: " + tpl, outbox.includes(tpl));
}
check("every send goes through the single BCC layer", (service.match(/gmail\.googleapis\.com/g) || []).length === 1);

console.log("\n[10] MAIL-040 ROW FIDELITY");
{
  const r = byId["MAIL-040"];
  const cell = (name) => String(r[col(name)]);
  check("MAIL-040 is an automatic lifecycle mail", cell("Gönderim Şekli") === "OTOMATİK (DERS COMPLETION)");
  check("MAIL-040 producer is the canonical completion", cell("Üretici (Producer)").includes("admin_record_completed_lesson"));
  check("MAIL-040 sender is info@", cell("Kim Gönderiyor?").includes("info@oriens-academy.com"));
  check("MAIL-040 BCC is admin@", cell("BCC (Arşiv Kopyası)").includes(ADMIN_BCC));
  check("MAIL-040 documents the timing rule", /max\(ders bitişi \+ 1 saat, tamamlama anı\)/.test(cell("Ne Tetikliyor?")));
  check("MAIL-040 documents remaining = 1", /Kalan = 1/.test(cell("Notlar")));
  check("MAIL-040 documents remaining = 0 CTA", /Kalan = 0/.test(cell("Notlar")) && /CTA/.test(cell("Notlar")));
  check("MAIL-040 recipient is the verified account holder", /email_verified_at/.test(cell("Kime Gidiyor?")));
  check("MAIL-040 delivery is the durable outbox", cell("Üretici (Producer)").includes("outbox"));
  check("MAIL-040 has no manual button", cell("Admin UI Butonu") === "—");
}

console.log("\n[11] ARTIFACT QUALITY");
{
  const flat = data.flat().map((v) => String(v));
  const banned = /\bnull\b|\bundefined\b|\bNaN\b|\[object Object\]|\bTODO\b|Lorem ipsum|prompt:|AI kalıntı/i;
  const dirty = flat.filter((v) => banned.test(v));
  check("no null/undefined/NaN/[object Object]/TODO anywhere", dirty.length === 0, dirty.slice(0, 3).join(" | "));
  check("no empty cells (placeholders use an em dash)", flat.every((v) => v.trim().length > 0));
  check("no stale audit commentary", !/task 7|forensic|audit bulgusu|denetim notu/i.test(allText));
}

console.log("\n=======================================");
console.log("  ACTIVE_MAIL_COUNT      = " + data.length);
console.log("  ADMIN_BCC_COVERAGE     = " + withBcc.length + "/" + data.length);
console.log("  DUPLICATE_MAIL_IDS     = " + (ids.length - new Set(ids).size));
console.log("  " + passed + " passed, " + failures.length + " failed");
if (failures.length) {
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log("  MAIL-V5 EXCEL VALIDATION: PASS");
