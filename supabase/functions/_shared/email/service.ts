import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import {
  renderAdminBookingEmail,
  renderStudentBookingEmail,
  renderAdminContactEmail,
  renderStudentContactEmail,
  type BookingEmailData,
  type ContactEmailData,
} from "./templates.ts";

const DEFAULT_SENDER = "Oriens Academy <notifications@notify.oriens-academy.com>";

export type EmailDeliveryResult = {
  status: "sent" | "failed";
  errorCode?: string;
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
 * Dispatches transactional email via Resend API and logs delivery attempt to notification_deliveries table.
 * Email failures NEVER throw unhandled exceptions or affect parent database transaction.
 */
async function sendResendEmail(params: {
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
}) {
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
    idempotencyKey,
  } = params;

  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const fromAddress = Deno.env.get("RESEND_FROM_EMAIL") || DEFAULT_SENDER;

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
    return { status: "failed", errorCode: "RECIPIENT_NOT_CONFIGURED" } satisfies EmailDeliveryResult;
  }

  if (!resendApiKey) {
    console.warn(`[email/service] RESEND_API_KEY is not configured in environment.`);
    await logNotificationDelivery({
      supabaseAdmin,
      eventType,
      entityType,
      entityId,
      recipient: to,
      status: "failed",
      lastErrorCode: "RESEND_API_KEY_MISSING",
    });
    return { status: "failed", errorCode: "RESEND_API_KEY_MISSING" } satisfies EmailDeliveryResult;
  }

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    };
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        ...(replyTo ? { reply_to: [replyTo] } : {}),
        subject,
        html,
        text,
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
      return { status: "sent" } satisfies EmailDeliveryResult;
    } else {
      const errorCode = json.name || json.message || "RESEND_ERROR";
      console.error(`[email/service] Resend API error:`, json);
      await logNotificationDelivery({
        supabaseAdmin,
        eventType,
        entityType,
        entityId,
        recipient: to,
        status: "failed",
        lastErrorCode: errorCode,
      });
      return { status: "failed", errorCode } satisfies EmailDeliveryResult;
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
    return { status: "failed", errorCode: "NETWORK_ERROR" } satisfies EmailDeliveryResult;
  }
}

async function logNotificationDelivery(params: {
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
      provider: "resend",
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
 * Triggers admin notification & student acknowledgement emails for a booking request.
 */
export async function dispatchBookingEmails(
  supabaseAdmin: SupabaseClient,
  bookingData: BookingEmailData
) {
  // Fetch private admin recipient configuration
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
    ? "oriensacademy@gmail.com"
    : configuredRecipient;
  const adminLocale = localeConfig?.locale ?? "tr";

  // 1. Dispatch Admin Notification
  const adminTemplate = renderAdminBookingEmail(bookingData, adminLocale);
  await sendResendEmail({
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
  });

  // 2. Dispatch Student Acknowledgement
  const studentTemplate = renderStudentBookingEmail(bookingData);
  await sendResendEmail({
    supabaseAdmin,
    to: bookingData.email,
    subject: studentTemplate.subject,
    html: studentTemplate.html,
    text: studentTemplate.text,
    eventType: "booking.created.student_acknowledgement",
    entityType: "booking",
    entityId: bookingData.bookingId,
    idempotencyKey: `booking-student-${bookingData.bookingId}`,
  });
}

/**
 * Triggers admin notification & student acknowledgement emails for a contact request.
 */
export async function dispatchContactEmails(
  supabaseAdmin: SupabaseClient,
  contactData: ContactEmailData
) {
  // Fetch private admin recipient configuration
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
    ? "oriensacademy@gmail.com"
    : configuredRecipient;
  const adminLocale = localeConfig?.locale ?? "tr";

  // Attempt both independently so one provider failure never prevents the other.
  const adminTemplate = renderAdminContactEmail(contactData, adminLocale);
  const studentTemplate = renderStudentContactEmail(contactData);
  const [admin, student] = await Promise.all([sendResendEmail({
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
    idempotencyKey: `${contactData.source === "quick_contact" ? "quick-contact" : contactData.source === "consultation" ? "consultation" : "contact"}-admin-${contactData.contactId}`,
  }), sendResendEmail({
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
    idempotencyKey: `${contactData.source === "quick_contact" ? "quick-contact" : contactData.source === "consultation" ? "consultation" : "contact"}-student-${contactData.contactId}`,
  })]);

  return {
    admin,
    student,
    status: admin.status === "sent" && student.status === "sent" ? "sent" as const : "partial" as const,
  };
}
