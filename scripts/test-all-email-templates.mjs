import fs from "fs";
import path from "path";
import assert from "assert";

// Load templates TypeScript file via tsx runner or dynamic transpilation
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
  renderStudentPackagePurchasedEmail,
  renderStudentPaymentSuccessEmail,
  renderStudentBankTransferPendingEmail,
  renderStudentPaymentReminderEmail,
  renderStudentBankTransferApprovedEmail,
  renderAdminPaymentNotificationEmail,
  renderStudentPackageActivatedEmail,
  renderStudentPackageLowBalanceEmail,
  renderStudentPackageCompletedEmail,
  renderStudentPackageRenewalEmail,
  renderStudentHomeworkAssignedEmail,
  renderStudentHomeworkDueReminderEmail,
  renderTeacherHomeworkSubmittedEmail,
  renderStudentHomeworkReviewedEmail,
  renderStudentWelcomeEmail,
  renderAccountPasswordRecoveryEmail,
  renderAccountSecurityAlertEmail,
  renderStudentLiveLessonLinkEmail,
  renderStudentLessonCompletedEmail,
} from "../supabase/functions/_shared/email/templates.ts";

const TARGET_EMAIL = "info@oriens-academy.com";
const nowIso = new Date().toISOString();

async function runEmailTestSuite() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — 26 TRANSACTIONAL EMAIL TEMPLATES TEST");
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
  testTemplate("10", "C. Paket / Ödeme", "Öğrenci Paket Siparişi Alındı",
    () => renderStudentPackagePurchasedEmail({ orderReference: "ORD-2026-001", studentName: "Canan Şahin", studentEmail: TARGET_EMAIL, packageName: "10 Derslik Paket (IB / AP / SAT)", lessonCount: 10, pricePerLesson: 2500, totalAmount: 25000, currency: "TRY", paymentMethod: "card", createdAt: nowIso, locale: "tr" }),
    () => renderStudentPackagePurchasedEmail({ orderReference: "ORD-2026-001", studentName: "Canan Sahin", studentEmail: TARGET_EMAIL, packageName: "10-Lesson Package (IB / AP / SAT)", lessonCount: 10, pricePerLesson: 2500, totalAmount: 25000, currency: "TRY", paymentMethod: "card", createdAt: nowIso, locale: "en" })
  );

  testTemplate("11", "C. Paket / Ödeme", "Öğrenci Ödeme Başarılı",
    () => renderStudentPaymentSuccessEmail({ paymentReference: "PAY-2026-001", studentName: "Canan Şahin", studentEmail: TARGET_EMAIL, packageName: "10 Derslik Paket", amountPaid: 25000, currency: "TRY", paymentMethod: "Kredi Kartı (3D Secure)", paidAt: nowIso, locale: "tr" }),
    () => renderStudentPaymentSuccessEmail({ paymentReference: "PAY-2026-001", studentName: "Canan Sahin", studentEmail: TARGET_EMAIL, packageName: "10-Lesson Package", amountPaid: 25000, currency: "TRY", paymentMethod: "Credit Card (3D Secure)", paidAt: nowIso, locale: "en" })
  );

  testTemplate("12", "C. Paket / Ödeme", "Öğrenci Banka Havalesi Talimatı",
    () => renderStudentBankTransferPendingEmail({ paymentReference: "TX-789012", studentName: "Canan Şahin", studentEmail: TARGET_EMAIL, packageName: "10 Derslik Paket", amount: 25000, currency: "TRY", bankName: "Garanti BBVA", iban: "TR12 0006 2000 0000 0000 0000 00", accountHolder: "Oriens Danışmanlık ve Eğitim Ltd. Şti.", locale: "tr" }),
    () => renderStudentBankTransferPendingEmail({ paymentReference: "TX-789012", studentName: "Canan Sahin", studentEmail: TARGET_EMAIL, packageName: "10-Lesson Package", amount: 25000, currency: "TRY", bankName: "Garanti BBVA", iban: "TR12 0006 2000 0000 0000 0000 00", accountHolder: "Oriens Consultancy", locale: "en" })
  );

  testTemplate("13", "C. Paket / Ödeme", "Öğrenci Ödeme Hatırlatması",
    () => renderStudentPaymentReminderEmail({ paymentReference: "TX-789012", studentName: "Canan Şahin", studentEmail: TARGET_EMAIL, packageName: "10 Derslik Paket", amount: 25000, currency: "TRY", bankName: "Garanti BBVA", iban: "TR12 0006 2000 0000 0000 0000 00", accountHolder: "Oriens Danışmanlık", reminderCount: 1, locale: "tr" }),
    () => renderStudentPaymentReminderEmail({ paymentReference: "TX-789012", studentName: "Canan Sahin", studentEmail: TARGET_EMAIL, packageName: "10-Lesson Package", amount: 25000, currency: "TRY", bankName: "Garanti BBVA", iban: "TR12 0006 2000 0000 0000 0000 00", accountHolder: "Oriens Consultancy", reminderCount: 1, locale: "en" })
  );

  testTemplate("14", "C. Paket / Ödeme", "Öğrenci Havale Ödeme Onaylandı",
    () => renderStudentBankTransferApprovedEmail({ paymentReference: "TX-789012", studentName: "Canan Şahin", studentEmail: TARGET_EMAIL, packageName: "10 Derslik Paket", totalLessons: 10, amountPaid: 25000, currency: "TRY", locale: "tr" }),
    () => renderStudentBankTransferApprovedEmail({ paymentReference: "TX-789012", studentName: "Canan Sahin", studentEmail: TARGET_EMAIL, packageName: "10-Lesson Package", totalLessons: 10, amountPaid: 25000, currency: "TRY", locale: "en" })
  );

  testTemplate("15", "C. Paket / Ödeme", "Admin Yeni Ödeme Bildirimi",
    () => renderAdminPaymentNotificationEmail({ paymentReference: "PAY-2026-001", payerName: "Canan Şahin", payerEmail: TARGET_EMAIL, payerPhone: "+90 555 987 65 43", packageName: "10 Derslik Paket", amount: 25000, currency: "TRY", paymentMethod: "card", status: "paid", createdAt: nowIso }, "tr"),
    () => renderAdminPaymentNotificationEmail({ paymentReference: "PAY-2026-001", payerName: "Canan Sahin", payerEmail: TARGET_EMAIL, payerPhone: "+90 555 987 65 43", packageName: "10-Lesson Package", amount: 25000, currency: "TRY", paymentMethod: "card", status: "paid", createdAt: nowIso }, "en")
  );

  testTemplate("16", "C. Paket / Ödeme", "Öğrenci Paket Aktif Edildi",
    () => renderStudentPackageActivatedEmail({ studentName: "Canan Şahin", studentEmail: TARGET_EMAIL, packageName: "10 Derslik Paket", totalLessons: 10, locale: "tr" }),
    () => renderStudentPackageActivatedEmail({ studentName: "Canan Sahin", studentEmail: TARGET_EMAIL, packageName: "10-Lesson Package", totalLessons: 10, locale: "en" })
  );

  testTemplate("17", "C. Paket / Ödeme", "Öğrenci Paket Bitmek Üzere",
    () => renderStudentPackageLowBalanceEmail({ studentName: "Canan Şahin", studentEmail: TARGET_EMAIL, packageName: "10 Derslik Paket", totalLessons: 10, lessonsUsed: 9, lessonsRemaining: 1, locale: "tr" }),
    () => renderStudentPackageLowBalanceEmail({ studentName: "Canan Sahin", studentEmail: TARGET_EMAIL, packageName: "10-Lesson Package", totalLessons: 10, lessonsUsed: 9, lessonsRemaining: 1, locale: "en" })
  );

  testTemplate("18", "C. Paket / Ödeme", "Öğrenci Paket Tamamlandı",
    () => renderStudentPackageCompletedEmail({ studentName: "Canan Şahin", studentEmail: TARGET_EMAIL, packageName: "10 Derslik Paket", totalLessons: 10, lessonsUsed: 10, lessonsRemaining: 0, locale: "tr" }),
    () => renderStudentPackageCompletedEmail({ studentName: "Canan Sahin", studentEmail: TARGET_EMAIL, packageName: "10-Lesson Package", totalLessons: 10, lessonsUsed: 10, lessonsRemaining: 0, locale: "en" })
  );

  testTemplate("19", "C. Paket / Ödeme", "Öğrenci Paket Yenileme Önerisi",
    () => renderStudentPackageRenewalEmail({ studentName: "Canan Şahin", studentEmail: TARGET_EMAIL, packageName: "10 Derslik Paket", totalLessons: 10, recommendedPackageName: "20 Derslik İleri Düzey Sınav Paketi", recommendedPackageUrl: "https://oriens-academy.com/tr/fiyatlandirma", locale: "tr" }),
    () => renderStudentPackageRenewalEmail({ studentName: "Canan Sahin", studentEmail: TARGET_EMAIL, packageName: "10-Lesson Package", totalLessons: 10, recommendedPackageName: "20-Lesson Advanced Exam Package", recommendedPackageUrl: "https://oriens-academy.com/en/pricing", locale: "en" })
  );

  // 4. Homework & Academic Tracking
  testTemplate("20", "D. Ödev & Akademik", "Öğrenci Yeni Ödev Atandı",
    () => renderStudentHomeworkAssignedEmail({ homeworkId: "hw-1", studentName: "Kaan Kurt", studentEmail: TARGET_EMAIL, assignmentTitle: "AP Physics C: Mechanics Work & Energy Set 4", subjectOrLesson: "AP Physics C", dueDate: "2026-08-30T21:00:00Z", description: "Lütfen 1'den 12'ye kadar olan soruları çözüp çözümlerinizi portala yükleyiniz.", locale: "tr" }),
    () => renderStudentHomeworkAssignedEmail({ homeworkId: "hw-1", studentName: "Kaan Kurt", studentEmail: TARGET_EMAIL, assignmentTitle: "AP Physics C: Mechanics Work & Energy Set 4", subjectOrLesson: "AP Physics C", dueDate: "2026-08-30T21:00:00Z", description: "Please complete problems 1 through 12 and submit via the portal.", locale: "en" })
  );

  testTemplate("21", "D. Ödev & Akademik", "Öğrenci Ödev Teslim Tarihi Yaklaşıyor",
    () => renderStudentHomeworkDueReminderEmail({ homeworkId: "hw-1", studentName: "Kaan Kurt", studentEmail: TARGET_EMAIL, assignmentTitle: "AP Physics C: Mechanics Work & Energy Set 4", subjectOrLesson: "AP Physics C", dueDate: "2026-08-30T21:00:00Z", locale: "tr" }),
    () => renderStudentHomeworkDueReminderEmail({ homeworkId: "hw-1", studentName: "Kaan Kurt", studentEmail: TARGET_EMAIL, assignmentTitle: "AP Physics C: Mechanics Work & Energy Set 4", subjectOrLesson: "AP Physics C", dueDate: "2026-08-30T21:00:00Z", locale: "en" })
  );

  testTemplate("22", "D. Ödev & Akademik", "Öğretmen Ödev Teslim Edildi",
    () => renderTeacherHomeworkSubmittedEmail({ homeworkId: "hw-1", studentName: "Kaan Kurt", studentEmail: TARGET_EMAIL, assignmentTitle: "AP Physics C Set 4", subjectOrLesson: "AP Physics C", dueDate: "2026-08-30T21:00:00Z", submissionText: "Tüm sorular çözüldü, ek dosya ektedir.", submittedAt: nowIso, locale: "tr" }, "tr"),
    () => renderTeacherHomeworkSubmittedEmail({ homeworkId: "hw-1", studentName: "Kaan Kurt", studentEmail: TARGET_EMAIL, assignmentTitle: "AP Physics C Set 4", subjectOrLesson: "AP Physics C", dueDate: "2026-08-30T21:00:00Z", submissionText: "All problems solved.", submittedAt: nowIso, locale: "en" }, "en")
  );

  testTemplate("23", "D. Ödev & Akademik", "Öğrenci Ödev Geri Bildirimi",
    () => renderStudentHomeworkReviewedEmail({ homeworkId: "hw-1", studentName: "Kaan Kurt", studentEmail: TARGET_EMAIL, assignmentTitle: "AP Physics C Set 4", subjectOrLesson: "AP Physics C", dueDate: "2026-08-30T21:00:00Z", teacherFeedback: "Tebrikler! Enerji korunumu yaklaşımınız çok başarılı. Soru 7'deki sürtünme katsayısı entegrasyonunu derste detaylandıracağız.", locale: "tr" }),
    () => renderStudentHomeworkReviewedEmail({ homeworkId: "hw-1", studentName: "Kaan Kurt", studentEmail: TARGET_EMAIL, assignmentTitle: "AP Physics C Set 4", subjectOrLesson: "AP Physics C", dueDate: "2026-08-30T21:00:00Z", teacherFeedback: "Great work on conservation of energy! We will review Problem 7 together in our next session.", locale: "en" })
  );

  // 5. Account & Security
  testTemplate("24", "E. Hesap & Güvenlik", "Öğrenci Hoş Geldiniz",
    () => renderStudentWelcomeEmail({ studentName: "Mert Ömeroğlu", studentEmail: TARGET_EMAIL, temporaryPassword: "Oriens-2026-Secure!", locale: "tr" }),
    () => renderStudentWelcomeEmail({ studentName: "Mert Omeroglu", studentEmail: TARGET_EMAIL, temporaryPassword: "Oriens-2026-Secure!", locale: "en" })
  );

  testTemplate("25", "E. Hesap & Güvenlik", "Kullanıcı Şifre Sıfırlama",
    () => renderAccountPasswordRecoveryEmail(TARGET_EMAIL, "TEMP-PASS-2026-XYZ", "tr"),
    () => renderAccountPasswordRecoveryEmail(TARGET_EMAIL, "TEMP-PASS-2026-XYZ", "en")
  );

  testTemplate("26", "E. Hesap & Güvenlik", "Kullanıcı Güvenlik Bildirimi",
    () => renderAccountSecurityAlertEmail({ studentEmail: TARGET_EMAIL, actionTitle: "Hesap Şifresi Güncellendi", actionDescription: "Öğrenci portalı giriş şifreniz başarıyla değiştirildi.", timestamp: nowIso, device: "Chrome / Windows 11", ipAddress: "88.255.120.45", locale: "tr" }),
    () => renderAccountSecurityAlertEmail({ studentEmail: TARGET_EMAIL, actionTitle: "Password Updated", actionDescription: "Your account password was successfully updated.", timestamp: nowIso, device: "Chrome / Windows 11", ipAddress: "88.255.120.45", locale: "en" })
  );

  // 6. Live Lessons & Tracking
  testTemplate("27", "F. Canlı Ders & Takip", "Canlı Ders Bağlantısı",
    () => renderStudentLiveLessonLinkEmail({ lessonId: "lsn-1", studentName: "Ece Yılmaz", studentEmail: TARGET_EMAIL, lessonTitle: "Birebir SAT Matematik Dersi", subject: "Matematik", examCode: "SAT", lessonDate: "2026-08-28T16:00:00Z", durationMinutes: 60, liveMeetingUrl: "https://meet.google.com/abc-defg-hij", teacherName: "Dr. Selin Demir", teacherNote: "Derse başlamadan önce Deneme 3 çözümlerinizi hazır bulundurunuz.", locale: "tr" }),
    () => renderStudentLiveLessonLinkEmail({ lessonId: "lsn-1", studentName: "Ece Yilmaz", studentEmail: TARGET_EMAIL, lessonTitle: "1-on-1 SAT Math Session", subject: "Mathematics", examCode: "SAT", lessonDate: "2026-08-28T16:00:00Z", durationMinutes: 60, liveMeetingUrl: "https://meet.google.com/abc-defg-hij", teacherName: "Dr. Selin Demir", teacherNote: "Please prepare your Practice Test 3 answers before the session.", locale: "en" })
  );

  testTemplate("28", "F. Canlı Ders & Takip", "Ders Tamamlandı & Kalan Ders",
    () => renderStudentLessonCompletedEmail({ lessonId: "lsn-1", studentName: "Ece Yılmaz", studentEmail: TARGET_EMAIL, lessonTitle: "Birebir SAT Matematik Dersi", subject: "Matematik", lessonDate: "2026-08-28T16:00:00Z", packageName: "10 Derslik SAT Hazırlık Paketi", remainingLessons: 7, totalLessons: 10, teacherNote: "Fonksiyon grafikleri ve trigonometrik oranlar üzerinde çalışıldı.", locale: "tr" }),
    () => renderStudentLessonCompletedEmail({ lessonId: "lsn-1", studentName: "Ece Yilmaz", studentEmail: TARGET_EMAIL, lessonTitle: "1-on-1 SAT Math Session", subject: "Mathematics", lessonDate: "2026-08-28T16:00:00Z", packageName: "10-Lesson SAT Prep Package", remainingLessons: 7, totalLessons: 10, teacherNote: "Reviewed function graphs and trigonometric ratios.", locale: "en" })
  );

  console.table(results.map(r => ({ "#": r.id, Category: r.category, Name: r.name, "TR Subject": r.trSubject, "EN Subject": r.enSubject, Status: "PASS" })));

  const scratchDir = path.resolve("C:\\Users\\merto\\.gemini\\antigravity-ide\\brain\\6aba360d-498b-4240-a412-57970e1f8bea\\scratch");
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
  fs.writeFileSync(path.join(scratchDir, "email_all_26_templates_preview.html"), `
    <!DOCTYPE html><html><head><meta charset="utf-8"><title>Oriens Academy 26 Transactional Email Previews</title></head>
    <body style="background:#eef2ee;margin:0;padding:20px;">
      <h1 style="text-align:center;font-family:sans-serif;color:#10271B;">Oriens Academy &mdash; 26 Transactional Email Templates Preview</h1>
      ${htmlPreviews.join("\n")}
    </body></html>
  `, "utf8");
  console.log("\n[PREVIEW GENERATED]: file:///C:/Users/merto/.gemini/antigravity-ide/brain/6aba360d-498b-4240-a412-57970e1f8bea/scratch/email_all_26_templates_preview.html");
}

runEmailTestSuite().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
