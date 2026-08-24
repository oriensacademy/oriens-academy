import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { sendTransactionalEmail } from "../_shared/email/service.ts";

const ALLOWED_PREVIEW_RECIPIENT = "info@oriens-academy.com";

function verifyServiceRole(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const parsed = JSON.parse(jsonPayload);
    return parsed.role === "service_role";
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;

  const url = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const apikey = req.headers.get("apikey") || "";
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!url || !service) {
    return buildJsonResponse({ error_code: "SERVER_CONFIG_ERROR" }, 500, req);
  }

  // Authorize via Service Role JWT or Service Key string
  const isAuthorized =
    verifyServiceRole(token) ||
    verifyServiceRole(apikey) ||
    token === service ||
    apikey === service;

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

  // Strict enforcement: Preview delivery is ONLY sent to info@oriens-academy.com
  const delivery = await sendTransactionalEmail({
    supabaseAdmin: admin,
    to: ALLOWED_PREVIEW_RECIPIENT,
    replyTo: replyTo || "support@oriens-academy.com",
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
