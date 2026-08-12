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
};

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
  const formattedTime = formatDateTime(data.startsAt, data.locale);

  const subject = isTr
    ? "Görüşme Talebiniz Alındı | Oriens Academy"
    : "Your Consultation Request Has Been Received | Oriens Academy";

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
      <div class="title">${isTr ? "Görüşme Talebiniz Alındı" : "Consultation Request Received"}</div>
    </div>
    
    <div class="body-text">
      ${isTr 
        ? `Sayın <strong>${data.fullName}</strong>,<br><br>Oriens Academy bünyesinde görüşme talebiniz başarıyla alınmıştır. Seçtiğiniz zaman dilimi kaydedilmiş olup ekip arkadaşlarımız talebinizi inceleyerek en kısa sürede sizinle iletişime geçecektir.`
        : `Dear <strong>${data.fullName}</strong>,<br><br>Your initial consultation request with Oriens Academy has been successfully received. Our academic team will review your requested time slot and reach out shortly to finalize arrangements.`
      }
    </div>

    <div class="summary-box">
      <div class="field-row"><span class="field-label">${isTr ? "Talep Edilen Zaman:" : "Requested Time:"}</span> ${formattedTime}</div>
      <div class="field-row"><span class="field-label">${isTr ? "E-posta:" : "Email:"}</span> ${data.email}</div>
      <div class="field-row"><span class="field-label">${isTr ? "Durum:" : "Status:"}</span> ${isTr ? "Onay Bekliyor" : "Pending Confirmation"}</div>
    </div>

    <div class="body-text">
      ${isTr 
        ? "Sorularınız olması halinde bu e-postayı yanıtlayarak doğrudan ekibimize ulaşabilirsiniz."
        : "If you have any immediate questions, feel free to reply directly to this email."
      }
    </div>

    <div class="footer">
      &copy; Oriens Academy &middot; International Academic Guidance
    </div>
  </div>
</body>
</html>
  `;

  const text = `
ORIENS ACADEMY - ${subject}

${isTr ? `Sayın ${data.fullName},` : `Dear ${data.fullName},`}

${isTr 
  ? "Görüşme talebiniz başarıyla alınmıştır. Seçtiğiniz zaman dilimi kaydedilmiş olup ekibimiz talebinizi inceleyerek sizinle iletişime geçecektir."
  : "Your consultation request has been successfully received. Our team will review your details and contact you shortly."
}

${isTr ? "Talep Edilen Zaman" : "Requested Time"}: ${formattedTime}
${isTr ? "E-posta" : "Email"}: ${data.email}
${isTr ? "Durum" : "Status"}: ${isTr ? "Onay Bekliyor" : "Pending Confirmation"}

Oriens Academy
  `.trim();

  return { subject, html, text };
}


// ----------------------------------------------------------------------------
// 3. ADMIN CONTACT EMAIL TEMPLATE
// ----------------------------------------------------------------------------
export function renderAdminContactEmail(data: ContactEmailData, adminLocale: "tr" | "en" = "tr") {
  const isTr = adminLocale === "tr";
  const subject = isTr
    ? `Yeni İletişim Talebi | Oriens Academy`
    : `New Contact Inquiry | Oriens Academy`;

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
  const subject = isTr
    ? "Mesajınızı Aldık | Oriens Academy"
    : "We Have Received Your Message | Oriens Academy";

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
    .footer { margin-top: 32px; font-size: 12px; color: #8c877d; text-align: center; border-t: 1px solid #eeeae3; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">ORIENS ACADEMY</div>
      <div class="title">${isTr ? "Mesajınızı Aldık" : "Message Received"}</div>
    </div>
    
    <div class="body-text">
      ${isTr 
        ? `Sayın <strong>${data.fullName}</strong>,<br><br>Oriens Academy ile iletişime geçtiğiniz için teşekkür ederiz. Mesajınız ekibimize ulaşmış olup konuyla ilgili en kısa sürede tarafınıza dönüş yapılacaktır.`
        : `Dear <strong>${data.fullName}</strong>,<br><br>Thank you for contacting Oriens Academy. Your message has been received, and our team will get back to you as soon as possible.`
      }
    </div>

    <div class="footer">
      &copy; Oriens Academy &middot; International Academic Guidance
    </div>
  </div>
</body>
</html>
  `;

  const text = `
ORIENS ACADEMY - ${subject}

${isTr ? `Sayın ${data.fullName},` : `Dear ${data.fullName},`}

${isTr 
  ? "Oriens Academy ile iletişime geçtiğiniz için teşekkür ederiz. Mesajınız ekibimize ulaşmış olup tarafınıza en kısa sürede dönüş yapılacaktır."
  : "Thank you for contacting Oriens Academy. Your message has been received, and our team will get back to you shortly."
}

Oriens Academy
  `.trim();

  return { subject, html, text };
}
