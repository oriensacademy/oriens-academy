import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { sendTransactionalEmail } from "../_shared/email/service.ts";
import { getSupabaseAdminKey } from "../_shared/supabase-admin.ts";

const ALLOWED_PREVIEW_RECIPIENTS = ["admin@oriens-academy.com", "info@oriens-academy.com"];
const DEFAULT_PREVIEW_RECIPIENT = "admin@oriens-academy.com";

Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;

  const url = Deno.env.get("SUPABASE_URL") || "";
  const service = getSupabaseAdminKey();
  const apikey = req.headers.get("apikey") || "";
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!url || !service) {
    return buildJsonResponse({ error_code: "SERVER_CONFIG_ERROR" }, 500, req);
  }

  const isAuthorized = token === service || apikey === service;

  if (!isAuthorized) {
    return buildJsonResponse({ error_code: "UNAUTHORIZED" }, 401, req);
  }

  const body = await req.json().catch(() => ({}));
  const channel = body.channel || "general";
  const subject = String(body.subject || "").trim();
  const html = String(body.html || "").trim();
  const text = String(body.text || "").trim();
  const from = body.from ? String(body.from) : undefined;
  const replyTo = body.replyTo ? String(body.replyTo) : undefined;
  const eventType = body.eventType ? String(body.eventType) : "preview.delivery";

  if (!subject || !html || !text) {
    return buildJsonResponse({ error_code: "MISSING_CONTENT" }, 400, req);
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Strict enforcement: Preview delivery is ONLY sent to authorized admin/test recipient
  const requestedRecipient = body.to ? String(body.to).trim().toLowerCase() : DEFAULT_PREVIEW_RECIPIENT;
  const targetRecipient = ALLOWED_PREVIEW_RECIPIENTS.includes(requestedRecipient)
    ? requestedRecipient
    : DEFAULT_PREVIEW_RECIPIENT;

  const delivery = await sendTransactionalEmail({
    supabaseAdmin: admin,
    to: targetRecipient,
    replyTo: replyTo || "info@oriens-academy.com",
    channel,
    sender: from
      ? {
          name: from.includes("<") ? from.split("<")[0].trim() : "Oriens Academy",
          email: from.includes("<") ? from.split("<")[1].replace(">", "").trim() : from.trim(),
        }
      : undefined,
    subject,
    html,
    text,
    eventType,
    entityType: "preview_delivery",
    entityId: `preview-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  });

  return buildJsonResponse(
    { success: delivery.status === "sent", delivery },
    delivery.status === "sent" ? 200 : 500,
    req
  );
});
