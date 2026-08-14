import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";
import { renderAdminPasswordRecoveryEmail } from "../_shared/email/templates.ts";

const RESET_ACTION = "admin_password_reset";
const RESET_COOLDOWN_MS = 10 * 60 * 1000;
const FAILED_DELIVERY_COOLDOWN_MS = 60 * 1000;
const NEUTRAL_MESSAGE_TR =
  "E-posta adresi yönetici hesabıyla eşleşiyorsa yeni giriş bilgileri gönderildi.";
const NEUTRAL_MESSAGE_EN =
  "If the email matches the administrator account, new sign-in credentials have been sent.";

type Locale = "tr" | "en";

function neutralResponse(req: Request, locale: Locale) {
  return buildJsonResponse(
    {
      accepted: true,
      message: locale === "tr" ? NEUTRAL_MESSAGE_TR : NEUTRAL_MESSAGE_EN,
    },
    200,
    req
  );
}

function temporaryFailure(req: Request) {
  return buildJsonResponse(
    { error_code: "TEMPORARY_ERROR", message: "The request could not be completed." },
    503,
    req
  );
}

function randomIndex(max: number): number {
  const ceiling = Math.floor(256 / max) * max;
  const buffer = new Uint8Array(1);
  do crypto.getRandomValues(buffer); while (buffer[0] >= ceiling);
  return buffer[0] % max;
}

function secureShuffle(chars: string[]): string {
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }
  return chars.join("");
}

function generateTemporaryPassword(length = 16): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*+-=?";
  const all = `${upper}${lower}${digits}${symbols}`;
  const password = [
    upper[randomIndex(upper.length)],
    lower[randomIndex(lower.length)],
    digits[randomIndex(digits.length)],
    symbols[randomIndex(symbols.length)],
  ];

  while (password.length < length) password.push(all[randomIndex(all.length)]);
  return secureShuffle(password);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

async function recordAudit(
  client: SupabaseClient,
  userId: string,
  email: string,
  delivery: "sent" | "failed"
) {
  const { error } = await client.from("audit_logs").insert({
    actor_user_id: null,
    action: "admin.password_reset_requested",
    entity_type: "admin_auth",
    entity_id: userId,
    metadata: { email_masked: maskEmail(email), delivery },
  });
  if (error) console.error("[admin-password-reset] Sanitized audit write failed.");
}

async function recordDelivery(
  client: SupabaseClient,
  requestId: string,
  recipient: string,
  status: "sent" | "failed",
  providerMessageId?: string,
  lastErrorCode?: string
) {
  const { error } = await client.from("notification_deliveries").insert({
    channel: "email",
    event_type: "admin.password_reset",
    entity_type: "admin_auth",
    entity_id: requestId,
    recipient,
    provider: "resend",
    provider_message_id: providerMessageId ?? null,
    status,
    attempt_count: 1,
    last_error_code: lastErrorCode ?? null,
    sent_at: status === "sent" ? new Date().toISOString() : null,
  });
  if (error) console.error("[admin-password-reset] Sanitized delivery write failed.");
}

async function sendCredentialEmail(params: {
  client: SupabaseClient;
  requestId: string;
  to: string;
  password: string;
  locale: Locale;
  apiKey: string;
  from: string;
}): Promise<boolean> {
  const template = renderAdminPasswordRecoveryEmail(params.to, params.password, params.locale);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `admin-password-reset-${params.requestId}`,
      },
      body: JSON.stringify({
        from: params.from,
        to: [params.to],
        subject: template.subject,
        html: template.html,
        text: template.text,
      }),
    });
    const result = await response.json().catch(() => ({})) as { id?: string; name?: string };
    if (!response.ok || !result.id) {
      await recordDelivery(params.client, params.requestId, params.to, "failed", undefined, result.name ?? `HTTP_${response.status}`);
      return false;
    }
    await recordDelivery(params.client, params.requestId, params.to, "sent", result.id);
    return true;
  } catch {
    await recordDelivery(params.client, params.requestId, params.to, "failed", undefined, "NETWORK_ERROR");
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const invalidRequest = validateMutationRequest(req, ["POST"]);
  if (invalidRequest) return invalidRequest;

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return buildJsonResponse({ error_code: "INVALID_REQUEST", message: "Invalid request." }, 400, req);
  }

  const locale: Locale = payload.locale === "en" ? "en" : "tr";
  const email = String(payload.email ?? "").trim().toLowerCase();
  const token = String(payload.turnstileToken ?? "").trim();
  const remoteIp =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  const turnstile = await verifyTurnstile({ token, expectedAction: RESET_ACTION, remoteIp });
  if (!turnstile.success) {
    return buildJsonResponse(
      { error_code: turnstile.errorCode, message: turnstile.message },
      turnstile.errorCode === "SERVER_CONFIG_ERROR" ? 503 : 400,
      req
    );
  }

  const allowedEmail = (Deno.env.get("ADMIN_AUTH_EMAIL") ?? "").trim().toLowerCase();
  if (!allowedEmail || email !== allowedEmail) return neutralResponse(req, locale);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !from) {
    console.error("[admin-password-reset] Required server configuration is missing.");
    return temporaryFailure(req);
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const keyHashes = [await sha256(`email|${email}`), await sha256(`ip|${remoteIp}`)];
  const now = new Date();
  for (const keyHash of keyHashes) {
    const { data: limitClaimed, error: limitWriteError } = await client.rpc(
      "claim_admin_password_reset_limit",
      {
        p_key_hash: keyHash,
        p_now: now.toISOString(),
        p_blocked_until: new Date(now.getTime() + RESET_COOLDOWN_MS).toISOString(),
      }
    );
    if (limitWriteError) {
      console.error("[admin-password-reset] Rate-limit reservation failed; failing closed.");
      return temporaryFailure(req);
    }
    if (limitClaimed !== true) return neutralResponse(req, locale);
  }

  const matchingUsers: User[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      console.error("[admin-password-reset] Administrator lookup failed.");
      return neutralResponse(req, locale);
    }
    matchingUsers.push(...data.users.filter((user) => user.email?.toLowerCase() === allowedEmail));
    if (data.users.length < 100) break;
  }
  if (matchingUsers.length !== 1 || matchingUsers[0].app_metadata?.role !== "admin") {
    console.error("[admin-password-reset] Configured administrator identity is inconsistent.");
    return neutralResponse(req, locale);
  }

  const adminUser = matchingUsers[0];
  const { data: profile, error: profileError } = await client
    .from("admin_profiles")
    .select("role, active")
    .eq("user_id", adminUser.id)
    .maybeSingle();
  if (profileError || !profile || profile.role !== "admin" || profile.active !== true) {
    console.error("[admin-password-reset] Configured administrator profile is inconsistent.");
    return neutralResponse(req, locale);
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error: updateError } = await client.auth.admin.updateUserById(adminUser.id, {
    password: temporaryPassword,
    user_metadata: { ...adminUser.user_metadata, force_password_change: true },
  });
  if (updateError) {
    console.error("[admin-password-reset] Password update failed.");
    return temporaryFailure(req);
  }

  const requestId = crypto.randomUUID();
  const delivered = await sendCredentialEmail({
    client,
    requestId,
    to: allowedEmail,
    password: temporaryPassword,
    locale,
    apiKey: resendApiKey,
    from,
  });
  await recordAudit(client, adminUser.id, allowedEmail, delivered ? "sent" : "failed");

  if (!delivered) {
    for (const keyHash of keyHashes) {
      await client.rpc("shorten_admin_password_reset_limit", {
        p_key_hash: keyHash,
        p_blocked_until: new Date(Date.now() + FAILED_DELIVERY_COOLDOWN_MS).toISOString(),
      });
    }
    console.error("[admin-password-reset] Credential delivery failed after password rotation.");
    return temporaryFailure(req);
  }

  return neutralResponse(req, locale);
});
