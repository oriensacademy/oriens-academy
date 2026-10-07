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
const EXPECTED_ACTIVE_IDS = [
  "MAIL-001", "MAIL-002", "MAIL-003", "MAIL-005", "MAIL-006", "MAIL-007",
  "MAIL-009", "MAIL-014", "MAIL-019", "MAIL-020", "MAIL-021",
  "MAIL-022", "MAIL-023", "MAIL-024", "MAIL-025", "MAIL-026", "MAIL-027",
  "MAIL-028", "MAIL-029", "MAIL-030", "MAIL-039", "MAIL-041", "MAIL-042", "MAIL-043", "MAIL-044",
];
const EXPECTED_ACTIVE_COUNT = 25;

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
check("autofilter is set", Boolean(wb.Sheets[SHEET]["!autofilter"]));
check("column widths are set", (wb.Sheets[SHEET]["!cols"] || []).length === EXPECTED_HEADER.length);
check("row heights are set for wrapped text", (wb.Sheets[SHEET]["!rows"] || []).length === data.length + 1);

const col = (name) => EXPECTED_HEADER.indexOf(name);
const ids = data.map((r) => String(r[col("Mail ID")]).trim());
const isActiveMode = (mode) => !/\b(?:DECOMMISSIONED|INACTIVE)\b/i.test(String(mode));
const activeData = data.filter((r) => isActiveMode(r[col("Gönderim Şekli")]));
const activeIds = activeData.map((r) => String(r[col("Mail ID")]).trim());
const expectedSet = new Set(EXPECTED_ACTIVE_IDS);
const activeSet = new Set(activeIds);
const missingActiveIds = EXPECTED_ACTIVE_IDS.filter((id) => !activeSet.has(id));
const unexpectedActiveIds = activeIds.filter((id) => !expectedSet.has(id));

function canonicalIdErrors(candidateIds) {
  const candidateSet = new Set(candidateIds);
  return {
    missing: EXPECTED_ACTIVE_IDS.filter((id) => !candidateSet.has(id)),
    unexpected: candidateIds.filter((id) => !expectedSet.has(id)),
  };
}

console.log("\n[2] ROW INTEGRITY");
check("at least one row", data.length > 0);
check("duplicate Mail IDs = 0", new Set(ids).size === ids.length, ids.filter((v, i) => ids.indexOf(v) !== i).join(", "));
check("No column is contiguous 1..n", data.every((r, i) => Number(r[col("No")]) === i + 1));
check("every row has a producer", data.every((r) => String(r[col("Üretici (Producer)")]).trim().length > 5));
check("every row has a renderer", data.every((r) => String(r[col("Şablon / Renderer")]).trim().length > 3));
check("every row has a subject", data.every((r) => String(r[col("Mail Başlığı")]).trim().length > 3));
check("ACTIVE count equals EXPECTED_ACTIVE_COUNT", activeData.length === EXPECTED_ACTIVE_COUNT, String(activeData.length));
check("canonical active IDs: no expected ID missing", missingActiveIds.length === 0, missingActiveIds.join(", "));
check("canonical active IDs: no unexpected ID active", unexpectedActiveIds.length === 0, unexpectedActiveIds.join(", "));

console.log("\n[2A] CANONICAL SET NEGATIVE FIXTURES");
for (const id of ["MAIL-022", "MAIL-041", "MAIL-042"]) {
  const fixture = EXPECTED_ACTIVE_IDS.filter((candidate) => candidate !== id);
  const errors = canonicalIdErrors(fixture);
  check(`removing ${id} is rejected`, errors.missing.length === 1 && errors.missing[0] === id);
}
{
  const errors = canonicalIdErrors([...EXPECTED_ACTIVE_IDS, "MAIL-999"]);
  check("an unexpected active ID is rejected", errors.unexpected.length === 1 && errors.unexpected[0] === "MAIL-999");
}

console.log("\n[3] SENDER RULE");
const senders = [...new Set(activeData.map((r) => String(r[col("Kim Gönderiyor?")])))];
check("zoom@ outbound = 0", !senders.some((s) => /zoom@/i.test(s)));
check("admin@ outbound = 0", !senders.some((s) => /admin@oriens-academy\.com/i.test(s)));
check("newsletter@ outbound = 0", !senders.some((s) => /newsletter@/i.test(s)));
check(
  "only info@ is used as sender",
  senders.every((s) => /<info@oriens-academy\.com>/.test(s)),
  senders.join(" | ")
);

console.log("\n[4] ADMIN BCC COVERAGE");
const withBcc = activeData.filter((r) => String(r[col("BCC (Arşiv Kopyası)")]).includes(ADMIN_BCC));
check("ACTIVE_WITH_ADMIN_BCC === ACTIVE_PRODUCTION_EMAIL_COUNT", withBcc.length === activeData.length);
check("MISSING_ADMIN_BCC = 0", activeData.length - withBcc.length === 0);
const adminPrimary = data.filter((r) => String(r[col("BCC (Arşiv Kopyası)")]).includes("zaten birincil alıcı"));
check("no active admin-primary mail remains", adminPrimary.length === 0);

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
for (const required of ["MAIL-006", "MAIL-010", "MAIL-021", "MAIL-022", "MAIL-023", "MAIL-024", "MAIL-025", "MAIL-026", "MAIL-027", "MAIL-040", "MAIL-041", "MAIL-042", "MAIL-043", "MAIL-044"]) {
  check("present: " + required, ids.includes(required));
}

console.log("\n[7] AUTOMATIC / MANUAL MATCHES SOURCE");
const byId = Object.fromEntries(data.map((r) => [String(r[col("Mail ID")]), r]));
const modeOf = (id) => String(byId[id]?.[col("Gönderim Şekli")] || "");
const buttonOf = (id) => String(byId[id]?.[col("Admin UI Butonu")] || "");

for (const id of ["MAIL-003", "MAIL-014", "MAIL-021", "MAIL-022", "MAIL-023", "MAIL-024", "MAIL-025", "MAIL-026", "MAIL-027", "MAIL-030", "MAIL-041", "MAIL-042"]) {
  check(id + " is MANUEL (ADMIN)", modeOf(id) === "MANUEL (ADMIN)", modeOf(id));
  check(id + " names a real admin action", buttonOf(id) !== "—" && buttonOf(id).length > 3);
}
for (const id of ["MAIL-001", "MAIL-002", "MAIL-005", "MAIL-006", "MAIL-007", "MAIL-009", "MAIL-019", "MAIL-020", "MAIL-028", "MAIL-029", "MAIL-039"]) {
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
  "MAIL-026": ["Linki Öğrenciye E-posta İle Gönder"],
  "MAIL-027": ["Raporu Kaydet ve Bildirimi Gönder", "Güncellenmiş Raporu Tekrar Gönder"],
  "MAIL-041": ["Paket Bilgilendirme E-postası Gönder"],
  "MAIL-042": ["Ders Hakkı Güncelleme E-postası Gönder"],
};
for (const [id, labels] of Object.entries(LABELS)) {
  for (const label of labels) {
    const sourceHasLabel = uiSource.includes(label) || (
      id === "MAIL-041" &&
      uiSource.includes('"Paket Bilgilendirme E-postası"') &&
      uiSource.includes('${base} Gönder')
    );
    check(`${id} label exists in UI source: "${label}"`, sourceHasLabel);
    check(`${id} label recorded in Excel: "${label}"`, buttonOf(id).includes(label));
  }
}

console.log("\n[9] PRODUCERS EXIST IN THE SOURCE TREE");
const service = read("supabase/functions/_shared/email/service.ts");
const outbox = read("supabase/functions/process-notification-outbox/index.ts");
const templates = read("supabase/functions/_shared/email/templates.ts");
const packageMigration = read("supabase/migrations/20260906170000_human_package_names_in_notifications.sql");
const reportMigration = read("supabase/migrations/20260909090000_lesson_report_manual_notification_flow.sql");
const paymentSuccessMigration = read("supabase/migrations/20260922120000_single_canonical_payment_success_delivery.sql");
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

console.log("\n[9A] RUNTIME PRODUCER TO CATALOG CONSISTENCY");
check("MAIL-022 renderer and dispatcher exist → row is active",
  templates.includes("export function renderAdminAppointmentCreatedEmail") &&
  service.includes("dispatchAppointmentConfirmedEmails") &&
  service.includes("renderAdminAppointmentCreatedEmail") &&
  isActiveMode(modeOf("MAIL-022")));
check("MAIL-041 runtime producer exists → row is active",
  packageMigration.includes("'package_assigned_manual'") &&
  outbox.includes('row.template === "package_assigned_manual"') &&
  learningManager.includes('sendPackageNotificationEmail(purchaseId, kind)') &&
  isActiveMode(modeOf("MAIL-041")));
check("MAIL-042 runtime producer exists → row is active",
  packageMigration.includes("'lesson_rights_manual'") &&
  outbox.includes('row.template === "lesson_rights_manual"') &&
  learningManager.includes('sendPackageNotificationEmail(purchaseId, kind)') &&
  isActiveMode(modeOf("MAIL-042")));
check("MAIL-027 manual producer exists → row is active",
  reportMigration.includes("admin_save_and_send_lesson_report") &&
  outbox.includes('row.template === "lesson_completed_account_holder"') &&
  learningManager.includes("saveAndSendLessonReport") &&
  isActiveMode(modeOf("MAIL-027")));
check("MAIL-040 producer removed → row is inactive",
  reportMigration.includes("MAIL-040 retired") &&
  !/enqueue_email_notification[\s\S]{0,500}lesson_remaining_rights_account_holder/.test(reportMigration) &&
  !isActiveMode(modeOf("MAIL-040")));
check("MAIL-010 producer removed → row is inactive",
  paymentSuccessMigration.includes("exactly one customer-facing outbox row") &&
  !paymentSuccessMigration.includes("payment_success_admin") &&
  !isActiveMode(modeOf("MAIL-010")));

console.log("\n[10] REQUIRED ROW FIDELITY");
{
  const r = byId["MAIL-010"] || [];
  const cell = (name) => String(r[col(name)] || "");
  check("MAIL-010 is decommissioned", cell("Gönderim Şekli") === "DECOMMISSIONED / INACTIVE");
  check("MAIL-010 has no active producer", /decommissioned/i.test(cell("Üretici (Producer)")));
  check("MAIL-010 has no manual button", cell("Admin UI Butonu") === "—");
}
{
  const r = byId["MAIL-022"] || [];
  const cell = (name) => String(r[col(name)] || "");
  check("MAIL-022 is active", isActiveMode(cell("Gönderim Şekli")));
  check("MAIL-022 is manual", cell("Gönderim Şekli") === "MANUEL (ADMIN)");
  check("MAIL-022 uses the real renderer", cell("Şablon / Renderer") === "renderAdminAppointmentCreatedEmail");
  check("MAIL-022 names the real dispatcher", cell("Üretici (Producer)").includes("dispatchAppointmentConfirmedEmails"));
}
{
  const r = byId["MAIL-040"] || [];
  const cell = (name) => String(r[col(name)] || "");
  check("MAIL-040 is decommissioned", cell("Gönderim Şekli") === "DECOMMISSIONED / INACTIVE");
  check("MAIL-040 has no active producer", /retired|decommissioned/i.test(cell("Üretici (Producer)")));
  check("MAIL-040 has no manual button", cell("Admin UI Butonu") === "—");
}
{
  const r = byId["MAIL-027"] || [];
  const cell = (name) => String(r[col(name)] || "");
  check("MAIL-027 has its canonical report name", cell("Mail Tipi") === "Ders Sonu Raporu ve Güncel Ders Bakiyesi");
  check("MAIL-027 has revised clean subject", cell("Mail Başlığı") === "Ders Sonu Raporunuz ve Güncel Ders Bakiyeniz");
  check("MAIL-027 is manual", cell("Gönderim Şekli") === "MANUEL (ADMIN)");
  check("MAIL-027 uses the canonical renderer", cell("Şablon / Renderer") === "lesson_completed_account_holder");
  check("MAIL-027 recipient is verified account holder", /verified|email_verified_at/i.test(cell("Kime Gidiyor?")));
  check("MAIL-027 documents timezone and identity separation", /IANA|saat dilimi/i.test(cell("Notlar")) && /Veli ve öğrenci adı/i.test(cell("Notlar")));
}
for (const [id, type, renderer] of [
  ["MAIL-041", "Paket Bilgilendirme", "package_assigned_manual"],
  ["MAIL-042", "Ders Hakkı Güncelleme", "lesson_rights_manual"],
]) {
  const r = byId[id] || [];
  const cell = (name) => String(r[col(name)] || "");
  check(`${id} has canonical mail type`, cell("Mail Tipi") === type, cell("Mail Tipi"));
  check(`${id} is active / manual`, cell("Gönderim Şekli") === "MANUEL (ADMIN)", cell("Gönderim Şekli"));
  check(`${id} uses canonical renderer`, cell("Şablon / Renderer").includes(renderer), cell("Şablon / Renderer"));
  check(`${id} recipient is verified account holder`, /verified|email_verified_at|doğrulanmış/i.test(cell("Kime Gidiyor?")));
  check(`${id} uses canonical sender`, cell("Kim Gönderiyor?") === "Oriens Academy <info@oriens-academy.com>");
}

console.log("\n[11] ARTIFACT QUALITY");
{
  const flat = data.flat().map((v) => String(v));
  const banned = /\bnull\b|\bundefined\b|\bNaN\b|\[object Object\]|\bTODO\b|Lorem ipsum|prompt:|AI kalıntı/i;
  const dirty = flat.filter((v) => banned.test(v));
  check("no null/undefined/NaN/[object Object]/TODO anywhere", dirty.length === 0, dirty.slice(0, 3).join(" | "));
  check("no empty cells (placeholders use an em dash)", flat.every((v) => v.trim().length > 0));
  check("no stale audit commentary", !/task 7|forensic|audit bulgusu|denetim notu/i.test(allText));
  check("no generated mail-name placeholders", !/Operasyonel Bildirim \d{3}|Manuel Operasyon Bildirimi \d{3}/i.test(allText));
  check("no generated renderer placeholders", !/canonical_renderer_\d{3}/i.test(allText));
}

console.log("\n=======================================");
console.log("  ACTIVE_MAIL_COUNT      = " + activeData.length);
console.log("  ADMIN_BCC_COVERAGE     = " + withBcc.length + "/" + activeData.length);
console.log("  DUPLICATE_MAIL_IDS     = " + (ids.length - new Set(ids).size));
console.log("  MAIL-022 PRESENT       = " + ids.includes("MAIL-022"));
  console.log("  MAIL-027 ACTIVE        = " + isActiveMode(modeOf("MAIL-027")));
  console.log("  MAIL-010 DECOMMISSIONED= " + !isActiveMode(modeOf("MAIL-010")));
console.log("  MAIL-040 DECOMMISSIONED= " + !isActiveMode(modeOf("MAIL-040")));
console.log("  MAIL-041 PRESENT       = " + ids.includes("MAIL-041"));
console.log("  MAIL-042 PRESENT       = " + ids.includes("MAIL-042"));
console.log("  " + passed + " passed, " + failures.length + " failed");
if (failures.length) {
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log("  MAIL-V5 EXCEL VALIDATION: PASS");
