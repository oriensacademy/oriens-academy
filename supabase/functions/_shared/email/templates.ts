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
  source?: "website" | "quick_contact" | "consultation";
};

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
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    return d.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", {
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

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f7f6f4; color: #1c1b18; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e3df; padding: 32px; border-radius: 4px; }
    .header { border-bottom: 2px solid #a86508; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 18px; font-weight: 700; color: #1c1b18; letter-spacing: 0.05em; text-transform: uppercase; }
    .title { font-size: 20px; font-weight: 600; margin-top: 12px; color: #1c1b18; }
    .field-group { margin-bottom: 16px; border-bottom: 1px solid #f0eee9; padding-bottom: 12px; }
    .label { font-size: 12px; font-weight: 600; text-transform: uppercase; color: #736f66; letter-spacing: 0.04em; }
    .value { font-size: 15px; font-weight: 500; color: #1c1b18; margin-top: 4px; }
    .footer { margin-top: 32px; font-size: 12px; color: #8c877d; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">ORIENS ACADEMY</div>
      <div class="title">${subject}</div>
    </div>
    
    <div class="field-group">
      <div class="label">${isTr ? "Ad Soyad" : "Full Name"}</div>
      <div class="value">${data.fullName}</div>
    </div>
    
    <div class="field-group">
      <div class="label">${isTr ? "E-posta" : "Email"}</div>
      <div class="value"><a href="mailto:${data.email}">${data.email}</a></div>
    </div>

    ${data.phone ? `
    <div class="field-group">
      <div class="label">${isTr ? "Telefon" : "Phone"}</div>
      <div class="value">${data.phone}</div>
    </div>` : ""}

    <div class="field-group">
      <div class="label">${isTr ? "Akademik Odak" : "Support Type"}</div>
      <div class="value">${supportLabel} ${examInfo ? `(${examInfo})` : ""}</div>
    </div>

    <div class="field-group">
      <div class="label">${isTr ? "Talep Edilen Görüşme Saati" : "Requested Appointment Time"}</div>
      <div class="value">${formattedTime}</div>
    </div>

    <div class="field-group">
      <div class="label">${isTr ? "Ziyaretçi Dili" : "Visitor Language"}</div>
      <div class="value">${data.locale.toUpperCase()}</div>
    </div>

    ${data.notes ? `
    <div class="field-group">
      <div class="label">${isTr ? "Notlar" : "Notes"}</div>
      <div class="value">${data.notes}</div>
    </div>` : ""}

    <div class="footer">
      Oriens Academy Operational System &middot; Booking ID: ${data.bookingId}
    </div>
  </div>
</body>
</html>
  `;

  const text = `
ORIENS ACADEMY - ${subject}

Ad Soyad: ${data.fullName}
E-posta: ${data.email}
Telefon: ${data.phone || "-"}
Akademik Odak: ${supportLabel} ${examInfo ? `(${examInfo})` : ""}
Görüşme Saati: ${formattedTime}
Dil: ${data.locale.toUpperCase()}
Notlar: ${data.notes || "-"}

Booking ID: ${data.bookingId}
  `.trim();

  return { subject, html, text };
}


// ----------------------------------------------------------------------------
// 2. STUDENT BOOKING ACKNOWLEDGEMENT EMAIL TEMPLATE
// ----------------------------------------------------------------------------
export function renderStudentBookingEmail(data: BookingEmailData) {
  const isTr = data.locale === "tr";
  const subject = isTr
    ? "Talebiniz Alındı | Oriens Academy"
    : "We Have Received Your Request | Oriens Academy";
  const safeName = escapeHtml(data.fullName);
  const safeEmail = escapeHtml(data.email);
  const safePhone = escapeHtml(data.phone || "—");
  const examOrTopic = data.examCode?.toUpperCase() || data.customExam || formatSupportLabel(data.supportType, data.locale);
  const safeTopic = escapeHtml(examOrTopic);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f7f6f4; color: #1c1b18; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e3df; padding: 32px; border-radius: 4px; }
    .header { border-bottom: 2px solid #a86508; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 18px; font-weight: 700; color: #1c1b18; letter-spacing: 0.05em; text-transform: uppercase; }
    .title { font-size: 20px; font-weight: 600; margin-top: 12px; color: #1c1b18; }
    .body-text { font-size: 15px; line-height: 1.6; color: #3b3833; margin-bottom: 24px; }
    .summary-box { background: #fcfbf9; border: 1px solid #eeeae3; padding: 20px; border-radius: 4px; margin-bottom: 24px; }
    .field-row { font-size: 14px; margin-bottom: 8px; }
    .field-label { font-weight: 600; color: #736f66; }
    .footer { margin-top: 32px; font-size: 12px; color: #8c877d; text-align: center; border-t: 1px solid #eeeae3; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">ORIENS ACADEMY</div>
      <div class="title">${isTr ? "Talebiniz Alındı" : "Request Received"}</div>
    </div>
    
    <div class="body-text">
      ${isTr 
        ? `Merhaba <strong>${safeName}</strong>,<br><br>Tanışma görüşmesi talebinizi başarıyla aldık.<br><br>Ekibimiz paylaştığınız iletişim bilgileri üzerinden en kısa sürede sizinle iletişime geçecektir.`
        : `Hello <strong>${safeName}</strong>,<br><br>We have successfully received your introductory consultation request.<br><br>Our team will contact you as soon as possible using the contact information you provided.`
      }
    </div>

    <div class="summary-box">
      <div class="field-row"><strong>${isTr ? "Talep Özeti" : "Request Summary"}</strong></div>
      <div class="field-row"><span class="field-label">${isTr ? "Ad Soyad:" : "Name:"}</span> ${safeName}</div>
      <div class="field-row"><span class="field-label">${isTr ? "E-posta:" : "Email:"}</span> ${safeEmail}</div>
      <div class="field-row"><span class="field-label">${isTr ? "Telefon:" : "Phone:"}</span> ${safePhone}</div>
      <div class="field-row"><span class="field-label">${isTr ? "İlgilendiğiniz sınav / konu:" : "Exam / topic:"}</span> ${safeTopic}</div>
    </div>

    <div class="footer">
      &copy; Oriens Academy &middot; oriensacademy@gmail.com &middot; +90 544 293 90 40
    </div>
  </div>
</body>
</html>
  `;

  const text = `
ORIENS ACADEMY - ${subject}

${isTr ? `Merhaba ${data.fullName},` : `Hello ${data.fullName},`}

${isTr 
  ? "Tanışma görüşmesi talebinizi başarıyla aldık.\n\nEkibimiz paylaştığınız iletişim bilgileri üzerinden en kısa sürede sizinle iletişime geçecektir."
  : "We have successfully received your introductory consultation request.\n\nOur team will contact you as soon as possible using the contact information you provided."
}

${isTr ? "Talep Özeti" : "Request Summary"}
${isTr ? "Ad Soyad" : "Name"}: ${data.fullName}
${isTr ? "E-posta" : "Email"}: ${data.email}
${isTr ? "Telefon" : "Phone"}: ${data.phone || "—"}
${isTr ? "İlgilendiğiniz sınav / konu" : "Exam / topic"}: ${examOrTopic}

Oriens Academy
${isTr ? "E-posta" : "Email"}: oriensacademy@gmail.com
${isTr ? "Telefon / WhatsApp" : "Phone / WhatsApp"}: +90 544 293 90 40
  `.trim();

  return { subject, html, text };
}


// ----------------------------------------------------------------------------
// 3. ADMIN CONTACT EMAIL TEMPLATE
// ----------------------------------------------------------------------------
export function renderAdminContactEmail(data: ContactEmailData, adminLocale: "tr" | "en" = "tr") {
  const isTr = adminLocale === "tr";
  const isQuick = data.source === "quick_contact";
  const subject = isTr
    ? `${isQuick ? "Yeni Hızlı İletişim Talebi" : "Yeni İletişim Talebi"} | Oriens Academy`
    : `${isQuick ? "New Quick Contact Lead" : "New Contact Inquiry"} | Oriens Academy`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #F6F8F3; color: #10271B; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #DDE4DC; padding: 32px; border-radius: 12px; }
    .header { border-bottom: 2px solid #819586; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 18px; font-weight: 700; color: #10271B; letter-spacing: 0.05em; text-transform: uppercase; }
    .title { font-size: 20px; font-weight: 600; margin-top: 12px; color: #10271B; }
    .field-group { margin-bottom: 16px; border-bottom: 1px solid #f0eee9; padding-bottom: 12px; }
    .label { font-size: 12px; font-weight: 600; text-transform: uppercase; color: #736f66; letter-spacing: 0.04em; }
    .value { font-size: 15px; font-weight: 500; color: #1c1b18; margin-top: 4px; }
    .message-box { background: #fcfbf9; border: 1px solid #eeeae3; p: 16px; padding: 16px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; margin-top: 8px; }
    .footer { margin-top: 32px; font-size: 12px; color: #8c877d; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">ORIENS ACADEMY</div>
      <div class="title">${subject}</div>
    </div>
    
    <div class="field-group">
      <div class="label">${isTr ? "Ad Soyad" : "Full Name"}</div>
      <div class="value">${data.fullName}</div>
    </div>
    
    <div class="field-group">
      <div class="label">${isTr ? "E-posta" : "Email"}</div>
      <div class="value"><a href="mailto:${data.email}">${data.email}</a></div>
    </div>

    ${data.phone ? `
    <div class="field-group">
      <div class="label">${isTr ? "Telefon" : "Phone"}</div>
      <div class="value">${data.phone}</div>
    </div>` : ""}

    ${data.subject ? `
    <div class="field-group">
      <div class="label">${isTr ? "Konu" : "Subject"}</div>
      <div class="value">${data.subject}</div>
    </div>` : ""}

    <div class="field-group">
      <div class="label">${isTr ? "Ziyaretçi Dili" : "Visitor Language"}</div>
      <div class="value">${data.locale.toUpperCase()}</div>
    </div>

    <div class="field-group">
      <div class="label">${isTr ? "Kaynak" : "Source"}</div>
      <div class="value">${isQuick ? "quick_contact" : "website"}</div>
    </div>

    <div class="field-group">
      <div class="label">${isTr ? "Mesaj" : "Message"}</div>
      <div class="message-box">${data.message}</div>
    </div>

    <div class="footer">
      Oriens Academy Operational System &middot; Contact ID: ${data.contactId}
    </div>
  </div>
</body>
</html>
  `;

  const text = `
ORIENS ACADEMY - ${subject}

Ad Soyad: ${data.fullName}
E-posta: ${data.email}
Telefon: ${data.phone || "-"}
Konu: ${data.subject || "-"}
Dil: ${data.locale.toUpperCase()}

Mesaj:
${data.message}

Contact ID: ${data.contactId}
  `.trim();

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
    : "We Have Received Your Request | Oriens Academy";
  const safeName = escapeHtml(data.fullName);
  const safeEmail = escapeHtml(data.email);
  const safePhone = escapeHtml(data.phone || "—");
  const safeSubject = escapeHtml(data.subject || (isTr ? "Genel iletişim talebi" : "General contact request"));
  const safeMessage = escapeHtml(data.message).replace(/\n/g, "<br>");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #F6F8F3; color: #10271B; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #DDE4DC; padding: 32px; border-radius: 12px; }
    .header { border-bottom: 2px solid #819586; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 18px; font-weight: 700; color: #10271B; letter-spacing: 0.05em; text-transform: uppercase; }
    .title { font-size: 20px; font-weight: 600; margin-top: 12px; color: #10271B; }
    .body-text { font-size: 15px; line-height: 1.6; color: #3b3833; margin-bottom: 24px; }
    .summary { background: #f1f4ef; border-left: 3px solid #819586; padding: 16px; margin: 22px 0; font-size: 14px; line-height: 1.6; }
    .footer { margin-top: 32px; font-size: 12px; color: #8c877d; text-align: center; border-t: 1px solid #eeeae3; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">ORIENS ACADEMY</div>
      <div class="title">${isTr ? "Talebiniz Alındı" : "Request Received"}</div>
    </div>
    
    <div class="body-text">
      ${isTr 
        ? `${isQuick ? "Merhaba" : `Merhaba <strong>${safeName}</strong>`},<br><br>${isConsultation ? "Tanışma görüşmesi" : "İletişim"} talebinizi başarıyla aldık.<br><br>Ekibimiz paylaştığınız iletişim bilgileri üzerinden en kısa sürede sizinle iletişime geçecektir.`
        : `${isQuick ? "Hello" : `Hello <strong>${safeName}</strong>`},<br><br>We have successfully received your ${isConsultation ? "introductory consultation" : "contact"} request.<br><br>Our team will contact you as soon as possible using the contact information you provided.`
      }
    </div>

    <div class="summary">
      <strong>${isTr ? "Talep özeti" : "Request summary"}</strong><br>
      ${isTr ? "Ad Soyad" : "Name"}: ${safeName}<br>
      ${isTr ? "E-posta" : "Email"}: ${safeEmail}<br>
      ${isTr ? "Telefon" : "Phone"}: ${safePhone}<br>
      ${isTr ? "İlgilendiğiniz sınav / konu" : "Exam / topic"}: ${safeSubject}<br><br>
      ${safeMessage}
    </div>

    <div class="footer">
      &copy; Oriens Academy &middot; oriensacademy@gmail.com &middot; +90 544 293 90 40
    </div>
  </div>
</body>
</html>
  `;

  const text = `
ORIENS ACADEMY - ${subject}

${isTr ? (isQuick ? "Merhaba," : `Merhaba ${data.fullName},`) : (isQuick ? "Hello," : `Hello ${data.fullName},`)}

${isTr 
  ? `${isConsultation ? "Tanışma görüşmesi" : "İletişim"} talebinizi başarıyla aldık.\n\nEkibimiz paylaştığınız iletişim bilgileri üzerinden en kısa sürede sizinle iletişime geçecektir.`
  : `We have successfully received your ${isConsultation ? "introductory consultation" : "contact"} request.\n\nOur team will contact you as soon as possible using the contact information you provided.`
}

${isTr ? "Talep özeti" : "Request summary"}:
${isTr ? "Ad Soyad" : "Name"}: ${data.fullName}
${isTr ? "E-posta" : "Email"}: ${data.email}
${isTr ? "Telefon" : "Phone"}: ${data.phone || "-"}
${isTr ? "İlgilendiğiniz sınav / konu" : "Exam / topic"}: ${data.subject || "-"}
${data.message}

Oriens Academy
${isTr ? "E-posta" : "Email"}: oriensacademy@gmail.com
${isTr ? "Telefon / WhatsApp" : "Phone / WhatsApp"}: +90 544 293 90 40
  `.trim();

  return { subject, html, text };
}
