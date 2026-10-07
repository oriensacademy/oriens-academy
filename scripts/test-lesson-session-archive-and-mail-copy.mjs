/**
 * Focused regression matrix for lesson archive UX and MAIL-027 copy.
 * Source-only: no database rows are changed and no email is sent.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (file) => readFileSync(path.resolve(process.cwd(), file), "utf8");
const manager = read("src/components/admin/StudentLearningManager.tsx");
const detail = read("src/components/admin/StudentDetailSheet.tsx");
const client = read("src/lib/admin/student-learning.ts");
const outbox = read("supabase/functions/process-notification-outbox/index.ts");
const completionEdge = read("supabase/functions/send-live-lesson-email/index.ts");
const reportMigration = read("supabase/migrations/20260909090000_lesson_report_manual_notification_flow.sql");

const completionPanel = manager.slice(manager.indexOf("{completeTarget && ("), manager.indexOf("{/* Canonical student_lessons archive */}"));
const completeClient = client.slice(client.indexOf("export async function completeStudentLesson"), client.indexOf("export async function recordCompletedLesson"));
const completedCard = manager.slice(manager.indexOf("Lesson cards retain their action ownership"), manager.indexOf("// HOMEWORK PANEL"));
const completionRpc = reportMigration.slice(
  reportMigration.indexOf("create or replace function public.admin_record_completed_lesson"),
  reportMigration.indexOf("create or replace function public.admin_save_lesson_completion_report")
);

let passed = 0;
const failed = [];
function check(id, name, condition) {
  if (condition) {
    passed++;
    console.log(`  PASS  TEST ${id} — ${name}`);
  } else {
    failed.push(`TEST ${id} — ${name}`);
    console.log(`  FAIL  TEST ${id} — ${name}`);
  }
}

// Fixture-level categorization mirrors the intentionally simple UI rule.
const now = Date.parse("2026-09-10T12:00:00Z");
const lessons = [
  { id: "future", status: "scheduled", lesson_date: "2026-09-11T09:00:00Z", booking_id: "linked" },
  { id: "past", status: "completed", lesson_date: "2026-09-09T09:00:00Z", booking_id: "linked" },
];
const bookings = [
  { id: "linked", status: "completed", starts_at: "2026-09-09T09:00:00Z" },
  { id: "consultation", status: "confirmed", starts_at: "2026-09-12T09:00:00Z" },
  { id: "past-consultation", status: "completed", starts_at: "2026-09-08T09:00:00Z" },
];
const upcomingLessons = lessons.filter((lesson) => lesson.status === "scheduled" && Date.parse(lesson.lesson_date) >= now);
const pastLessons = lessons.filter((lesson) => lesson.status !== "scheduled" || Date.parse(lesson.lesson_date) < now);
const linkedBookingIds = new Set(lessons.map((lesson) => lesson.booking_id).filter(Boolean));
const standaloneBookings = bookings.filter((booking) => !linkedBookingIds.has(booking.id));

console.log("\nLESSON SESSION ARCHIVE AND MAIL COPY");
check("A", "scheduled completion has no teacher-note input or client parameter",
  !/completionNote|Tamamlama \/ Değerlendirme Notu/.test(completionPanel) && !/teacherNote\?:/.test(completeClient) && !/body\.teacherNote/.test(completionEdge));
check("B", "past lesson form has no teacher-note prompt",
  !/pastForm\.teacherNote|Ders notu veya eğitmen geri bildirimi/.test(manager));
check("C", "planning header is action-only and has no lesson count",
  /Ders Yönetimi\s*</.test(manager) && !/Ders Planlama ve Geçmiş/.test(manager));
check("D", "canonical scheduled and completed lessons classify correctly",
  upcomingLessons.length === 1 && upcomingLessons[0].id === "future" && pastLessons.length === 1 && pastLessons[0].id === "past");
check("E", "linked booking and lesson records are deduplicated",
  standaloneBookings.length === 2 && !standaloneBookings.some((booking) => booking.id === "linked") && /linkedBookingIds/.test(detail));
check("F", "upcoming and archive counts are sourced from rendered collections",
  /Yaklaşan Seanslar \(\{upcomingSessions\.length\}\)/.test(detail) && /Yapılan Dersler \(\{pastSessions\.length\}\)/.test(detail));
check("G", "upcoming is oldest-first and archive is newest-first",
  /a\.lesson_date\.localeCompare\(b\.lesson_date\)/.test(manager) && /b\.lesson_date\.localeCompare\(a\.lesson_date\)/.test(manager));
check("H", "completed archive report editor is collapsed by default",
  /Detayı \/ Raporu Aç/.test(completedCard) && /expandedReports\.has\(l\.id\) && <>/.test(completedCard));
check("I", "archive retains save, send, edit, and resend actions",
  /Raporu Kaydet/.test(completedCard) && /Raporu Kaydet ve Bildirimi Gönder/.test(completedCard) && /Güncellenmiş Raporu Tekrar Gönder/.test(completedCard));
check("J", "report state compares delivery and current report versions",
  /dedupe_key\?\.match\(\/:v\(\\d\+\)\$\//.test(manager) && /deliveryVersion < currentVersion/.test(manager));
check("K", "queue, processing, sent date, and failure labels are explicit",
  /"Kuyrukta"/.test(manager) && /"Gönderiliyor"/.test(manager) && /`Gönderildi —/.test(manager) && /"Gönderilemedi"/.test(manager));
check("L", "completed UI never renders historical teacher_note",
  /isScheduled && l\.teacher_note/.test(completedCard) && !/isCompleted && l\.teacher_note/.test(completedCard));
check("M", "MAIL-027 formats date and time in the stored IANA timezone",
  /safeLessonTimezone\(p\.lesson_timezone\)/.test(outbox) && /formatLessonDate\(p\.lesson_date/.test(outbox) && /formatLessonTime\(p\.lesson_date/.test(outbox));
check("N", "missing student names use generic copy without repeating guardian",
  /const studentName = String\(p\.student_name \|\| p\.learner_name \|\| ""\)/.test(outbox) && /Öğrencimizin tamamlanan/.test(outbox));
check("O", "Turkish balance section uses the revised customer terminology",
  /GÜNCEL DERS BAKİYESİ/.test(outbox) && /Güncel Ders Bakiyesi/.test(outbox) && !/Kalan Ders Hakkınız/.test(outbox.slice(outbox.indexOf("\/\/ MAIL-027:"), outbox.indexOf("lesson_remaining_rights_account_holder"))));
check("P", "one-lesson and zero-balance copy is concise",
  /Güncel ders bakiyeniz 1 derstir\./.test(outbox) && /Güncel ders bakiyeniz sıfırdır\./.test(outbox));
check("Q", "zero-right MAIL-027 still selects the renewal CTA",
  /row\.template === "lesson_completed_account_holder"/.test(outbox) && /Ders Haklarını Yenile/.test(outbox));
check("R", "MAIL-040 remains absent from automatic completion",
  !/enqueue_email_notification/.test(completionRpc) && !/lesson_remaining_rights_account_holder/.test(completeClient));
check("S", "one lesson plus one standalone booking yields upcoming count two",
  upcomingLessons.length + standaloneBookings.filter((booking) => !["completed", "cancelled", "no_show"].includes(booking.status)).length === 2);
check("T", "one lesson plus one standalone booking yields past count two",
  pastLessons.length + standaloneBookings.filter((booking) => ["completed", "cancelled", "no_show"].includes(booking.status)).length === 2);
check("U", "session headings render exactly once and the standalone section is gone",
  (detail.match(/Yaklaşan Seanslar \(\{upcomingSessions\.length\}\)/g) || []).length === 1 &&
  (detail.match(/Yapılan Dersler \(\{pastSessions\.length\}\)/g) || []).length === 1 &&
  !/Bağımsız Randevular/.test(detail));
check("V", "normalized types and both action families remain reachable",
  /type: "lesson" as const/.test(manager) && /type: "booking"/.test(detail) &&
  /Detayı \/ Raporu Aç/.test(manager) && /onOpenReschedule\(b\)/.test(detail) && /sendManualEmail/.test(detail));

console.log(`\n${passed} passed, ${failed.length} failed`);
if (failed.length) {
  failed.forEach((item) => console.log("  - " + item));
  process.exit(1);
}
console.log("LESSON SESSION ARCHIVE AND MAIL COPY: PASS");
