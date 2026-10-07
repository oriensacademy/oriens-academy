import fs from "fs";
import path from "path";
import assert from "assert";

// Çalıştırma: npx tsx scripts/test-all-email-templates.mjs
// f454507 ile kaldırılan eski 16 şablon (ödev, paket, eski ödeme, güvenlik
// uyarısı, eski ders tamamlandı) bu listeden çıkarıldı; güncel katalog
// test-all-email-types.mjs / test-production-email-reconciliation.mjs'de.
import {
  renderAdminBookingEmail,
  renderStudentBookingEmail,
  renderAdminContactEmail,
  renderStudentContactEmail,
  renderStudentAppointmentConfirmedEmail,
  renderAdminAppointmentCreatedEmail,
  renderStudentAppointmentUpdatedEmail,
  renderStudentAppointmentCancelledEmail,
  renderStudentAppointmentReminderEmail,
  renderStudentWelcomeEmail,
  renderAccountPasswordRecoveryEmail,
  renderStudentLiveLessonLinkEmail,
} from "../supabase/functions/_shared/email/templates.ts";

const TARGET_EMAIL = "info@oriens-academy.com";
const nowIso = new Date().toISOString();

async function runEmailTestSuite() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — TRANSACTIONAL EMAIL TEMPLATES TEST");
  console.log("==================================================\n");

  const results = [];
  const htmlPreviews = [];

  function testTemplate(id, category, name, fnTr, fnEn) {
    const tr = fnTr();
    const en = fnEn();

    // Assertions
    assert(tr.subject && tr.subject.length > 5, `TR subject missing for ${id}`);
    assert(en.subject && en.subject.length > 5, `EN subject missing for ${id}`);
    assert(tr.html.includes("<!DOCTYPE html>"), `TR html doctype missing for ${id}`);
    assert(en.html.includes("<!DOCTYPE html>"), `EN html doctype missing for ${id}`);
    assert(tr.text && tr.text.length > 10, `TR text missing for ${id}`);
    assert(en.text && en.text.length > 10, `EN text missing for ${id}`);

    // Verify raw divider line removal
    assert(!tr.html.includes("border-bottom:1px solid #DDE5DC"), `Found raw divider line in TR ${id}`);
    assert(!en.html.includes("border-bottom:1px solid #DDE5DC"), `Found raw divider line in EN ${id}`);

    results.push({ id, category, name, trSubject: tr.subject, enSubject: en.subject, passed: true });
    htmlPreviews.push(`
      <div style="margin:40px auto;max-width:650px;border:1px solid #ccc;border-radius:12px;overflow:hidden;">
        <div style="background:#10271B;color:#fff;padding:12px 18px;font-family:sans-serif;font-weight:bold;">
          [${category}] ${id}. ${name} &mdash; ${tr.subject}
        </div>
        <div>${tr.html}</div>
      </div>`);
  }

  // 1. Consultation & Contact
  testTemplate("1", "A. Görüşme / İletişim", "Admin Görüşme Talebi",
    () => renderAdminBookingEmail({ bookingId: "book-1", fullName: "Zeynep Kaya", email: TARGET_EMAIL, phone: "+90 555 123 45 67", supportType: "exam_preparation", examCode: "SAT", startsAt: nowIso, locale: "tr", notes: "SAT Sayısal ve Reading çalışma planı", status: "pending" }, "tr"),
    () => renderAdminBookingEmail({ bookingId: "book-1", fullName: "Zeynep Kaya", email: TARGET_EMAIL, phone: "+90 555 123 45 67", supportType: "exam_preparation", examCode: "SAT", startsAt: nowIso, locale: "en", notes: "SAT Math and Reading plan", status: "pending" }, "en")
  );

  testTemplate("2", "A. Görüşme / İletişim", "Öğrenci Görüşme Talebi Alındı",
    () => renderStudentBookingEmail({ bookingId: "book-1", fullName: "Zeynep Kaya", email: TARGET_EMAIL, supportType: "exam_preparation", examCode: "SAT", startsAt: nowIso, locale: "tr", status: "pending" }),
    () => renderStudentBookingEmail({ bookingId: "book-1", fullName: "Zeynep Kaya", email: TARGET_EMAIL, supportType: "exam_preparation", examCode: "SAT", startsAt: nowIso, locale: "en", status: "pending" })
  );

  testTemplate("3", "A. Görüşme / İletişim", "Admin İletişim Formu Talebi",
    () => renderAdminContactEmail({ contactId: "c-1", fullName: "Emre Demir", email: TARGET_EMAIL, phone: "+90 532 000 00 00", subject: "IB Matematik HL Desteği", message: "IB Matematik HL sınavı için 10 derslik paket hakkında bilgi almak istiyorum.", locale: "tr", createdAt: nowIso, source: "contact_form", package: { id: "p10", name: "10 Derslik Paket", price: 25000, currency: "TRY", lessons: 10 } }, "tr"),
    () => renderAdminContactEmail({ contactId: "c-1", fullName: "Emre Demir", email: TARGET_EMAIL, phone: "+90 532 000 00 00", subject: "IB Math HL Support", message: "Inquiry about 10-lesson IB Math HL package.", locale: "en", createdAt: nowIso, source: "contact_form", package: { id: "p10", name: "10-Lesson Package", price: 25000, currency: "TRY", lessons: 10 } }, "en")
  );

  testTemplate("4", "A. Görüşme / İletişim", "Öğrenci İletişim Talebi Alındı",
    () => renderStudentContactEmail({ contactId: "c-1", fullName: "Emre Demir", email: TARGET_EMAIL, subject: "IB Matematik HL", message: "Mesaj alındı.", locale: "tr", createdAt: nowIso, source: "contact_form" }),
    () => renderStudentContactEmail({ contactId: "c-1", fullName: "Emre Demir", email: TARGET_EMAIL, subject: "IB Math HL", message: "Message received.", locale: "en", createdAt: nowIso, source: "contact_form" })
  );

  // 2. Appointments
  testTemplate("5", "B. Randevu", "Öğrenci Randevu Onaylandı",
    () => renderStudentAppointmentConfirmedEmail({ appointmentId: "apt-1", studentName: "Ali Yılmaz", studentEmail: TARGET_EMAIL, teacherName: "Dr. Selin Arslan", lessonTitle: "SAT Math: Advanced Trigonometry", startsAt: nowIso, locationOrMeetingUrl: "https://meet.google.com/abc-defg-hij", notes: "Önceki deneme soruları üzerinden gidilecektir.", locale: "tr" }),
    () => renderStudentAppointmentConfirmedEmail({ appointmentId: "apt-1", studentName: "Ali Yilmaz", studentEmail: TARGET_EMAIL, teacherName: "Dr. Selin Arslan", lessonTitle: "SAT Math: Advanced Trigonometry", startsAt: nowIso, locationOrMeetingUrl: "https://meet.google.com/abc-defg-hij", notes: "We will review previous mock questions.", locale: "en" })
  );

  testTemplate("6", "B. Randevu", "Admin Randevu Oluşturuldu",
    () => renderAdminAppointmentCreatedEmail({ appointmentId: "apt-1", studentName: "Ali Yılmaz", studentEmail: TARGET_EMAIL, teacherName: "Dr. Selin Arslan", lessonTitle: "SAT Math: Advanced Trigonometry", startsAt: nowIso, locale: "tr" }, "tr"),
    () => renderAdminAppointmentCreatedEmail({ appointmentId: "apt-1", studentName: "Ali Yilmaz", studentEmail: TARGET_EMAIL, teacherName: "Dr. Selin Arslan", lessonTitle: "SAT Math: Advanced Trigonometry", startsAt: nowIso, locale: "en" }, "en")
  );

  testTemplate("7", "B. Randevu", "Öğrenci Randevu Güncellendi",
    () => renderStudentAppointmentUpdatedEmail({ appointmentId: "apt-1", studentName: "Ali Yılmaz", studentEmail: TARGET_EMAIL, teacherName: "Dr. Selin Arslan", lessonTitle: "SAT Math", startsAt: nowIso, previousStartsAt: "2026-08-24T10:00:00Z", notes: "Öğrenci talebi doğrultusunda saat kaydırıldı.", locale: "tr" }),
    () => renderStudentAppointmentUpdatedEmail({ appointmentId: "apt-1", studentName: "Ali Yilmaz", studentEmail: TARGET_EMAIL, teacherName: "Dr. Selin Arslan", lessonTitle: "SAT Math", startsAt: nowIso, previousStartsAt: "2026-08-24T10:00:00Z", notes: "Rescheduled as requested.", locale: "en" })
  );

  testTemplate("8", "B. Randevu", "Öğrenci Randevu İptal Edildi",
    () => renderStudentAppointmentCancelledEmail({ appointmentId: "apt-1", studentName: "Ali Yılmaz", studentEmail: TARGET_EMAIL, lessonTitle: "SAT Math", startsAt: nowIso, cancellationReason: "Öğrenci rahatsızlığı sebebiyle iptal edildi.", locale: "tr" }),
    () => renderStudentAppointmentCancelledEmail({ appointmentId: "apt-1", studentName: "Ali Yilmaz", studentEmail: TARGET_EMAIL, lessonTitle: "SAT Math", startsAt: nowIso, cancellationReason: "Cancelled due to student illness.", locale: "en" })
  );

  testTemplate("9", "B. Randevu", "Öğrenci Randevu Hatırlatması",
    () => renderStudentAppointmentReminderEmail({ appointmentId: "apt-1", studentName: "Ali Yılmaz", studentEmail: TARGET_EMAIL, teacherName: "Dr. Selin Arslan", lessonTitle: "SAT Math", startsAt: nowIso, locationOrMeetingUrl: "https://meet.google.com/abc-defg-hij", locale: "tr" }),
    () => renderStudentAppointmentReminderEmail({ appointmentId: "apt-1", studentName: "Ali Yilmaz", studentEmail: TARGET_EMAIL, teacherName: "Dr. Selin Arslan", lessonTitle: "SAT Math", startsAt: nowIso, locationOrMeetingUrl: "https://meet.google.com/abc-defg-hij", locale: "en" })
  );

  // 3. Packages & Payments

  // 4. Homework & Academic Tracking

  // 5. Account & Security
  testTemplate("24", "E. Hesap & Güvenlik", "Öğrenci Hoş Geldiniz",
    () => renderStudentWelcomeEmail({ studentName: "Mert Ömeroğlu", studentEmail: TARGET_EMAIL, temporaryPassword: "Oriens-2026-Secure!", locale: "tr" }),
    () => renderStudentWelcomeEmail({ studentName: "Mert Omeroglu", studentEmail: TARGET_EMAIL, temporaryPassword: "Oriens-2026-Secure!", locale: "en" })
  );

  testTemplate("25", "E. Hesap & Güvenlik", "Kullanıcı Şifre Sıfırlama",
    () => renderAccountPasswordRecoveryEmail(TARGET_EMAIL, "TEMP-PASS-2026-XYZ", "tr"),
    () => renderAccountPasswordRecoveryEmail(TARGET_EMAIL, "TEMP-PASS-2026-XYZ", "en")
  );

  // 6. Live Lessons & Tracking
  testTemplate("27", "F. Canlı Ders & Takip", "Canlı Ders Bağlantısı",
    () => renderStudentLiveLessonLinkEmail({ lessonId: "lsn-1", studentName: "Ece Yılmaz", studentEmail: TARGET_EMAIL, lessonTitle: "Birebir SAT Matematik Dersi", subject: "Matematik", examCode: "SAT", lessonDate: "2026-08-28T16:00:00Z", durationMinutes: 60, liveMeetingUrl: "https://meet.google.com/abc-defg-hij", teacherName: "Dr. Selin Demir", teacherNote: "Derse başlamadan önce Deneme 3 çözümlerinizi hazır bulundurunuz.", locale: "tr" }),
    () => renderStudentLiveLessonLinkEmail({ lessonId: "lsn-1", studentName: "Ece Yilmaz", studentEmail: TARGET_EMAIL, lessonTitle: "1-on-1 SAT Math Session", subject: "Mathematics", examCode: "SAT", lessonDate: "2026-08-28T16:00:00Z", durationMinutes: 60, liveMeetingUrl: "https://meet.google.com/abc-defg-hij", teacherName: "Dr. Selin Demir", teacherNote: "Please prepare your Practice Test 3 answers before the session.", locale: "en" })
  );

  console.table(results.map(r => ({ "#": r.id, Category: r.category, Name: r.name, "TR Subject": r.trSubject, "EN Subject": r.enSubject, Status: "PASS" })));

  // Önizleme isteğe bağlı: EMAIL_PREVIEW_DIR verilirse yazılır.
  const scratchDir = process.env.EMAIL_PREVIEW_DIR;
  if (scratchDir) {
    if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
    const previewFile = path.join(scratchDir, "email_templates_preview.html");
    fs.writeFileSync(previewFile, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Oriens Academy Email Previews</title></head><body style="background:#eef2ee;margin:0;padding:20px;">${htmlPreviews.join(String.fromCharCode(10))}</body></html>`, "utf8");
    console.log(`[PREVIEW GENERATED]: ${previewFile}`);
  }
  console.log(`${results.length} templates PASS`);
}

runEmailTestSuite().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
