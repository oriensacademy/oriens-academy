import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendTransactionalEmail } from "../_shared/email/service.ts";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { renderEmailShell, actionButton, normalizeLocale, normalContentBlock, sectionHeading, turkishGenitiveSuffix } from "../_shared/email/templates.ts";
import { renderPaymentSuccessEmail } from "../_shared/email/payment-success.ts";
import { renderLessonReportEmail } from "../_shared/email/lesson-report.ts";
import { renderAccountCreatedEmail } from "../_shared/email/account-created.ts";
import { getSupabaseAdminKey } from "../_shared/supabase-admin.ts";

type OutboxRow = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  recipient: string;
  template: string | null;
  payload: Record<string, unknown>;
};

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));

const TIMEZONE_LABELS: Record<string, string> = {
  "Europe/Istanbul": "TR", "Europe/London": "UK", "Europe/Amsterdam": "NL", "Europe/Berlin": "DE",
  "America/New_York": "US-ET", "America/Chicago": "US-CT", "America/Denver": "US-MT", "America/Los_Angeles": "US-PT",
};

function safeLessonTimezone(value: unknown) {
  const zone = String(value || "Europe/Istanbul");
  return TIMEZONE_LABELS[zone] ? zone : "Europe/Istanbul";
}

function formatLessonDate(value: unknown, locale: "tr" | "en", timeZone: string) {
  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) return String(value ?? "");
  const parts = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return locale === "tr"
    ? `${part("day")} ${part("month")} ${part("year")} ${part("weekday")}`
    : `${part("weekday")}, ${part("month")} ${part("day")}, ${part("year")}`;
}

function formatLessonTime(value: unknown, timeZone: string) {
  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) return String(value ?? "");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("hour")}.${part("minute")}`;
}

function formatPackageDate(value: unknown, locale: "tr" | "en") {
  const raw = String(value ?? "");
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00Z`) : new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone: "UTC", day: "numeric", month: "long", year: "numeric",
  }).format(parsed);
}

function render(row: OutboxRow, liveRemaining?: number) {
  const p = row.payload || {};
  const isEn = normalizeLocale(String(p.locale ?? "")) === "en";
  let renderedIsEn = isEn;
  const lines: string[] = [];
  let subject = "Oriens Academy";
  let title: string | null = null;
  let channel: "payments" | "support" = "payments";
  let customContentHtml: string | null = null;
  let visualVariant: "payment-confirmation" | "account-created" | "lesson-report" | undefined;

  if (row.template === "payment_success_guardian") {
    const payment = renderPaymentSuccessEmail("guardian", p, isEn ? "en" : "tr");
    subject = payment.subject;
    title = payment.title;
    lines.push(payment.text);
    customContentHtml = payment.bodyHtml;
    visualVariant = "payment-confirmation";
  } else if (row.template === "payment_success_admin") {
    const payment = renderPaymentSuccessEmail("admin", p, "en");
    renderedIsEn = true;
    subject = payment.subject;
    title = payment.title;
    lines.push(payment.text);
    customContentHtml = payment.bodyHtml;
  } else if (row.template === "lesson_completed_account_holder") {
    channel = "support";
    const lessonReport = renderLessonReportEmail(row.template, p, liveRemaining);
    subject = lessonReport.subject;
    title = lessonReport.title;
    lines.push(lessonReport.text);
    customContentHtml = lessonReport.bodyHtml;
    visualVariant = lessonReport.visualVariant;
  } else if (
    row.template === "lesson_completed_guardian" ||
    row.template === "lesson_completed_student"
  ) {
    // MAIL-027: canonical manual lesson report with authoritative live balance.
    channel = "support";
    subject = isEn ? "Your Lesson Report and Current Lesson Balance" : "Ders Sonu Raporunuz ve Güncel Ders Bakiyeniz";
    const name = String(p.account_holder_name || p.guardian_name || (isEn ? "Account Owner" : "Hesap Sahibi"));
    const studentName = String(p.student_name || p.learner_name || "").trim();
    const remaining = Math.max(0, Number(liveRemaining ?? p.total_remaining_lessons ?? 0));
    const report = String(p.completion_report || "").trim();
    const lessonTimezone = safeLessonTimezone(p.lesson_timezone);
    const lessonTimezoneLabel = TIMEZONE_LABELS[lessonTimezone];
    const lessonDate = formatLessonDate(p.lesson_date, isEn ? "en" : "tr", lessonTimezone);
    const lessonTime = formatLessonTime(p.lesson_date, lessonTimezone);
    const greeting = isEn ? `Hello ${name},` : `Merhaba ${name},`;
    const studentSuffix = isEn ? "'s" : turkishGenitiveSuffix(studentName);
    const introduction = studentName
      ? (isEn ? `The evaluation report for ${studentName}'s completed lesson and your current lesson balance are provided below.` : `Öğrencimiz ${studentName}${studentSuffix} tamamlanan dersine ait değerlendirme raporu ve güncel ders bakiyeniz aşağıda yer almaktadır.`)
      : (isEn ? "The evaluation report for our student's completed lesson and your current lesson balance are provided below." : "Öğrencimizin tamamlanan dersine ilişkin değerlendirme raporu ile güncel ders bakiyenize aşağıda yer verilmiştir.");
    const rightsWarning = remaining === 0
      ? (isEn ? "Your current lesson balance is zero." : "Güncel ders bakiyeniz sıfırdır. Yeni paketinizi Havale/EFT ile veya site üzerinden kredi kartı ile satın alabilirsiniz.")
      : remaining === 1
        ? (isEn ? "Your current lesson balance is 1 lesson." : "Güncel ders bakiyeniz 1 derstir.")
        : "";
    if (report.length < 5) throw new Error("REPORT_REQUIRED");
    lines.push(
      greeting,
      introduction,
      `${isEn ? "Lesson" : "Ders"}: ${p.lesson_title}`,
      `${isEn ? "Subject" : "Konu"}: ${p.subject}`,
      `${isEn ? "Date" : "Tarih"}: ${lessonDate}`,
      `${isEn ? "Time" : "Saat"}: ${lessonTime} ${lessonTimezoneLabel}`,
      `${isEn ? "Duration" : "Süre"}: ${p.duration_minutes} ${isEn ? "minutes" : "dakika"}`,
      `${isEn ? "Lesson report" : "Ders sonu raporu"}: ${report}`,
      `${isEn ? "Current Lesson Balance" : "Güncel Ders Bakiyesi"}: ${remaining} ${isEn ? "lessons" : "Ders"}`,
    );
    if (p.instructor_name) lines.splice(6, 0, `${isEn ? "Instructor" : "Eğitmen"}: ${p.instructor_name}`);
    if (rightsWarning) lines.push(rightsWarning);
    const useReferenceVisual = row.template === "lesson_completed_account_holder";
    if (useReferenceVisual) visualVariant = "lesson-report";
    const rowHtml = (label: string, value: unknown, first = false) => {
      const labelPadding = useReferenceVisual ? (first ? "16px 0 10px 20px" : "10px 0 10px 20px") : "7px 0";
      const valuePadding = useReferenceVisual ? (first ? "16px 20px 10px 0" : "10px 20px 10px 0") : "7px 0";
      const divider = !first && useReferenceVisual ? "border-top:1px solid #EBEBE6;" : "";
      return `<tr><td style="padding:${labelPadding};color:${useReferenceVisual ? "#6B7078" : "#557064"};width:34%;${divider}">${escapeHtml(label)}</td><td style="padding:${valuePadding};font-weight:600;color:${useReferenceVisual ? "#141B2D" : "#10271B"};${divider}">${escapeHtml(value)}</td></tr>`;
    };
    const lessonDetailsTable = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      ${rowHtml(isEn ? "Lesson" : "Ders", p.lesson_title, true)}
      ${rowHtml(isEn ? "Subject" : "Konu", p.subject)}
      ${rowHtml(isEn ? "Date" : "Tarih", lessonDate)}
      ${rowHtml(isEn ? "Time" : "Saat", `${lessonTime} ${lessonTimezoneLabel}`)}
      ${rowHtml(isEn ? "Duration" : "Süre", `${p.duration_minutes} ${isEn ? "minutes" : "dakika"}`)}
      ${p.instructor_name ? rowHtml(isEn ? "Instructor" : "Eğitmen", p.instructor_name) : ""}
    </table>`;
    customContentHtml = useReferenceVisual ? `
      <p style="margin:0 0 12px 0;font-size:15px;line-height:24px;color:#2B2F36;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 28px 0;font-size:15px;line-height:24px;color:#4A4F57;overflow-wrap:anywhere;">${studentName ? (isEn
        ? `The evaluation report for <strong style="font-weight:700;color:#2B2F36;">${escapeHtml(studentName)}</strong>${escapeHtml(studentSuffix)} completed lesson and your current lesson balance are provided below.`
        : `Öğrencimiz <strong style="font-weight:700;color:#2B2F36;">${escapeHtml(studentName)}</strong>${escapeHtml(studentSuffix)} tamamlanan dersine ait değerlendirme raporu ve güncel ders bakiyeniz aşağıda yer almaktadır.`)
        : escapeHtml(introduction)}</p>
      <div style="margin:0 0 12px 0;font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.5px;color:#B8975A;text-transform:uppercase;">${escapeHtml(isEn ? "LESSON DETAILS" : "DERS BİLGİLERİ")}</div>
      <div style="margin:0 0 28px 0;background-color:#F7F7F4;border-radius:12px;overflow:hidden;">${lessonDetailsTable}</div>
      <div style="margin:0 0 12px 0;font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.5px;color:#B8975A;text-transform:uppercase;">${escapeHtml(isEn ? "LESSON REPORT" : "DERS SONU RAPORU")}</div>
      <div style="margin:0 0 28px 0;background-color:#F7F7F4;border-radius:12px;overflow:hidden;"><div style="padding:18px 20px;font-size:14px;line-height:23px;color:#2B2F36;white-space:normal;">${escapeHtml(report).replace(/\r?\n/g, "<br />")}</div></div>
      <div style="margin:0 0 12px 0;font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.5px;color:#B8975A;text-transform:uppercase;">${escapeHtml(isEn ? "CURRENT LESSON BALANCE" : "GÜNCEL DERS BAKİYESİ")}</div>
      <div style="margin:0;background-color:#141B2D;border-radius:12px;padding:20px 24px;"><span style="font-size:38px;line-height:42px;font-weight:700;color:#FFFFFF;">${escapeHtml(remaining)}</span><span style="padding-left:6px;font-size:16px;line-height:42px;font-weight:600;color:#D9C39A;">${escapeHtml(isEn ? "lessons" : "Ders")}</span></div>
      ${rightsWarning ? `<p style="margin:14px 0 0;color:${remaining === 0 ? "#A33A2B" : "#8A5A00"};">${escapeHtml(rightsWarning)}</p>` : ""}
    ` : `
      <p style="margin:0 0 6px 0;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 18px 0;overflow-wrap:anywhere;">${studentName ? (isEn
        ? `The evaluation report for <strong>${escapeHtml(studentName)}</strong>${escapeHtml(studentSuffix)} completed lesson and your current lesson balance are provided below.`
        : `Öğrencimiz <strong>${escapeHtml(studentName)}</strong>${escapeHtml(studentSuffix)} tamamlanan dersine ait değerlendirme raporu ve güncel ders bakiyeniz aşağıda yer almaktadır.`)
        : escapeHtml(introduction)}</p>
      ${sectionHeading(isEn ? "LESSON DETAILS" : "DERS BİLGİLERİ")}
      ${normalContentBlock(lessonDetailsTable)}
      ${sectionHeading(isEn ? "LESSON REPORT" : "DERS SONU RAPORU")}
      ${normalContentBlock(`<div style="white-space:normal;">${escapeHtml(report).replace(/\r?\n/g, "<br />")}</div>`)}
      ${sectionHeading(isEn ? "CURRENT LESSON BALANCE" : "GÜNCEL DERS BAKİYESİ")}
      ${normalContentBlock(`<p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(`${remaining} ${isEn ? "lessons" : "Ders"}`)}</p>`)}
      ${rightsWarning ? `<p style="margin:0 0 12px;color:${remaining === 0 ? "#A33A2B" : "#8A5A00"};">${escapeHtml(rightsWarning)}</p>` : ""}
    `;
  } else if (row.template === "lesson_remaining_rights_account_holder") {
    // MAIL-040: Post-lesson total remaining rights automation (Includes zero & low-balance advisory)
    channel = "support";
    const remaining = typeof liveRemaining === "number" ? liveRemaining : Math.max(0, Number(p.total_remaining_lessons ?? 0));
    subject = isEn ? `Lesson Completed | Remaining Lesson Rights: ${remaining}` : `Dersiniz Tamamlandı | Kalan Ders Hakkınız: ${remaining}`;
    const name = String(p.account_holder_name || p.guardian_name || p.student_name || (isEn ? "Account Owner" : "Hesap Sahibi"));
    lines.push(
      isEn ? `Hello ${name}, your lesson has been completed.` : `Merhaba ${name}, dersiniz tamamlandı.`,
      `${isEn ? "Completed Lesson" : "Tamamlanan Ders"}: ${p.lesson_title}`,
      `${isEn ? "Date" : "Tarih"}: ${p.lesson_date}`,
      `${isEn ? "Total Usable Lesson Rights" : "Kalan Toplam Ders Hakkınız"}: ${remaining}`,
    );
    if (remaining === 0) {
      lines.push(
        isEn
          ? "Notice: You have 0 lesson rights remaining. Please purchase new lesson rights to continue your education seamlessly."
          : "Bilgilendirme: Ders hakkınız kalmadı. Eğitiminize kesintisiz devam etmek için yeni ders hakkı satın alabilirsiniz."
      );
    } else if (remaining === 1) {
      lines.push(
        isEn
          ? "Reminder: You have only 1 lesson right remaining. You may want to renew your lesson rights before scheduling your next lesson."
          : "Hatırlatma: Kalan toplam ders hakkınız 1'e düştü. Yeni ders planlamadan önce ders haklarınızı yenilemek isteyebilirsiniz."
      );
    }
  } else if (row.template === "payment_refunded_account_holder") {
    const name = String(p.account_holder_name || p.guardian_name || p.learner_name || (isEn ? "Account Owner" : "Hesap Sahibi"));
    const full = p.refund_status === "full";
    // Aynı gerekçeyle referans başlıktan çıkarıldı; gövdede "İşlem referansı"
    // ve "İade referansı" olarak zaten yer alıyor.
    subject = isEn
      ? `${full ? "Refund Completed" : "Partial Refund Completed"}`
      : `${full ? "İadeniz Tamamlandı" : "Kısmi İadeniz Tamamlandı"}`;
    lines.push(
      isEn ? `Hello ${name}, your refund has been completed.` : `Merhaba ${name}, iade işleminiz tamamlandı.`,
      `${isEn ? "Transaction reference" : "İşlem referansı"}: ${p.reference}`,
      `${isEn ? "Refund reference" : "İade referansı"}: ${p.refund_reference}`,
      `${isEn ? "Refund amount" : "İade tutarı"}: ${p.refund_amount} ${p.currency}`,
      `${isEn ? "Package" : "Paket"}: ${p.package_name}`,
      `${isEn ? "Lesson rights revoked" : "İade edilen ders hakkı"}: ${p.revoked_lessons}`,
      `${isEn ? "Remaining active lesson rights" : "Aktif kalan ders hakkı"}: ${p.remaining_lessons}`,
      `${isEn ? "Refund status" : "İade durumu"}: ${full ? (isEn ? "Full" : "Tam") : (isEn ? "Partial" : "Kısmi")}`,
    );
  } else if (row.template === "package_rights_summary") {
    channel = "support";
    const name = String(p.account_holder_name || (isEn ? "Account Owner" : "Hesap Sahibi"));
    subject = isEn ? "Current Lesson Rights" : "Güncel Ders Haklarınız";
    title = isEn ? "Current Lesson Rights" : "Güncel Ders Haklarınız";
    const totalRemaining = Math.max(0, Number(p.total_remaining_lessons ?? 0));
    const currentDate = formatLessonDate(p.current_date, isEn ? "en" : "tr", "Europe/Istanbul");
    lines.push(
      isEn ? `Hello ${name}.` : `Merhaba ${name}.`,
      isEn ? "Your current lesson rights are listed below." : "Mevcut ders haklarınız aşağıdaki gibidir.",
      `${isEn ? "Student" : "Öğrenci"}: ${p.student_name}`,
      `${isEn ? "Total remaining lesson rights" : "Toplam kalan ders hakkı"}: ${totalRemaining}`,
      `${isEn ? "Date" : "Tarih"}: ${currentDate}`,
    );
    const detailRow = (label: string, value: unknown) => `<tr><td style="padding:5px 0;font-weight:700;color:#10271B;vertical-align:top;">${escapeHtml(label)}</td><td style="width:18px;padding:5px 5px;text-align:center;color:#557064;vertical-align:top;">:</td><td style="padding:5px 0;font-weight:400;color:#10271B;vertical-align:top;">${escapeHtml(value)}</td></tr>`;
    customContentHtml = `
      <p style="margin:0 0 12px 0;">${escapeHtml(isEn ? `Hello ${name}.` : `Merhaba ${name}.`)}</p>
      <p style="margin:0 0 18px 0;">${escapeHtml(isEn ? "Your current lesson rights are listed below." : "Mevcut ders haklarınız aşağıdaki gibidir.")}</p>
      ${normalContentBlock(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:auto;">
        ${detailRow(isEn ? "Student" : "Öğrenci", p.student_name)}
        ${detailRow(isEn ? "Total remaining lesson rights" : "Toplam kalan ders hakkı", totalRemaining)}
        ${detailRow(isEn ? "Date" : "Tarih", currentDate)}
      </table>`)}
    `;
  } else if (
    row.template === "guardian_welcome" ||
    row.template === "student_welcome" ||
    row.template === "student.welcome_email" ||
    row.template === "guardian.welcome"
  ) {
    channel = "support";
    const name = String(
      p.recipient_name || p.guardian_name || p.full_name || p.student_name || (isEn ? "Account Owner" : "Hesap Sahibi")
    );
    subject = isEn ? "Your Oriens Academy account is ready" : "Oriens Academy hesabınız hazır";
    lines.push(
      isEn
        ? `Dear ${name}, your Oriens Academy account has been created successfully.`
        : `Sayın ${name}, Oriens Academy hesabınız başarıyla oluşturuldu.`,
      isEn
        ? "You can manage lessons, packages and payments from your account."
        : "Ders, paket ve ödeme işlemlerinizi hesabınızdan yönetebilirsiniz.",
    );
    if (row.template === "guardian_welcome") {
      const accountCreated = renderAccountCreatedEmail(p, isEn ? "en" : "tr");
      subject = accountCreated.subject;
      title = accountCreated.title;
      lines.splice(0, lines.length, accountCreated.text);
      visualVariant = accountCreated.visualVariant;
      customContentHtml = accountCreated.bodyHtml;
    }
  } else if (row.template === "package_assigned_manual") {
    // MAIL-041: Paket tanimlama bilgilendirmesi. Otomatik DEGIL -- admin panelinden
    // acik bir aksiyonla (admin_send_package_notification) kuyruga alinir.
    channel = "support";
    const name = String(p.account_holder_name || p.guardian_name || (isEn ? "Account Owner" : "Hesap Sahibi"));
    const studentName = String(p.student_name || p.learner_name || "").trim();
    const remaining = Math.max(0, Number(p.remaining_lessons ?? 0));
    const currentBalance = Math.max(0, Number(p.total_remaining_lessons ?? remaining));
    const greeting = isEn ? `Hello ${name},` : `Merhaba ${name},`;
    const introduction = studentName
      ? (isEn ? `The lesson package below has been assigned for ${studentName}.` : `${studentName} için aşağıdaki ders paketi tanımlanmıştır.`)
      : (isEn ? "The lesson package below has been assigned for your student." : "Öğrenciniz için aşağıdaki ders paketi tanımlanmıştır.");
    const startDate = p.start_date ? formatPackageDate(p.start_date, isEn ? "en" : "tr") : "";
    const endDate = p.end_date ? formatPackageDate(p.end_date, isEn ? "en" : "tr") : "";
    subject = isEn ? "Your Lesson Package Has Been Assigned" : "Ders Paketiniz Tanımlandı";
    lines.push(
      greeting,
      introduction,
      `${isEn ? "Package" : "Paket"}: ${p.package_name}`,
      `${isEn ? "Current Lesson Balance" : "Güncel Ders Bakiyesi"}: ${currentBalance} ${isEn ? "lessons" : "Ders"}`,
    );
    if (startDate) lines.push(`${isEn ? "Start Date" : "Başlangıç Tarihi"}: ${startDate}`);
    if (endDate) lines.push(`${isEn ? "End Date" : "Bitiş Tarihi"}: ${endDate}`);
    lines.push(
      isEn
        ? "You can follow your lessons and remaining rights from your account at any time."
        : "Derslerinizi ve kalan haklarınızı dilediğiniz zaman hesabınızdan takip edebilirsiniz."
    );
    const detailRow = (label: string, value: unknown) => `<tr>
      <td style="padding:7px 0;color:#557064;white-space:nowrap;">${escapeHtml(label)}</td>
      <td style="padding:7px 10px;color:#557064;text-align:center;width:18px;">:</td>
      <td style="padding:7px 0;font-weight:600;color:#10271B;">${escapeHtml(value)}</td>
    </tr>`;
    customContentHtml = `
      <p style="margin:0 0 6px 0;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 18px 0;">${escapeHtml(introduction)}</p>
      ${normalContentBlock(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
        ${detailRow(isEn ? "Package" : "Paket", p.package_name)}
        ${detailRow(isEn ? "Current Lesson Balance" : "Güncel Ders Bakiyesi", `${currentBalance} ${isEn ? "lessons" : "Ders"}`)}
        ${startDate ? detailRow(isEn ? "Start Date" : "Başlangıç Tarihi", startDate) : ""}
        ${endDate ? detailRow(isEn ? "End Date" : "Bitiş Tarihi", endDate) : ""}
      </table>`)}
      <p style="margin:0 0 12px 0;">${escapeHtml(isEn ? "You can follow your lessons and current balance from your account at any time." : "Derslerinizi ve güncel bakiyenizi dilediğiniz zaman hesabınızdan takip edebilirsiniz.")}</p>
    `;
  } else if (row.template === "lesson_rights_manual") {
    // MAIL-042: Ders hakki guncelleme bilgilendirmesi. Otomatik DEGIL -- hak
    // artirma/azaltma islemi kendi basina e-posta gondermez.
    channel = "support";
    const name = String(p.account_holder_name || p.learner_name || (isEn ? "Account Owner" : "Hesap Sahibi"));
    const totalRemaining = Math.max(0, Number(p.total_remaining_lessons ?? 0));
    subject = isEn ? "Your Lesson Rights Have Been Updated" : "Ders Hakkınız Güncellendi";
    title = subject;
    lines.push(
      isEn
        ? `Hello ${name}, the lesson rights of ${p.learner_name} have been updated.`
        : `Merhaba ${name}, ${p.learner_name} adına tanımlı ders haklarınız güncellenmiştir.`,
      `${isEn ? "Total Remaining Lesson Rights" : "Toplam Kalan Ders Hakkınız"}: ${totalRemaining}`,
    );
    if (totalRemaining === 0) {
      lines.push(
        isEn
          ? "Notice: You have 0 lesson rights remaining. Please purchase new lesson rights to continue your education seamlessly."
          : "Bilgilendirme: Ders hakkınız kalmadı. Eğitiminize kesintisiz devam etmek için yeni ders hakkı satın alabilirsiniz."
      );
    } else if (totalRemaining === 1) {
      lines.push(
        isEn
          ? "Reminder: You have only 1 lesson right remaining."
          : "Hatırlatma: Kalan toplam ders hakkınız 1'e düştü."
      );
    }
    const rightsRow = (label: string, value: unknown) => `<tr><td style="padding:7px 0;font-weight:700;color:#10271B;">${escapeHtml(label)}</td><td style="width:18px;padding:7px;text-align:center;color:#557064;">:</td><td style="padding:7px 0;font-weight:700;color:#10271B;">${escapeHtml(value)}</td></tr>`;
    customContentHtml = `<p style="margin:0 0 18px 0;">${escapeHtml(lines[0])}</p>${normalContentBlock(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${rightsRow(isEn ? "Total Remaining Lesson Rights" : "Toplam Kalan Ders Hakkınız", totalRemaining)}</table>`)}${lines.slice(2).map((line) => `<p style="margin:12px 0 0 0;">${escapeHtml(line)}</p>`).join("")}`;
  } else if (row.template === "past_lesson_confirmation_manual") {
    channel = "support";
    const name = String(p.account_holder_name || p.guardian_name || (isEn ? "Account Owner" : "Hesap Sahibi"));
    const timezone = safeLessonTimezone(p.lesson_timezone);
    const lessonDate = formatLessonDate(p.lesson_date, isEn ? "en" : "tr", timezone);
    const lessonTime = formatLessonTime(p.lesson_date, timezone);
    subject = isEn ? "Your Past Lesson Record Has Been Added" : "Geçmiş Ders Kaydınız Oluşturuldu";
    title = subject;
    const detailRow = (label: string, value: unknown) => `<tr><td style="padding:6px 0;font-weight:700;color:#10271B;vertical-align:top;">${escapeHtml(label)}</td><td style="width:18px;padding:6px;text-align:center;color:#557064;vertical-align:top;">:</td><td style="padding:6px 0;color:#10271B;vertical-align:top;">${escapeHtml(value)}</td></tr>`;
    lines.push(isEn ? `Hello ${name}, your student's past lesson record has been added.` : `Merhaba ${name}, öğrencinizin geçmiş ders kaydı oluşturuldu.`);
    customContentHtml = `<p style="margin:0 0 18px 0;">${escapeHtml(lines[0])}</p>${normalContentBlock(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${detailRow(isEn ? "Student" : "Öğrenci", p.student_name)}${detailRow(isEn ? "Subject" : "Konu / Alan", p.subject)}${detailRow(isEn ? "Date" : "Tarih", lessonDate)}${detailRow(isEn ? "Time" : "Saat", lessonTime)}${detailRow(isEn ? "Duration" : "Süre", `${p.duration_minutes} ${isEn ? "min" : "dk"}`)}${detailRow(isEn ? "Time Zone" : "Saat Dilimi", p.lesson_timezone_label || TIMEZONE_LABELS[timezone])}${p.instructor_name ? detailRow(isEn ? "Instructor" : "Eğitmen", p.instructor_name) : ""}${detailRow(isEn ? "Remaining Lessons" : "Kalan Ders", Math.max(0,Number(p.total_remaining_lessons ?? 0)))}</table>`)}`;
  } else {
    throw new Error("UNSUPPORTED_OUTBOX_TEMPLATE");
  }

  const text = lines.join("\n");
  const isPricingCta =
    (row.template === "lesson_completed_account_holder" && (liveRemaining === 0 || Number(p.total_remaining_lessons) === 0)) ||
    (row.template === "lesson_remaining_rights_account_holder" && (liveRemaining === 0 || Number(p.total_remaining_lessons) === 0)) ||
    (row.template === "lesson_rights_manual" && Number(p.total_remaining_lessons ?? 0) === 0);
  const ctaUrl = isPricingCta
    ? (renderedIsEn ? "https://oriens-academy.com/en/pricing/" : "https://oriens-academy.com/tr/ucretler/")
    : (renderedIsEn ? "https://oriens-academy.com/en/account/" : "https://oriens-academy.com/tr/hesabim/");
  const ctaLabel = isPricingCta ? (renderedIsEn ? "Renew Lesson Rights" : "Ders Haklarını Yenile") : (renderedIsEn ? "Go to My Account" : "Hesabıma Git");
  const ctaButton = visualVariant
    ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="${visualVariant === "lesson-report" ? "#B8975A" : "#1B2A22"}" style="border-radius:10px;"><a href="${ctaUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;line-height:20px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;">${escapeHtml(ctaLabel)} &rarr;</a></td></tr></table>`
    : actionButton(ctaLabel, ctaUrl);
  const bodyHtml = `
    <div style="font-size:14px;line-height:1.65;color:#10271B;">
      ${customContentHtml || lines.map((line) => `<p style="margin:0 0 12px 0;">${escapeHtml(line)}</p>`).join("")}
      <div style="margin-top:${visualVariant ? "28px" : "20px"};${visualVariant === "payment-confirmation" ? "display:flex;justify-content:center;" : ""}">
        ${ctaButton}
      </div>
    </div>
  `;
  const html = renderEmailShell({
    locale: renderedIsEn ? "en" : "tr",
    eyebrow: renderedIsEn ? "Oriens Academy" : "Oriens Academy",
    title: title || subject,
    bodyHtml,
    footerEmail: "info@oriens-academy.com",
    visualVariant,
    footerNote: ["lesson_completed_account_holder", "package_assigned_manual"].includes(String(row.template))
      ? undefined
      : (renderedIsEn ? "This is an automated notification from Oriens Academy." : "Bu otomatik bir bilgilendirme e-postasıdır."),
  });

  return { subject, text, html, channel };
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = getSupabaseAdminKey();
  const schedulerKeyHash = Deno.env.get("OUTBOX_SCHEDULER_KEY_SHA256") ?? "";
  const apikey = req.headers.get("apikey") || "";
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const isServiceRequest = Boolean(serviceKey) && (bearer === serviceKey || apikey === serviceKey);
  const isScheduledRequest = body.source === "scheduled" && Boolean(schedulerKeyHash) && Boolean(apikey) &&
    (await sha256Hex(apikey)) === schedulerKeyHash;

  const admin = createClient(supabaseUrl, serviceKey);
  let isAdminRequest = false;
  if (!isServiceRequest && !isScheduledRequest && bearer) {
    const { data: userData } = await admin.auth.getUser(bearer);
    if (userData.user) {
      const { data: profile } = await admin
        .from("admin_profiles")
        .select("active,role")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      isAdminRequest = profile?.active === true && profile.role === "admin";
    }
  }

  if (!isServiceRequest && !isScheduledRequest && !isAdminRequest) {
    return buildJsonResponse({ success: false, error_code: "ADMIN_OR_SERVICE_REQUIRED" }, 403, req);
  }

  const { data, error } = await admin.rpc("claim_email_notifications", { p_limit: 10 });
  if (error) return buildJsonResponse({ success: false, error_code: "OUTBOX_CLAIM_FAILED" }, 500, req);

  let sent = 0;
  let failed = 0;
  for (const row of (data || []) as OutboxRow[]) {
    // 1. Decommissioned templates check: Cancel without error
    if (
      row.template === "package_activated_guardian" ||
      row.template === "lesson_rights_decreased" ||
      row.template === "package_low_balance_account_holder" ||
      row.template === "package_completed_renewal_account_holder" ||
      row.template === "lesson_remaining_rights_account_holder"
    ) {
      await admin.from("notification_deliveries").update({
        status: "cancelled",
        last_error_code: "TEMPLATE_DECOMMISSIONED",
        last_error: `Template ${row.template} is decommissioned. Lesson completion reports use manual MAIL-027.`,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      continue;
    }

    // 2. Lesson state check and live remaining-rights calculation for completion e-mails.
    let liveRemaining: number | undefined;
    if (["lesson_remaining_rights_account_holder", "lesson_completed_account_holder", "lesson_completed_guardian", "lesson_completed_student"].includes(String(row.template))) {
      const lessonId = row.entity_id || (row.payload as Record<string, unknown>)?.lesson_id;
      const { data: lesson } = await admin
        .from("student_lessons")
        .select("id, status, student_user_id, title, lesson_date")
        .eq("id", lessonId)
        .maybeSingle();

      if (!lesson || lesson.status !== "completed") {
        await admin.from("notification_deliveries").update({
          status: "cancelled",
          last_error_code: "LESSON_NOT_COMPLETED",
          last_error: `Lesson status is ${lesson?.status || "missing"}. Cancelled remaining rights delivery.`,
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        continue;
      }

      // Calculate authoritative live remaining rights across all active, non-expired packages
      const { data: rightsData } = await admin.rpc("calculate_student_usable_remaining_lessons", {
        p_student_id: lesson.student_user_id,
      });
      liveRemaining = Number(rightsData ?? 0);
    }

    try {
      const message = render(row, liveRemaining);
      const result = await sendTransactionalEmail({
        supabaseAdmin: admin,
        to: row.recipient,
        subject: message.subject,
        html: message.html,
        text: message.text,
        eventType: row.event_type,
        entityType: row.entity_type,
        entityId: row.entity_id,
        idempotencyKey: row.id,
        channel: message.channel,
        sender: row.template === "lesson_completed_account_holder"
          ? { name: "Oriens Academy", email: "info@oriens-academy.com" }
          : undefined,
        deliveryId: row.id,
      });
      if (result.status === "sent") sent += 1; else failed += 1;
    } catch (err) {
      failed += 1;
      await admin.from("notification_deliveries").update({
        status: "failed",
        last_error_code: "OUTBOX_RENDER_FAILED",
        last_error: err instanceof Error ? err.message.slice(0, 500) : "render failed",
        next_attempt_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
    }
  }
  return buildJsonResponse({ success: true, claimed: (data || []).length, sent, failed }, 200, req);
});
