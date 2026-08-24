/**
 * Oriens Academy — Comprehensive Transactional Email Templates
 * Premium Academic / International Education Consultancy Standard
 * Design: Navigation × Mathematics × Academia (Deep Forest, Warm Gold, Soft Sage)
 * 100% Inline CSS, Table-based, Mobile & Outlook/Gmail Responsive
 */

// ----------------------------------------------------------------------------
// DATA TYPES
// ----------------------------------------------------------------------------

export type BookingEmailData = {
  bookingId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  supportType: string;
  examCode?: string | null;
  customExam?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  locale: "tr" | "en";
  notes?: string | null;
  status: string;
};

export type ContactEmailData = {
  contactId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  message: string;
  locale: "tr" | "en";
  createdAt: string;
  source?: "website" | "contact_form" | "quick_contact" | "consultation";
  package?: {
    id: string;
    name: string;
    price: number | null;
    currency: string;
    lessons: number | null;
  } | null;
};

export type AppointmentEmailData = {
  appointmentId: string;
  studentName: string;
  studentEmail: string;
  teacherName?: string | null;
  lessonTitle: string;
  startsAt: string;
  endsAt?: string | null;
  locationOrMeetingUrl?: string | null;
  notes?: string | null;
  locale: "tr" | "en";
  previousStartsAt?: string | null;
  cancellationReason?: string | null;
};

export type PackagePurchaseEmailData = {
  orderReference: string;
  studentName: string;
  studentEmail: string;
  packageName: string;
  lessonCount: number;
  pricePerLesson?: number | null;
  totalAmount: number;
  currency: string;
  paymentMethod: "card" | "bank_transfer";
  createdAt: string;
  locale: "tr" | "en";
  portalUrl?: string;
};

export type PaymentSuccessEmailData = {
  paymentReference: string;
  studentName: string;
  studentEmail: string;
  packageName: string;
  amountPaid: number;
  currency: string;
  paymentMethod: string;
  paidAt: string;
  locale: "tr" | "en";
};

export type BankTransferPendingEmailData = {
  paymentReference: string;
  studentName: string;
  studentEmail: string;
  packageName: string;
  amount: number;
  currency: string;
  bankName: string;
  iban: string;
  accountHolder: string;
  locale: "tr" | "en";
};

export type PaymentReminderEmailData = {
  paymentReference: string;
  studentName: string;
  studentEmail: string;
  packageName: string;
  amount: number;
  currency: string;
  bankName?: string;
  iban?: string;
  accountHolder?: string;
  reminderCount?: number;
  locale: "tr" | "en";
};

export type BankTransferApprovedEmailData = {
  paymentReference: string;
  studentName: string;
  studentEmail: string;
  packageName: string;
  totalLessons: number;
  amountPaid: number;
  currency: string;
  locale: "tr" | "en";
};

export type AdminPaymentNotificationData = {
  paymentReference: string;
  payerName: string;
  payerEmail: string;
  payerPhone?: string | null;
  packageName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
  locale?: "tr" | "en";
};

export type PackageStatusEmailData = {
  studentName: string;
  studentEmail: string;
  packageName: string;
  totalLessons: number;
  lessonsUsed?: number;
  lessonsRemaining?: number;
  locale: "tr" | "en";
  recommendedPackageName?: string;
  recommendedPackageUrl?: string;
};

export type HomeworkEmailData = {
  homeworkId: string;
  studentName: string;
  studentEmail: string;
  assignmentTitle: string;
  subjectOrLesson: string;
  dueDate: string;
  contentType?: "homework" | "lesson_note" | "worksheet" | "resource" | "mock_exam";
  description?: string | null;
  submissionText?: string | null;
  teacherFeedback?: string | null;
  submittedAt?: string | null;
  locale: "tr" | "en";
};

export type WelcomeEmailData = {
  studentUserId?: string;
  studentName: string;
  studentEmail: string;
  temporaryPassword?: string | null;
  locale: "tr" | "en";
};

export type SecurityAlertEmailData = {
  studentEmail: string;
  actionTitle: string;
  actionDescription: string;
  timestamp: string;
  ipAddress?: string | null;
  device?: string | null;
  locale: "tr" | "en";
};

export type LiveLessonLinkEmailData = {
  lessonId: string;
  studentName: string;
  studentEmail: string;
  lessonTitle: string;
  subject: string;
  examCode?: string | null;
  lessonDate: string;
  durationMinutes: number;
  liveMeetingUrl: string;
  teacherName?: string | null;
  teacherNote?: string | null;
  isUpdate?: boolean;
  locale: "tr" | "en";
};

export type LessonCompletedEmailData = {
  lessonId: string;
  studentName: string;
  studentEmail: string;
  lessonTitle: string;
  subject?: string | null;
  lessonDate: string;
  packageName: string;
  remainingLessons: number;
  totalLessons: number;
  teacherNote?: string | null;
  locale: "tr" | "en";
};

// ----------------------------------------------------------------------------
// DESIGN TOKENS & VISUAL PALETTE
// ----------------------------------------------------------------------------

const PALETTE = {
  bg: "#F6F8F4",
  card: "#FFFFFF",
  surfaceMuted: "#F3F7F2",
  surfaceGold: "#FCF9EE",
  primary: "#10271B",
  primaryMuted: "#344B3E",
  sage: "#718977",
  gold: "#C9A452",
  goldDark: "#94742A",
  border: "#DFE7DE",
  borderGold: "#EBDDB2",
  borderSoft: "#EAEFE9",
  textMuted: "#5D7264",
};

const ORIENS_LOGO_URL = "https://oriens-academy.com/brand/oriens-logo-v2.png";
const BASE_URL = "https://oriens-academy.com";

// ----------------------------------------------------------------------------
// UTILITY & ESCAPING HELPERS
// ----------------------------------------------------------------------------

function escapeHtml(value: string | null | undefined): string {
  return (value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char] ?? char));
}

function formatCurrency(amount: number | null | undefined, currency = "TRY", locale: "tr" | "en" = "tr"): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  try {
    return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

function formatDateTime(isoStr?: string | null, locale: "tr" | "en" = "tr"): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return d.toLocaleString(locale === "tr" ? "tr-TR" : "en-GB", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Istanbul",
    });
  } catch {
    return isoStr;
  }
}

function formatDate(isoStr?: string | null, locale: "tr" | "en" = "tr"): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Europe/Istanbul",
    });
  } catch {
    return isoStr;
  }
}

function formatSupportLabel(type: string, locale: "tr" | "en"): string {
  if (type === "exam_preparation") return locale === "tr" ? "Sınav Hazırlığı" : "Exam Preparation";
  if (type === "university_support") return locale === "tr" ? "Üniversite Ders Desteği" : "University Support";
  return locale === "tr" ? "Genel Akademik Danışmanlık" : "General Consultation";
}

function joinText(lines: Array<string | null | undefined | false>): string {
  return lines.filter((line) => line !== null && line !== undefined && line !== false).join("\n").trim();
}

// ----------------------------------------------------------------------------
// REUSABLE UI BLOCKS FOR EMAILS (CARD / BADGE / METRICS / BUTTONS)
// ----------------------------------------------------------------------------

export function actionButton(label: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
      <tr>
        <td style="border-radius:10px;background-color:${PALETTE.primary};text-align:center;">
          <a href="${href}" target="_blank" style="display:inline-block;padding:13px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:.02em;color:#FFFFFF;text-decoration:none;border-radius:10px;">
            ${escapeHtml(label)} &rarr;
          </a>
        </td>
      </tr>
    </table>`;
}

export function infoBadge(text: string, variant: "gold" | "sage" | "forest" | "neutral" = "neutral"): string {
  let bg = PALETTE.surfaceMuted;
  let color = PALETTE.primary;
  let border = PALETTE.border;

  if (variant === "gold") {
    bg = PALETTE.surfaceGold;
    color = PALETTE.goldDark;
    border = PALETTE.borderGold;
  } else if (variant === "forest") {
    bg = PALETTE.primary;
    color = "#FFFFFF";
    border = PALETTE.primary;
  } else if (variant === "sage") {
    bg = "#EBF1EC";
    color = PALETTE.primaryMuted;
    border = PALETTE.border;
  }

  return `<span style="display:inline-block;vertical-align:middle;padding:4px 10px;font-size:11px;font-weight:700;line-height:100%;letter-spacing:.06em;text-transform:uppercase;border-radius:6px;background-color:${bg};color:${color};border:1px solid ${border};mso-line-height-rule:exactly;">${escapeHtml(text)}</span>`;
}

export function summaryCard(title: string | null, items: Array<{ label: string; value: string; fullWidth?: boolean }>): string {
  // Group into pairs for 2-column layout
  const rows: string[] = [];
  let currentRow: string[] = [];

  items.filter((i) => i.value).forEach((item) => {
    if (item.fullWidth) {
      if (currentRow.length > 0) {
        rows.push(`<tr>${currentRow.join("")}</tr>`);
        currentRow = [];
      }
      rows.push(`<tr><td colspan="2" style="padding:8px 10px;box-sizing:border-box;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${PALETTE.sage};margin-bottom:3px;">${escapeHtml(item.label)}</div>
        <div style="font-size:14px;font-weight:600;color:${PALETTE.primary};line-height:1.4;overflow-wrap:anywhere;word-break:break-word;">${item.value}</div>
      </td></tr>`);
    } else {
      currentRow.push(`
        <td class="stack-col" width="50%" valign="top" style="padding:8px 10px;box-sizing:border-box;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${PALETTE.sage};margin-bottom:3px;">${escapeHtml(item.label)}</div>
          <div style="font-size:14px;font-weight:600;color:${PALETTE.primary};line-height:1.4;overflow-wrap:anywhere;word-break:break-word;">${item.value}</div>
        </td>`);
      if (currentRow.length === 2) {
        rows.push(`<tr>${currentRow.join("")}</tr>`);
        currentRow = [];
      }
    }
  });

  if (currentRow.length > 0) {
    if (currentRow.length === 1) {
      currentRow.push(`<td class="stack-col" width="50%" valign="top" style="padding:8px 10px;"></td>`);
    }
    rows.push(`<tr>${currentRow.join("")}</tr>`);
  }

  return `
    <div style="margin-top:20px;background-color:${PALETTE.surfaceMuted};border:1px solid ${PALETTE.border};border-radius:12px;padding:16px 14px;">
      ${title ? `<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${PALETTE.primary};margin:0 0 12px 10px;">${escapeHtml(title)}</div>` : ""}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;">
        ${rows.join("")}
      </table>
    </div>`;
}

export function metricCard(opts: {
  badge?: string;
  title: string;
  metricValue: string;
  metricLabel: string;
  subtext?: string;
}): string {
  return `
    <div style="margin-top:20px;background-color:${PALETTE.surfaceMuted};border:1px solid ${PALETTE.border};border-radius:12px;padding:18px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
        <tr>
          <td align="left" valign="middle" style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${PALETTE.sage};line-height:16px;">
            ${escapeHtml(opts.title)}
          </td>
          ${opts.badge ? `<td align="right" valign="middle" style="line-height:16px;">${infoBadge(opts.badge, "gold")}</td>` : ""}
        </tr>
      </table>
      <div style="font-size:24px;font-weight:700;color:${PALETTE.primary};letter-spacing:-.01em;margin-top:6px;">
        ${escapeHtml(opts.metricValue)}
      </div>
      <div style="font-size:12px;color:${PALETTE.textMuted};margin-top:2px;">
        ${escapeHtml(opts.metricLabel)}
      </div>
      ${opts.subtext ? `<div style="font-size:12px;color:${PALETTE.primaryMuted};margin-top:10px;padding-top:10px;border-top:1px dashed ${PALETTE.border};">${escapeHtml(opts.subtext)}</div>` : ""}
    </div>`;
}

export function bankDetailsCard(bank: {
  bankName: string;
  iban: string;
  accountHolder: string;
  amountText: string;
  referenceCode: string;
  locale: "tr" | "en";
}): string {
  const isTr = bank.locale === "tr";
  return `
    <div style="margin-top:20px;background-color:${PALETTE.surfaceGold};border:1px solid ${PALETTE.borderGold};border-radius:12px;padding:18px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
        <tr>
          <td align="left" valign="middle" style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${PALETTE.goldDark};line-height:16px;">
            ${isTr ? "Banka Havalesi / EFT Bilgileri" : "Bank Wire Transfer Details"}
          </td>
          <td align="right" valign="middle" style="line-height:16px;">
            ${infoBadge(isTr ? "IBAN Ödemesi" : "Wire Transfer", "gold")}
          </td>
        </tr>
      </table>
      
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
        <tr>
          <td style="padding:6px 0;font-size:12px;color:${PALETTE.textMuted};width:40%;">${isTr ? "Banka Adı" : "Bank Name"}:</td>
          <td style="padding:6px 0;font-size:13px;font-weight:700;color:${PALETTE.primary};">${escapeHtml(bank.bankName)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:12px;color:${PALETTE.textMuted};">${isTr ? "Hesap Sahibi" : "Account Holder"}:</td>
          <td style="padding:6px 0;font-size:13px;font-weight:700;color:${PALETTE.primary};">${escapeHtml(bank.accountHolder)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:12px;color:${PALETTE.textMuted};">IBAN:</td>
          <td style="padding:6px 0;font-family:Consolas,Menlo,monospace;font-size:13px;font-weight:700;color:${PALETTE.primary};">${escapeHtml(bank.iban)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:12px;color:${PALETTE.textMuted};">${isTr ? "Ödenecek Tutar" : "Amount to Pay"}:</td>
          <td style="padding:6px 0;font-size:16px;font-weight:700;color:${PALETTE.primary};">${escapeHtml(bank.amountText)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:12px;color:${PALETTE.goldDark};font-weight:700;">${isTr ? "Açıklama (Referans Kodu)" : "Payment Reference"}:</td>
          <td style="padding:6px 0;font-family:Consolas,Menlo,monospace;font-size:15px;font-weight:700;color:${PALETTE.primary};background-color:#FFFFFF;padding:4px 8px;border-radius:6px;border:1px solid ${PALETTE.borderGold};display:inline-block;">
            ${escapeHtml(bank.referenceCode)}
          </td>
        </tr>
      </table>

      <div style="margin-top:14px;padding-top:12px;border-top:1px dashed ${PALETTE.borderGold};font-size:12px;line-height:1.5;color:${PALETTE.goldDark};">
        ${isTr ? "<strong>Önemli:</strong> Transfer açıklama kısmına yalnızca yukarıdaki <strong>Referans Kodunu</strong> yazmanız ödemenizin anında eşleşmesini sağlar." : "<strong>Important:</strong> Please include only the <strong>Reference Code</strong> in your transfer description to ensure prompt verification."}
      </div>
    </div>`;
}

// ----------------------------------------------------------------------------
// ROOT EMAIL SHELL (RESPONSIVE, ROBUST, INLINE-STYLED)
// ----------------------------------------------------------------------------

export function renderEmailShell(opts: {
  locale: "tr" | "en";
  eyebrow: string;
  title: string;
  bodyHtml: string;
  footerNote?: string;
  footerEmail?: string;
}): string {
  const { locale, eyebrow, title, bodyHtml, footerNote, footerEmail = "info@oriens-academy.com" } = opts;
  const isTr = locale === "tr";

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
  @media only screen and (max-width: 600px) {
    .email-container { width: 100% !important; border-radius: 0 !important; }
    .email-content { padding: 20px 20px !important; }
    .stack-col { display: block !important; width: 100% !important; max-width: 100% !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${PALETTE.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PALETTE.bg};padding:32px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:${PALETTE.card};border:1px solid ${PALETTE.border};border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(16,39,27,0.03);">
        <!-- BRAND HEADER -->
        <tr>
          <td style="padding:28px 36px 0 36px;">
            <a href="${BASE_URL}" target="_blank" style="text-decoration:none;">
              <img src="${ORIENS_LOGO_URL}" width="175" alt="Oriens Academy" style="display:block;width:175px;max-width:100%;height:auto;border:0;outline:none;" />
            </a>
            <div style="height:3px;width:52px;background-color:${PALETTE.gold};border-radius:2px;margin-top:14px;"></div>
          </td>
        </tr>

        <!-- SUBJECT & EYEBROW -->
        <tr>
          <td style="padding:20px 36px 0 36px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${PALETTE.sage};">${escapeHtml(eyebrow)}</div>
            <div style="font-size:22px;font-weight:700;color:${PALETTE.primary};line-height:1.3;margin-top:6px;letter-spacing:-.01em;">${escapeHtml(title)}</div>
          </td>
        </tr>

        <!-- MAIN BODY -->
        <tr>
          <td class="email-content" style="padding:20px 36px 24px 36px;font-size:14px;line-height:1.65;color:${PALETTE.primary};">
            ${bodyHtml}
          </td>
        </tr>

        <!-- FOOTER & SIGNATURE -->
        <tr>
          <td style="padding:24px 36px 28px 36px;background-color:${PALETTE.surfaceMuted};border-top:1px solid ${PALETTE.borderSoft};">
            ${footerNote ? `<div style="font-size:12px;color:${PALETTE.textMuted};margin-bottom:14px;line-height:1.4;">${footerNote}</div>` : ""}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:13px;font-weight:700;color:${PALETTE.primary};">Oriens Academy</div>
                  <div style="font-size:12px;color:${PALETTE.textMuted};margin-top:3px;">
                    <a href="mailto:${escapeHtml(footerEmail)}" style="color:${PALETTE.textMuted};text-decoration:none;">${escapeHtml(footerEmail)}</a> &middot; +90 544 293 90 40
                  </div>
                  <div style="font-size:11px;color:${PALETTE.sage};margin-top:4px;line-height:1.4;">
                    ${isTr ? "Emaar Square, The Heights E Blok, Ünalan Mah., Libadiye Cd. No:82, Üsküdar / İstanbul" : "Emaar Square, The Heights E Block, Ünalan Neighborhood, Libadiye Street No:82, Üsküdar / Istanbul"}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ============================================================================
// A. GÖRÜŞME / İLETİŞİM (CONSULTATION & CONTACT EMAILS)
// ============================================================================

/**
 * 1. Admin Booking Notification Email
 */
export function renderAdminBookingEmail(data: BookingEmailData, adminLocale: "tr" | "en" = "tr") {
  const isTr = adminLocale === "tr";
  const examInfo = data.examCode
    ? data.examCode.toUpperCase()
    : data.customExam
      ? data.customExam
      : null;
  const examSuffix = examInfo ? ` — ${examInfo}` : "";

  const subject = isTr
    ? `Yeni Görüşme Talebi${examSuffix} | Oriens Academy`
    : `New Consultation Request${examSuffix} | Oriens Academy`;

  const formattedTime = formatDateTime(data.startsAt, adminLocale);
  const supportLabel = formatSupportLabel(data.supportType, adminLocale);

  const cardHtml = summaryCard(isTr ? "Talep Detayları" : "Request Details", [
    { label: isTr ? "Öğrenci / Veli" : "Name", value: escapeHtml(data.fullName) },
    { label: isTr ? "E-posta" : "Email", value: `<a href="mailto:${escapeHtml(data.email)}" style="color:${PALETTE.primary};">${escapeHtml(data.email)}</a>` },
    { label: isTr ? "Telefon" : "Phone", value: data.phone ? escapeHtml(data.phone) : "—" },
    { label: isTr ? "Akademik Odak" : "Focus", value: `${supportLabel}${examInfo ? ` (${examInfo})` : ""}` },
    { label: isTr ? "Görüşme Zamanı" : "Slot Time", value: formattedTime || (isTr ? "Belirtilmedi" : "Not specified") },
    { label: isTr ? "Ziyaretçi Dili" : "Language", value: data.locale.toUpperCase() },
    { label: isTr ? "Öğrenci Notu" : "Notes", value: data.notes ? escapeHtml(data.notes) : "", fullWidth: true },
  ]);

  const bodyHtml = `
    <div>${isTr ? "Web sitesi üzerinden yeni bir tanışma ve akademik değerlendirme görüşmesi talebi oluşturuldu." : "A new consultation and academic evaluation request has been submitted on the website."}</div>
    ${cardHtml}
    ${actionButton(isTr ? "Görüşmeleri İncele" : "Review Bookings", `${BASE_URL}/admin/gorusmeler`)}`;

  const html = renderEmailShell({
    locale: adminLocale,
    eyebrow: isTr ? "Yeni Talep" : "New Request",
    title: subject,
    bodyHtml,
    footerNote: `${isTr ? "Rezervasyon Kayıt Kodu" : "Booking ID"}: ${data.bookingId}`,
    footerEmail: "contact@oriens-academy.com",
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`, "",
    `${isTr ? "Öğrenci / Veli" : "Name"}: ${data.fullName}`,
    `${isTr ? "E-posta" : "Email"}: ${data.email}`,
    data.phone ? `${isTr ? "Telefon" : "Phone"}: ${data.phone}` : null,
    `${isTr ? "Akademik Odak" : "Focus"}: ${supportLabel}${examInfo ? ` (${examInfo})` : ""}`,
    formattedTime ? `${isTr ? "Görüşme Zamanı" : "Time"}: ${formattedTime}` : null,
    data.notes ? `${isTr ? "Notlar" : "Notes"}: ${data.notes}` : null,
    "", `${isTr ? "Admin Paneli" : "Admin Panel"}: ${BASE_URL}/admin/gorusmeler`,
  ]);

  return { subject, html, text };
}

/**
 * 2. Student Booking Acknowledgement Email
 */
export function renderStudentBookingEmail(data: BookingEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? "Görüşme Talebiniz Alındı | Oriens Academy"
    : "Your Consultation Request Received | Oriens Academy";
  const safeName = escapeHtml(data.fullName);
  const formattedTime = formatDateTime(data.startsAt, data.locale);
  const supportLabel = formatSupportLabel(data.supportType, data.locale);

  const intro = isTr
    ? `Merhaba <strong>${safeName}</strong>,<br><br>Oriens Academy ile tanışma ve akademik değerlendirme görüşmesi talebiniz başarıyla bize ulaştı. Danışman ekibimiz bilgilerinizi inceleyerek en kısa sürede sizinle iletişime geçecektir.`
    : `Hello <strong>${safeName}</strong>,<br><br>We have received your introductory consultation request with Oriens Academy. Our academic team will review your details and reach out to you shortly.`;

  const detailsCard = summaryCard(isTr ? "Görüşme Özeti" : "Consultation Summary", [
    { label: isTr ? "Akademik Odak" : "Focus Area", value: `${supportLabel}${data.examCode ? ` (${data.examCode.toUpperCase()})` : ""}` },
    { label: isTr ? "Tercih Edilen Zaman" : "Preferred Time", value: formattedTime || (isTr ? "En kısa sürede" : "As soon as possible") },
    { label: isTr ? "İletişim E-postası" : "Contact Email", value: escapeHtml(data.email) },
    { label: isTr ? "Telefon" : "Phone", value: data.phone ? escapeHtml(data.phone) : "—" },
  ]);

  const bodyHtml = `
    <div>${intro}</div>
    ${detailsCard}
    <div style="margin-top:18px;font-size:13px;color:${PALETTE.textMuted};">
      ${isTr ? "Görüşme öncesinde sorularınız veya eklemek istediğiniz hedefleriniz olursa bu e-postayı yanıtlayarak bize iletebilirsiniz." : "If you have any questions or additional academic goals before the call, feel free to reply to this email."}
    </div>`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Görüşme Talebi" : "Consultation Request",
    title: isTr ? "Talebiniz Alındı" : "Request Received",
    bodyHtml,
    footerEmail: "contact@oriens-academy.com",
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`, "",
    isTr ? `Merhaba ${data.fullName},` : `Hello ${data.fullName},`, "",
    isTr ? "Görüşme talebiniz başarıyla alındı. Danışman ekibimiz en kısa sürede sizinle iletişime geçecektir." : "Your consultation request has been received. Our team will contact you shortly.",
    "", `Oriens Academy - info@oriens-academy.com`,
  ]);

  return { subject, html, text };
}

/**
 * 3. Admin Contact Form Notification Email
 */
export function renderAdminContactEmail(data: ContactEmailData, adminLocale: "tr" | "en" = "tr") {
  const isTr = adminLocale === "tr";
  const isQuick = data.source === "quick_contact";
  const subject = isTr
    ? "Yeni İletişim Talebi | Oriens Academy"
    : "New Contact Request | Oriens Academy";

  const packagePrice = data.package?.price
    ? formatCurrency(data.package.price, data.package.currency, adminLocale)
    : null;

  const cardItems = [
    { label: isTr ? "Ad Soyad" : "Full Name", value: !isQuick && data.fullName ? escapeHtml(data.fullName) : (isTr ? "Hızlı İletişim" : "Quick Contact") },
    { label: isTr ? "E-posta" : "Email", value: `<a href="mailto:${escapeHtml(data.email)}" style="color:${PALETTE.primary};">${escapeHtml(data.email)}</a>` },
    ...(data.phone ? [{ label: isTr ? "Telefon" : "Phone", value: escapeHtml(data.phone) }] : []),
    ...(data.subject ? [{ label: isTr ? "Konu / Sınav" : "Subject", value: escapeHtml(data.subject) }] : []),
    ...(data.package ? [{ label: isTr ? "İlgilenilen Paket" : "Package", value: `${escapeHtml(data.package.name)}${packagePrice ? ` (${packagePrice})` : ""}` }] : []),
    { label: isTr ? "Dil" : "Language", value: data.locale.toUpperCase() },
  ];

  const cardHtml = summaryCard(isTr ? "İletişim Bilgileri" : "Contact Information", cardItems);

  const messageHtml = data.message ? `
    <div style="margin-top:16px;background-color:${PALETTE.surfaceMuted};border:1px solid ${PALETTE.border};border-radius:12px;padding:16px 18px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${PALETTE.sage};margin-bottom:6px;">${isTr ? "Ziyaretçi Mesajı" : "Visitor Message"}</div>
      <div style="font-size:14px;line-height:1.6;color:${PALETTE.primary};white-space:pre-wrap;">${escapeHtml(data.message)}</div>
    </div>` : "";

  const bodyHtml = `
    <div>${isTr ? "Web sitesi iletişim formu üzerinden yeni bir mesaj iletildi." : "A new message has been submitted via the website contact form."}</div>
    ${cardHtml}
    ${messageHtml}
    ${actionButton(isTr ? "İletişim Taleplerini Aç" : "View Contact Requests", `${BASE_URL}/admin/iletisim`)}`;

  const html = renderEmailShell({
    locale: adminLocale,
    eyebrow: "ORIENS ACADEMY",
    title: isTr ? "Yeni İletişim Talebi" : "New Contact Request",
    bodyHtml,
    footerNote: isTr ? `Kayıt ID: ${data.contactId}` : `Contact ID: ${data.contactId}`,
    footerEmail: "contact@oriens-academy.com",
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`, "",
    data.fullName ? `${isTr ? "Ad Soyad" : "Name"}: ${data.fullName}` : null,
    `${isTr ? "E-posta" : "Email"}: ${data.email}`,
    data.phone ? `${isTr ? "Telefon" : "Phone"}: ${data.phone}` : null,
    data.message ? `\n${isTr ? "Mesaj" : "Message"}:\n${data.message}` : null,
    "", `${isTr ? "Admin Paneli" : "Admin Panel"}: ${BASE_URL}/admin/iletisim`,
  ]);

  return { subject, html, text };
}

/**
 * 4. Student Contact Acknowledgement Email
 */
export function renderStudentContactEmail(data: ContactEmailData) {
  const isTr = data.locale === "tr";
  const isQuick = data.source === "quick_contact";
  const subject = isTr
    ? "Mesajınız Bize Ulaştı | Oriens Academy"
    : "We Received Your Message | Oriens Academy";
  const safeName = escapeHtml(data.fullName);

  const intro = isTr
    ? `${isQuick ? "Merhaba" : `Merhaba <strong>${safeName}</strong>`},<br><br>Oriens Academy'ye ilettiğiniz mesaj başarıyla alınmıştır. Akademik danışmanlarımız talebinizi inceleyerek en geç 24 saat içinde sizinle iletişime geçecektir.`
    : `${isQuick ? "Hello" : `Hello <strong>${safeName}</strong>`},<br><br>Thank you for reaching out to Oriens Academy. Our academic advisors have received your inquiry and will respond within 24 hours.`;

  const bodyHtml = `
    <div>${intro}</div>
    <div style="margin-top:20px;padding:16px 18px;background-color:${PALETTE.surfaceMuted};border:1px solid ${PALETTE.border};border-radius:12px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${PALETTE.sage};">${isTr ? "İletilen Bilgiler" : "Submitted Details"}</div>
      <div style="font-size:14px;font-weight:600;color:${PALETTE.primary};margin-top:6px;">${escapeHtml(data.subject || (isTr ? "Genel Danışmanlık" : "General Inquiry"))}</div>
      ${data.message ? `<div style="font-size:13px;color:${PALETTE.textMuted};margin-top:6px;line-height:1.5;">${escapeHtml(data.message)}</div>` : ""}
    </div>`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "İletişim" : "Contact",
    title: isTr ? "Mesajınız Alındı" : "Message Received",
    bodyHtml,
    footerEmail: "contact@oriens-academy.com",
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`, "",
    isTr ? "Mesajınız bize ulaştı. En kısa sürede sizinle iletişime geçeceğiz." : "We received your message and will get back to you shortly.",
    "", `Oriens Academy - info@oriens-academy.com`,
  ]);

  return { subject, html, text };
}

// ============================================================================
// B. RANDEVU MAİLLERİ (APPOINTMENT & LESSON EMAILS)
// ============================================================================

/**
 * 5. Randevu Oluşturuldu / Onaylandı — Öğrenciye
 */
export function renderStudentAppointmentConfirmedEmail(data: AppointmentEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? `Ders Randevunuz Onaylandı: ${data.lessonTitle} | Oriens Academy`
    : `Lesson Appointment Confirmed: ${data.lessonTitle} | Oriens Academy`;

  const formattedTime = formatDateTime(data.startsAt, data.locale);

  const cardHtml = summaryCard(isTr ? "Ders Detayları" : "Lesson Details", [
    { label: isTr ? "Ders / Konu" : "Lesson", value: escapeHtml(data.lessonTitle) },
    { label: isTr ? "Eğitmen / Danışman" : "Instructor", value: data.teacherName ? escapeHtml(data.teacherName) : "Oriens Faculty" },
    { label: isTr ? "Tarih ve Saat" : "Date & Time", value: formattedTime },
    { label: isTr ? "Format" : "Location", value: data.locationOrMeetingUrl ? `<a href="${data.locationOrMeetingUrl}" style="color:${PALETTE.primary};font-weight:700;">${isTr ? "Online Ders Odası" : "Online Classroom"} &rarr;</a>` : (isTr ? "Online (Google Meet / Zoom)" : "Online Meeting") },
    { label: isTr ? "Eğitmen Notu" : "Notes", value: data.notes ? escapeHtml(data.notes) : "", fullWidth: true },
  ]);

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Ders randevunuz başarıyla planlanmış ve takvime eklenmiştir.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Your lesson appointment has been confirmed and added to the schedule.`}</div>
    ${cardHtml}
    ${data.locationOrMeetingUrl ? actionButton(isTr ? "Derse Katıl" : "Join Lesson", data.locationOrMeetingUrl) : actionButton(isTr ? "Öğrenci Paneline Git" : "Go to Portal", `${BASE_URL}/${data.locale}/hesabim`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Ders Randevusu" : "Appointment",
    title: isTr ? "Randevunuz Onaylandı" : "Appointment Confirmed",
    bodyHtml,
    footerNote: isTr ? "Ders saatinizden 5 dakika önce hazır bulunmanızı rica ederiz." : "Please be ready 5 minutes prior to the scheduled lesson time.",
    footerEmail: "support@oriens-academy.com",
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`, "",
    `${isTr ? "Ders" : "Lesson"}: ${data.lessonTitle}`,
    `${isTr ? "Tarih" : "Time"}: ${formattedTime}`,
    data.locationOrMeetingUrl ? `${isTr ? "Bağlantı" : "Link"}: ${data.locationOrMeetingUrl}` : null,
  ]);

  return { subject, html, text };
}

/**
 * 6. Randevu Oluşturuldu — Yöneticiye
 */
export function renderAdminAppointmentCreatedEmail(data: AppointmentEmailData, adminLocale: "tr" | "en" = "tr") {
  const isTr = adminLocale === "tr";
  const subject = isTr
    ? `Yeni Ders Randevusu: ${data.studentName} — ${data.lessonTitle} | Oriens Academy`
    : `New Lesson Scheduled: ${data.studentName} — ${data.lessonTitle} | Oriens Academy`;

  const formattedTime = formatDateTime(data.startsAt, adminLocale);

  const cardHtml = summaryCard(isTr ? "Randevu Özeti" : "Appointment Summary", [
    { label: isTr ? "Öğrenci" : "Student", value: escapeHtml(data.studentName) },
    { label: isTr ? "Öğrenci E-posta" : "Student Email", value: escapeHtml(data.studentEmail) },
    { label: isTr ? "Ders / Konu" : "Lesson Title", value: escapeHtml(data.lessonTitle) },
    { label: isTr ? "Tarih & Saat" : "Date & Time", value: formattedTime },
    { label: isTr ? "Eğitmen" : "Teacher", value: data.teacherName ? escapeHtml(data.teacherName) : "Oriens Faculty" },
  ]);

  const bodyHtml = `
    <div>${isTr ? "Öğrenci için yeni bir ders randevusu oluşturuldu ve takvime işlendi." : "A new lesson appointment has been scheduled and recorded in the calendar."}</div>
    ${cardHtml}
    ${actionButton(isTr ? "Yönetim Panelinde Aç" : "View in Admin", `${BASE_URL}/admin/ogrenciler`)}`;

  const html = renderEmailShell({
    locale: adminLocale,
    eyebrow: "ORIENS ACADEMY",
    title: subject,
    bodyHtml,
    footerEmail: "support@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", `${data.studentName} - ${data.lessonTitle} - ${formattedTime}`]);
  return { subject, html, text };
}

/**
 * 7. Randevu Güncellendi — Öğrenciye
 */
export function renderStudentAppointmentUpdatedEmail(data: AppointmentEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? `Ders Randevusu Saati Güncellendi: ${data.lessonTitle} | Oriens Academy`
    : `Lesson Time Updated: ${data.lessonTitle} | Oriens Academy`;

  const newTime = formatDateTime(data.startsAt, data.locale);
  const oldTime = data.previousStartsAt ? formatDateTime(data.previousStartsAt, data.locale) : null;

  const cardHtml = summaryCard(isTr ? "Güncel Ders Bilgisi" : "Updated Appointment", [
    { label: isTr ? "Ders" : "Lesson", value: escapeHtml(data.lessonTitle) },
    { label: isTr ? "Yeni Tarih & Saat" : "New Date & Time", value: `<strong style="color:${PALETTE.goldDark};">${newTime}</strong>` },
    oldTime ? { label: isTr ? "Önceki Tarih" : "Previous Time", value: oldTime } : { label: "", value: "" },
    { label: isTr ? "Eğitmen" : "Instructor", value: data.teacherName ? escapeHtml(data.teacherName) : "Oriens Faculty" },
    { label: isTr ? "Güncelleme Notu" : "Update Reason", value: data.notes ? escapeHtml(data.notes) : (isTr ? "Saat düzenlemesi yapıldı." : "Schedule adjustment."), fullWidth: true },
  ]);

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Ders randevunuzun tarihi veya saati güncellenmiştir.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Your lesson appointment time has been rescheduled.`}</div>
    ${cardHtml}
    ${actionButton(isTr ? "Detayları Görüntüle" : "View in Portal", `${BASE_URL}/${data.locale}/hesabim`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Randevu Güncellemesi" : "Schedule Update",
    title: isTr ? "Ders Saati Değişti" : "Appointment Rescheduled",
    bodyHtml,
    footerEmail: "support@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", `${isTr ? "Yeni Saat" : "New Time"}: ${newTime}`]);
  return { subject, html, text };
}

/**
 * 8. Randevu İptal Edildi — Öğrenciye
 */
export function renderStudentAppointmentCancelledEmail(data: AppointmentEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? `Ders Randevusu İptali: ${data.lessonTitle} | Oriens Academy`
    : `Lesson Cancelled: ${data.lessonTitle} | Oriens Academy`;

  const formattedTime = formatDateTime(data.startsAt, data.locale);

  const cardHtml = summaryCard(isTr ? "İptal Edilen Randevu" : "Cancelled Lesson", [
    { label: isTr ? "Ders" : "Lesson", value: escapeHtml(data.lessonTitle) },
    { label: isTr ? "Planlanan Zaman" : "Scheduled Time", value: formattedTime },
    { label: isTr ? "İptal Gerekçesi" : "Reason", value: data.cancellationReason ? escapeHtml(data.cancellationReason) : (isTr ? "Talebiniz veya eğitmen uygunluğu doğrultusunda iptal edildi." : "Cancelled as requested or due to faculty availability."), fullWidth: true },
  ]);

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Aşağıda belirtilen ders randevusu iptal edilmiştir. Paketinizdeki ders hakkınız hesabınıza iade edilmiştir.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>The following lesson appointment has been cancelled. Your lesson credit remains intact in your package balance.`}</div>
    ${cardHtml}
    ${actionButton(isTr ? "Yeni Randevu Oluştur" : "Reschedule Lesson", `${BASE_URL}/${data.locale}/hesabim`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Randevu İptali" : "Cancellation",
    title: isTr ? "Ders İptal Edildi" : "Lesson Cancelled",
    bodyHtml,
    footerEmail: "support@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", `${isTr ? "İptal Edilen Ders" : "Cancelled Lesson"}: ${data.lessonTitle} - ${formattedTime}`]);
  return { subject, html, text };
}

/**
 * 9. Randevu Hatırlatması — Öğrenciye (24h / 2h önce)
 */
export function renderStudentAppointmentReminderEmail(data: AppointmentEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? `Hatırlatma: Yarınki Dersiniz — ${data.lessonTitle} | Oriens Academy`
    : `Reminder: Upcoming Lesson — ${data.lessonTitle} | Oriens Academy`;

  const formattedTime = formatDateTime(data.startsAt, data.locale);

  const cardHtml = summaryCard(isTr ? "Ders Bilgileri" : "Lesson Information", [
    { label: isTr ? "Ders / Konu" : "Lesson", value: escapeHtml(data.lessonTitle) },
    { label: isTr ? "Eğitmen" : "Instructor", value: data.teacherName ? escapeHtml(data.teacherName) : "Oriens Faculty" },
    { label: isTr ? "Başlangıç Saati" : "Starts At", value: `<strong style="color:${PALETTE.goldDark};">${formattedTime}</strong>` },
    { label: isTr ? "Platform" : "Platform", value: data.locationOrMeetingUrl ? `<a href="${data.locationOrMeetingUrl}" style="color:${PALETTE.primary};font-weight:700;">${isTr ? "Online Ders Odası" : "Join Online"} &rarr;</a>` : (isTr ? "Online Görüşme Odası" : "Online Room") },
  ]);

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Oriens Academy bünyesindeki bir sonraki ders randevunuzu hatırlatmak isteriz.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>This is a gentle reminder of your upcoming lesson with Oriens Academy.`}</div>
    ${cardHtml}
    ${data.locationOrMeetingUrl ? actionButton(isTr ? "Derse Katıl" : "Join Classroom", data.locationOrMeetingUrl) : actionButton(isTr ? "Öğrenci Paneli" : "Student Portal", `${BASE_URL}/${data.locale}/hesabim`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Ders Hatırlatması" : "Lesson Reminder",
    title: isTr ? "Yaklaşan Dersiniz" : "Upcoming Lesson",
    bodyHtml,
    footerNote: isTr ? "Ders materyallerinizi ve çalışma notlarınızı hazır bulundurmanızı öneririz." : "We recommend having your study materials and notebook ready prior to the session.",
    footerEmail: "support@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", `${data.lessonTitle} - ${formattedTime}`]);
  return { subject, html, text };
}

// ============================================================================
// C. PAKET / SATIN ALMA / ÖDEME MAİLLERİ (PURCHASE & PAYMENTS)
// ============================================================================

/**
 * 10. Paket Satın Alındı / Sipariş Alındı — Öğrenciye
 */
export function renderStudentPackagePurchasedEmail(data: PackagePurchaseEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? `Siparişiniz Alındı: ${data.packageName} | Oriens Academy`
    : `Order Received: ${data.packageName} | Oriens Academy`;

  const formattedTotal = formatCurrency(data.totalAmount, data.currency, data.locale);
  const formattedPerLesson = data.pricePerLesson
    ? formatCurrency(data.pricePerLesson, data.currency, data.locale)
    : formatCurrency(Math.round(data.totalAmount / data.lessonCount), data.currency, data.locale);

  const cardHtml = summaryCard(isTr ? "Paket ve Sipariş Detayları" : "Package & Order Details", [
    { label: isTr ? "Paket Adı" : "Package", value: escapeHtml(data.packageName) },
    { label: isTr ? "Toplam Ders Sayısı" : "Total Lessons", value: `${data.lessonCount} ${isTr ? "Ders" : "Lessons"}` },
    { label: isTr ? "Ders Başı Ücret" : "Per Lesson", value: formattedPerLesson },
    { label: isTr ? "Toplam Tutar" : "Total Amount", value: `<strong style="color:${PALETTE.goldDark};">${formattedTotal}</strong>` },
    { label: isTr ? "Ödeme Yöntemi" : "Payment Method", value: data.paymentMethod === "bank_transfer" ? (isTr ? "Banka Havalesi / EFT" : "Bank Transfer") : (isTr ? "Kredi Kartı" : "Credit Card") },
    { label: isTr ? "Referans No" : "Reference No", value: escapeHtml(data.orderReference) },
  ]);

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Oriens Academy'den <strong>${escapeHtml(data.packageName)}</strong> paketi siparişiniz başarıyla alınmıştır. Bizi tercih ettiğiniz için teşekkür ederiz.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Thank you for choosing Oriens Academy. Your order for <strong>${escapeHtml(data.packageName)}</strong> has been received.`}</div>
    ${cardHtml}
    ${actionButton(isTr ? "Hesabım & Paketlerim" : "My Account & Packages", data.portalUrl || `${BASE_URL}/${data.locale}/hesabim`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Sipariş Onayı" : "Order Confirmation",
    title: isTr ? "Teşekkür Ederiz" : "Thank You For Your Order",
    bodyHtml,
    footerEmail: "payments@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", `${data.packageName} - ${formattedTotal} - ${data.orderReference}`]);
  return { subject, html, text };
}

/**
 * 11. Ödeme Başarılı — Öğrenciye
 */
export function renderStudentPaymentSuccessEmail(data: PaymentSuccessEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? `Ödemeniz Başarıyla Alındı (${data.paymentReference}) | Oriens Academy`
    : `Payment Successful (${data.paymentReference}) | Oriens Academy`;

  const formattedAmount = formatCurrency(data.amountPaid, data.currency, data.locale);
  const formattedDate = formatDateTime(data.paidAt, data.locale);

  const cardHtml = summaryCard(isTr ? "Ödeme Makbuzu Bilgileri" : "Payment Receipt", [
    { label: isTr ? "Paket" : "Package", value: escapeHtml(data.packageName) },
    { label: isTr ? "Ödenen Tutar" : "Amount Paid", value: `<strong style="color:${PALETTE.goldDark};">${formattedAmount}</strong>` },
    { label: isTr ? "İşlem Referansı" : "Reference", value: escapeHtml(data.paymentReference) },
    { label: isTr ? "Ödeme Yöntemi" : "Payment Method", value: escapeHtml(data.paymentMethod) },
    { label: isTr ? "Ödeme Zamanı" : "Payment Date", value: formattedDate },
    { label: isTr ? "Durum" : "Status", value: infoBadge(isTr ? "ÖDENDİ" : "PAID", "gold") },
  ]);

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br><strong>${formattedAmount}</strong> tutarındaki ödemeniz başarıyla tahsil edilmiştir. Ders kredileriniz hesabınıza tanımlanmıştır.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Your payment of <strong>${formattedAmount}</strong> has been successfully processed. Your lesson credits are now available in your portal.`}</div>
    ${cardHtml}
    ${actionButton(isTr ? "Ders Planlamaya Başla" : "Schedule Lessons", `${BASE_URL}/${data.locale}/hesabim`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Ödeme Onayı" : "Payment Confirmation",
    title: isTr ? "Ödeme Başarılı" : "Payment Received",
    bodyHtml,
    footerEmail: "payments@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", `${data.paymentReference} - ${formattedAmount} - ${data.packageName}`]);
  return { subject, html, text };
}

/**
 * 12. Banka Havalesi / IBAN Ödeme Talebi Oluşturuldu — Öğrenciye
 */
export function renderStudentBankTransferPendingEmail(data: BankTransferPendingEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? `Banka Havalesi Bilgileri: ${data.packageName} (${data.paymentReference}) | Oriens Academy`
    : `Bank Transfer Instructions: ${data.packageName} (${data.paymentReference}) | Oriens Academy`;

  const formattedAmount = formatCurrency(data.amount, data.currency, data.locale);

  const bankCard = bankDetailsCard({
    bankName: data.bankName,
    iban: data.iban,
    accountHolder: data.accountHolder,
    amountText: formattedAmount,
    referenceCode: data.paymentReference,
    locale: data.locale,
  });

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br><strong>${escapeHtml(data.packageName)}</strong> paketi için banka havalesi / EFT ödeme talebiniz oluşturulmuştur. Lütfen aşağıdaki hesap bilgilerine transfer işlemini gerçekleştiriniz:` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Your bank wire transfer order for <strong>${escapeHtml(data.packageName)}</strong> has been initiated. Please complete the transfer using the account details below:`}</div>
    ${bankCard}
    <div style="margin-top:18px;font-size:13px;color:${PALETTE.textMuted};line-height:1.5;">
      ${isTr ? "Transferiniz banka hesabımıza ulaştığında ekibimiz ödemeyi onaylayacak ve paketiniz anında aktif edilecektir. Sorularınız için bu e-postayı yanıtlayabilirsiniz." : "Once the transfer is received, our finance team will verify it and activate your package immediately."}
    </div>
    ${actionButton(isTr ? "Ödeme Durumunu Kontrol Et" : "Check Payment Status", `${BASE_URL}/${data.locale}/hesabim`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Havale Talebi" : "Bank Transfer",
    title: isTr ? "Ödeme Bilgileriniz" : "Payment Instructions",
    bodyHtml,
    footerEmail: "payments@oriens-academy.com",
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`, "",
    `${isTr ? "Banka" : "Bank"}: ${data.bankName}`,
    `IBAN: ${data.iban}`,
    `${isTr ? "Tutar" : "Amount"}: ${formattedAmount}`,
    `${isTr ? "Açıklama" : "Reference"}: ${data.paymentReference}`,
  ]);

  return { subject, html, text };
}

/**
 * 13. Banka Havalesi Ödeme Hatırlatması — Öğrenciye
 */
export function renderStudentPaymentReminderEmail(data: PaymentReminderEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? `Ödeme Hatırlatması: ${data.packageName} (${data.paymentReference}) | Oriens Academy`
    : `Payment Reminder: ${data.packageName} (${data.paymentReference}) | Oriens Academy`;

  const formattedAmount = formatCurrency(data.amount, data.currency, data.locale);

  const bankCard = data.iban ? bankDetailsCard({
    bankName: data.bankName || "Garanti BBVA",
    iban: data.iban,
    accountHolder: data.accountHolder || "Oriens Danışmanlık ve Eğitim Ltd. Şti.",
    amountText: formattedAmount,
    referenceCode: data.paymentReference,
    locale: data.locale,
  }) : "";

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br><strong>${escapeHtml(data.packageName)}</strong> paketi için oluşturulan <strong>${data.paymentReference}</strong> referanslı bekleyen ödemenizi hatırlatmak isteriz.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>This is a gentle reminder regarding your pending order <strong>${data.paymentReference}</strong> for <strong>${escapeHtml(data.packageName)}</strong>.`}</div>
    ${bankCard}
    <div style="margin-top:16px;font-size:13px;color:${PALETTE.textMuted};">
      ${isTr ? "Ödemeniz tamamlandığında ders paketiniz derhal aktif hale gelecektir. Eğer ödemeyi gerçekleştirdiyseniz lütfen bu mesajı dikkate almayınız." : "Your lessons will be unlocked immediately upon confirmation. If you have already made the transfer, please disregard this note."}
    </div>
    ${actionButton(isTr ? "Hesabıma Git" : "Go to Portal", `${BASE_URL}/${data.locale}/hesabim`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Ödeme Hatırlatması" : "Payment Reminder",
    title: isTr ? "Bekleyen Ödeme" : "Pending Payment",
    bodyHtml,
    footerEmail: "payments@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", `${data.paymentReference} - ${formattedAmount} - ${data.packageName}`]);
  return { subject, html, text };
}

/**
 * 14. Banka Havalesi Ödeme Onaylandı — Öğrenciye
 */
export function renderStudentBankTransferApprovedEmail(data: BankTransferApprovedEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? `Havaleniz Onaylandı & Paketiniz Aktif! (${data.packageName}) | Oriens Academy`
    : `Bank Transfer Confirmed & Package Activated! (${data.packageName}) | Oriens Academy`;

  const formattedAmount = formatCurrency(data.amountPaid, data.currency, data.locale);

  const cardHtml = summaryCard(isTr ? "Aktif Paket Özeti" : "Activated Package", [
    { label: isTr ? "Paket" : "Package", value: escapeHtml(data.packageName) },
    { label: isTr ? "Tanımlanan Ders Sayısı" : "Credited Lessons", value: `<strong style="color:${PALETTE.goldDark};">${data.totalLessons} ${isTr ? "Ders" : "Lessons"}</strong>` },
    { label: isTr ? "Onaylanan Tutar" : "Verified Amount", value: formattedAmount },
    { label: isTr ? "İşlem Referansı" : "Reference", value: escapeHtml(data.paymentReference) },
  ]);

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Banka havalesi ödemeniz finans ekibimiz tarafından onaylanmış ve <strong>${data.totalLessons} derslik</strong> paketiniz öğrenci hesabınızda aktif edilmiştir.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Your bank transfer has been verified and your package with <strong>${data.totalLessons} lessons</strong> is now fully active.`}</div>
    ${cardHtml}
    ${actionButton(isTr ? "Ders Randevusu Planla" : "Book Your First Lesson", `${BASE_URL}/${data.locale}/hesabim`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Ödeme Onayı" : "Transfer Approved",
    title: isTr ? "Paketiniz Aktif Edildi" : "Package Activated",
    bodyHtml,
    footerEmail: "payments@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", `${data.packageName} - ${data.totalLessons} ${isTr ? "Ders" : "Lessons"}`]);
  return { subject, html, text };
}

/**
 * 15. Yöneticiye Yeni Ödeme Bildirimi — Admin'e
 */
export function renderAdminPaymentNotificationEmail(data: AdminPaymentNotificationData, adminLocale: "tr" | "en" = "tr") {
  const isTr = adminLocale === "tr";
  const subject = isTr
    ? `Yeni Ödeme Bildirimi (${formatCurrency(data.amount, data.currency, adminLocale)}) — ${data.payerName} | Oriens Academy`
    : `New Payment Alert (${formatCurrency(data.amount, data.currency, adminLocale)}) — ${data.payerName} | Oriens Academy`;

  const formattedAmount = formatCurrency(data.amount, data.currency, adminLocale);
  const formattedDate = formatDateTime(data.createdAt, adminLocale);

  const cardHtml = summaryCard(isTr ? "Mali İşlem Özeti" : "Transaction Summary", [
    { label: isTr ? "Ödeyen" : "Payer Name", value: escapeHtml(data.payerName) },
    { label: isTr ? "E-posta" : "Email", value: `<a href="mailto:${escapeHtml(data.payerEmail)}" style="color:${PALETTE.primary};">${escapeHtml(data.payerEmail)}</a>` },
    { label: isTr ? "Telefon" : "Phone", value: data.payerPhone ? escapeHtml(data.payerPhone) : "—" },
    { label: isTr ? "Paket" : "Package", value: escapeHtml(data.packageName) },
    { label: isTr ? "Tutar" : "Amount", value: `<strong style="color:${PALETTE.goldDark};">${formattedAmount}</strong>` },
    { label: isTr ? "Yöntem / Durum" : "Method & Status", value: `${data.paymentMethod} &middot; ${infoBadge(data.status.toUpperCase(), data.status === "paid" ? "gold" : "neutral")}` },
    { label: isTr ? "Referans Kodu" : "Reference", value: escapeHtml(data.paymentReference) },
    { label: isTr ? "Tarih" : "Timestamp", value: formattedDate },
  ]);

  const bodyHtml = `
    <div>${isTr ? "Sistemde yeni bir ödeme hareketi gerçekleşti." : "A new payment transaction has been registered in the system."}</div>
    ${cardHtml}
    ${actionButton(isTr ? "Ödemeleri Yönet" : "Manage Payments", `${BASE_URL}/admin/odemeler`)}`;

  const html = renderEmailShell({
    locale: adminLocale,
    eyebrow: "ORIENS ACADEMY",
    title: subject,
    bodyHtml,
    footerEmail: "payments@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", `${data.payerName} - ${formattedAmount} - ${data.paymentReference}`]);
  return { subject, html, text };
}

/**
 * 16. Paket Aktif Edildi — Öğrenciye
 */
export function renderStudentPackageActivatedEmail(data: PackageStatusEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? `Ders Paketiniz Aktif Edildi: ${data.packageName} | Oriens Academy`
    : `Your Package is Active: ${data.packageName} | Oriens Academy`;

  const metricHtml = metricCard({
    title: isTr ? "Tanımlanan Ders Kredisi" : "Lesson Credits",
    metricValue: `${data.totalLessons} ${isTr ? "Ders" : "Lessons"}`,
    metricLabel: data.packageName,
    badge: isTr ? "AKTİF" : "ACTIVE",
    subtext: isTr ? "Dilediğiniz zaman öğrenci portalı üzerinden eğitmeninizle ders planlayabilirsiniz." : "You can schedule your sessions anytime via the student portal.",
  });

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br><strong>${escapeHtml(data.packageName)}</strong> paketiniz başarıyla tanımlanmış ve öğrenim yolculuğunuz için aktif hale getirilmiştir.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Your <strong>${escapeHtml(data.packageName)}</strong> package is now active and ready to use.`}</div>
    ${metricHtml}
    ${actionButton(isTr ? "İlk Dersini Planla" : "Book Your First Lesson", `${BASE_URL}/${data.locale}/hesabim`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Paket Aktivasyonu" : "Package Activation",
    title: isTr ? "Öğrenim Yolculuğunuz Başladı" : "Your Journey Begins",
    bodyHtml,
    footerEmail: "payments@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", `${data.packageName} - ${data.totalLessons} ${isTr ? "Ders" : "Lessons"}`]);
  return { subject, html, text };
}

/**
 * 17. Paket Bitmek Üzere — Öğrenciye (Kalan 1-2 Ders)
 */
export function renderStudentPackageLowBalanceEmail(data: PackageStatusEmailData) {
  const isTr = data.locale === "tr";
  const remaining = data.lessonsRemaining ?? 1;
  const subject = isTr
    ? `Paketinizde Son ${remaining} Ders Kaldı (${data.packageName}) | Oriens Academy`
    : `${remaining} Lesson${remaining > 1 ? "s" : ""} Remaining in Your Package | Oriens Academy`;

  const metricHtml = metricCard({
    title: isTr ? "Ders Durumu" : "Package Balance",
    metricValue: `${remaining} ${isTr ? "Ders Kaldı" : "Lessons Left"}`,
    metricLabel: `${isTr ? "Tamamlanan" : "Completed"}: ${data.lessonsUsed || 0} / ${data.totalLessons}`,
    badge: isTr ? "BİTMEK ÜZERE" : "LOW BALANCE",
    subtext: isTr ? "Akademik çalışma programınızın aksamaması için paketinizi yenileyebilirsiniz." : "Renew your package to maintain study momentum without interruption.",
  });

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br><strong>${escapeHtml(data.packageName)}</strong> paketinizdeki derslerin büyük bölümünü başarıyla tamamladınız. Paketinizde <strong>${remaining} ders</strong> hakkınız kalmıştır.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>You are nearing the end of your <strong>${escapeHtml(data.packageName)}</strong> package with <strong>${remaining} lesson(s)</strong> remaining.`}</div>
    ${metricHtml}
    ${actionButton(isTr ? "Paketi Yenile & Devam Et" : "Renew Package", `${BASE_URL}/${data.locale}/fiyatlandirma`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Ders Takibi" : "Progress Update",
    title: isTr ? "Paketiniz Tamamlanmak Üzere" : "Package Nearing Completion",
    bodyHtml,
    footerEmail: "payments@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", `${remaining} ${isTr ? "ders kaldı" : "lessons remaining"}`]);
  return { subject, html, text };
}

/**
 * 18. Paket Tamamlandı / Bitti — Öğrenciye
 */
export function renderStudentPackageCompletedEmail(data: PackageStatusEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? `Tebrikler! ${data.packageName} Paketini Tamamladınız | Oriens Academy`
    : `Congratulations! You Completed ${data.packageName} | Oriens Academy`;

  const metricHtml = metricCard({
    title: isTr ? "Tamamlanan Program" : "Completed Program",
    metricValue: `${data.totalLessons} / ${data.totalLessons} ${isTr ? "Ders" : "Lessons"}`,
    metricLabel: data.packageName,
    badge: isTr ? "TAMAMLANDI" : "COMPLETED",
    subtext: isTr ? "Akademik hedeflerinize ulaşma yolunda gösterdiğiniz özveri için teşekkür ederiz." : "Thank you for your dedication toward achieving your academic goals.",
  });

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br><strong>${escapeHtml(data.packageName)}</strong> programınızdaki tüm dersleri başarıyla tamamladınız! Eğitmenlerinizle birlikte kaydettiğiniz ilerlemeyi tebrik ederiz.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Congratulations on successfully completing all sessions in your <strong>${escapeHtml(data.packageName)}</strong> program!` }</div>
    ${metricHtml}
    ${actionButton(isTr ? "Yeni Bir Paket Seç" : "Explore Next Packages", `${BASE_URL}/${data.locale}/fiyatlandirma`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Program Başarısı" : "Milestone Achieved",
    title: isTr ? "Paket Tamamlandı" : "Package Completed",
    bodyHtml,
    footerEmail: "payments@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", `${data.packageName} ${isTr ? "başarıyla tamamlandı" : "successfully completed"}`]);
  return { subject, html, text };
}

/**
 * 19. Paket Yenileme Önerisi — Öğrenciye
 */
export function renderStudentPackageRenewalEmail(data: PackageStatusEmailData) {
  const isTr = data.locale === "tr";
  const recPackage = data.recommendedPackageName || (isTr ? "10 Derslik İleri Düzey Paket" : "10-Lesson Advanced Package");
  const subject = isTr
    ? `Akademik Çalışmalarınıza Devam Edin: ${recPackage} | Oriens Academy`
    : `Continue Your Momentum: ${recPackage} | Oriens Academy`;

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Akademik hedeflerinizde süreklilik sağlamak ve sınav performansınızı zirvede tutmak için eğitmenlerinizin önerdiği devam paketini inceleyebilirsiniz.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>To keep your academic momentum and maximize exam performance, explore our recommended continuation package.`}</div>
    <div style="margin-top:20px;padding:20px;background-color:${PALETTE.surfaceGold};border:1px solid ${PALETTE.borderGold};border-radius:12px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${PALETTE.goldDark};">${isTr ? "Önerilen Devam Paketi" : "Recommended Continuation Package"}</div>
      <div style="font-size:18px;font-weight:700;color:${PALETTE.primary};margin-top:6px;">${escapeHtml(recPackage)}</div>
      <div style="font-size:13px;color:${PALETTE.textMuted};margin-top:4px;">${isTr ? "Mevcut öğrenci avantajlarıyla hemen devam edin." : "Enjoy continuity advantages as an active student."}</div>
    </div>
    ${actionButton(isTr ? "Paketi İncele & Satın Al" : "Review Package", data.recommendedPackageUrl || `${BASE_URL}/${data.locale}/fiyatlandirma`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Akademik Öneri" : "Next Steps",
    title: isTr ? "Çalışmalarınıza Devam Edin" : "Keep Up The Momentum",
    bodyHtml,
    footerEmail: "payments@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", `${recPackage}`]);
  return { subject, html, text };
}

// ============================================================================
// D. ÖDEV / AKADEMİK TAKİP MAİLLERİ (HOMEWORK & ACADEMICS)
// ============================================================================

/**
 * 20. Yeni İçerik / Ödev Atandı — Öğrenciye
 */
export function renderStudentHomeworkAssignedEmail(data: HomeworkEmailData) {
  const isTr = data.locale === "tr";
  const type = data.contentType || "homework";

  const subjectMapTr: Record<string, string> = {
    homework: "Yeni Ödeviniz Var | Oriens Academy",
    lesson_note: "Yeni Ders Notunuz Var | Oriens Academy",
    worksheet: "Yeni Çalışma Kağıdınız Var | Oriens Academy",
    resource: "Yeni Eğitim Materyaliniz Var | Oriens Academy",
    mock_exam: "Yeni Denemeniz Var | Oriens Academy",
  };

  const subjectMapEn: Record<string, string> = {
    homework: `New Homework Assigned: ${data.assignmentTitle} | Oriens Academy`,
    lesson_note: `New Lesson Note Available: ${data.assignmentTitle} | Oriens Academy`,
    worksheet: `New Worksheet Assigned: ${data.assignmentTitle} | Oriens Academy`,
    resource: `New Study Material Available: ${data.assignmentTitle} | Oriens Academy`,
    mock_exam: `New Mock Exam Assigned: ${data.assignmentTitle} | Oriens Academy`,
  };

  const titleMapTr: Record<string, string> = {
    homework: "Yeni Ödeviniz Var",
    lesson_note: "Yeni Ders Notunuz Var",
    worksheet: "Yeni Çalışma Kağıdınız Var",
    resource: "Yeni Eğitim Materyaliniz Var",
    mock_exam: "Yeni Denemeniz Var",
  };

  const titleMapEn: Record<string, string> = {
    homework: "New Homework Assigned",
    lesson_note: "New Lesson Note",
    worksheet: "New Worksheet Assigned",
    resource: "New Study Material",
    mock_exam: "New Mock Exam Assigned",
  };

  const subject = (isTr ? subjectMapTr[type] : subjectMapEn[type]) || (isTr ? "Yeni İçeriğiniz Var | Oriens Academy" : `New Content: ${data.assignmentTitle} | Oriens Academy`);
  const headerTitle = (isTr ? titleMapTr[type] : titleMapEn[type]) || (isTr ? "Yeni İçeriğiniz Var" : "New Content Assigned");

  const formattedDueDate = formatDate(data.dueDate, data.locale);

  const cardHtml = summaryCard(isTr ? "İçerik Detayları" : "Content Details", [
    { label: isTr ? "Başlık" : "Title", value: escapeHtml(data.assignmentTitle) },
    { label: isTr ? "Ders / Konu" : "Subject", value: escapeHtml(data.subjectOrLesson) },
    ...(type === "lesson_note" || type === "resource" ? [] : [
      { label: isTr ? "Son Teslim Tarihi" : "Due Date", value: `<strong style="color:${PALETTE.goldDark};">${formattedDueDate}</strong>` }
    ]),
    { label: isTr ? "Durum" : "Status", value: infoBadge(isTr ? "ATANDI" : "ASSIGNED", "sage") },
    { label: isTr ? "Açıklama / Yönergeler" : "Instructions", value: data.description ? escapeHtml(data.description) : (isTr ? "Detaylar öğrenci portalında belirtilmiştir." : "See student portal for details."), fullWidth: true },
  ]);

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Eğitmeniniz tarafından <strong>${escapeHtml(data.subjectOrLesson)}</strong> için yeni bir içerik paylaşılmıştır.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Your instructor has shared new material for <strong>${escapeHtml(data.subjectOrLesson)}</strong>.`}</div>
    ${cardHtml}
    ${actionButton(isTr ? "İçeriği Görüntüle" : "View Content", `${BASE_URL}/${data.locale}/hesabim`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Akademik Takip" : "Academic Tracking",
    title: headerTitle,
    bodyHtml,
    footerNote: isTr ? "İçeriğe dilediğiniz zaman öğrenci portalı üzerinden erişebilirsiniz." : "You can access your materials anytime via the student portal.",
    footerEmail: "support@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", `${data.assignmentTitle}`]);
  return { subject, html, text };
}

/**
 * 21. Ödev Teslim Tarihi Yaklaşıyor — Öğrenciye
 */
export function renderStudentHomeworkDueReminderEmail(data: HomeworkEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? `Ödev Teslim Hatırlatması: ${data.assignmentTitle} | Oriens Academy`
    : `Homework Due Reminder: ${data.assignmentTitle} | Oriens Academy`;

  const formattedDueDate = formatDate(data.dueDate, data.locale);

  const cardHtml = summaryCard(isTr ? "Ödev Bilgisi" : "Assignment Info", [
    { label: isTr ? "Ödev" : "Title", value: escapeHtml(data.assignmentTitle) },
    { label: isTr ? "Son Teslim" : "Due Date", value: `<strong style="color:${PALETTE.goldDark};">${formattedDueDate}</strong>` },
    { label: isTr ? "Ders" : "Subject", value: escapeHtml(data.subjectOrLesson) },
  ]);

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br><strong>${escapeHtml(data.assignmentTitle)}</strong> ödevinizin teslim tarihi yaklaşmaktadır. Çalışmanızı zamanında iletmeyi unutmayınız.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>This is a reminder that your assignment <strong>${escapeHtml(data.assignmentTitle)}</strong> is due on <strong>${formattedDueDate}</strong>.`}</div>
    ${cardHtml}
    ${actionButton(isTr ? "Ödevi Gönder" : "Submit Assignment", `${BASE_URL}/${data.locale}/hesabim`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Ödev Hatırlatması" : "Due Date Reminder",
    title: isTr ? "Teslim Tarihi Yaklaşıyor" : "Assignment Due Soon",
    bodyHtml,
    footerEmail: "support@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", `${data.assignmentTitle} - ${formattedDueDate}`]);
  return { subject, html, text };
}

/**
 * 22. Ödev Teslim Edildi — Eğitmene/Yöneticiye
 */
export function renderTeacherHomeworkSubmittedEmail(data: HomeworkEmailData, adminLocale: "tr" | "en" = "tr") {
  const isTr = adminLocale === "tr";
  const subject = isTr
    ? `Ödev Teslim Edildi: ${data.studentName} — ${data.assignmentTitle} | Oriens Academy`
    : `Homework Submitted: ${data.studentName} — ${data.assignmentTitle} | Oriens Academy`;

  const formattedDate = formatDateTime(data.submittedAt || new Date().toISOString(), adminLocale);

  const cardHtml = summaryCard(isTr ? "Teslim Detayları" : "Submission Details", [
    { label: isTr ? "Öğrenci" : "Student", value: escapeHtml(data.studentName) },
    { label: isTr ? "Ödev Başlığı" : "Assignment", value: escapeHtml(data.assignmentTitle) },
    { label: isTr ? "Ders / Konu" : "Subject", value: escapeHtml(data.subjectOrLesson) },
    { label: isTr ? "Teslim Zamanı" : "Submitted At", value: formattedDate },
    { label: isTr ? "Öğrenci Yanıtı" : "Student Response", value: data.submissionText ? escapeHtml(data.submissionText) : (isTr ? "Dosya / metin yüklendi" : "Uploaded"), fullWidth: true },
  ]);

  const bodyHtml = `
    <div>${isTr ? `Öğrenci <strong>${escapeHtml(data.studentName)}</strong> ödevini teslim etti.` : `Student <strong>${escapeHtml(data.studentName)}</strong> has submitted their assignment.`}</div>
    ${cardHtml}
    ${actionButton(isTr ? "Ödevi İncele & Geri Bildirim Ver" : "Review Homework", `${BASE_URL}/admin/ogrenciler`)}`;

  const html = renderEmailShell({
    locale: adminLocale,
    eyebrow: "ORIENS ACADEMY",
    title: subject,
    bodyHtml,
    footerEmail: "support@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", `${data.studentName} - ${data.assignmentTitle}`]);
  return { subject, html, text };
}

/**
 * 23. Ödev İncelendi / Geri Bildirim Verildi — Öğrenciye
 */
export function renderStudentHomeworkReviewedEmail(data: HomeworkEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? "Ödeviniz Değerlendirildi | Oriens Academy"
    : `Homework Feedback Ready: ${data.assignmentTitle} | Oriens Academy`;

  const feedbackHtml = data.teacherFeedback ? `
    <div style="margin-top:16px;background-color:${PALETTE.surfaceGold};border:1px solid ${PALETTE.borderGold};border-radius:12px;padding:16px 18px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${PALETTE.goldDark};margin-bottom:6px;">${isTr ? "Eğitmen Geri Bildirimi" : "Instructor Feedback"}</div>
      <div style="font-size:14px;line-height:1.6;color:${PALETTE.primary};">${escapeHtml(data.teacherFeedback)}</div>
    </div>` : "";

  const cardHtml = summaryCard(isTr ? "Ödev Bilgisi" : "Assignment Info", [
    { label: isTr ? "Ödev" : "Title", value: escapeHtml(data.assignmentTitle) },
    { label: isTr ? "Ders" : "Subject", value: escapeHtml(data.subjectOrLesson) },
    { label: isTr ? "Durum" : "Status", value: infoBadge(isTr ? "İNCELENDİ" : "REVIEWED", "gold") },
  ]);

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br><strong>${escapeHtml(data.assignmentTitle)}</strong> başlıklı ödeviniz eğitmeniniz tarafından incelenmiş ve geri bildirim eklenmiştir.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Your submission for <strong>${escapeHtml(data.assignmentTitle)}</strong> has been reviewed by your instructor.`}</div>
    ${cardHtml}
    ${feedbackHtml}
    ${actionButton(isTr ? "Portaldan Detayları Gör" : "View Details in Portal", `${BASE_URL}/${data.locale}/hesabim`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Akademik Değerlendirme" : "Feedback Ready",
    title: isTr ? "Ödeviniz İncelendi" : "Feedback Ready",
    bodyHtml,
    footerEmail: "support@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", data.teacherFeedback || ""]);
  return { subject, html, text };
}

/**
 * 23B. Ödev Düzenleme Talebi — Öğrenciye
 */
export function renderStudentHomeworkRevisionRequestedEmail(data: HomeworkEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? "Ödeviniz İçin Düzenleme Talebi | Oriens Academy"
    : `Revision Requested: ${data.assignmentTitle} | Oriens Academy`;

  const feedbackHtml = data.teacherFeedback ? `
    <div style="margin-top:16px;background-color:${PALETTE.surfaceGold};border:1px solid ${PALETTE.borderGold};border-radius:12px;padding:16px 18px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${PALETTE.goldDark};margin-bottom:6px;">${isTr ? "Eğitmen Notu & Düzenleme İsteği" : "Instructor Revision Note"}</div>
      <div style="font-size:14px;line-height:1.6;color:${PALETTE.primary};">${escapeHtml(data.teacherFeedback)}</div>
    </div>` : "";

  const cardHtml = summaryCard(isTr ? "Ödev Bilgisi" : "Assignment Info", [
    { label: isTr ? "Ödev" : "Title", value: escapeHtml(data.assignmentTitle) },
    { label: isTr ? "Ders" : "Subject", value: escapeHtml(data.subjectOrLesson) },
    { label: isTr ? "Durum" : "Status", value: infoBadge(isTr ? "DÜZENLEME BEKLİYOR" : "REVISION NEEDED", "gold") },
  ]);

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br><strong>${escapeHtml(data.assignmentTitle)}</strong> başlıklı ödeviniz için eğitmeniniz düzenleme talebinde bulunmuştur. Lütfen eğitmen notunu inceleyerek ödevinizi güncelleyip tekrar teslim ediniz.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Your instructor has requested a revision for <strong>${escapeHtml(data.assignmentTitle)}</strong>. Please review the notes, update your submission, and resubmit.`}</div>
    ${cardHtml}
    ${feedbackHtml}
    ${actionButton(isTr ? "Ödevi Düzenle ve Yeniden Teslim Et" : "Edit & Resubmit Assignment", `${BASE_URL}/${data.locale}/hesabim`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Akademik Takip" : "Revision Request",
    title: isTr ? "Düzenleme Talebi" : "Revision Requested",
    bodyHtml,
    footerEmail: "support@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", data.teacherFeedback || ""]);
  return { subject, html, text };
}

// ============================================================================
// E. HESAP / GÜVENLİK MAİLLERİ (ACCOUNT & SECURITY)
// ============================================================================

/**
 * 24. Hoş Geldiniz / Hesap Oluşturuldu — Öğrenciye
 */
export function renderStudentWelcomeEmail(data: WelcomeEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? "Oriens Academy’ye Hoş Geldiniz"
    : "Welcome to Oriens Academy";

  const studentName = data.studentName || (isTr ? "Öğrenci" : "Student");
  const portalAccountUrl = isTr
    ? "https://oriens-academy.com/tr/hesabim/"
    : "https://oriens-academy.com/en/account/";

  const ctaLabel = isTr ? "Hesabıma Git" : "Go to My Account";

  const bodyHtml = isTr
    ? `
    <div style="font-size:14px;line-height:1.65;color:${PALETTE.primary};">
      <p style="margin:0 0 16px 0;">Merhaba <strong>${escapeHtml(studentName)}</strong>,</p>
      <p style="margin:0 0 12px 0;">Oriens Academy hesabınız başarıyla oluşturuldu.</p>
      <p style="margin:0 0 16px 0;">Artık öğrenci hesabınız üzerinden sınav hazırlık sürecinizi ve eğitim planınızı tek yerden yönetebilirsiniz.</p>
      
      <p style="margin:0 0 8px 0;font-weight:600;color:${PALETTE.primary};">Hesabınız üzerinden:</p>
      <ul style="margin:0 0 20px 0;padding-left:20px;font-size:14px;line-height:1.75;color:${PALETTE.primary};">
        <li style="margin-bottom:4px;">sınav geçmişinizi görüntüleyebilir,</li>
        <li style="margin-bottom:4px;">ders ve randevularınızı takip edebilir,</li>
        <li style="margin-bottom:4px;">ödevlerinizi görüntüleyip teslim edebilir,</li>
        <li style="margin-bottom:4px;">paket ve ödeme bilgilerinizi inceleyebilir,</li>
        <li style="margin-bottom:4px;">destek ekibimizle iletişime geçebilirsiniz.</li>
      </ul>
      ${actionButton(ctaLabel, portalAccountUrl)}
    </div>`
    : `
    <div style="font-size:14px;line-height:1.65;color:${PALETTE.primary};">
      <p style="margin:0 0 16px 0;">Hello <strong>${escapeHtml(studentName)}</strong>,</p>
      <p style="margin:0 0 12px 0;">Your Oriens Academy account has been created successfully.</p>
      <p style="margin:0 0 16px 0;">You can now manage your academic journey from your student account.</p>
      
      <p style="margin:0 0 8px 0;font-weight:600;color:${PALETTE.primary};">From your account, you can:</p>
      <ul style="margin:0 0 20px 0;padding-left:20px;font-size:14px;line-height:1.75;color:${PALETTE.primary};">
        <li style="margin-bottom:4px;">review your exam history,</li>
        <li style="margin-bottom:4px;">track lessons and appointments,</li>
        <li style="margin-bottom:4px;">view and submit assignments,</li>
        <li style="margin-bottom:4px;">manage package and payment information,</li>
        <li style="margin-bottom:4px;">contact the Oriens Academy support team.</li>
      </ul>
      ${actionButton(ctaLabel, portalAccountUrl)}
    </div>`;

  const footerNote = isTr
    ? "Oriens Academy &middot; info@oriens-academy.com &middot; support@oriens-academy.com"
    : "Oriens Academy &middot; info@oriens-academy.com &middot; support@oriens-academy.com";

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Hoş Geldiniz" : "Welcome",
    title: isTr ? "Oriens Academy’ye Hoş Geldiniz" : "Welcome to Oriens Academy",
    bodyHtml,
    footerNote,
    footerEmail: "support@oriens-academy.com",
  });

  const text = isTr
    ? joinText([
        `ORIENS ACADEMY - ${subject}`,
        "",
        `Merhaba ${studentName},`,
        "",
        "Oriens Academy hesabınız başarıyla oluşturuldu.",
        "Artık öğrenci hesabınız üzerinden sınav hazırlık sürecinizi ve eğitim planınızı tek yerden yönetebilirsiniz.",
        "",
        "Hesabınız üzerinden:",
        "• sınav geçmişinizi görüntüleyebilir,",
        "• ders ve randevularınızı takip edebilir,",
        "• ödevlerinizi görüntüleyip teslim edebilir,",
        "• paket ve ödeme bilgilerinizi inceleyebilir,",
        "• destek ekibimizle iletişime geçebilirsiniz.",
        "",
        `${ctaLabel}: ${portalAccountUrl}`,
        "",
        "Oriens Academy",
        "info@oriens-academy.com",
        "support@oriens-academy.com",
      ])
    : joinText([
        `ORIENS ACADEMY - ${subject}`,
        "",
        `Hello ${studentName},`,
        "",
        "Your Oriens Academy account has been created successfully.",
        "You can now manage your academic journey from your student account.",
        "",
        "From your account, you can:",
        "• review your exam history,",
        "• track lessons and appointments,",
        "• view and submit assignments,",
        "• manage package and payment information,",
        "• contact the Oriens Academy support team.",
        "",
        `${ctaLabel}: ${portalAccountUrl}`,
        "",
        "Oriens Academy",
        "info@oriens-academy.com",
        "support@oriens-academy.com",
      ]);

  return { subject, html, text };
}

/**
 * 25. Şifre Sıfırlama / Geçici Şifre — Kullanıcıya
 */
export function renderAccountPasswordRecoveryEmail(
  email: string,
  temporaryPassword: string,
  locale: "tr" | "en" = "tr"
) {
  const isTr = locale === "tr";
  const subject = isTr
    ? "Oriens Academy | Geçici Giriş Şifresi"
    : "Oriens Academy | Temporary Sign-In Password";

  const intro = isTr
    ? "Oriens Academy hesabınız için bir kurtarma talebi alındı ve yeni bir geçici giriş şifresi oluşturuldu."
    : "A recovery request was made for your Oriens Academy account, and a new temporary sign-in password has been generated.";

  const cardHtml = `
    <div style="margin-top:20px;background-color:${PALETTE.surfaceMuted};border:1px solid ${PALETTE.border};border-radius:12px;padding:18px 20px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${PALETTE.sage};">${isTr ? "Hesap E-postası" : "Account Email"}</div>
      <div style="font-size:14px;font-weight:600;color:${PALETTE.primary};margin-top:2px;">${escapeHtml(email)}</div>
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid ${PALETTE.border};">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${PALETTE.goldDark};">${isTr ? "Geçici Şifreniz" : "Temporary Password"}</div>
        <div style="font-family:Consolas,Menlo,monospace;font-size:22px;font-weight:700;letter-spacing:.06em;color:${PALETTE.primary};margin-top:6px;">${escapeHtml(temporaryPassword)}</div>
      </div>
    </div>`;

  const bodyHtml = `
    <div>${intro}</div>
    ${cardHtml}
    <div style="margin-top:18px;font-size:13px;color:${PALETTE.textMuted};line-height:1.5;">
      ${isTr ? "Bu şifreyle ortak Oturum Aç sayfasından giriş yapabilirsiniz. Güvenliğiniz için giriş yaptıktan sonra yeni bir şifre belirlemeniz önerilir." : "Use this password on the Sign In page. For your security, please update your password after signing in."}
    </div>
    ${actionButton(isTr ? "Oturum Aç" : "Sign In", `${BASE_URL}/${locale}/giris`)}
    <div style="margin-top:14px;color:${PALETTE.sage};font-size:12px;">
      ${isTr ? "Bu işlemi siz başlatmadıysanız lütfen derhal Oriens Academy sistemiyle iletişime geçiniz." : "If you did not initiate this request, please contact Oriens Academy support immediately."}
    </div>`;

  const html = renderEmailShell({
    locale,
    eyebrow: isTr ? "Hesap Güvenliği" : "Account Security",
    title: isTr ? "Yeni Geçici Şifreniz" : "Temporary Password",
    bodyHtml,
    footerEmail: "support@oriens-academy.com",
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`, "",
    `${isTr ? "E-posta" : "Email"}: ${email}`,
    `${isTr ? "Geçici Şifre" : "Password"}: ${temporaryPassword}`,
    `${BASE_URL}/${locale}/giris`,
  ]);

  return { subject, html, text };
}

/**
 * 26. Hesapta Önemli Değişiklik Bildirimi — Kullanıcıya
 */
export function renderAccountSecurityAlertEmail(data: SecurityAlertEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? `Güvenlik Bildirimi: ${data.actionTitle} | Oriens Academy`
    : `Security Alert: ${data.actionTitle} | Oriens Academy`;

  const cardHtml = summaryCard(isTr ? "İşlem Detayları" : "Activity Details", [
    { label: isTr ? "İşlem" : "Action", value: escapeHtml(data.actionTitle) },
    { label: isTr ? "E-posta" : "Account", value: escapeHtml(data.studentEmail) },
    { label: isTr ? "Tarih ve Saat" : "Timestamp", value: formatDateTime(data.timestamp, data.locale) },
    { label: isTr ? "IP / Cihaz" : "Device", value: data.device || data.ipAddress || (isTr ? "Güvenli Tarayıcı" : "Secure Browser") },
  ]);

  const bodyHtml = `
    <div>${isTr ? `Hesabınızda önemli bir güvenlik veya profil güncellemesi gerçekleştirildi: <strong>${escapeHtml(data.actionDescription)}</strong>` : `An important account security or profile update was performed: <strong>${escapeHtml(data.actionDescription)}</strong>`}</div>
    ${cardHtml}
    <div style="margin-top:16px;font-size:13px;color:${PALETTE.textMuted};">
      ${isTr ? "Bu işlemi siz gerçekleştirdiyseniz herhangi bir işlem yapmanıza gerek yoktur. İşlem bilginiz dışındaysa lütfen hemen şifrenizi sıfırlayınız veya bize ulaşınız." : "If this was you, no action is needed. If you did not make this change, please reset your password immediately."}
    </div>
    ${actionButton(isTr ? "Hesap Ayarları" : "Account Settings", `${BASE_URL}/${data.locale}/hesabim`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Güvenlik Uyarısı" : "Security Notice",
    title: isTr ? "Hesap Güncellemesi" : "Account Update",
    bodyHtml,
    footerEmail: "info@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", data.actionDescription]);
  return { subject, html, text };
}

/**
 * 27. Canlı Ders Bağlantısı — Öğrenciye
 */
export function renderStudentLiveLessonLinkEmail(data: LiveLessonLinkEmailData) {
  const isTr = data.locale === "tr";
  const subject = data.isUpdate
    ? (isTr ? `Canlı Ders Bağlantınız Güncellendi: ${data.lessonTitle} | Oriens Academy` : `Your Live Lesson Link Has Been Updated: ${data.lessonTitle} | Oriens Academy`)
    : (isTr ? `Canlı Ders Bağlantınız: ${data.lessonTitle} | Oriens Academy` : `Your Live Lesson Link: ${data.lessonTitle} | Oriens Academy`);

  const formattedTime = formatDateTime(data.lessonDate, data.locale);

  const cardHtml = summaryCard(isTr ? "Canlı Ders Bilgileri" : "Live Lesson Details", [
    { label: isTr ? "Ders / Konu" : "Lesson Title", value: escapeHtml(data.lessonTitle) },
    { label: isTr ? "Alan / Sınav" : "Subject & Exam", value: `${escapeHtml(data.subject)}${data.examCode ? ` (${data.examCode.toUpperCase()})` : ""}` },
    { label: isTr ? "Tarih ve Saat" : "Date & Time", value: `<strong style="color:${PALETTE.goldDark};">${formattedTime}</strong>` },
    { label: isTr ? "Süre" : "Duration", value: `${data.durationMinutes} ${isTr ? "Dakika" : "Minutes"}` },
    { label: isTr ? "Eğitmen" : "Instructor", value: data.teacherName ? escapeHtml(data.teacherName) : "Oriens Faculty" },
    { label: isTr ? "Bağlantı" : "Meeting Link", value: `<a href="${data.liveMeetingUrl}" target="_blank" style="color:${PALETTE.primary};font-weight:700;word-break:break-all;">${escapeHtml(data.liveMeetingUrl)} &rarr;</a>`, fullWidth: true },
    data.teacherNote ? { label: isTr ? "Eğitmen Notu" : "Teacher Note", value: escapeHtml(data.teacherNote), fullWidth: true } : { label: "", value: "" },
  ]);

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Yaklaşan birebir canlı dersinizin bağlantısı hazırlanmıştır. Ders saatinde aşağıdaki butona tıklayarak online ders odasına katılabilirsiniz.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>The link for your upcoming live 1-on-1 lesson is ready. You can join the online classroom at the scheduled time using the button below.`}</div>
    ${cardHtml}
    ${actionButton(isTr ? "Derse Katıl" : "Join Lesson", data.liveMeetingUrl)}
    <div style="margin-top:18px;font-size:13px;color:${PALETTE.textMuted};">
      ${isTr ? "Ders saatinden 5 dakika önce hazır olmanızı, kamera ve mikrofon bağlantılarınızı kontrol etmenizi öneririz." : "Please be ready 5 minutes prior to the lesson and verify your audio/video settings."}
    </div>`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Canlı Ders" : "Live Lesson",
    title: isTr ? "Canlı Ders Bağlantınız" : "Your Live Lesson Link",
    bodyHtml,
    footerNote: isTr ? "Ders saati veya bağlantıyla ilgili sorularınız için support@oriens-academy.com üzerinden bize ulaşabilirsiniz." : "For questions regarding your lesson link or schedule, contact support@oriens-academy.com.",
    footerEmail: "support@oriens-academy.com",
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`, "",
    `${isTr ? "Ders" : "Lesson"}: ${data.lessonTitle}`,
    `${isTr ? "Zaman" : "Time"}: ${formattedTime}`,
    `${isTr ? "Derse Katıl" : "Join Lesson"}: ${data.liveMeetingUrl}`,
    data.teacherNote ? `${isTr ? "Not" : "Note"}: ${data.teacherNote}` : null,
  ]);

  return { subject, html, text };
}

/**
 * 28. Ders Tamamlandı — Öğrenciye
 */
export function renderStudentLessonCompletedEmail(data: LessonCompletedEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? `Dersiniz Tamamlandı: ${data.lessonTitle} | Oriens Academy`
    : `Your Lesson is Completed: ${data.lessonTitle} | Oriens Academy`;

  const formattedDate = formatDate(data.lessonDate, data.locale);
  const remaining = Math.max(0, data.remainingLessons);

  const metricHtml = metricCard({
    title: isTr ? "Paket Kullanım Durumu" : "Package Status",
    metricValue: remaining > 0 ? `${remaining} ${isTr ? "Ders Kaldı" : "Lessons Left"}` : (isTr ? "Paket Tamamlandı" : "Package Complete"),
    metricLabel: data.packageName,
    badge: remaining > 0 ? (isTr ? "AKTİF" : "ACTIVE") : (isTr ? "TAMAMLANDI" : "COMPLETED"),
    subtext: remaining > 0
      ? (isTr ? `Bu ders ile birlikte paketinizde ${remaining} dersiniz kaldı.` : `You have ${remaining} lesson(s) remaining in your package.`)
      : (isTr ? "Tebrikler! Paketinizdeki tüm dersleri başarıyla tamamladınız." : "Congratulations! You have completed all lessons in your package."),
  });

  const detailsCard = summaryCard(isTr ? "Ders Kaydı" : "Completed Session", [
    { label: isTr ? "Tamamlanan Ders" : "Lesson", value: escapeHtml(data.lessonTitle) },
    { label: isTr ? "Tarih" : "Date", value: formattedDate },
    { label: isTr ? "İlişkili Paket" : "Package", value: escapeHtml(data.packageName) },
    { label: isTr ? "Kalan Ders Kredisi" : "Remaining Credits", value: `${remaining} / ${data.totalLessons}` },
    data.teacherNote ? { label: isTr ? "Eğitmen Notu" : "Teacher Note", value: escapeHtml(data.teacherNote), fullWidth: true } : { label: "", value: "" },
  ]);

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br><strong>${escapeHtml(data.lessonTitle)}</strong> dersiniz başarıyla tamamlandı ve öğrenim geçmişinize kaydedildi.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Your lesson <strong>${escapeHtml(data.lessonTitle)}</strong> has been marked as completed and added to your learning records.`}</div>
    ${detailsCard}
    ${metricHtml}
    ${actionButton(isTr ? "Öğrenci Paneline Git" : "Go to Student Portal", `${BASE_URL}/${data.locale}/hesabim`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Ders Takibi" : "Lesson Tracking",
    title: isTr ? "Dersiniz Tamamlandı" : "Lesson Completed",
    bodyHtml,
    footerEmail: "support@oriens-academy.com",
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`, "",
    `${isTr ? "Tamamlanan Ders" : "Lesson"}: ${data.lessonTitle}`,
    `${isTr ? "Kalan Ders" : "Remaining"}: ${remaining} / ${data.totalLessons}`,
    `${BASE_URL}/${data.locale}/hesabim`,
  ]);

  return { subject, html, text };
}

export interface SupportConfirmationEmailData {
  studentName: string;
  studentEmail: string;
  subject: string;
  categoryLabel: string;
  locale: "tr" | "en";
}

export function renderStudentSupportConfirmationEmail(
  data: SupportConfirmationEmailData
): EmailTemplateResult {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? "Destek Talebiniz Alındı | Oriens Academy"
    : "Your Support Request Has Been Received | Oriens Academy";

  const portalUrl = `${BASE_URL}/${data.locale}/${isTr ? "hesabim" : "account"}`;

  const detailsCard = summaryCard(isTr ? "Talep Bilgileri" : "Ticket Details", [
    { label: isTr ? "Konu" : "Subject", value: escapeHtml(data.subject) },
    { label: isTr ? "Kategori" : "Category", value: escapeHtml(data.categoryLabel) },
    { label: isTr ? "Durum" : "Status", value: isTr ? "İnceleniyor / Açık" : "In Review / Open" },
  ]);

  const bodyHtml = `
    <div>
      ${
        isTr
          ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Destek talebiniz başarıyla alınmış ve destek ekibimize iletilmiştir. Uzman ekibimiz talebinizi en kısa sürede inceleyerek Öğrenci Portalı üzerinden yanıtlayacaktır.`
          : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Your support request has been received and forwarded to our support team. Our team will review your inquiry and respond through your Student Portal promptly.`
      }
    </div>
    ${detailsCard}
    ${actionButton(isTr ? "Destek Mesajlarımı Görüntüle" : "View My Support Messages", portalUrl)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Öğrenci Destek" : "Student Support",
    title: isTr ? "Destek Talebiniz Alındı" : "Support Request Received",
    bodyHtml,
    footerEmail: "support@oriens-academy.com",
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`,
    "",
    isTr ? `Merhaba ${data.studentName},` : `Hello ${data.studentName},`,
    isTr
      ? "Destek talebiniz ekibimize iletildi. Durumu öğrenci portalınızdan takip edebilirsiniz."
      : "Your support request has been forwarded to our team. You can track updates in your student portal.",
    "",
    `${isTr ? "Konu" : "Subject"}: ${data.subject}`,
    `${isTr ? "Kategori" : "Category"}: ${data.categoryLabel}`,
    "",
    `${portalUrl}`,
  ]);

  return { subject, html, text };
}
