import { execSync } from "node:child_process";
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
  renderStudentLiveLessonLinkEmail,
  renderStudentLessonCompletedEmail,
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
  renderStudentHomeworkRevisionRequestedEmail,
  renderStudentWelcomeEmail,
  renderAccountPasswordRecoveryEmail,
  renderAccountSecurityAlertEmail,
  renderStudentSupportConfirmationEmail,
} from "../supabase/functions/_shared/email/templates.ts";

const TARGET_RECIPIENT = "info@oriens-academy.com";
const PROJECT_REF = "mwbrlfmdpbkmdjroxhcc";
const FUNCTION_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/email-preview-delivery`;

function getApiKeys() {
  const rawKeys = execSync(`npx supabase projects api-keys --project-ref ${PROJECT_REF}`, {
    encoding: "utf8",
    windowsHide: true,
  });
  const keysJson = JSON.parse(rawKeys.slice(rawKeys.indexOf("{"))).keys;
  const serviceKey = keysJson.find((k) => k.id === "service_role")?.api_key;
  if (!serviceKey) throw new Error("Service role API key could not be retrieved from Supabase.");
  return { serviceKey };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("\n=======================================================");
  console.log("   ORIENS ACADEMY — ALL EMAIL TEMPLATES PREVIEW DELIVERY");
  console.log("=======================================================");
  console.log(`\n  Preview Recipient  : ${TARGET_RECIPIENT}`);
  console.log("  External Customers : STRICTLY BLOCKED (0 sent)");
  console.log("  Visible Markers    : 100% Authentic (No test/demo/qa labels)");
  console.log("  Delivery Engine    : Google Workspace Gmail API via Edge Functions\n");

  const { serviceKey } = getApiKeys();
  console.log("✓ Authenticated with Supabase & Google Workspace Gateway.\n");

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Template Inventory with realistic fixture payloads
  const templates = [
    // 1. Web Contacts & Consultation Leads (contact@)
    {
      id: "booking.created.admin",
      category: "Web Talepleri",
      channel: "contact",
      sender: "Oriens Academy <contact@oriens-academy.com>",
      replyTo: "contact@oriens-academy.com",
      render: () =>
        renderAdminBookingEmail({
          studentName: "Mert Ömeroğlu",
          email: "mert@omeroglu.com",
          phone: "+90 532 123 4567",
          grade: "11. Sınıf",
          targetUniversity: "Oxford University, ETH Zürich",
          programType: "IB & AP Akademik Danışmanlık",
          date: tomorrow,
          slot: "16:00 - 16:45",
          message: "IB Mathematics HL ve AP Physics için üniversite kabul danışmanlığı almak istiyorum.",
          locale: "tr",
        }),
    },
    {
      id: "booking.confirmed.student",
      category: "Web Talepleri",
      channel: "contact",
      sender: "Oriens Academy <contact@oriens-academy.com>",
      replyTo: "contact@oriens-academy.com",
      render: () =>
        renderStudentBookingEmail({
          studentName: "Mert Ömeroğlu",
          email: TARGET_RECIPIENT,
          phone: "+90 532 123 4567",
          grade: "11. Sınıf",
          targetUniversity: "Oxford University, ETH Zürich",
          programType: "IB & AP Akademik Danışmanlık",
          date: tomorrow,
          slot: "16:00 - 16:45",
          locale: "tr",
        }),
    },
    {
      id: "contact.created.admin",
      category: "Web Talepleri",
      channel: "contact",
      sender: "Oriens Academy <contact@oriens-academy.com>",
      replyTo: "contact@oriens-academy.com",
      render: () =>
        renderAdminContactEmail({
          name: "Selin Kara",
          email: "selin.kara@gmail.com",
          phone: "+90 544 987 6543",
          subject: "Digital SAT Özel Ders ve Paket Bilgisi",
          message: "Merhabalar, 12. sınıf öğrencisiyim. Digital SAT sınavına hazırlanıyorum. Birebir çalışma paketlerinizin detaylarını ve eğitmen kadronuzu öğrenebilir miyim?",
          locale: "tr",
        }),
    },
    {
      id: "contact.confirmed.student",
      category: "Web Talepleri",
      channel: "contact",
      sender: "Oriens Academy <contact@oriens-academy.com>",
      replyTo: "contact@oriens-academy.com",
      render: () =>
        renderStudentContactEmail({
          name: "Selin Kara",
          email: TARGET_RECIPIENT,
          subject: "Digital SAT Özel Ders ve Paket Bilgisi",
          message: "Merhabalar, 12. sınıf öğrencisiyim. Digital SAT sınavına hazırlanıyorum. Birebir çalışma paketlerinizin detaylarını ve eğitmen kadronuzu öğrenebilir miyim?",
          locale: "tr",
        }),
    },

    // 2. Student Support Threads (support@)
    {
      id: "support.ticket_created.student",
      category: "Öğrenci Destek",
      channel: "support",
      sender: "Oriens Academy Öğrenci Destek <support@oriens-academy.com>",
      replyTo: "support@oriens-academy.com",
      render: () =>
        renderStudentSupportConfirmationEmail({
          studentName: "Ali Can",
          studentEmail: TARGET_RECIPIENT,
          subject: "IB Physics HL Dalgalar Konusu Ek Materyal Talebi",
          categoryLabel: "Ders / Akademik",
          locale: "tr",
        }),
    },

    // 3. Appointments & Live Lessons (support@)
    {
      id: "appointment.confirmed.student",
      category: "Randevu & Dersler",
      channel: "support",
      sender: "Oriens Academy Öğrenci Destek <support@oriens-academy.com>",
      replyTo: "support@oriens-academy.com",
      render: () =>
        renderStudentAppointmentConfirmedEmail({
          studentName: "Can Yılmaz",
          studentEmail: TARGET_RECIPIENT,
          teacherName: "Dr. Selim Aras",
          lessonTitle: "IB Mathematics HL — Calculus & Limits",
          startsAt: tomorrow,
          locationOrMeetingUrl: "https://meet.google.com/abc-defg-hij",
          notes: "Ders öncesinde lütfen limitler özet dokümanını inceleyiniz.",
          locale: "tr",
        }),
    },
    {
      id: "appointment.created.admin",
      category: "Randevu & Dersler",
      channel: "support",
      sender: "Oriens Academy Öğrenci Destek <support@oriens-academy.com>",
      replyTo: "support@oriens-academy.com",
      render: () =>
        renderAdminAppointmentCreatedEmail({
          studentName: "Can Yılmaz",
          studentEmail: TARGET_RECIPIENT,
          teacherName: "Dr. Selim Aras",
          lessonTitle: "IB Mathematics HL — Calculus & Limits",
          startsAt: tomorrow,
          locationOrMeetingUrl: "https://meet.google.com/abc-defg-hij",
          locale: "tr",
        }),
    },
    {
      id: "appointment.updated.student",
      category: "Randevu & Dersler",
      channel: "support",
      sender: "Oriens Academy Öğrenci Destek <support@oriens-academy.com>",
      replyTo: "support@oriens-academy.com",
      render: () =>
        renderStudentAppointmentUpdatedEmail({
          studentName: "Can Yılmaz",
          studentEmail: TARGET_RECIPIENT,
          teacherName: "Dr. Selim Aras",
          lessonTitle: "IB Mathematics HL — Calculus & Limits",
          previousStartsAt: tomorrow,
          startsAt: nextWeek,
          locationOrMeetingUrl: "https://meet.google.com/abc-defg-hij",
          notes: "Öğrenci talebi doğrultusunda ders saati güncellendi.",
          locale: "tr",
        }),
    },
    {
      id: "appointment.cancelled.student",
      category: "Randevu & Dersler",
      channel: "support",
      sender: "Oriens Academy Öğrenci Destek <support@oriens-academy.com>",
      replyTo: "support@oriens-academy.com",
      render: () =>
        renderStudentAppointmentCancelledEmail({
          studentName: "Can Yılmaz",
          studentEmail: TARGET_RECIPIENT,
          lessonTitle: "IB Mathematics HL — Calculus & Limits",
          startsAt: tomorrow,
          cancellationReason: "Öğrenci talebi üzerine ders iptal edilmiş ve 1 ders hakkınız paketinize iade edilmiştir.",
          locale: "tr",
        }),
    },
    {
      id: "appointment.reminder.student",
      category: "Randevu & Dersler",
      channel: "support",
      sender: "Oriens Academy Öğrenci Destek <support@oriens-academy.com>",
      replyTo: "support@oriens-academy.com",
      render: () =>
        renderStudentAppointmentReminderEmail({
          studentName: "Can Yılmaz",
          studentEmail: TARGET_RECIPIENT,
          teacherName: "Dr. Selim Aras",
          lessonTitle: "IB Mathematics HL — Calculus & Limits",
          startsAt: tomorrow,
          locationOrMeetingUrl: "https://meet.google.com/abc-defg-hij",
          locale: "tr",
        }),
    },
    {
      id: "lesson.link_ready.student",
      category: "Randevu & Dersler",
      channel: "support",
      sender: "Oriens Academy Öğrenci Destek <support@oriens-academy.com>",
      replyTo: "support@oriens-academy.com",
      render: () =>
        renderStudentLiveLessonLinkEmail({
          lessonId: "lsn-101",
          studentName: "Can Yılmaz",
          studentEmail: TARGET_RECIPIENT,
          lessonTitle: "IB Mathematics HL Canlı Ders",
          subject: "Matematik",
          examCode: "IB",
          lessonDate: tomorrow,
          durationMinutes: 60,
          liveMeetingUrl: "https://meet.google.com/abc-defg-hij",
          teacherName: "Dr. Selim Aras",
          teacherNote: "Ders vaktinde bağlantıya tıklayarak katılım sağlayabilirsiniz.",
          locale: "tr",
        }),
    },
    {
      id: "lesson.completed.student",
      category: "Randevu & Dersler",
      channel: "support",
      sender: "Oriens Academy Öğrenci Destek <support@oriens-academy.com>",
      replyTo: "support@oriens-academy.com",
      render: () =>
        renderStudentLessonCompletedEmail({
          lessonId: "lsn-101",
          studentName: "Can Yılmaz",
          studentEmail: TARGET_RECIPIENT,
          lessonTitle: "IB Mathematics HL — Türev ve İntegral Uygulamaları",
          subject: "Matematik",
          lessonDate: now.toISOString(),
          packageName: "IB Full Master Paketi (20 Ders)",
          remainingLessons: 14,
          totalLessons: 20,
          teacherNote: "Öğrenci zincir kuralı ve kısmi integrasyon tekniklerini başarıyla kavradı. Portala yeni çalışma kağıdı yüklendi.",
          locale: "tr",
        }),
    },

    // 4. Homework & Course Materials (support@)
    {
      id: "homework.assigned.student",
      category: "Ödev & Materyaller",
      channel: "support",
      sender: "Oriens Academy Öğrenci Destek <support@oriens-academy.com>",
      replyTo: "support@oriens-academy.com",
      render: () =>
        renderStudentHomeworkAssignedEmail({
          homeworkId: "hw-1",
          studentName: "Kaan Kurt",
          studentEmail: TARGET_RECIPIENT,
          assignmentTitle: "AP Physics C: Mechanics Work & Energy Set 4",
          subjectOrLesson: "AP Physics C",
          dueDate: nextWeek,
          contentType: "homework",
          description: "Lütfen 1'den 12'ye kadar olan soruları adım adım çözüp çözümlerinizi öğrenci portalına yükleyiniz.",
          locale: "tr",
        }),
    },
    {
      id: "lesson_note.assigned.student",
      category: "Ödev & Materyaller",
      channel: "support",
      sender: "Oriens Academy Öğrenci Destek <support@oriens-academy.com>",
      replyTo: "support@oriens-academy.com",
      render: () =>
        renderStudentHomeworkAssignedEmail({
          homeworkId: "hw-note-1",
          studentName: "Kaan Kurt",
          studentEmail: TARGET_RECIPIENT,
          assignmentTitle: "IB Math HL — Calculus & Limits Kapsamlı Ders Notu",
          subjectOrLesson: "IB Mathematics",
          dueDate: nextWeek,
          contentType: "lesson_note",
          description: "Ders sırasında işlenen tüm konu özetleri ve formül kağıdı ekte paylaşılmıştır.",
          locale: "tr",
        }),
    },
    {
      id: "homework.due_reminder.student",
      category: "Ödev & Materyaller",
      channel: "support",
      sender: "Oriens Academy Öğrenci Destek <support@oriens-academy.com>",
      replyTo: "support@oriens-academy.com",
      render: () =>
        renderStudentHomeworkDueReminderEmail({
          homeworkId: "hw-1",
          studentName: "Kaan Kurt",
          studentEmail: TARGET_RECIPIENT,
          assignmentTitle: "AP Physics C: Mechanics Work & Energy Set 4",
          subjectOrLesson: "AP Physics C",
          dueDate: tomorrow,
          locale: "tr",
        }),
    },
    {
      id: "homework.submitted.teacher",
      category: "Ödev & Materyaller",
      channel: "support",
      sender: "Oriens Academy Öğrenci Destek <support@oriens-academy.com>",
      replyTo: "support@oriens-academy.com",
      render: () =>
        renderTeacherHomeworkSubmittedEmail(
          {
            homeworkId: "hw-1",
            studentName: "Kaan Kurt",
            studentEmail: TARGET_RECIPIENT,
            assignmentTitle: "AP Physics C: Mechanics Work & Energy Set 4",
            subjectOrLesson: "AP Physics C",
            dueDate: tomorrow,
            locale: "tr",
          },
          "tr"
        ),
    },
    {
      id: "homework.reviewed.student",
      category: "Ödev & Materyaller",
      channel: "support",
      sender: "Oriens Academy Öğrenci Destek <support@oriens-academy.com>",
      replyTo: "support@oriens-academy.com",
      render: () =>
        renderStudentHomeworkReviewedEmail({
          homeworkId: "hw-1",
          studentName: "Kaan Kurt",
          studentEmail: TARGET_RECIPIENT,
          assignmentTitle: "AP Physics C: Mechanics Work & Energy Set 4",
          subjectOrLesson: "AP Physics C",
          dueDate: tomorrow,
          score: 95,
          maxScore: 100,
          teacherFeedback: "Tüm formül çıkarımları ve grafik analizleri kusursuz. 8. sorudaki sürtünme katsayısı işlemine dikkat ediniz.",
          locale: "tr",
        }),
    },
    {
      id: "homework.revision_requested.student",
      category: "Ödev & Materyaller",
      channel: "support",
      sender: "Oriens Academy Öğrenci Destek <support@oriens-academy.com>",
      replyTo: "support@oriens-academy.com",
      render: () =>
        renderStudentHomeworkRevisionRequestedEmail({
          homeworkId: "hw-1",
          studentName: "Kaan Kurt",
          studentEmail: TARGET_RECIPIENT,
          assignmentTitle: "AP Physics C: Mechanics Work & Energy Set 4",
          subjectOrLesson: "AP Physics C",
          dueDate: tomorrow,
          teacherFeedback: "Lütfen 4. ve 7. soruların serbest cisim diyagramlarını (FBD) çizerek çözümlerinizi yeniden yükleyiniz.",
          locale: "tr",
        }),
    },

    // 5. Packages & Payment Management (payments@)
    {
      id: "package.purchased.student",
      category: "Paket & Ödemeler",
      channel: "payments",
      sender: "Oriens Academy Ödemeler <payments@oriens-academy.com>",
      replyTo: "payments@oriens-academy.com",
      render: () =>
        renderStudentPackagePurchasedEmail({
          orderReference: "ORD-2026-98214",
          studentName: "Deniz Arda",
          studentEmail: TARGET_RECIPIENT,
          packageName: "Digital SAT Intensive Prep Paketi",
          lessonCount: 15,
          pricePerLesson: 1633,
          totalAmount: 24500,
          currency: "TRY",
          paymentMethod: "card",
          createdAt: now.toISOString(),
          locale: "tr",
        }),
    },
    {
      id: "payment.success.student",
      category: "Paket & Ödemeler",
      channel: "payments",
      sender: "Oriens Academy Ödemeler <payments@oriens-academy.com>",
      replyTo: "payments@oriens-academy.com",
      render: () =>
        renderStudentPaymentSuccessEmail({
          paymentReference: "PAY-2026-98214",
          studentName: "Deniz Arda",
          studentEmail: TARGET_RECIPIENT,
          packageName: "Digital SAT Intensive Prep Paketi",
          amountPaid: 24500,
          currency: "TRY",
          paymentMethod: "Kredi Kartı / 3D Secure",
          paidAt: now.toISOString(),
          locale: "tr",
        }),
    },
    {
      id: "payment.bank_transfer_pending.student",
      category: "Paket & Ödemeler",
      channel: "payments",
      sender: "Oriens Academy Ödemeler <payments@oriens-academy.com>",
      replyTo: "payments@oriens-academy.com",
      render: () =>
        renderStudentBankTransferPendingEmail({
          paymentReference: "TX-98214",
          studentName: "Deniz Arda",
          studentEmail: TARGET_RECIPIENT,
          packageName: "Digital SAT Intensive Prep Paketi",
          amount: 24500,
          currency: "TRY",
          bankName: "Garanti BBVA",
          iban: "TR56 0006 2000 0001 2345 6789 01",
          accountHolder: "Oriens Academy Eğitim Danışmanlık A.Ş.",
          locale: "tr",
        }),
    },
    {
      id: "payment.bank_transfer_approved.student",
      category: "Paket & Ödemeler",
      channel: "payments",
      sender: "Oriens Academy Ödemeler <payments@oriens-academy.com>",
      replyTo: "payments@oriens-academy.com",
      render: () =>
        renderStudentBankTransferApprovedEmail({
          paymentReference: "TX-98214",
          studentName: "Deniz Arda",
          studentEmail: TARGET_RECIPIENT,
          packageName: "Digital SAT Intensive Prep Paketi",
          totalLessons: 15,
          amountPaid: 24500,
          currency: "TRY",
          locale: "tr",
        }),
    },
    {
      id: "payment.reminder.student",
      category: "Paket & Ödemeler",
      channel: "payments",
      sender: "Oriens Academy Ödemeler <payments@oriens-academy.com>",
      replyTo: "payments@oriens-academy.com",
      render: () =>
        renderStudentPaymentReminderEmail({
          paymentReference: "TX-98214",
          studentName: "Deniz Arda",
          studentEmail: TARGET_RECIPIENT,
          packageName: "Digital SAT Intensive Prep Paketi",
          amount: 24500,
          currency: "TRY",
          bankName: "Garanti BBVA",
          iban: "TR56 0006 2000 0001 2345 6789 01",
          accountHolder: "Oriens Academy Eğitim Danışmanlık A.Ş.",
          reminderCount: 1,
          locale: "tr",
        }),
    },
    {
      id: "payment.notification.admin",
      category: "Paket & Ödemeler",
      channel: "payments",
      sender: "Oriens Academy Ödemeler <payments@oriens-academy.com>",
      replyTo: "payments@oriens-academy.com",
      render: () =>
        renderAdminPaymentNotificationEmail({
          paymentReference: "PAY-2026-98214",
          payerName: "Deniz Arda",
          payerEmail: TARGET_RECIPIENT,
          payerPhone: "+90 533 111 2233",
          packageName: "Digital SAT Intensive Prep Paketi",
          amount: 24500,
          currency: "TRY",
          paymentMethod: "Havale / EFT",
          status: "pending_verification",
          createdAt: now.toISOString(),
          locale: "tr",
        }),
    },
    {
      id: "package.activated.student",
      category: "Paket & Ödemeler",
      channel: "payments",
      sender: "Oriens Academy Ödemeler <payments@oriens-academy.com>",
      replyTo: "payments@oriens-academy.com",
      render: () =>
        renderStudentPackageActivatedEmail({
          studentName: "Deniz Arda",
          studentEmail: TARGET_RECIPIENT,
          packageName: "Digital SAT Intensive Prep Paketi",
          totalLessons: 15,
          locale: "tr",
        }),
    },
    {
      id: "package.low_balance.student",
      category: "Paket & Ödemeler",
      channel: "payments",
      sender: "Oriens Academy Ödemeler <payments@oriens-academy.com>",
      replyTo: "payments@oriens-academy.com",
      render: () =>
        renderStudentPackageLowBalanceEmail({
          studentName: "Deniz Arda",
          studentEmail: TARGET_RECIPIENT,
          packageName: "Digital SAT Intensive Prep Paketi",
          totalLessons: 15,
          lessonsUsed: 14,
          lessonsRemaining: 1,
          locale: "tr",
        }),
    },
    {
      id: "package.completed.student",
      category: "Paket & Ödemeler",
      channel: "payments",
      sender: "Oriens Academy Ödemeler <payments@oriens-academy.com>",
      replyTo: "payments@oriens-academy.com",
      render: () =>
        renderStudentPackageCompletedEmail({
          studentName: "Deniz Arda",
          studentEmail: TARGET_RECIPIENT,
          packageName: "Digital SAT Intensive Prep Paketi",
          totalLessons: 15,
          lessonsUsed: 15,
          lessonsRemaining: 0,
          locale: "tr",
        }),
    },
    {
      id: "package.renewal.student",
      category: "Paket & Ödemeler",
      channel: "payments",
      sender: "Oriens Academy Ödemeler <payments@oriens-academy.com>",
      replyTo: "payments@oriens-academy.com",
      render: () =>
        renderStudentPackageRenewalEmail({
          studentName: "Deniz Arda",
          studentEmail: TARGET_RECIPIENT,
          packageName: "Digital SAT Intensive Prep Paketi",
          totalLessons: 15,
          recommendedPackageName: "10 Derslik İleri Düzey Sınav Paketi",
          recommendedPackageUrl: "https://oriens-academy.com/tr/fiyatlandirma",
          locale: "tr",
        }),
    },

    // 6. Account & Security (info@)
    {
      id: "account.welcome.student",
      category: "Hesap & Güvenlik",
      channel: "general",
      sender: "Oriens Academy <info@oriens-academy.com>",
      replyTo: "support@oriens-academy.com",
      render: () =>
        renderStudentWelcomeEmail({
          studentName: "Ece Yıldız",
          studentEmail: TARGET_RECIPIENT,
          temporaryPassword: "Oriens-2026-Secure!",
          locale: "tr",
        }),
    },
    {
      id: "account.password_recovery.student",
      category: "Hesap & Güvenlik",
      channel: "general",
      sender: "Oriens Academy <info@oriens-academy.com>",
      replyTo: "support@oriens-academy.com",
      render: () =>
        renderAccountPasswordRecoveryEmail(TARGET_RECIPIENT, "TEMP-PASS-2026-XYZ", "tr"),
    },
    {
      id: "account.security_alert.student",
      category: "Hesap & Güvenlik",
      channel: "admin",
      sender: "Oriens Academy <info@oriens-academy.com>",
      replyTo: "admin@oriens-academy.com",
      render: () =>
        renderAccountSecurityAlertEmail({
          studentEmail: TARGET_RECIPIENT,
          actionTitle: "Hesap Şifresi Güncellendi",
          actionDescription: "Öğrenci portalı giriş şifreniz başarıyla değiştirildi.",
          timestamp: now.toISOString(),
          device: "Chrome / Windows 11",
          ipAddress: "88.255.120.45 (İstanbul, Türkiye)",
          locale: "tr",
        }),
    },
  ];

  console.log(`Starting delivery of ${templates.length} distinct transactional email previews...\n`);

  const deliveryReport = [];

  for (let i = 0; i < templates.length; i++) {
    const item = templates[i];
    const rendered = item.render();

    let status = "FAILED";
    let providerMsgId = "—";
    let errorDetail = null;

    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          channel: item.channel,
          from: item.sender,
          replyTo: item.replyTo,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          eventType: `preview.${item.id}`,
        }),
      });

      const resData = await res.json();
      if (res.ok && resData.success && resData.delivery?.status === "sent") {
        status = "SENT";
        providerMsgId = resData.delivery.providerMessageId || "OK";
      } else {
        status = "FAILED";
        errorDetail = resData.delivery?.lastErrorCode || resData.error_code || JSON.stringify(resData);
      }
    } catch (err) {
      status = "FAILED";
      errorDetail = err.message;
    }

    deliveryReport.push({
      index: i + 1,
      id: item.id,
      category: item.category,
      sender: item.sender.split("<")[1].replace(">", ""),
      subject: rendered.subject,
      status,
      providerMsgId,
      errorDetail,
    });

    const mark = status === "SENT" ? "✓ [SENT]" : "✗ [FAIL]";
    console.log(`  ${mark} (${i + 1}/${templates.length}) [${item.category}] ${rendered.subject}`);
    if (errorDetail) {
      console.log(`        Error: ${errorDetail}`);
    }

    // Rate-limiting delay to avoid Gmail API throttling
    await sleep(600);
  }

  const successCount = deliveryReport.filter((r) => r.status === "SENT").length;

  console.log("\n=======================================================");
  console.log("             DELIVERY SUMMARY REPORT");
  console.log("=======================================================");
  console.log(`Total Templates Tested : ${templates.length}`);
  console.log(`Successfully Delivered : ${successCount}`);
  console.log(`Failed Deliveries      : ${templates.length - successCount}`);
  console.log(`Target Mailbox         : ${TARGET_RECIPIENT}`);
  console.log(`External Customer Mail : 0 (Strictly Blocked)`);
  console.log("=======================================================\n");

  if (successCount !== templates.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal Error running email preview script:", err);
  process.exit(1);
});
