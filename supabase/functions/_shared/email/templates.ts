/**
 * Oriens Academy — Comprehensive Transactional Email Templates
 * Premium Academic / International Education Consultancy Standard
 * Design: Navigation × Mathematics × Academia (Deep Forest, Warm Gold, Soft Sage)
 * 100% Inline CSS, Table-based, Mobile & Outlook/Gmail Responsive
 */

// ----------------------------------------------------------------------------
// DATA TYPES
// ----------------------------------------------------------------------------

export type EmailTemplateResult = {
  subject: string;
  html: string;
  text: string;
};

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

/**
 * Canonical locale normalizer for the whole email system. Strict `=== "en"`
 * comparisons (still hand-rolled in several dispatchers) miss case variants
 * and BCP-47 regional tags -- "EN", "en-US", "en-GB" would all silently fall
 * back to Turkish. This extracts the primary language subtag case-insensitively;
 * anything that isn't "en" (including null/undefined/unknown) keeps the
 * existing canonical Turkish fallback.
 */
export function normalizeLocale(locale?: string | null): "tr" | "en" {
  const primary = (locale ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return primary === "en" ? "en" : "tr";
}

export type WelcomeEmailData = {
  studentUserId?: string;
  studentName: string;
  studentEmail: string;
  temporaryPassword?: string | null;
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

export type EmailChangeOtpEmailData = {
  candidateEmail: string;
  otp: string;
  locale: "tr" | "en";
  expiresInMinutes?: number;
};

export type EmailChangeSecurityNoticeEmailData = {
  oldEmail: string;
  newEmailMasked: string;
  changedAt?: string;
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

function formatSupportLabel(type: string, locale: "tr" | "en"): string {
  if (type === "exam_preparation") return locale === "tr" ? "Sınav Hazırlığı" : "Exam Preparation";
  if (type === "university_support") return locale === "tr" ? "Üniversite Ders Desteği" : "University Support";
  return locale === "tr" ? "Genel Akademik Danışmanlık" : "General Consultation";
}

export function humanizePaymentMethod(method?: string | null, locale: "tr" | "en" = "tr"): string {
  const isTr = locale === "tr";
  if (!method) return isTr ? "Kart ile Ödeme" : "Card Payment";
  const normalized = method.toLowerCase().trim();
  if (normalized === "card" || normalized === "credit_card" || normalized === "hosted_card" || normalized === "paytr") {
    return isTr ? "Kart ile Ödeme" : "Card Payment";
  }
  if (normalized === "bank_transfer" || normalized === "wire" || normalized === "eft" || normalized === "havale") {
    return isTr ? "Banka Havalesi / EFT" : "Bank Transfer / EFT";
  }
  return isTr ? "Kart ile Ödeme" : "Card Payment";
}

export function humanizeEventType(eventType?: string | null, locale: "tr" | "en" = "tr"): string {
  const isTr = locale === "tr";
  if (!eventType) return isTr ? "Ders" : "Lesson";
  const normalized = eventType.toLowerCase().trim();
  if (normalized === "lesson") return isTr ? "Ders" : "Lesson";
  if (normalized === "discovery" || normalized === "pre_consultation") return isTr ? "Ön Görüşme" : "Pre-Consultation";
  if (normalized === "additional_consultation") return isTr ? "Ek Görüşme" : "Follow-up Meeting";
  if (normalized === "consultation") return isTr ? "Danışmanlık" : "Consultation";
  if (normalized === "other") return isTr ? "Diğer" : "Other";
  return isTr ? "Ders" : "Lesson";
}

export function humanizePaymentStatus(status?: string | null, locale: "tr" | "en" = "tr"): string {
  const isTr = locale === "tr";
  if (!status) return isTr ? "Bekliyor" : "Pending";
  const normalized = status.toLowerCase().trim();
  if (normalized === "paid" || normalized === "completed" || normalized === "success") {
    return isTr ? "Ödendi" : "Paid";
  }
  if (normalized === "pending") return isTr ? "Bekliyor" : "Pending";
  if (normalized === "failed" || normalized === "rejected") return isTr ? "Başarısız" : "Failed";
  if (normalized === "cancelled") return isTr ? "İptal Edildi" : "Cancelled";
  if (normalized === "refunded") return isTr ? "İade Edildi" : "Refunded";
  return isTr ? "Ödendi" : "Paid";
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
          <a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:.02em;color:#FFFFFF;text-decoration:none;border-radius:10px;">
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
            <a href="${BASE_URL}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
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
                    <a href="mailto:${escapeHtml(footerEmail)}" style="color:${PALETTE.textMuted};text-decoration:none;">${escapeHtml(footerEmail)}</a> &middot; <a href="tel:08503040467" style="color:${PALETTE.textMuted};text-decoration:none;">0850 304 04 67</a> &middot; <a href="https://wa.me/905442939040" style="color:${PALETTE.textMuted};text-decoration:none;">WhatsApp: +90 544 293 90 40</a>
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
    footerEmail: "info@oriens-academy.com",
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
    footerEmail: "info@oriens-academy.com",
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
    footerEmail: "info@oriens-academy.com",
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
    footerEmail: "info@oriens-academy.com",
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`, "",
    isTr ? "Mesajınız bize ulaştı. En kısa sürede sizinle iletişime geçeceğiz." : "We received your message and will get back to you shortly.",
    "", `Oriens Academy - info@oriens-academy.com`,
  ]);

  return { subject, html, text };
}

/**
 * 4b. Contact Reply Email to Student/Inquirer
 */
export function renderContactReplyEmail(params: {
  fullName?: string;
  originalSubject?: string;
  replyMessage: string;
  locale?: "tr" | "en";
}): EmailTemplateResult {
  const isTr = normalizeLocale(params.locale) === "tr";
  const subject = params.originalSubject
    ? /^re:/i.test(params.originalSubject)
      ? params.originalSubject
      : `Re: ${params.originalSubject}`
    : isTr
      ? "İletişim Talebiniz Hakkında | Oriens Academy"
      : "Regarding Your Inquiry | Oriens Academy";

  const safeName = params.fullName ? escapeHtml(params.fullName) : "";
  const greeting = safeName
    ? isTr ? `Merhaba <strong>${safeName}</strong>,` : `Hello <strong>${safeName}</strong>,`
    : isTr ? "Merhaba," : "Hello,";

  const paragraphs = escapeHtml(params.replyMessage)
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 14px;line-height:1.65;white-space:pre-wrap;color:${PALETTE.primary}">${paragraph}</p>`)
    .join("");

  const bodyHtml = `
    <div>${greeting}</div>
    <div style="margin-top:16px;">
      ${paragraphs}
    </div>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid ${PALETTE.border};font-size:12px;color:${PALETTE.textMuted};">
      ${isTr
        ? "Sorularınız için bu e-postayı doğrudan yanıtlayabilir veya <a href=\"mailto:info@oriens-academy.com\" style=\"color:#10271B;font-weight:600;\">info@oriens-academy.com</a> üzerinden bize ulaşabilirsiniz."
        : "You can reply directly to this email or reach us at <a href=\"mailto:info@oriens-academy.com\" style=\"color:#10271B;font-weight:600;\">info@oriens-academy.com</a>."}
    </div>`;

  const html = renderEmailShell({
    locale: normalizeLocale(params.locale),
    eyebrow: isTr ? "Oriens Danışmanlık Yanıtı" : "Oriens Advisory Response",
    title: isTr ? "Mesajınızın Yanıtı" : "Response to Your Inquiry",
    bodyHtml,
    footerEmail: "info@oriens-academy.com",
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`,
    "",
    params.fullName ? (isTr ? `Sayın ${params.fullName},` : `Dear ${params.fullName},`) : "",
    "",
    params.replyMessage,
    "",
    "Oriens Academy - info@oriens-academy.com",
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
    footerEmail: "info@oriens-academy.com",
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
    footerEmail: "info@oriens-academy.com",
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
    ? `Ders / Görüşme Bilgileriniz Güncellendi: ${data.lessonTitle} | Oriens Academy`
    : `Your Lesson / Meeting Has Been Updated: ${data.lessonTitle} | Oriens Academy`;

  const newTime = formatDateTime(data.startsAt, data.locale);
  const oldTime = data.previousStartsAt ? formatDateTime(data.previousStartsAt, data.locale) : null;

  const cardHtml = summaryCard(isTr ? "Güncel Ders / Görüşme Bilgisi" : "Updated Lesson / Meeting", [
    { label: isTr ? "Etkinlik" : "Event", value: escapeHtml(data.lessonTitle) },
    { label: isTr ? "Yeni Tarih & Saat" : "New Date & Time", value: `<strong style="color:${PALETTE.goldDark};">${newTime}</strong>` },
    ...(oldTime ? [{ label: isTr ? "Önceki Zaman" : "Previous Time", value: oldTime }] : []),
    { label: isTr ? "Eğitmen / Danışman" : "Instructor", value: data.teacherName ? escapeHtml(data.teacherName) : "Oriens Faculty" },
    ...(data.locationOrMeetingUrl ? [{ label: isTr ? "Bağlantı" : "Meeting Link", value: `<a href="${data.locationOrMeetingUrl}" style="color:${PALETTE.primary};font-weight:700;">${isTr ? "Online Ders Odası" : "Join Online"} &rarr;</a>` }] : []),
    { label: isTr ? "Güncelleme Notu" : "Update Note", value: data.notes ? escapeHtml(data.notes) : (isTr ? "Tarih/saat düzenlemesi yapıldı." : "Schedule adjustment."), fullWidth: true },
  ]);

  const bodyHtml = `
    <div>${isTr ? `Merhaba <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Ders veya görüşme randevunuzun detayları güncellenmiştir.` : `Hello <strong>${escapeHtml(data.studentName)}</strong>,<br><br>Your scheduled lesson or meeting details have been updated.`}</div>
    ${cardHtml}
    ${data.locationOrMeetingUrl ? actionButton(isTr ? "Ders / Görüşmeye Katıl" : "Join Lesson / Meeting", data.locationOrMeetingUrl) : actionButton(isTr ? "Öğrenci Portalında Aç" : "View in Portal", `${BASE_URL}/${data.locale}/hesabim`)}`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Randevu Güncellemesi" : "Schedule Update",
    title: isTr ? "Ders / Görüşme Bilgileriniz Güncellendi" : "Your Lesson / Meeting Has Been Updated",
    bodyHtml,
    footerEmail: "info@oriens-academy.com",
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`, "",
    `${isTr ? "Etkinlik" : "Event"}: ${data.lessonTitle}`,
    `${isTr ? "Yeni Zaman" : "New Time"}: ${newTime}`,
    oldTime ? `${isTr ? "Önceki Zaman" : "Previous Time"}: ${oldTime}` : null,
    data.locationOrMeetingUrl ? `${isTr ? "Bağlantı" : "Link"}: ${data.locationOrMeetingUrl}` : null,
    data.notes ? `${isTr ? "Not" : "Note"}: ${data.notes}` : null,
  ]);
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
    footerEmail: "info@oriens-academy.com",
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
    footerEmail: "info@oriens-academy.com",
  });

  const text = joinText([`ORIENS ACADEMY - ${subject}`, "", `${data.lessonTitle} - ${formattedTime}`]);
  return { subject, html, text };
}

// ============================================================================
// C. PAKET / SATIN ALMA / ÖDEME MAİLLERİ (PURCHASE & PAYMENTS)
// ============================================================================

// ============================================================================
// D. ÖDEV / AKADEMİK TAKİP MAİLLERİ (HOMEWORK & ACADEMICS)
// ============================================================================

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
      <p style="margin:0 0 16px 0;">Artık eğitim sürecinizi ve ders planınızı hesabınızdan yönetebilirsiniz.</p>
      
      <p style="margin:0 0 8px 0;font-weight:600;color:${PALETTE.primary};">Hesabınız üzerinden:</p>
      <ul style="margin:0 0 20px 0;padding-left:20px;font-size:14px;line-height:1.75;color:${PALETTE.primary};">
        <li style="margin-bottom:4px;">ders ve randevularınızı takip edebilir,</li>
        <li style="margin-bottom:4px;">kalan ders haklarınızı ve paketlerinizi inceleyebilir,</li>
        <li style="margin-bottom:4px;">ödeme bilgilerinizi görüntüleyebilir,</li>
        <li style="margin-bottom:4px;">destek ekibimizle iletişime geçebilirsiniz.</li>
      </ul>
      ${actionButton(ctaLabel, portalAccountUrl)}
    </div>`
    : `
    <div style="font-size:14px;line-height:1.65;color:${PALETTE.primary};">
      <p style="margin:0 0 16px 0;">Hello <strong>${escapeHtml(studentName)}</strong>,</p>
      <p style="margin:0 0 12px 0;">Your Oriens Academy account has been created successfully.</p>
      <p style="margin:0 0 16px 0;">You can now manage your education process and lesson plan from your account.</p>
      
      <p style="margin:0 0 8px 0;font-weight:600;color:${PALETTE.primary};">From your account, you can:</p>
      <ul style="margin:0 0 20px 0;padding-left:20px;font-size:14px;line-height:1.75;color:${PALETTE.primary};">
        <li style="margin-bottom:4px;">track lessons and appointments,</li>
        <li style="margin-bottom:4px;">review remaining lesson rights and packages,</li>
        <li style="margin-bottom:4px;">view payment information,</li>
        <li style="margin-bottom:4px;">contact the Oriens Academy support team.</li>
      </ul>
      ${actionButton(ctaLabel, portalAccountUrl)}
    </div>`;

  const footerNote = "Oriens Academy &middot; info@oriens-academy.com";

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Hoş Geldiniz" : "Welcome",
    title: isTr ? "Oriens Academy’ye Hoş Geldiniz" : "Welcome to Oriens Academy",
    bodyHtml,
    footerNote,
    footerEmail: "info@oriens-academy.com",
  });

  const text = isTr
    ? joinText([
        `ORIENS ACADEMY - ${subject}`,
        "",
        `Merhaba ${studentName},`,
        "",
        "Oriens Academy hesabınız başarıyla oluşturuldu.",
        "Artık eğitim sürecinizi ve ders planınızı hesabınızdan yönetebilirsiniz.",
        "",
        "Hesabınız üzerinden:",
        "• ders ve randevularınızı takip edebilir,",
        "• kalan ders haklarınızı ve paketlerinizi inceleyebilir,",
        "• ödeme bilgilerinizi görüntüleyebilir,",
        "• destek ekibimizle iletişime geçebilirsiniz.",
        "",
        `${ctaLabel}: ${portalAccountUrl}`,
        "",
        "Oriens Academy",
        "info@oriens-academy.com",
      ])
    : joinText([
        `ORIENS ACADEMY - ${subject}`,
        "",
        `Hello ${studentName},`,
        "",
        "Your Oriens Academy account has been created successfully.",
        "You can now manage your education process and lesson plan from your account.",
        "",
        "From your account, you can:",
        "• track lessons and appointments,",
        "• review remaining lesson rights and packages,",
        "• view payment information,",
        "• contact the Oriens Academy support team.",
        "",
        `${ctaLabel}: ${portalAccountUrl}`,
        "",
        "Oriens Academy",
        "info@oriens-academy.com",
      ]);

  return { subject, html, text };
}

/**
 * 25. Şifre Sıfırlama / Geçici Şifre — Kullanıcıya
 */
/**
 * 25. Şifre Sıfırlama / Güvenli Kurtarma — Kullanıcıya
 * Güvenlik Politikası: E-posta içerisinde ASLA geçici / düz metin (plaintext) şifre gönderilmez.
 * Yalnızca güvenli eylem bağlantısı veya güvenli yönlendirme sağlanır.
 */
export function renderAccountPasswordRecoveryEmail(
  email: string,
  temporaryPasswordOrLink: string,
  locale: "tr" | "en" = "tr"
) {
  const normLocale = normalizeLocale(locale);
  const isTr = normLocale === "tr";
  const isUrl = typeof temporaryPasswordOrLink === "string" && (temporaryPasswordOrLink.startsWith("http://") || temporaryPasswordOrLink.startsWith("https://"));
  const actionUrl = isUrl ? temporaryPasswordOrLink : `${BASE_URL}/${normLocale}/sifre-yenile`;

  // If a full recovery action link was passed, directly render the canonical action email
  if (isUrl) {
    return renderPasswordResetActionEmail(email, actionUrl, normLocale);
  }

  const subject = isTr
    ? "Oriens Academy — Şifre Sıfırlama Bildirimi"
    : "Oriens Academy — Password Reset Notification";

  const intro = isTr
    ? "Oriens Academy hesabınız için bir şifre sıfırlama işlemi başlatıldı. Güvenliğiniz için yeni şifrenizi aşağıdaki bağlantı üzerinden kendiniz belirleyebilirsiniz."
    : "A password reset action was initiated for your Oriens Academy account. For your security, please set your new password using the secure link below.";

  const cardHtml = `
    <div style="margin-top:20px;background-color:${PALETTE.surfaceMuted};border:1px solid ${PALETTE.border};border-radius:12px;padding:18px 20px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${PALETTE.sage};">${isTr ? "Hesap E-postası" : "Account Email"}</div>
      <div style="font-size:14px;font-weight:600;color:${PALETTE.primary};margin-top:2px;">${escapeHtml(email)}</div>
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid ${PALETTE.border};">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${PALETTE.goldDark};">${isTr ? "Güvenlik Durumu" : "Security Status"}</div>
        <div style="font-size:13px;font-weight:600;color:${PALETTE.primary};margin-top:4px;">${isTr ? "Şifre güncellemesi bekleniyor (Düz metin şifre güvenliğiniz için e-postada yer almaz)" : "Password update pending (Plaintext passwords are never emailed for security)"}</div>
      </div>
    </div>`;

  const bodyHtml = `
    <div>${intro}</div>
    ${cardHtml}
    <div style="margin-top:18px;font-size:13px;color:${PALETTE.textMuted};line-height:1.5;">
      ${isTr ? "Aşağıdaki butona tıklayarak hesabınıza güvenli şifre belirleyebilirsiniz." : "Click the button below to securely set your password."}
    </div>
    ${actionButton(isTr ? "Yeni Şifre Belirle" : "Set New Password", actionUrl)}
    <div style="margin-top:14px;color:${PALETTE.sage};font-size:12px;">
      ${isTr ? "Bu işlemi siz başlatmadıysanız lütfen derhal Oriens Academy destek ekibiyle iletişime geçiniz." : "If you did not initiate this request, please contact Oriens Academy support immediately."}
    </div>`;

  const html = renderEmailShell({
    locale: normLocale,
    eyebrow: isTr ? "Hesap Güvenliği" : "Account Security",
    title: isTr ? "Şifre Sıfırlama" : "Password Reset",
    bodyHtml,
    footerEmail: "info@oriens-academy.com",
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`, "",
    `${isTr ? "E-posta" : "Email"}: ${email}`,
    `${isTr ? "Yeni Şifre Belirleme Bağlantısı" : "Password Reset Link"}: ${actionUrl}`,
  ]);

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
    { label: isTr ? "Bağlantı" : "Meeting Link", value: `<a href="${data.liveMeetingUrl}" target="_blank" rel="noopener noreferrer" style="color:${PALETTE.primary};font-weight:700;word-break:break-all;">${escapeHtml(data.liveMeetingUrl)} &rarr;</a>`, fullWidth: true },
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
    footerNote: isTr ? "Ders saati veya bağlantıyla ilgili sorularınız için info@oriens-academy.com üzerinden bize ulaşabilirsiniz." : "For questions regarding your lesson link or schedule, contact info@oriens-academy.com.",
    footerEmail: "info@oriens-academy.com",
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
// ============================================================================
// L. SATIN ALMA E-POSTA DOĞRULAMA (PURCHASE EMAIL VERIFICATION OTP)
// ============================================================================

export type PurchaseEmailVerificationOtpData = {
  candidateEmail: string;
  otp: string;
  locale: "tr" | "en";
  expiresInMinutes?: number;
};

/**
 * Email verification is 6-digit OTP ONLY. This template must never grow a
 * verification button, magic link or "verify in one click" copy again: a link in
 * a verification email is fetched by mail security scanners and link
 * prefetchers before the recipient ever opens the message, which consumed the
 * challenge and made the user's correct code look wrong.
 */
export function renderPurchaseEmailVerificationOtpEmail(data: PurchaseEmailVerificationOtpData): {
  subject: string;
  html: string;
  text: string;
} {
  const isTr = data.locale === "tr";
  const minutes = data.expiresInMinutes || 10;
  const subject = isTr
    ? `Oriens Academy — ${data.otp} E-posta Doğrulama Kodunuz`
    : `Oriens Academy — ${data.otp} Your Email Verification Code`;

  const eyebrow = isTr ? "GÜVENLİK & DOĞRULAMA" : "SECURITY & VERIFICATION";
  const title = isTr ? "E-posta Adresinizi Doğrulayın" : "Verify Your Email Address";

  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">
      ${isTr
        ? "Oriens Academy hesabınızı etkinleştirmek için e-posta adresinizi doğrulayınız:"
        : "To activate your Oriens Academy account, please verify your email address:"}
    </p>

    <div style="background-color:${PALETTE.surfaceGold};border:1px solid ${PALETTE.borderGold};border-radius:12px;padding:24px 20px;text-align:center;margin:20px 0;">
      <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${PALETTE.goldDark};margin-bottom:8px;">
        ${isTr ? "6 HANELİ DOĞRULAMA KODU" : "6-DIGIT VERIFICATION CODE"}
      </div>
      <div style="font-size:36px;font-weight:800;letter-spacing:.25em;color:${PALETTE.primary};font-family:ui-monospace,Menlo,Monaco,'Cascadia Mono','Segoe UI Mono','Roboto Mono',monospace;">
        ${escapeHtml(data.otp)}
      </div>
      <div style="font-size:12px;color:${PALETTE.textMuted};margin-top:10px;">
        ${isTr
          ? `Bu kod <strong>${minutes} dakika</strong> boyunca geçerlidir.`
          : `This code is valid for <strong>${minutes} minutes</strong>.`}
      </div>
    </div>

    <p style="margin:16px 0 0 0;font-size:13px;line-height:1.5;color:${PALETTE.textMuted};">
      ${isTr
        ? "Eğer bu işlemi siz başlatmadıysanız bu e-postayı dikkate almayınız. Güvenliğiniz için bu kodu kimseyle paylaşmayınız."
        : "If you did not initiate this request, please disregard this email. For your security, do not share this code with anyone."}
    </p>`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow,
    title,
    bodyHtml,
    footerEmail: "payments@oriens-academy.com",
    footerNote: isTr
      ? "Bu otomatik bir güvenlik ve işlem e-postasıdır."
      : "This is an automated security and transaction email.",
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`,
    "",
    isTr
      ? `E-posta doğrulama kodunuz: ${data.otp}\nBu kod ${minutes} dakika boyunca geçerlidir.\nEğer bu işlemi siz başlatmadıysanız lütfen dikkate almayınız.`
      : `Your email verification code: ${data.otp}\nThis code is valid for ${minutes} minutes.\nIf you did not initiate this request, please disregard this email.`,
  ]);

  return { subject, html, text };
}

/**
 * 28. Parola Sıfırlama Bağlantısı (Supabase Recovery Token Link) — Kullanıcıya Tek Dilli
 */
export function renderPasswordResetActionEmail(
  email: string,
  recoveryUrl: string,
  locale: "tr" | "en" = "tr"
) {
  const isTr = locale === "tr";
  const subject = isTr
    ? "Oriens Academy — Şifre Sıfırlama Bağlantısı"
    : "Oriens Academy — Reset Your Password";

  const eyebrow = isTr ? "HESAP GÜVENLİĞİ" : "ACCOUNT SECURITY";
  const title = isTr ? "Şifrenizi Sıfırlayın" : "Reset Your Password";

  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.65;color:${PALETTE.primary};">
      ${isTr ? "Merhaba," : "Hello,"}
    </p>
    <p style="margin:0 0 20px 0;font-size:14px;line-height:1.65;color:${PALETTE.primary};">
      ${isTr
        ? "Oriens Academy hesabınız için bir şifre sıfırlama talebi aldık. Aşağıdaki butona tıklayarak yeni şifrenizi güvenli bir şekilde belirleyebilirsiniz."
        : "We received a request to reset the password for your Oriens Academy account. Click the button below to securely choose your new password."}
    </p>
    
    ${actionButton(isTr ? "Şifremi Sıfırla" : "Reset Password", recoveryUrl)}

    <div style="margin-top:24px;background-color:${PALETTE.surfaceMuted};border:1px solid ${PALETTE.border};border-radius:12px;padding:14px 16px;">
      <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;color:${PALETTE.sage};">
        ${isTr ? "Buton çalışmıyorsa aşağıdaki bağlantıyı tarayıcınıza kopyalayabilirsiniz:" : "If the button does not work, copy and paste this link into your browser:"}
      </p>
      <p style="margin:0;font-size:11px;word-break:break-all;color:${PALETTE.primary};line-height:1.4;">
        <a href="${escapeHtml(recoveryUrl)}" style="color:${PALETTE.primary};text-decoration:underline;">${escapeHtml(recoveryUrl)}</a>
      </p>
    </div>

    <div style="margin-top:20px;padding-top:16px;border-top:1px solid ${PALETTE.border};font-size:12px;line-height:1.5;color:${PALETTE.textMuted};">
      ${isTr
        ? "Bu talebi siz oluşturmadıysanız bu e-postayı dikkate almayınız; mevcut şifreniz değişmeyecektir."
        : "If you did not make this request, you can safely ignore this email; your password will remain unchanged."}
    </div>
  `;

  const html = renderEmailShell({
    locale,
    eyebrow,
    title,
    bodyHtml,
    footerEmail: "info@oriens-academy.com",
    footerNote: isTr
      ? "Bu e-posta Oriens Academy güvenlik sistemi tarafından otomatik olarak oluşturulmuştur."
      : "This email was automatically generated by the Oriens Academy security system.",
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`,
    "",
    isTr
      ? `Oriens Academy hesabınız için şifre sıfırlama bağlantısı:\n${recoveryUrl}\n\nBu talebi siz oluşturmadıysanız bu e-postayı dikkate almayınız.`
      : `Password reset link for your Oriens Academy account:\n${recoveryUrl}\n\nIf you did not make this request, please disregard this email.`,
  ]);

  return { subject, html, text };
}

/**
 * MAIL-007. Yeni E-posta Doğrulama OTP Maili (Yalnızca yeni e-posta adresine)
 * 6 haneli OTP kodu içerir. Eski adrese link gitmez.
 */
export function renderEmailChangeOtpEmail(data: EmailChangeOtpEmailData): EmailTemplateResult {
  const isTr = data.locale === "tr";
  const minutes = data.expiresInMinutes || 10;
  const subject = isTr
    ? `Yeni E-posta Adresinizi Doğrulayın | Oriens Academy`
    : `Verify Your New Email Address | Oriens Academy`;

  const eyebrow = isTr ? "GÜVENLİK & DOĞRULAMA" : "SECURITY & VERIFICATION";
  const title = isTr ? "Yeni E-posta Adresinizi Doğrulayın" : "Verify Your New Email Address";

  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">
      ${isTr
        ? "Oriens Academy hesabınızın e-posta adresini güncellemek için aşağıdaki 6 haneli doğrulama kodunu kullanınız:"
        : "To update the email address associated with your Oriens Academy account, please enter the 6-digit verification code below:"}
    </p>

    <div style="background-color:${PALETTE.surfaceGold};border:1px solid ${PALETTE.borderGold};border-radius:12px;padding:24px 20px;text-align:center;margin:20px 0;">
      <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${PALETTE.goldDark};margin-bottom:8px;">
        ${isTr ? "6 HANELİ DOĞRULAMA KODU" : "6-DIGIT VERIFICATION CODE"}
      </div>
      <div style="font-size:36px;font-weight:800;letter-spacing:.25em;color:${PALETTE.primary};font-family:ui-monospace,Menlo,Monaco,'Cascadia Mono','Segoe UI Mono','Roboto Mono',monospace;">
        ${escapeHtml(data.otp)}
      </div>
      <div style="font-size:12px;color:${PALETTE.textMuted};margin-top:10px;">
        ${isTr
          ? `Bu kod <strong>${minutes} dakika</strong> boyunca geçerlidir.`
          : `This code is valid for <strong>${minutes} minutes</strong>.`}
      </div>
    </div>

    <p style="margin:16px 0 0 0;font-size:13px;line-height:1.5;color:${PALETTE.textMuted};">
      ${isTr
        ? "Bu değişikliği siz talep etmediyseniz bu e-postayı dikkate almayınız. Güvenliğiniz için bu kodu kimseyle paylaşmayınız."
        : "If you did not initiate this change request, please disregard this email. For your security, do not share this code with anyone."}
    </p>`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow,
    title,
    bodyHtml,
    footerEmail: "info@oriens-academy.com",
    footerNote: isTr
      ? "Bu otomatik bir güvenlik ve e-posta doğrulama iletisidir."
      : "This is an automated security and email verification message.",
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`,
    "",
    isTr
      ? `Yeni e-posta doğrulama kodunuz: ${data.otp}\nBu kod ${minutes} dakika boyunca geçerlidir.\nEğer bu değişikliği siz talep etmediyseniz lütfen dikkate almayınız.`
      : `Your new email verification code: ${data.otp}\nThis code is valid for ${minutes} minutes.\nIf you did not initiate this request, please disregard this email.`,
  ]);

  return { subject, html, text };
}

/**
 * MAIL-039. Eski E-posta Adresine Güvenlik Bildirimi
 * Yalnızca eski e-posta adresine gönderilir.
 * KESİNLİKLE OTP, doğrulama linki, iptal/onay butonu İÇERMEZ. Sırf bilgilendirme amaçlıdır.
 */
export function renderEmailChangeSecurityNoticeEmail(data: EmailChangeSecurityNoticeEmailData): EmailTemplateResult {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? "E-posta Adresiniz Değiştirildi | Oriens Academy"
    : "Email Address Changed | Oriens Academy";

  const eyebrow = isTr ? "GÜVENLİK BİLDİRİMİ" : "SECURITY NOTICE";
  const title = isTr ? "E-posta Adresiniz Değiştirildi" : "Email Address Changed";

  const summaryItems: Array<{ label: string; value: string; fullWidth?: boolean }> = [
    { label: isTr ? "Eski E-posta Adresi" : "Previous Email Address", value: escapeHtml(data.oldEmail) },
    { label: isTr ? "Yeni E-posta Adresi" : "New Email Address", value: escapeHtml(data.newEmailMasked) },
  ];

  if (data.changedAt) {
    summaryItems.push({
      label: isTr ? "Değişiklik Zamanı" : "Changed At",
      value: formatDateTime(data.changedAt, data.locale),
    });
  }

  const cardHtml = summaryCard(isTr ? "İşlem Bilgileri" : "Security Details", summaryItems);

  const bodyHtml = `
    <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;">
      ${isTr ? "Merhaba," : "Hello,"}
    </p>
    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.65;color:${PALETTE.primary};">
      ${isTr
        ? "Oriens Academy hesabınıza bağlı e-posta adresi başarıyla değiştirildi."
        : "The email address associated with your Oriens Academy account has been successfully changed."}
    </p>
    ${cardHtml}
    <div style="margin-top:20px;padding:16px;background-color:${PALETTE.surfaceGold};border:1px solid ${PALETTE.borderGold};border-radius:10px;font-size:13px;line-height:1.5;color:${PALETTE.goldDark};">
      <strong>${isTr ? "Bu işlemi siz gerçekleştirmediyseniz:" : "If you did not perform this change:"}</strong><br>
      ${isTr
        ? "Lütfen derhal Oriens Academy ile iletişime geçiniz. Hesap güvenliğiniz için destek ekibimiz hizmetinizdedir."
        : "Please contact Oriens Academy immediately to protect your account."}
      <div style="margin-top:10px;font-size:12px;">
        <a href="mailto:info@oriens-academy.com" style="color:${PALETTE.goldDark};font-weight:700;">info@oriens-academy.com</a> &middot; 
        <a href="tel:08503040467" style="color:${PALETTE.goldDark};font-weight:700;">0850 304 04 67</a> &middot; 
        <a href="https://wa.me/905442939040" style="color:${PALETTE.goldDark};font-weight:700;">WhatsApp: +90 544 293 90 40</a>
      </div>
    </div>`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow,
    title,
    bodyHtml,
    footerEmail: "info@oriens-academy.com",
    footerNote: isTr
      ? "Bu e-posta hesabınızın güvenliğini sağlamak amacıyla eski e-posta adresinize otomatik güvenlik bildirimi olarak iletilmiştir. Herhangi bir onay, doğrulama veya iptal bağlantısı içermez."
      : "This automated security notice was sent to your previous email address for account safety. It does not contain any confirmation, verification or cancellation links.",
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`,
    "",
    isTr
      ? `Merhaba,\n\nOriens Academy hesabınıza bağlı e-posta adresi başarıyla değiştirildi.\nEski Adres: ${data.oldEmail}\nYeni Adres: ${data.newEmailMasked}\n\nBu işlemi siz gerçekleştirmediyseniz lütfen Oriens Academy ile iletişime geçin:\nE-posta: info@oriens-academy.com\nTelefon: 0850 304 04 67\nWhatsApp: +90 544 293 90 40`
      : `Hello,\n\nThe email address associated with your Oriens Academy account has been successfully changed.\nPrevious Email: ${data.oldEmail}\nNew Email: ${data.newEmailMasked}\n\nIf you did not perform this change, please contact Oriens Academy immediately:\nEmail: info@oriens-academy.com\nPhone: 0850 304 04 67\nWhatsApp: +90 544 293 90 40`,
  ]);

  return { subject, html, text };
}

