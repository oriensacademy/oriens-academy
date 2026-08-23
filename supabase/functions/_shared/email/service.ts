import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
  type BookingEmailData,
  type ContactEmailData,
  type AppointmentEmailData,
  type PackagePurchaseEmailData,
  type PaymentSuccessEmailData,
  type BankTransferPendingEmailData,
  type PaymentReminderEmailData,
  type BankTransferApprovedEmailData,
  type AdminPaymentNotificationData,
  type PackageStatusEmailData,
  type HomeworkEmailData,
  type WelcomeEmailData,
  type SecurityAlertEmailData,
} from "./templates.ts";

const DEFAULT_SENDER_NAME = "Oriens Academy";
const DEFAULT_SENDER_EMAIL = "info@oriens-academy.com";

export type EmailDeliveryResult = {
  status: "sent" | "failed";
  errorCode?: string;
  providerMessageId?: string;
};

/**
 * Retrieves a private setting value from `site_settings` table using service role client.
 */
async function getPrivateSiteSetting<T>(
  supabaseAdmin: SupabaseClient,
  key: string
): Promise<T | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error || !data) return null;
    return data.value as T;
  } catch {
    return null;
  }
}

/**
 * Base64url encoder for RFC 2822 email payload (Google Gmail API format)
 */
function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Builds RFC 2822 MIME multipart/alternative message for transactional delivery
 */
function buildRfc822Message(params: {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
}): string {
  const boundary = `====_Oriens_${crypto.randomUUID().replace(/-/g, "")}_====`;
  const utf8Subject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(params.subject)))}?=`;

  const headers = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    params.replyTo ? `Reply-To: ${params.replyTo}` : null,
    `Subject: ${utf8Subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean).join("\r\n");

  const body = [
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    params.text,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    params.html,
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  return `${headers}\r\n\r\n${body}`;
}

/**
 * Exchanges Google OAuth2 Refresh Token for a fresh Access Token
 */
async function getGoogleAccessToken(): Promise<{ token?: string; error?: string }> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    return { error: "GOOGLE_CREDENTIALS_MISSING" };
  }

  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok || !data.access_token) {
      console.error("[email/service] Google OAuth token exchange failed:", data);
      return { error: data.error_description || data.error || "OAUTH_TOKEN_ERROR" };
    }

    return { token: data.access_token };
  } catch (err) {
    console.error("[email/service] Network error obtaining Google access token:", err);
    return { error: "NETWORK_ERROR" };
  }
}

/**
 * Logs transactional delivery attempt to `notification_deliveries` table.
 */
export async function logNotificationDelivery(params: {
  supabaseAdmin: SupabaseClient;
  eventType: string;
  entityType: string;
  entityId: string;
  recipient: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  lastErrorCode?: string;
}) {
  try {
    await params.supabaseAdmin.from("notification_deliveries").insert({
      channel: "email",
      event_type: params.eventType,
      entity_type: params.entityType,
      entity_id: params.entityId,
      recipient: params.recipient,
      provider: "google_workspace",
      provider_message_id: params.providerMessageId || null,
      status: params.status,
      attempt_count: 1,
      last_error_code: params.lastErrorCode || null,
      sent_at: params.status === "sent" ? new Date().toISOString() : null,
    });
  } catch (err) {
    console.error(`[email/service] Failed to log notification delivery:`, err);
  }
}

/**
 * Sends a transactional email using Google Mail API (OAuth2) and logs delivery to DB.
 */
export async function sendTransactionalEmail(params: {
  supabaseAdmin: SupabaseClient;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  eventType: string;
  entityType: string;
  entityId: string;
  idempotencyKey?: string;
}): Promise<EmailDeliveryResult> {
  const {
    supabaseAdmin,
    to,
    replyTo,
    subject,
    html,
    text,
    eventType,
    entityType,
    entityId,
  } = params;

  const senderName = Deno.env.get("MAIL_FROM_NAME") || DEFAULT_SENDER_NAME;
  const senderEmail = Deno.env.get("MAIL_FROM_EMAIL") || DEFAULT_SENDER_EMAIL;
  const fromAddress = `${senderName} <${senderEmail}>`;

  if (!to || !to.includes("@")) {
    console.warn(`[email/service] Recipient email not configured for ${eventType}`);
    await logNotificationDelivery({
      supabaseAdmin,
      eventType,
      entityType,
      entityId,
      recipient: to || "not_configured",
      status: "failed",
      lastErrorCode: "RECIPIENT_NOT_CONFIGURED",
    });
    return { status: "failed", errorCode: "RECIPIENT_NOT_CONFIGURED" };
  }

  const { token: accessToken, error: tokenError } = await getGoogleAccessToken();

  if (!accessToken || tokenError) {
    const isDev = Deno.env.get("DENO_ENV") === "development" || Deno.env.get("ENVIRONMENT") === "development";
    if (isDev) {
      console.warn(`[email/service] [DEV MODE] Google credentials not configured. Simulating delivery for: ${to}`);
      const mockId = `mock-google-${crypto.randomUUID()}`;
      await logNotificationDelivery({
        supabaseAdmin,
        eventType,
        entityType,
        entityId,
        recipient: to,
        status: "sent",
        providerMessageId: mockId,
      });
      return { status: "sent", providerMessageId: mockId };
    }

    console.error(`[email/service] Google Mail credentials missing or invalid: ${tokenError}`);
    await logNotificationDelivery({
      supabaseAdmin,
      eventType,
      entityType,
      entityId,
      recipient: to,
      status: "failed",
      lastErrorCode: tokenError || "GOOGLE_AUTH_ERROR",
    });
    return { status: "failed", errorCode: tokenError || "GOOGLE_AUTH_ERROR" };
  }

  try {
    const rawMime = buildRfc822Message({
      from: fromAddress,
      to,
      replyTo,
      subject,
      html,
      text,
    });

    const rawBase64Url = base64UrlEncode(rawMime);

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: rawBase64Url,
      }),
    });

    const json = await res.json();

    if (res.ok && json.id) {
      await logNotificationDelivery({
        supabaseAdmin,
        eventType,
        entityType,
        entityId,
        recipient: to,
        status: "sent",
        providerMessageId: json.id,
      });
      return { status: "sent", providerMessageId: json.id };
    } else {
      const errorCode = json.error?.message || json.message || `HTTP_${res.status}`;
      console.error(`[email/service] Google Gmail API error:`, json);
      await logNotificationDelivery({
        supabaseAdmin,
        eventType,
        entityType,
        entityId,
        recipient: to,
        status: "failed",
        lastErrorCode: errorCode,
      });
      return { status: "failed", errorCode };
    }
  } catch (err) {
    console.error(`[email/service] Unexpected network error sending email:`, err);
    await logNotificationDelivery({
      supabaseAdmin,
      eventType,
      entityType,
      entityId,
      recipient: to,
      status: "failed",
      lastErrorCode: "NETWORK_ERROR",
    });
    return { status: "failed", errorCode: "NETWORK_ERROR" };
  }
}

// ============================================================================
// DISPATCHERS — GÖRÜŞME & İLETİŞİM
// ============================================================================

export async function dispatchBookingEmails(
  supabaseAdmin: SupabaseClient,
  bookingData: BookingEmailData
) {
  const adminEmailConfig = await getPrivateSiteSetting<{ email: string }>(
    supabaseAdmin,
    "notification.booking_email"
  );
  const localeConfig = await getPrivateSiteSetting<{ locale: "tr" | "en" }>(
    supabaseAdmin,
    "notification.admin_locale"
  );

  const configuredRecipient = adminEmailConfig?.email?.trim().toLowerCase();
  const adminRecipient = !configuredRecipient || configuredRecipient === "notifications@oriens-academy.com"
    ? "info@oriens-academy.com"
    : configuredRecipient;
  const adminLocale = localeConfig?.locale ?? "tr";

  const adminTemplate = renderAdminBookingEmail(bookingData, adminLocale);
  const studentTemplate = renderStudentBookingEmail(bookingData);

  const [admin, student] = await Promise.all([
    sendTransactionalEmail({
      supabaseAdmin,
      to: adminRecipient,
      replyTo: bookingData.email,
      subject: adminTemplate.subject,
      html: adminTemplate.html,
      text: adminTemplate.text,
      eventType: "booking.created.admin_notification",
      entityType: "booking",
      entityId: bookingData.bookingId,
      idempotencyKey: `booking-admin-${bookingData.bookingId}`,
    }),
    sendTransactionalEmail({
      supabaseAdmin,
      to: bookingData.email,
      subject: studentTemplate.subject,
      html: studentTemplate.html,
      text: studentTemplate.text,
      eventType: "booking.created.student_acknowledgement",
      entityType: "booking",
      entityId: bookingData.bookingId,
      idempotencyKey: `booking-student-${bookingData.bookingId}`,
    }),
  ]);

  return {
    admin,
    student,
    status: admin.status === "sent" && student.status === "sent" ? ("sent" as const) : ("partial" as const),
  };
}

export async function dispatchContactEmails(
  supabaseAdmin: SupabaseClient,
  contactData: ContactEmailData
) {
  const adminEmailConfig = await getPrivateSiteSetting<{ email: string }>(
    supabaseAdmin,
    "notification.contact_email"
  );
  const localeConfig = await getPrivateSiteSetting<{ locale: "tr" | "en" }>(
    supabaseAdmin,
    "notification.admin_locale"
  );

  const configuredRecipient = adminEmailConfig?.email?.trim().toLowerCase();
  const adminRecipient = !configuredRecipient || configuredRecipient === "notifications@oriens-academy.com"
    ? "info@oriens-academy.com"
    : configuredRecipient;
  const adminLocale = localeConfig?.locale ?? "tr";

  const adminTemplate = renderAdminContactEmail(contactData, adminLocale);
  const studentTemplate = renderStudentContactEmail(contactData);

  const [admin, student] = await Promise.all([
    sendTransactionalEmail({
      supabaseAdmin,
      to: adminRecipient,
      replyTo: contactData.email,
      subject: adminTemplate.subject,
      html: adminTemplate.html,
      text: adminTemplate.text,
      eventType: contactData.source === "quick_contact"
        ? "quick_contact.created.admin_notification"
        : contactData.source === "consultation"
          ? "consultation.created.admin_notification"
          : "contact.created.admin_notification",
      entityType: "contact_request",
      entityId: contactData.contactId,
      idempotencyKey: `${contactData.source || "contact"}-admin-${contactData.contactId}`,
    }),
    sendTransactionalEmail({
      supabaseAdmin,
      to: contactData.email,
      subject: studentTemplate.subject,
      html: studentTemplate.html,
      text: studentTemplate.text,
      eventType: contactData.source === "quick_contact"
        ? "quick_contact.created.student_acknowledgement"
        : contactData.source === "consultation"
          ? "consultation.created.student_acknowledgement"
          : "contact.created.student_acknowledgement",
      entityType: "contact_request",
      entityId: contactData.contactId,
      idempotencyKey: `${contactData.source || "contact"}-student-${contactData.contactId}`,
    }),
  ]);

  return {
    admin,
    student,
    status: admin.status === "sent" && student.status === "sent" ? ("sent" as const) : ("partial" as const),
  };
}

// ============================================================================
// DISPATCHERS — RANDEVU & DERSLER
// ============================================================================

export async function dispatchAppointmentConfirmedEmails(
  supabaseAdmin: SupabaseClient,
  data: AppointmentEmailData
) {
  const adminTemplate = renderAdminAppointmentCreatedEmail(data, "tr");
  const studentTemplate = renderStudentAppointmentConfirmedEmail(data);

  const [admin, student] = await Promise.all([
    sendTransactionalEmail({
      supabaseAdmin,
      to: "info@oriens-academy.com",
      replyTo: data.studentEmail,
      subject: adminTemplate.subject,
      html: adminTemplate.html,
      text: adminTemplate.text,
      eventType: "appointment.created.admin",
      entityType: "appointment",
      entityId: data.appointmentId,
      idempotencyKey: `appt-admin-${data.appointmentId}`,
    }),
    sendTransactionalEmail({
      supabaseAdmin,
      to: data.studentEmail,
      subject: studentTemplate.subject,
      html: studentTemplate.html,
      text: studentTemplate.text,
      eventType: "appointment.confirmed.student",
      entityType: "appointment",
      entityId: data.appointmentId,
      idempotencyKey: `appt-student-${data.appointmentId}`,
    }),
  ]);

  return { admin, student };
}

export async function dispatchAppointmentUpdatedEmail(
  supabaseAdmin: SupabaseClient,
  data: AppointmentEmailData
) {
  const studentTemplate = renderStudentAppointmentUpdatedEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    subject: studentTemplate.subject,
    html: studentTemplate.html,
    text: studentTemplate.text,
    eventType: "appointment.rescheduled.student",
    entityType: "appointment",
    entityId: data.appointmentId,
    idempotencyKey: `appt-update-${data.appointmentId}-${Date.now()}`,
  });
}

export async function dispatchAppointmentCancelledEmail(
  supabaseAdmin: SupabaseClient,
  data: AppointmentEmailData
) {
  const studentTemplate = renderStudentAppointmentCancelledEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    subject: studentTemplate.subject,
    html: studentTemplate.html,
    text: studentTemplate.text,
    eventType: "appointment.cancelled.student",
    entityType: "appointment",
    entityId: data.appointmentId,
    idempotencyKey: `appt-cancel-${data.appointmentId}`,
  });
}

export async function dispatchAppointmentReminderEmail(
  supabaseAdmin: SupabaseClient,
  data: AppointmentEmailData
) {
  const studentTemplate = renderStudentAppointmentReminderEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    subject: studentTemplate.subject,
    html: studentTemplate.html,
    text: studentTemplate.text,
    eventType: "appointment.reminder.student",
    entityType: "appointment",
    entityId: data.appointmentId,
    idempotencyKey: `appt-remind-${data.appointmentId}`,
  });
}

// ============================================================================
// DISPATCHERS — PAKETLER & ÖDEMELER
// ============================================================================

export async function dispatchPackagePurchasedEmail(
  supabaseAdmin: SupabaseClient,
  data: PackagePurchaseEmailData
) {
  const template = renderStudentPackagePurchasedEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "package.order_received.student",
    entityType: "package_order",
    entityId: data.orderReference,
    idempotencyKey: `pkg-purchase-${data.orderReference}`,
  });
}

export async function dispatchPaymentSuccessEmail(
  supabaseAdmin: SupabaseClient,
  data: PaymentSuccessEmailData
) {
  const template = renderStudentPaymentSuccessEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "payment.success.student",
    entityType: "payment_transaction",
    entityId: data.paymentReference,
    idempotencyKey: `pay-success-${data.paymentReference}`,
  });
}

export async function dispatchBankTransferPendingEmail(
  supabaseAdmin: SupabaseClient,
  data: BankTransferPendingEmailData
) {
  const template = renderStudentBankTransferPendingEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "payment.bank_transfer_pending.student",
    entityType: "payment_transaction",
    entityId: data.paymentReference,
    idempotencyKey: `pay-bank-pending-${data.paymentReference}`,
  });
}

export async function dispatchPaymentReminderEmail(
  supabaseAdmin: SupabaseClient,
  data: PaymentReminderEmailData
) {
  const template = renderStudentPaymentReminderEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "payment.reminder.student",
    entityType: "payment_transaction",
    entityId: data.paymentReference,
    idempotencyKey: `pay-remind-${data.paymentReference}-${data.reminderCount || 1}`,
  });
}

export async function dispatchBankTransferApprovedEmail(
  supabaseAdmin: SupabaseClient,
  data: BankTransferApprovedEmailData
) {
  const template = renderStudentBankTransferApprovedEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "payment.bank_transfer_approved.student",
    entityType: "payment_transaction",
    entityId: data.paymentReference,
    idempotencyKey: `pay-bank-approved-${data.paymentReference}`,
  });
}

export async function dispatchAdminPaymentAlert(
  supabaseAdmin: SupabaseClient,
  data: AdminPaymentNotificationData
) {
  const template = renderAdminPaymentNotificationEmail(data, "tr");
  return sendTransactionalEmail({
    supabaseAdmin,
    to: "info@oriens-academy.com",
    replyTo: data.payerEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "payment.created.admin_alert",
    entityType: "payment_transaction",
    entityId: data.paymentReference,
    idempotencyKey: `pay-admin-alert-${data.paymentReference}`,
  });
}

export async function dispatchPackageStatusEmail(
  supabaseAdmin: SupabaseClient,
  type: "activated" | "low_balance" | "completed" | "renewal",
  data: PackageStatusEmailData
) {
  let template;
  const eventType = `package.${type}.student`;

  switch (type) {
    case "activated":
      template = renderStudentPackageActivatedEmail(data);
      break;
    case "low_balance":
      template = renderStudentPackageLowBalanceEmail(data);
      break;
    case "completed":
      template = renderStudentPackageCompletedEmail(data);
      break;
    case "renewal":
      template = renderStudentPackageRenewalEmail(data);
      break;
  }

  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType,
    entityType: "package_status",
    entityId: `${data.packageName}-${Date.now()}`,
    idempotencyKey: `pkg-status-${type}-${data.studentEmail}-${Date.now()}`,
  });
}

// ============================================================================
// DISPATCHERS — ÖDEVLER & AKADEMİK TAKİP
// ============================================================================

export async function dispatchHomeworkAssignedEmail(
  supabaseAdmin: SupabaseClient,
  data: HomeworkEmailData
) {
  const template = renderStudentHomeworkAssignedEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "homework.assigned.student",
    entityType: "homework",
    entityId: data.homeworkId,
    idempotencyKey: `hw-assigned-${data.homeworkId}`,
  });
}

export async function dispatchHomeworkDueReminderEmail(
  supabaseAdmin: SupabaseClient,
  data: HomeworkEmailData
) {
  const template = renderStudentHomeworkDueReminderEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "homework.due_reminder.student",
    entityType: "homework",
    entityId: data.homeworkId,
    idempotencyKey: `hw-due-${data.homeworkId}`,
  });
}

export async function dispatchHomeworkSubmittedEmail(
  supabaseAdmin: SupabaseClient,
  data: HomeworkEmailData
) {
  const template = renderTeacherHomeworkSubmittedEmail(data, "tr");
  return sendTransactionalEmail({
    supabaseAdmin,
    to: "info@oriens-academy.com",
    replyTo: data.studentEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "homework.submitted.teacher",
    entityType: "homework",
    entityId: data.homeworkId,
    idempotencyKey: `hw-submitted-${data.homeworkId}`,
  });
}

export async function dispatchHomeworkReviewedEmail(
  supabaseAdmin: SupabaseClient,
  data: HomeworkEmailData
) {
  const template = renderStudentHomeworkReviewedEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "homework.reviewed.student",
    entityType: "homework",
    entityId: data.homeworkId,
    idempotencyKey: `hw-reviewed-${data.homeworkId}`,
  });
}

// ============================================================================
// DISPATCHERS — HESAP & GÜVENLİK
// ============================================================================

export async function dispatchWelcomeEmail(
  supabaseAdmin: SupabaseClient,
  data: WelcomeEmailData
) {
  const template = renderStudentWelcomeEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "account.welcome.student",
    entityType: "account_auth",
    entityId: data.studentEmail,
    idempotencyKey: `acc-welcome-${data.studentEmail}`,
  });
}

export async function dispatchPasswordResetEmail(params: {
  supabaseAdmin: SupabaseClient;
  requestId: string;
  to: string;
  temporaryPassword: string;
  locale?: "tr" | "en";
}): Promise<EmailDeliveryResult> {
  const { supabaseAdmin, requestId, to, temporaryPassword, locale = "tr" } = params;
  const template = renderAccountPasswordRecoveryEmail(to, temporaryPassword, locale);

  return sendTransactionalEmail({
    supabaseAdmin,
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "account.password_reset",
    entityType: "account_auth",
    entityId: requestId,
    idempotencyKey: `admin-password-reset-${requestId}`,
  });
}

export async function dispatchSecurityAlertEmail(
  supabaseAdmin: SupabaseClient,
  data: SecurityAlertEmailData
) {
  const template = renderAccountSecurityAlertEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "account.security_alert",
    entityType: "account_security",
    entityId: `${data.studentEmail}-${Date.now()}`,
    idempotencyKey: `acc-security-${data.studentEmail}-${Date.now()}`,
  });
}
