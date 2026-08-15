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

// ----------------------------------------------------------------------------
// SHARED ORIENS BRAND EMAIL SHELL
// ----------------------------------------------------------------------------
const PALETTE = {
  bg: "#F6F8F3",
  card: "#FFFFFF",
  primary: "#10271B",
  sage: "#819586",
  gold: "#D6B56D",
  border: "#DDE5DC",
};

const ORIENS_LOGO_URL = "https://oriens-academy.com/brand/oriens-logo-v2.png";

function escapeHtml(value: string | null | undefined): string {
  return (value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character] ?? character));
}

function formatSupportLabel(type: string, locale: "tr" | "en"): string {
  if (type === "exam_preparation") return locale === "tr" ? "Sınav Hazırlığı" : "Exam Preparation";
  if (type === "university_support") return locale === "tr" ? "Üniversite Ders Desteği" : "University Support";
  return locale === "tr" ? "Genel Akademik Danışmanlık" : "General Consultation";
}

function formatDateTime(isoStr?: string | null, locale?: "tr" | "en"): string {
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
      timeZoneName: "short",
    });
  } catch {
    return isoStr;
  }
}

function joinText(lines: Array<string | null | undefined | false>): string {
  return lines.filter((line) => line !== null && line !== undefined && line !== false).join("\n").trim();
}

function actionButton(label: string, href: string): string {
  return `<div style="margin-top:22px;"><a href="${href}" style="display:inline-block;background-color:${PALETTE.primary};color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:700;padding:12px 18px;border-radius:8px;">${escapeHtml(label)}</a></div>`;
}

/**
 * Renders a field label/value row for use inside an email shell body.
 */
function fieldRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:0 0 14px 0;border-bottom:1px solid ${PALETTE.border};">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${PALETTE.sage};">${label}</div>
        <div style="font-size:15px;font-weight:500;color:${PALETTE.primary};margin-top:4px;overflow-wrap:anywhere;word-break:break-word;">${value}</div>
      </td>
    </tr>`;
}

/**
 * Shared responsive, Gmail-safe, table-based Oriens Academy transactional email shell.
 * All styling is inline; no external stylesheet dependency.
 */
function renderEmailShell(opts: {
  locale: "tr" | "en";
  eyebrow: string;
  title: string;
  bodyHtml: string;
  footerNote?: string;
}): string {
  const { locale, eyebrow, title, bodyHtml, footerNote } = opts;
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${PALETTE.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PALETTE.bg};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;table-layout:fixed;background-color:${PALETTE.card};border:1px solid ${PALETTE.border};border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr>
          <td style="padding:28px 36px 0 36px;">
            <img src="${ORIENS_LOGO_URL}" width="170" alt="Oriens Academy" style="display:block;width:170px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
            <div style="height:3px;width:56px;background-color:${PALETTE.gold};border-radius:2px;margin-top:12px;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 36px 0 36px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${PALETTE.sage};">${escapeHtml(eyebrow)}</div>
            <div style="font-size:22px;font-weight:700;color:${PALETTE.primary};margin-top:8px;">${escapeHtml(title)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 36px 8px 36px;font-size:14px;line-height:1.65;color:${PALETTE.primary};">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 36px 28px 36px;border-top:1px solid ${PALETTE.border};margin-top:8px;">
            ${footerNote ? `<div style="font-size:12px;color:${PALETTE.sage};margin-bottom:12px;">${footerNote}</div>` : ""}
            <div style="font-size:12px;font-weight:700;color:${PALETTE.primary};">Oriens Academy</div>
            <div style="font-size:12px;color:${PALETTE.sage};margin-top:3px;overflow-wrap:anywhere;word-break:break-word;">oriensacademy@gmail.com</div>
            <div style="font-size:12px;color:${PALETTE.sage};margin-top:2px;">+90 544 293 90 40</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ----------------------------------------------------------------------------
// 1. ADMIN BOOKING EMAIL TEMPLATE
// ----------------------------------------------------------------------------
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

  const rows = [
    fieldRow(isTr ? "Ad Soyad" : "Full Name", escapeHtml(data.fullName)),
    fieldRow(isTr ? "E-posta" : "Email", `<a href="mailto:${escapeHtml(data.email)}" style="color:${PALETTE.primary};">${escapeHtml(data.email)}</a>`),
    data.phone ? fieldRow(isTr ? "Telefon" : "Phone", escapeHtml(data.phone)) : "",
    fieldRow(isTr ? "Akademik Odak" : "Support Type", `${supportLabel}${examInfo ? ` (${examInfo})` : ""}`),
    formattedTime ? fieldRow(isTr ? "Talep Edilen Görüşme Saati" : "Requested Appointment Time", formattedTime) : "",
    fieldRow(isTr ? "Ziyaretçi Dili" : "Visitor Language", data.locale.toUpperCase()),
    data.notes ? fieldRow(isTr ? "Notlar" : "Notes", escapeHtml(data.notes)) : "",
  ].join("");

  const bodyHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;

  const html = renderEmailShell({
    locale: adminLocale,
    eyebrow: isTr ? "Yeni Talep" : "New Request",
    title: subject,
    bodyHtml,
    footerNote: `${isTr ? "Rezervasyon No" : "Booking ID"}: ${data.bookingId}`,
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`, "",
    `${isTr ? "Ad Soyad" : "Name"}: ${data.fullName}`,
    `${isTr ? "E-posta" : "Email"}: ${data.email}`,
    data.phone ? `${isTr ? "Telefon" : "Phone"}: ${data.phone}` : null,
    `${isTr ? "Akademik Odak" : "Support Type"}: ${supportLabel}${examInfo ? ` (${examInfo})` : ""}`,
    formattedTime ? `${isTr ? "Görüşme Saati" : "Appointment Time"}: ${formattedTime}` : null,
    `${isTr ? "Dil" : "Language"}: ${data.locale.toUpperCase()}`,
    data.notes ? `${isTr ? "Notlar" : "Notes"}: ${data.notes}` : null,
    "", `${isTr ? "Rezervasyon No" : "Booking ID"}: ${data.bookingId}`,
  ]);

  return { subject, html, text };
}

// ----------------------------------------------------------------------------
// 2. STUDENT BOOKING ACKNOWLEDGEMENT EMAIL TEMPLATE
// ----------------------------------------------------------------------------
export function renderStudentBookingEmail(data: BookingEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? "Talebiniz Alındı | Oriens Academy"
    : "We Received Your Request | Oriens Academy";
  const safeName = escapeHtml(data.fullName);

  const intro = isTr
    ? `Merhaba <strong>${safeName}</strong>,<br><br>Tanışma görüşmesi talebinizi başarıyla aldık.<br><br>Ekibimiz paylaştığınız iletişim bilgileri üzerinden en kısa sürede sizinle iletişime geçecektir.`
    : `Hello <strong>${safeName}</strong>,<br><br>We have successfully received your introductory consultation request.<br><br>Our team will contact you as soon as possible using the contact information you provided.`;

  const bodyHtml = `<div>${intro}</div>`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "Görüşme Talebi" : "Consultation Request",
    title: isTr ? "Talebiniz Alındı" : "Request Received",
    bodyHtml,
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`, "", isTr ? `Merhaba ${data.fullName},` : `Hello ${data.fullName},`, "",
    isTr ? "Tanışma görüşmesi talebinizi başarıyla aldık.\n\nEkibimiz paylaştığınız iletişim bilgileri üzerinden en kısa sürede sizinle iletişime geçecektir." : "We have successfully received your introductory consultation request.\n\nOur team will contact you as soon as possible using the contact information you provided.",
    "", "Oriens Academy", "oriensacademy@gmail.com", "+90 544 293 90 40",
  ]);

  return { subject, html, text };
}

// ----------------------------------------------------------------------------
// 3. ADMIN CONTACT EMAIL TEMPLATE
// ----------------------------------------------------------------------------
export function renderAdminContactEmail(data: ContactEmailData, adminLocale: "tr" | "en" = "tr") {
  const isTr = adminLocale === "tr";
  const isQuick = data.source === "quick_contact";
  const subject = isTr
    ? "Yeni İletişim Talebi | Oriens Academy"
    : "New Contact Request | Oriens Academy";

  const rows = [
    !isQuick && data.fullName ? fieldRow(isTr ? "Ad Soyad" : "Full Name", escapeHtml(data.fullName)) : "",
    fieldRow(isTr ? "E-posta" : "Email", `<a href="mailto:${escapeHtml(data.email)}" style="color:${PALETTE.primary};">${escapeHtml(data.email)}</a>`),
    data.phone ? fieldRow(isTr ? "Telefon" : "Phone", escapeHtml(data.phone)) : "",
    data.subject ? fieldRow(isTr ? "Sınav / Konu" : "Exam / Topic", escapeHtml(data.subject)) : "",
    fieldRow(isTr ? "Ziyaretçi Dili" : "Visitor Language", data.locale.toUpperCase()),
  ].join("");
  const packagePrice = data.package?.price !== null && data.package?.price !== undefined
    ? new Intl.NumberFormat(isTr ? "tr-TR" : "en-GB", {
        style: "currency",
        currency: data.package.currency || "TRY",
        maximumFractionDigits: 0,
      }).format(data.package.price)
    : null;
  const packageHtml = data.package ? `
    <div style="margin-top:18px;background-color:${PALETTE.bg};border:1px solid ${PALETTE.border};border-radius:10px;padding:14px 16px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${PALETTE.sage};">${isTr ? "İlgilenilen Paket" : "Selected Package"}</div>
      <div style="font-size:16px;font-weight:700;color:${PALETTE.primary};margin-top:6px;">${escapeHtml(data.package.name)}</div>
      <div style="font-size:13px;color:${PALETTE.sage};margin-top:3px;">${[
        data.package.lessons ? `${data.package.lessons} ${isTr ? "ders" : "lessons"}` : "",
        packagePrice || "",
      ].filter(Boolean).join(" &middot; ")}</div>
    </div>` : "";

  const bodyHtml = `
    <div style="margin-bottom:20px;">${isTr ? "Yeni bir iletişim talebi aldınız." : "You have received a new contact request."}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    ${packageHtml}
    ${data.message ? `<div style="margin-top:16px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${PALETTE.sage};">${isTr ? "Mesaj" : "Message"}</div>
      <div style="margin-top:6px;background-color:${PALETTE.bg};border:1px solid ${PALETTE.border};border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(data.message)}</div>
    </div>` : ""}
    ${actionButton(isTr ? "Yönetim Panelinde Görüntüle" : "View in Admin Panel", "https://oriens-academy.com/admin/iletisim")}`;

  const html = renderEmailShell({
    locale: adminLocale,
    eyebrow: "ORIENS ACADEMY",
    title: isTr ? "Yeni İletişim Talebi" : "New Contact Request",
    bodyHtml,
    footerNote: isTr ? `Ziyaretçi dili: ${data.locale.toUpperCase()}` : `Visitor language: ${data.locale.toUpperCase()}`,
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`, "", isTr ? "Yeni bir iletişim talebi aldınız." : "You have received a new contact request.", "",
    !isQuick && data.fullName ? `${isTr ? "Ad Soyad" : "Full Name"}: ${data.fullName}` : null,
    `${isTr ? "E-posta" : "Email"}: ${data.email}`,
    data.phone ? `${isTr ? "Telefon" : "Phone"}: ${data.phone}` : null,
    data.subject ? `${isTr ? "Sınav / Konu" : "Exam / Topic"}: ${data.subject}` : null,
    data.package ? `${isTr ? "İlgilenilen Paket" : "Selected Package"}: ${data.package.name}` : null,
    data.package?.lessons ? `${isTr ? "Ders sayısı" : "Lessons"}: ${data.package.lessons}` : null,
    packagePrice ? `${isTr ? "Gösterilen fiyat" : "Displayed price"}: ${packagePrice}` : null,
    data.message ? `\n${isTr ? "Mesaj" : "Message"}:\n${data.message}` : null,
    "", `${isTr ? "Yönetim Panelinde Görüntüle" : "View in Admin Panel"}: https://oriens-academy.com/admin/iletisim`,
    "", "Oriens Academy", "oriensacademy@gmail.com", "+90 544 293 90 40",
  ]);

  return { subject, html, text };
}

// ----------------------------------------------------------------------------
// 4. STUDENT CONTACT ACKNOWLEDGEMENT EMAIL TEMPLATE
// ----------------------------------------------------------------------------
export function renderStudentContactEmail(data: ContactEmailData) {
  const isTr = data.locale === "tr";
  const isQuick = data.source === "quick_contact";
  const isConsultation = data.source === "consultation";
  const subject = isTr
    ? "Talebiniz Alındı | Oriens Academy"
    : "We Received Your Request | Oriens Academy";
  const safeName = escapeHtml(data.fullName);

  const intro = isTr
    ? `${isQuick ? "Merhaba" : `Merhaba <strong>${safeName}</strong>`},<br><br>${isConsultation ? "Tanışma görüşmesi" : "İletişim"} talebinizi başarıyla aldık.<br><br>Ekibimiz paylaştığınız iletişim bilgileri üzerinden en kısa sürede sizinle iletişime geçecektir.`
    : `${isQuick ? "Hello" : `Hello <strong>${safeName}</strong>`},<br><br>We have successfully received your ${isConsultation ? "introductory consultation" : "contact"} request.<br><br>Our team will contact you as soon as possible using the contact information you provided.`;

  const bodyHtml = `<div>${intro}</div>`;

  const html = renderEmailShell({
    locale: data.locale,
    eyebrow: isTr ? "İletişim Talebi" : "Contact Request",
    title: isTr ? "Talebiniz Alındı" : "Request Received",
    bodyHtml,
  });

  const text = joinText([
    `ORIENS ACADEMY - ${subject}`, "",
    isTr ? (isQuick ? "Merhaba," : `Merhaba ${data.fullName},`) : (isQuick ? "Hello," : `Hello ${data.fullName},`), "",
    isTr ? `${isConsultation ? "Tanışma görüşmesi" : "İletişim"} talebinizi başarıyla aldık.\n\nEkibimiz paylaştığınız iletişim bilgileri üzerinden en kısa sürede sizinle iletişime geçecektir.` : `We have successfully received your ${isConsultation ? "introductory consultation" : "contact"} request.\n\nOur team will contact you as soon as possible using the contact information you provided.`,
    "", "Oriens Academy", "oriensacademy@gmail.com", "+90 544 293 90 40",
  ]);

  return { subject, html, text };
}

// ----------------------------------------------------------------------------
// 5. ADMIN PASSWORD RECOVERY EMAIL TEMPLATE
// ----------------------------------------------------------------------------
export function renderAdminPasswordRecoveryEmail(
  email: string,
  temporaryPassword: string,
  locale: "tr" | "en" = "tr"
) {
  const isTr = locale === "tr";
  const subject = isTr
    ? "Oriens Academy | Geçici Yönetici Şifresi"
    : "Oriens Academy | Temporary Admin Password";

  const intro = isTr
    ? "Yönetim paneli hesabınız için bir kurtarma talebi alındı ve yeni bir geçici giriş şifresi oluşturuldu."
    : "A recovery request was made for your administrator account, and a new temporary sign-in password has been generated.";
  const instruction = isTr
    ? "Bu şifreyle yönetim paneline giriş yapabilirsiniz. Giriş yaptıktan sonra size yeni bir şifre belirlemeniz istenecektir."
    : "You can use this password to sign in to the administration panel. After signing in, you will be asked to set a new password."
  const warning = isTr
    ? "Bu işlemi siz başlatmadıysanız lütfen Oriens Academy sistem yöneticisiyle iletişime geçin."
    : "If you did not request this, please contact the Oriens Academy system administrator.";

  const rows = [
    fieldRow(isTr ? "E-posta" : "Email", escapeHtml(email)),
  ].join("");

  const bodyHtml = `
    <div>${intro}</div>
    <div style="margin-top:20px;background-color:${PALETTE.bg};border:1px solid ${PALETTE.border};border-radius:10px;padding:16px 18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      <div style="margin-top:14px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${PALETTE.sage};">${isTr ? "Geçici Şifre" : "Temporary Password"}</div>
        <div style="font-family:Consolas,Menlo,monospace;font-size:22px;font-weight:700;letter-spacing:.06em;color:${PALETTE.primary};margin-top:6px;">${escapeHtml(temporaryPassword)}</div>
      </div>
    </div>
    <div style="margin-top:18px;">${instruction}</div>
    <div style="margin-top:12px;color:${PALETTE.sage};font-size:13px;">${warning}</div>`;

  const html = renderEmailShell({
    locale,
    eyebrow: isTr ? "Hesap Kurtarma" : "Account Recovery",
    title: isTr ? "Yeni Yönetici Şifreniz" : "Your New Administrator Password",
    bodyHtml,
  });

  const text = `Oriens Academy

${isTr ? "Yeni Yönetici Şifreniz" : "Your New Administrator Password"}

${intro}

${isTr ? "E-posta" : "Email"}: ${email}
${isTr ? "Geçici şifre" : "Temporary password"}: ${temporaryPassword}

${instruction}

${warning}

Oriens Academy`;

  return { subject, html, text };
}
