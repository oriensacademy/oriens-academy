import {
  escapeHtml,
  normalContentBlock,
  sectionHeading,
  turkishGenitiveSuffix,
  type EmailVisualVariant,
} from "./templates.ts";

export type LessonReportPayload = Record<string, unknown>;

const TIMEZONE_LABELS: Record<string, string> = {
  "Europe/Istanbul": "TSİ",
  "Europe/London": "Birleşik Krallık Saati",
  "Europe/Berlin": "Orta Avrupa Saati",
  "America/New_York": "ABD Doğu Saati",
  "America/Chicago": "ABD Merkez Saati",
  "America/Denver": "ABD Dağ Saati",
  "America/Los_Angeles": "ABD Pasifik Saati",
  "America/Toronto": "Kanada Doğu Saati",
  UTC: "UTC",
};

function safeTimezone(value: unknown): string {
  const timezone = String(value || "Europe/Istanbul");
  try {
    new Intl.DateTimeFormat("tr-TR", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "Europe/Istanbul";
  }
}

function formatDate(value: unknown, locale: "tr" | "en", timeZone: string): string {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return String(value || "");
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
    timeZone,
  }).format(date);
}

function formatTime(value: unknown, timeZone: string): string {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
}

export function renderLessonReportEmail(
  template: string,
  payload: LessonReportPayload,
  liveRemaining?: number,
): {
  subject: string;
  title: string;
  text: string;
  bodyHtml: string;
  visualVariant?: EmailVisualVariant;
} {
  const isEn = String(payload.locale || "tr").toLowerCase().startsWith("en");
  const subject = isEn ? "Your Lesson Report and Current Lesson Balance" : "Ders Sonu Raporunuz ve Güncel Ders Bakiyeniz";
  const name = String(payload.account_holder_name || payload.guardian_name || (isEn ? "Account Owner" : "Hesap Sahibi"));
  const studentName = String(payload.student_name || payload.learner_name || "").trim();
  const remaining = Math.max(0, Number(liveRemaining ?? payload.total_remaining_lessons ?? 0));
  const report = String(payload.completion_report || "").trim();
  const lessonTimezone = safeTimezone(payload.lesson_timezone);
  const lessonTimezoneLabel = String(payload.lesson_timezone_label || TIMEZONE_LABELS[lessonTimezone] || lessonTimezone);
  const lessonDate = formatDate(payload.lesson_date, isEn ? "en" : "tr", lessonTimezone);
  const lessonTime = formatTime(payload.lesson_date, lessonTimezone);
  const greeting = isEn ? `Hello ${name},` : `Merhaba ${name},`;
  const studentSuffix = isEn ? "'s" : turkishGenitiveSuffix(studentName);
  const introduction = studentName
    ? (isEn
      ? `The evaluation report for ${studentName}'s completed lesson and your current lesson balance are provided below.`
      : `Öğrencimiz ${studentName}${studentSuffix} tamamlanan dersine ait değerlendirme raporu ve güncel ders bakiyeniz aşağıda yer almaktadır.`)
    : (isEn
      ? "The evaluation report for our student's completed lesson and your current lesson balance are provided below."
      : "Öğrencimizin tamamlanan dersine ilişkin değerlendirme raporu ile güncel ders bakiyenize aşağıda yer verilmiştir.");
  const rightsWarning = remaining === 0
    ? (isEn
      ? "Your current lesson balance is zero."
      : "Güncel ders bakiyeniz sıfırdır. Yeni paketinizi Havale/EFT ile veya site üzerinden kredi kartı ile satın alabilirsiniz.")
    : remaining === 1
      ? (isEn ? "Your current lesson balance is 1 lesson." : "Güncel ders bakiyeniz 1 derstir.")
      : "";

  if (report.length < 5) throw new Error("REPORT_REQUIRED");

  const lines = [
    greeting,
    introduction,
    `${isEn ? "Lesson" : "Ders"}: ${String(payload.lesson_title || "")}`,
    `${isEn ? "Subject" : "Konu"}: ${String(payload.subject || "")}`,
    `${isEn ? "Date" : "Tarih"}: ${lessonDate}`,
    `${isEn ? "Time" : "Saat"}: ${lessonTime} ${lessonTimezoneLabel}`,
    `${isEn ? "Duration" : "Süre"}: ${String(payload.duration_minutes || "")} ${isEn ? "minutes" : "dakika"}`,
    `${isEn ? "Lesson report" : "Ders sonu raporu"}: ${report}`,
    `${isEn ? "Current Lesson Balance" : "Güncel Ders Bakiyesi"}: ${remaining} ${isEn ? "lessons" : "Ders"}`,
  ];
  if (payload.instructor_name) lines.splice(6, 0, `${isEn ? "Instructor" : "Eğitmen"}: ${String(payload.instructor_name)}`);
  if (rightsWarning) lines.push(rightsWarning);

  const useReferenceVisual = template === "lesson_completed_account_holder";
  const rowHtml = (label: string, value: unknown, first = false) => {
    const labelPadding = useReferenceVisual ? (first ? "16px 0 10px 20px" : "10px 0 10px 20px") : "7px 0";
    const valuePadding = useReferenceVisual ? (first ? "16px 20px 10px 0" : "10px 20px 10px 0") : "7px 0";
    const divider = !first && useReferenceVisual ? "border-top:1px solid #EBEBE6;" : "";
    return `<tr><td style="padding:${labelPadding};color:${useReferenceVisual ? "#6B7078" : "#557064"};width:34%;${divider}">${escapeHtml(label)}</td><td style="padding:${valuePadding};font-weight:600;color:${useReferenceVisual ? "#141B2D" : "#10271B"};${divider}">${escapeHtml(String(value ?? ""))}</td></tr>`;
  };
  const lessonDetailsTable = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
    ${rowHtml(isEn ? "Lesson" : "Ders", payload.lesson_title, true)}
    ${rowHtml(isEn ? "Subject" : "Konu", payload.subject)}
    ${rowHtml(isEn ? "Date" : "Tarih", lessonDate)}
    ${rowHtml(isEn ? "Time" : "Saat", `${lessonTime} ${lessonTimezoneLabel}`)}
    ${rowHtml(isEn ? "Duration" : "Süre", `${String(payload.duration_minutes || "")} ${isEn ? "minutes" : "dakika"}`)}
    ${payload.instructor_name ? rowHtml(isEn ? "Instructor" : "Eğitmen", payload.instructor_name) : ""}
  </table>`;

  const bodyHtml = useReferenceVisual ? `
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
    <div style="margin:0;background-color:#141B2D;border-radius:12px;padding:20px 24px;"><span style="font-size:38px;line-height:42px;font-weight:700;color:#FFFFFF;">${escapeHtml(String(remaining))}</span><span style="padding-left:6px;font-size:16px;line-height:42px;font-weight:600;color:#D9C39A;">${escapeHtml(isEn ? "lessons" : "Ders")}</span></div>
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

  return {
    subject,
    title: subject,
    text: lines.join("\n"),
    bodyHtml,
    visualVariant: useReferenceVisual ? "lesson-report" : undefined,
  };
}
