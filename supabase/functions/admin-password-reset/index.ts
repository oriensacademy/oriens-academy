import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";
import { dispatchPasswordResetEmail } from "../_shared/email/service.ts";

const RESET_ACTION = "admin_password_reset";
const RESET_COOLDOWN_MS = 10 * 60 * 1000;
const FAILED_DELIVERY_COOLDOWN_MS = 60 * 1000;
const NEUTRAL_MESSAGE_TR =
  "E-posta adresi aktif bir Oriens Academy hesabıyla eşleşiyorsa yeni giriş bilgileri gönderildi.";
const NEUTRAL_MESSAGE_EN =
  "If the email matches an active Oriens Academy account, new sign-in information has been sent.";

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
    action: "account.password_reset_requested",
    entity_type: "account_auth",
    entity_id: userId,
    metadata: { email_masked: maskEmail(email), delivery },
  });
  if (error) console.error("[admin-password-reset] Sanitized audit write failed.");
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
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
      console.error("[admin-password-reset] Account lookup failed.");
      return neutralResponse(req, locale);
    }
    matchingUsers.push(...data.users.filter((user) => user.email?.toLowerCase() === email));
    if (data.users.length < 100) break;
  }
  if (matchingUsers.length !== 1) return neutralResponse(req, locale);

  const accountUser = matchingUsers[0];
  let activeAccount = false;
  if (accountUser.app_metadata?.role === "admin") {
    const { data: profile } = await client.from("admin_profiles").select("role, active").eq("user_id", accountUser.id).maybeSingle();
    activeAccount = profile?.role === "admin" && profile.active === true;
  }
  if (!activeAccount) {
    const { data: profile } = await client.from("student_profiles").select("active").eq("id", accountUser.id).maybeSingle();
    activeAccount = profile?.active === true;
  }
  if (!activeAccount) return neutralResponse(req, locale);

  const temporaryPassword = generateTemporaryPassword();
  const { error: updateError } = await client.auth.admin.updateUserById(accountUser.id, {
    password: temporaryPassword,
    user_metadata: { ...accountUser.user_metadata, force_password_change: true },
  });
  if (updateError) {
    console.error("[admin-password-reset] Password update failed.");
    return temporaryFailure(req);
  }

  const requestId = crypto.randomUUID();
  const deliveryResult = await dispatchPasswordResetEmail({
    supabaseAdmin: client,
    requestId,
    to: email,
    temporaryPassword,
    locale,
  });
  const delivered = deliveryResult.status === "sent";

  await recordAudit(client, accountUser.id, email, delivered ? "sent" : "failed");

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
