import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { INFO_EMAIL, sendTransactionalEmail } from "../_shared/email/service.ts";
import { renderContactReplyEmail } from "../_shared/email/templates.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authorization = req.headers.get("authorization") || "";
  if (!url || !anonKey || !serviceKey || !authorization) {
    return buildJsonResponse({ error_code: "SERVER_CONFIG_ERROR" }, 500, req);
  }

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [{ data: userData, error: userError }, { data: isAdmin }] = await Promise.all([
    caller.auth.getUser(),
    caller.rpc("is_admin"),
  ]);
  if (userError || !userData.user) {
    return buildJsonResponse({ error_code: "UNAUTHORIZED" }, 401, req);
  }
  if (!isAdmin) {
    return buildJsonResponse({ error_code: "FORBIDDEN" }, 403, req);
  }

  const body = await req.json().catch(() => ({}));
  const contactRequestId = String(body.contactRequestId || "").trim();
  const messageText = String(body.messageText || "").trim();
  const idempotencyKey = String(body.idempotencyKey || "").trim();
  if (!UUID.test(contactRequestId)) {
    return buildJsonResponse({ error_code: "INVALID_CONTACT_REQUEST_ID" }, 400, req);
  }
  if (!messageText || messageText.length > 10000) {
    return buildJsonResponse({ error_code: "INVALID_MESSAGE" }, 400, req);
  }
  if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return buildJsonResponse({ error_code: "INVALID_IDEMPOTENCY_KEY" }, 400, req);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: contact, error: contactError } = await admin
    .from("contact_requests")
    .select("id, full_name, email, subject, locale")
    .eq("id", contactRequestId)
    .maybeSingle();
  if (contactError || !contact) {
    return buildJsonResponse({ error_code: "CONTACT_REQUEST_NOT_FOUND" }, 404, req);
  }

  const recipientEmail = String(contact.email || "").trim().toLowerCase();
  if (!EMAIL.test(recipientEmail)) {
    return buildJsonResponse({ error_code: "INVALID_RECIPIENT" }, 400, req);
  }

  const renderedReply = renderContactReplyEmail({
    fullName: contact.full_name,
    originalSubject: contact.subject,
    replyMessage: messageText,
    locale: contact.locale === "en" ? "en" : "tr",
  });
  const messageHtml = renderedReply.html;
  const { data: claimedReply, error: claimError } = await admin
    .from("contact_replies")
    .insert({
      contact_request_id: contact.id,
      direction: "outbound",
      sender_email: INFO_EMAIL,
      recipient_email: recipientEmail,
      sender_name: "Oriens Academy",
      message_text: messageText,
      message_html: messageHtml,
      delivery_status: "pending",
      sent_by_admin_user_id: userData.user.id,
      idempotency_key: idempotencyKey,
    })
    .select("*")
    .single();

  if (claimError?.code === "23505") {
    const { data: existing } = await admin
      .from("contact_replies")
      .select("*")
      .eq("contact_request_id", contact.id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    return buildJsonResponse({
      success: existing?.delivery_status === "sent",
      duplicate: true,
      reply: existing,
      error_code: existing?.delivery_status === "failed" ? "DELIVERY_FAILED" : undefined,
    }, existing?.delivery_status === "sent" ? 200 : 202, req);
  }
  if (claimError || !claimedReply) {
    return buildJsonResponse({ error_code: "REPLY_CLAIM_FAILED" }, 500, req);
  }

  const subject = renderedReply.subject;
  const delivery = await sendTransactionalEmail({
    supabaseAdmin: admin,
    to: recipientEmail,
    replyTo: INFO_EMAIL,
    subject,
    html: messageHtml,
    text: renderedReply.text,
    eventType: "contact.admin_reply",
    entityType: "contact_reply",
    entityId: claimedReply.id,
    idempotencyKey,
    channel: "contact",
    sender: { name: "Oriens Academy", email: INFO_EMAIL },
  });

  const sent = delivery.status === "sent";
  const sanitizedError = sent ? null : { code: delivery.errorCode || "DELIVERY_FAILED" };
  const { data: finalReply, error: updateError } = await admin
    .from("contact_replies")
    .update({
      delivery_status: sent ? "sent" : "failed",
      external_message_id: delivery.providerMessageId || null,
      sent_at: sent ? new Date().toISOString() : null,
      error_metadata: sanitizedError,
    })
    .eq("id", claimedReply.id)
    .select("*")
    .single();

  if (updateError || !finalReply) {
    return buildJsonResponse({ error_code: "REPLY_STATUS_UPDATE_FAILED" }, 500, req);
  }

  await admin.from("audit_logs").insert({
    actor_user_id: userData.user.id,
    action: sent ? "admin.contact.reply_sent" : "admin.contact.reply_failed",
    entity_type: "contact_reply",
    entity_id: finalReply.id,
    metadata: {
      contact_request_id: contact.id,
      recipient_email: recipientEmail,
      delivery_status: finalReply.delivery_status,
    },
  });

  return buildJsonResponse({
    success: sent,
    duplicate: false,
    reply: finalReply,
    error_code: sent ? undefined : "DELIVERY_FAILED",
  }, 200, req);
});
