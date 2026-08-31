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
  renderStudentHomeworkRevisionRequestedEmail,
  renderStudentWelcomeEmail,
  renderAccountPasswordRecoveryEmail,
  renderAccountSecurityAlertEmail,
  renderStudentLiveLessonLinkEmail,
  renderStudentLessonCompletedEmail,
  renderStudentSupportConfirmationEmail,
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
  type LiveLessonLinkEmailData,
  type LessonCompletedEmailData,
  type SupportConfirmationEmailData,
} from "./templates.ts";

export type EmailChannel =
  | "general"
  | "contact"
  | "support"
  | "payments"
  | "zoom"
  | "admin";

export interface MailIdentity {
  fromName: string;
  fromEmail: string;
  fromAddress: string;
  replyTo: string;
  internalRecipient: string;
}

export const ADMIN_EMAIL = "admin@oriens-academy.com";
export const INFO_EMAIL = "info@oriens-academy.com";
export const PAYMENTS_EMAIL = "payments@oriens-academy.com";
export const ZOOM_EMAIL = "zoom@oriens-academy.com";
export const MAIL_ADDRESSES = { admin: ADMIN_EMAIL, info: INFO_EMAIL, payments: PAYMENTS_EMAIL, zoom: ZOOM_EMAIL } as const;

export const DEFAULT_FALLBACK_NAME = "Oriens Academy";
export const DEFAULT_FALLBACK_EMAIL = INFO_EMAIL;
export const DEFAULT_FALLBACK_FROM = `${DEFAULT_FALLBACK_NAME} <${DEFAULT_FALLBACK_EMAIL}>`;

/**
 * Global Transactional Email BCC Archive Address
 */
export const EMAIL_ARCHIVE_BCC = ADMIN_EMAIL;

/**
 * Resolves the canonical global transactional email BCC archive address.
 * The operational copy mailbox is fixed to admin@ to prevent legacy env values from restoring info@ as the archive.
 */
export function getArchiveBccAddress(): string { return EMAIL_ARCHIVE_BCC; }

/**
 * Extracts and normalizes email addresses from strings, comma-separated lists, or arrays.
 * Handles both "user@example.com" and "Name <user@example.com>".
 */
export function extractEmails(input?: string | string[] | null): string[] {
  if (!input) return [];
  const rawList = Array.isArray(input) ? input : input.split(",");
  const emails: string[] = [];
  for (const raw of rawList) {
    if (!raw) continue;
    const match = raw.match(/<([^>]+)>/) || [null, raw];
    const email = (match[1] || "").trim().toLowerCase();
    if (email && email.includes("@")) {
      emails.push(email);
    }
  }
  return emails;
}

/**
 * Resolves strongly-typed mail identity attributes by business channel.
 */
export function resolveMailIdentity(
  channel: EmailChannel = "general",
  locale: "tr" | "en" = "tr"
): MailIdentity {
  switch (channel) {
    case "contact":
      return {
        fromName: "Oriens Academy",
        fromEmail: INFO_EMAIL,
        fromAddress: `Oriens Academy <${INFO_EMAIL}>`,
        replyTo: INFO_EMAIL,
        internalRecipient: INFO_EMAIL,
      };
    case "support": {
      const supportName = locale === "en" ? "Oriens Academy Student Support" : "Oriens Academy Öğrenci Destek";
      return {
        fromName: supportName,
        fromEmail: INFO_EMAIL,
        fromAddress: `${supportName} <${INFO_EMAIL}>`,
        replyTo: INFO_EMAIL,
        internalRecipient: INFO_EMAIL,
      };
    }
    case "payments": {
      const paymentsName = locale === "en" ? "Oriens Academy Payments" : "Oriens Academy Ödemeler";
      return {
        fromName: paymentsName,
        fromEmail: PAYMENTS_EMAIL,
        fromAddress: `${paymentsName} <${PAYMENTS_EMAIL}>`,
        replyTo: PAYMENTS_EMAIL,
        internalRecipient: PAYMENTS_EMAIL,
      };
    }
    case "zoom":
      return { fromName: "Oriens Academy Ders", fromEmail: ZOOM_EMAIL, fromAddress: `Oriens Academy Ders <${ZOOM_EMAIL}>`, replyTo: ZOOM_EMAIL, internalRecipient: ZOOM_EMAIL };
    case "admin":
      return {
        fromName: "Oriens Academy",
        fromEmail: INFO_EMAIL,
        fromAddress: `Oriens Academy <${INFO_EMAIL}>`,
        replyTo: ADMIN_EMAIL,
        internalRecipient: ADMIN_EMAIL,
      };
    case "general":
    default:
      return {
        fromName: "Oriens Academy",
        fromEmail: INFO_EMAIL,
        fromAddress: `Oriens Academy <${INFO_EMAIL}>`,
        replyTo: INFO_EMAIL,
        internalRecipient: INFO_EMAIL,
      };
  }
}

export type EmailDeliveryResult = {
  status: "sent" | "failed";
  errorCode?: string;
  providerMessageId?: string;
  channel?: EmailChannel;
  usedFallback?: boolean;
  archiveBccApplied?: boolean;
  archiveRecipient?: string;
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

function utf8Base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** RFC 2047 encoding for non-ASCII mailbox display names and subjects. */
export function encodeHeaderWord(value: string): string {
  const clean = value.replace(/[\r\n]+/g, " ").trim();
  if (/^=\?UTF-8\?[BQ]\?.+\?=$/i.test(clean) || /^[\x20-\x7E]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${utf8Base64(clean)}?=`;
}

function encodeMailboxHeader(value: string): string {
  const clean = value.replace(/[\r\n]+/g, " ").trim();
  const match = clean.match(/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/);
  if (!match) return clean;
  const displayName = match[1].replace(/^"|"$/g, "").trim();
  return displayName ? `${encodeHeaderWord(displayName)} <${match[2]}>` : `<${match[2]}>`;
}

/**
 * Builds RFC 2822 / RFC 5322 MIME multipart/alternative message for transactional delivery
 */
export function buildRfc822Message(params: {
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
}): string {
  const boundary = `====_Oriens_${crypto.randomUUID().replace(/-/g, "")}_====`;
  const utf8Subject = encodeHeaderWord(params.subject);

  const headers = [
    `From: ${encodeMailboxHeader(params.from)}`,
    `To: ${params.to}`,
    params.cc ? `Cc: ${params.cc}` : null,
    params.bcc ? `Bcc: ${params.bcc}` : null,
    params.replyTo ? `Reply-To: ${encodeMailboxHeader(params.replyTo)}` : null,
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

function getEnvVar(key: string): string | undefined {
  try {
    if (typeof Deno !== "undefined" && Deno.env) {
      return Deno.env.get(key);
    }
    if (typeof process !== "undefined" && process.env) {
      return process.env[key];
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Exchanges Google OAuth2 Refresh Token for a fresh Access Token
 */
async function getGoogleAccessToken(): Promise<{ token?: string; error?: string }> {
  const clientId = getEnvVar("GOOGLE_CLIENT_ID");
  const clientSecret = getEnvVar("GOOGLE_CLIENT_SECRET");
  const refreshToken = getEnvVar("GOOGLE_REFRESH_TOKEN");

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
  deliveryId?: string;
}) {
  try {
    if (params.deliveryId) {
      await params.supabaseAdmin.from("notification_deliveries").update({
        provider: "google_workspace",
        provider_message_id: params.providerMessageId || null,
        status: params.status,
        last_error_code: params.lastErrorCode || null,
        last_error: params.lastErrorCode || null,
        sent_at: params.status === "sent" ? new Date().toISOString() : null,
        next_attempt_at: params.status === "failed" ? new Date(Date.now() + 5 * 60_000).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", params.deliveryId);
      return;
    }
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
 * Sends a transactional email using Google Mail API (OAuth2) with centralized alias routing,
 * automated operational BCC copy (admin@oriens-academy.com), deduplication protection & safe fallback.
 */
export async function sendTransactionalEmail(params: {
  supabaseAdmin: SupabaseClient;
  to: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  eventType: string;
  entityType: string;
  entityId: string;
  idempotencyKey?: string;
  channel?: EmailChannel;
  sender?: { name?: string; email?: string };
  skipArchiveBcc?: boolean;
  deliveryId?: string;
}): Promise<EmailDeliveryResult> {
  const {
    supabaseAdmin,
    to,
    cc,
    bcc,
    replyTo,
    subject,
    html,
    text,
    eventType,
    entityType,
    entityId,
    channel = "general",
    sender,
    skipArchiveBcc = false,
    deliveryId,
  } = params;

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
      deliveryId,
    });
    return { status: "failed", errorCode: "RECIPIENT_NOT_CONFIGURED", channel };
  }

  // Calculate operational BCC recipient (admin@oriens-academy.com)
  const archiveAddress = getArchiveBccAddress();
  const toEmails = extractEmails(to);
  const ccEmails = extractEmails(cc);
  const explicitBccEmails = extractEmails(bcc);

  // Do not add admin@ again when it is already a direct recipient.
  const alreadyTargeted =
    toEmails.includes(archiveAddress) ||
    ccEmails.includes(archiveAddress) ||
    explicitBccEmails.includes(archiveAddress);

  let archiveBccApplied = false;
  let finalBccList: string[] = [];

  if (!alreadyTargeted && !skipArchiveBcc) {
    finalBccList = [...new Set([...explicitBccEmails, archiveAddress])];
    archiveBccApplied = true;
  } else {
    finalBccList = [...new Set(explicitBccEmails)];
    archiveBccApplied = false;
  }

  const effectiveBccHeader = finalBccList.length > 0 ? finalBccList.join(", ") : undefined;

  // Resolve sender identity from channel or override
  const resolvedIdentity = resolveMailIdentity(channel);
  const targetFromName = sender?.name || resolvedIdentity.fromName;
  const targetFromEmail = sender?.email || resolvedIdentity.fromEmail;
  const targetReplyTo = replyTo || resolvedIdentity.replyTo;
  const initialFromAddress = `${targetFromName} <${targetFromEmail}>`;

  const { token: accessToken, error: tokenError } = await getGoogleAccessToken();

  if (!accessToken || tokenError) {
    const isDev =
      (typeof Deno !== "undefined" &&
        (Deno.env.get("DENO_ENV") === "development" || Deno.env.get("ENVIRONMENT") === "development")) ||
      (typeof process !== "undefined" &&
        (process.env.NODE_ENV === "development" || process.env.ENVIRONMENT === "development"));

    if (isDev) {
      console.warn(
        `[email/service] [DEV MODE] Google credentials not configured. Simulating delivery for: ${to} (BCC archive: ${archiveBccApplied ? archiveAddress : "none"})`
      );
      const mockId = `mock-google-${crypto.randomUUID()}`;
      await logNotificationDelivery({
        supabaseAdmin,
        eventType,
        entityType,
        entityId,
        recipient: to,
        status: "sent",
        providerMessageId: mockId,
        deliveryId,
      });
      return {
        status: "sent",
        providerMessageId: mockId,
        channel,
        archiveBccApplied,
        archiveRecipient: archiveBccApplied ? archiveAddress : undefined,
      };
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
      deliveryId,
    });
    return {
      status: "failed",
      errorCode: tokenError || "GOOGLE_AUTH_ERROR",
      channel,
      archiveBccApplied,
      archiveRecipient: archiveBccApplied ? archiveAddress : undefined,
    };
  }

  // Helper function to send an RFC 822 MIME message to Gmail API
  async function attemptSend(fromHdr: string, replyToHdr?: string) {
    const rawMime = buildRfc822Message({
      from: fromHdr,
      to,
      cc,
      bcc: effectiveBccHeader,
      replyTo: replyToHdr,
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
      body: JSON.stringify({ raw: rawBase64Url }),
    });

    const json = await res.json();
    return { res, json };
  }

  try {
    let usedFallback = false;
    let { res, json } = await attemptSend(initialFromAddress, targetReplyTo);

    // If alias From is rejected by Gmail API (e.g. status 400/403 on unverified alias),
    // automatically fallback to safe default From (info@oriens-academy.com) while keeping Reply-To set to the alias!
    if (!res.ok && targetFromEmail !== DEFAULT_FALLBACK_EMAIL) {
      console.warn(
        `[email/service] Alias From "${initialFromAddress}" rejected by Gmail API (${json.error?.message || res.status}). Retrying with safe fallback From: "${DEFAULT_FALLBACK_FROM}" and Reply-To: "${targetReplyTo}"`
      );
      const fallbackResult = await attemptSend(DEFAULT_FALLBACK_FROM, targetReplyTo);
      res = fallbackResult.res;
      json = fallbackResult.json;
      usedFallback = true;
    }

    if (res.ok && json.id) {
      await logNotificationDelivery({
        supabaseAdmin,
        eventType,
        entityType,
        entityId,
        recipient: to,
        status: "sent",
        providerMessageId: json.id,
        deliveryId,
      });
      return {
        status: "sent",
        providerMessageId: json.id,
        channel,
        usedFallback,
        archiveBccApplied,
        archiveRecipient: archiveBccApplied ? archiveAddress : undefined,
      };
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
        deliveryId,
      });
      return {
        status: "failed",
        errorCode,
        channel,
        usedFallback,
        archiveBccApplied,
        archiveRecipient: archiveBccApplied ? archiveAddress : undefined,
      };
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
      deliveryId,
    });
    return {
      status: "failed",
      errorCode: "NETWORK_ERROR",
      channel,
      archiveBccApplied,
      archiveRecipient: archiveBccApplied ? archiveAddress : undefined,
    };
  }
}

// ============================================================================
// DISPATCHERS — GÖRÜŞME & İLETİŞİM (CHANNEL: CONTACT)
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
  const adminRecipient = !configuredRecipient || configuredRecipient === INFO_EMAIL
    ? INFO_EMAIL
    : configuredRecipient;
  const adminLocale = localeConfig?.locale ?? "tr";

  const adminTemplate = renderAdminBookingEmail(bookingData, adminLocale);
  const studentTemplate = renderStudentBookingEmail(bookingData);

  const [admin, student] = await Promise.all([
    sendTransactionalEmail({
      supabaseAdmin,
      to: adminRecipient,
      replyTo: bookingData.email,
      channel: "contact",
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
      replyTo: INFO_EMAIL,
      channel: "contact",
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
  const adminRecipient = !configuredRecipient || configuredRecipient === INFO_EMAIL
    ? INFO_EMAIL
    : configuredRecipient;
  const adminLocale = localeConfig?.locale ?? "tr";

  const adminTemplate = renderAdminContactEmail(contactData, adminLocale);
  const studentTemplate = renderStudentContactEmail(contactData);

  const [admin, student] = await Promise.all([
    sendTransactionalEmail({
      supabaseAdmin,
      to: adminRecipient,
      replyTo: contactData.email,
      channel: "contact",
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
      replyTo: INFO_EMAIL,
      channel: "contact",
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
// DISPATCHERS — RANDEVU & DERSLER (CHANNEL: SUPPORT)
// ============================================================================

export async function dispatchAppointmentConfirmedEmails(
  supabaseAdmin: SupabaseClient,
  data: AppointmentEmailData
) {
  const supportEmailConfig = await getPrivateSiteSetting<{ email: string }>(
    supabaseAdmin,
    "notification.support_email"
  );
  const bookingEmailConfig = await getPrivateSiteSetting<{ email: string }>(
    supabaseAdmin,
    "notification.booking_email"
  );
  const adminRecipient = supportEmailConfig?.email?.trim() || bookingEmailConfig?.email?.trim() || INFO_EMAIL;

  const adminTemplate = renderAdminAppointmentCreatedEmail(data, "tr");
  const studentTemplate = renderStudentAppointmentConfirmedEmail(data);

  const [admin, student] = await Promise.all([
    sendTransactionalEmail({
      supabaseAdmin,
      to: adminRecipient,
      replyTo: data.studentEmail,
      channel: "support",
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
      replyTo: INFO_EMAIL,
      channel: "support",
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
    replyTo: INFO_EMAIL,
    channel: "support",
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
    replyTo: INFO_EMAIL,
    channel: "support",
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
    replyTo: INFO_EMAIL,
    channel: "support",
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
// DISPATCHERS — PAKETLER & ÖDEMELER (CHANNEL: PAYMENTS)
// ============================================================================

export async function dispatchPackagePurchasedEmail(
  supabaseAdmin: SupabaseClient,
  data: PackagePurchaseEmailData
) {
  const template = renderStudentPackagePurchasedEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    replyTo: PAYMENTS_EMAIL,
    channel: "payments",
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
    replyTo: PAYMENTS_EMAIL,
    channel: "payments",
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
    replyTo: PAYMENTS_EMAIL,
    channel: "payments",
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
    replyTo: PAYMENTS_EMAIL,
    channel: "payments",
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
    replyTo: PAYMENTS_EMAIL,
    channel: "payments",
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
  const paymentEmailConfig = await getPrivateSiteSetting<{ email: string }>(
    supabaseAdmin,
    "notification.payment_email"
  );
  const adminRecipient = paymentEmailConfig?.email?.trim() || PAYMENTS_EMAIL;

  const template = renderAdminPaymentNotificationEmail(data, data.locale || "tr");
  return sendTransactionalEmail({
    supabaseAdmin,
    to: adminRecipient,
    replyTo: data.payerEmail,
    channel: "payments",
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
    replyTo: PAYMENTS_EMAIL,
    channel: "payments",
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
// DISPATCHERS — ÖDEVLER & AKADEMİK TAKİP (CHANNEL: SUPPORT)
// ============================================================================

export async function dispatchHomeworkAssignedEmail(
  supabaseAdmin: SupabaseClient,
  data: HomeworkEmailData
) {
  const template = renderStudentHomeworkAssignedEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    replyTo: INFO_EMAIL,
    channel: "support",
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
    replyTo: INFO_EMAIL,
    channel: "support",
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
  const supportEmailConfig = await getPrivateSiteSetting<{ email: string }>(
    supabaseAdmin,
    "notification.support_email"
  );
  const recipient = supportEmailConfig?.email?.trim() || INFO_EMAIL;

  const template = renderTeacherHomeworkSubmittedEmail(data, "tr");
  return sendTransactionalEmail({
    supabaseAdmin,
    to: recipient,
    replyTo: data.studentEmail,
    channel: "support",
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
    replyTo: INFO_EMAIL,
    channel: "support",
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "homework.reviewed.student",
    entityType: "homework",
    entityId: data.homeworkId,
    idempotencyKey: `hw-reviewed-${data.homeworkId}-${Date.now()}`,
  });
}

export async function dispatchHomeworkRevisionRequestedEmail(
  supabaseAdmin: SupabaseClient,
  data: HomeworkEmailData
) {
  const template = renderStudentHomeworkRevisionRequestedEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    replyTo: INFO_EMAIL,
    channel: "support",
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "homework.revision_requested.student",
    entityType: "homework",
    entityId: data.homeworkId,
    idempotencyKey: `hw-revision-${data.homeworkId}-${Date.now()}`,
  });
}

// ============================================================================
// DISPATCHERS — HESAP & GÜVENLİK (CHANNELS: GENERAL & SUPPORT)
// ============================================================================

export async function dispatchWelcomeEmail(
  supabaseAdmin: SupabaseClient,
  data: WelcomeEmailData
) {
  const template = renderStudentWelcomeEmail(data);
  const studentIdentifier = data.studentUserId || data.studentEmail;

  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    replyTo: INFO_EMAIL,
    channel: "general",
    sender: {
      name: "Oriens Academy",
      email: INFO_EMAIL,
    },
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "student.welcome_email",
    entityType: "student_profile",
    entityId: studentIdentifier,
    idempotencyKey: `student-welcome-${studentIdentifier}`,
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
    replyTo: INFO_EMAIL,
    channel: "support",
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
    replyTo: ADMIN_EMAIL,
    channel: "admin",
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "account.security_alert",
    entityType: "account_security",
    entityId: `${data.studentEmail}-${Date.now()}`,
    idempotencyKey: `acc-security-${data.studentEmail}-${Date.now()}`,
  });
}

// ============================================================================
// DISPATCHERS — CANLI DERS & DERS TAMAMLAMA (CHANNEL: SUPPORT)
// ============================================================================

export async function dispatchLiveLessonLinkEmail(
  supabaseAdmin: SupabaseClient,
  data: LiveLessonLinkEmailData
) {
  const template = renderStudentLiveLessonLinkEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    replyTo: ZOOM_EMAIL,
    channel: "zoom",
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: data.isUpdate ? "lesson.link_updated.student" : "lesson.link_ready.student",
    entityType: "student_lesson",
    entityId: data.lessonId,
    idempotencyKey: `lesson-link-${data.lessonId}-${Date.now()}`,
  });
}

export async function dispatchLessonCompletedEmail(
  supabaseAdmin: SupabaseClient,
  data: LessonCompletedEmailData
) {
  const template = renderStudentLessonCompletedEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    replyTo: INFO_EMAIL,
    channel: "support",
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "lesson.completed.student",
    entityType: "student_lesson",
    entityId: data.lessonId,
    idempotencyKey: `lesson-completed-${data.lessonId}`,
  });
}

export async function dispatchSupportCreatedEmail(
  supabaseAdmin: SupabaseClient,
  data: SupportConfirmationEmailData & { threadId: string }
) {
  const template = renderStudentSupportConfirmationEmail(data);
  return sendTransactionalEmail({
    supabaseAdmin,
    to: data.studentEmail,
    replyTo: INFO_EMAIL,
    channel: "support",
    sender: {
      name: data.locale === "en" ? "Oriens Academy Destek" : "Oriens Academy Destek",
      email: INFO_EMAIL,
    },
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "support.ticket_created.student",
    entityType: "support_thread",
    entityId: data.threadId,
    idempotencyKey: `support-created-${data.threadId}`,
  });
}
