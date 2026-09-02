import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { sendTransactionalEmail } from "../_shared/email/service.ts";
import { renderPurchaseEmailVerificationOtpEmail } from "../_shared/email/templates.ts";

const OTP_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_REQUESTS_PER_HOUR = 10;
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function computeOtpHmac(
  userId: string,
  email: string,
  otp: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const messageData = encoder.encode(`${userId}:${email}:${otp}`);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function computeTokenHmac(rawToken: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const messageData = encoder.encode(`purchase_link:${rawToken}`);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateSecureOtp(): string {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return String(100000 + (buffer[0] % 900000));
}

Deno.serve(async (req: Request) => {
  const invalidRequest = validateMutationRequest(req, ["POST"]);
  if (invalidRequest) return invalidRequest;

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return buildJsonResponse(
      { error_code: "UNAUTHORIZED", message: "Oturum açmanız gerekmektedir." },
      401,
      req
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const hmacSecret = Deno.env.get("PURCHASE_OTP_HMAC_SECRET") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !hmacSecret) {
    console.error("[request-purchase-email-verification] Required server configuration is missing.");
    return buildJsonResponse(
      { error_code: "SERVER_CONFIG_ERROR", message: "Sunucu yapılandırma hatası." },
      503,
      req
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return buildJsonResponse(
      { error_code: "UNAUTHORIZED", message: "Geçersiz oturum." },
      401,
      req
    );
  }
  const user: User = userData.user;

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return buildJsonResponse(
      { error_code: "INVALID_REQUEST", message: "Geçersiz istek formatı." },
      400,
      req
    );
  }

  const candidateEmail = String(payload.candidateEmail || user.email || "").trim().toLowerCase();
  const locale = payload.locale === "en" ? "en" : "tr";

  if (!candidateEmail || !EMAIL_REGEX.test(candidateEmail)) {
    return buildJsonResponse(
      { error_code: "INVALID_EMAIL", message: "Geçerli bir e-posta adresi giriniz." },
      400,
      req
    );
  }

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  // Rate limit: Max requests per hour
  const { count: hourlyCount, error: countError } = await supabaseAdmin
    .from("purchase_email_verification_challenges")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", oneHourAgo);

  if (!countError && typeof hourlyCount === "number" && hourlyCount >= MAX_REQUESTS_PER_HOUR) {
    return buildJsonResponse(
      {
        error_code: "RATE_LIMIT_EXCEEDED",
        message: locale === "tr"
          ? "Çok fazla doğrulama kodu talep edildi. Lütfen 1 saat sonra tekrar deneyiniz."
          : "Too many verification requests. Please try again in 1 hour.",
      },
      429,
      req
    );
  }

  // Check resend cooldown
  const { data: latestChallenge } = await supabaseAdmin
    .from("purchase_email_verification_challenges")
    .select("id, resend_available_at, expires_at")
    .eq("user_id", user.id)
    .is("verified_at", null)
    .gt("expires_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestChallenge && new Date(latestChallenge.resend_available_at) > now) {
    return buildJsonResponse(
      {
        error_code: "RESEND_COOLDOWN",
        resend_available_at: latestChallenge.resend_available_at,
        message: locale === "tr"
          ? "Lütfen yeni kod istemeden önce bir süre bekleyin."
          : "Please wait before requesting a new code.",
      },
      429,
      req
    );
  }

  // Invalidate previous challenges
  await supabaseAdmin
    .from("purchase_email_verification_challenges")
    .update({ expires_at: now.toISOString(), updated_at: now.toISOString() })
    .eq("user_id", user.id)
    .is("verified_at", null)
    .gt("expires_at", now.toISOString());

  const otp = generateSecureOtp();
  const codeHash = await computeOtpHmac(user.id, candidateEmail, otp, hmacSecret);

  // Generate high-entropy 256-bit opaque token for one-click email verification
  const rawTokenBytes = new Uint8Array(32);
  crypto.getRandomValues(rawTokenBytes);
  const rawLinkToken = Array.from(rawTokenBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const linkTokenHash = await computeTokenHmac(rawLinkToken, hmacSecret);

  const expiresAt = new Date(now.getTime() + OTP_EXPIRATION_MS).toISOString();
  const resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_MS).toISOString();

  const { error: insertError } = await supabaseAdmin
    .from("purchase_email_verification_challenges")
    .insert({
      user_id: user.id,
      candidate_email: candidateEmail,
      code_hash: codeHash,
      verification_token_hash: linkTokenHash,
      expires_at: expiresAt,
      resend_available_at: resendAvailableAt,
      attempt_count: 0,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

  if (insertError) {
    console.error("[request-purchase-email-verification] Failed to save challenge:", insertError);
    return buildJsonResponse(
      { error_code: "DB_ERROR", message: "Doğrulama isteği kaydedilemedi." },
      500,
      req
    );
  }

  // Build secure one-click verification URL pointing to the edge function callback
  const verificationUrl = `${supabaseUrl}/functions/v1/verify-purchase-email-link?token=${rawLinkToken}&locale=${locale}`;

  // Render & dispatch email with both 6-digit OTP and one-click verification button
  const template = renderPurchaseEmailVerificationOtpEmail({
    candidateEmail,
    otp,
    locale,
    expiresInMinutes: 10,
    verificationUrl,
  });

  const delivery = await sendTransactionalEmail({
    supabaseAdmin,
    to: candidateEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    eventType: "purchase.email_verification_otp",
    entityType: "purchase_verification",
    entityId: user.id,
    channel: "payments",
    idempotencyKey: `otp-verify-${user.id}-${Date.now()}`,
  });

  if (delivery.status === "failed") {
    console.error("[request-purchase-email-verification] Email delivery failed:", delivery.errorCode);
  }

  await supabaseAdmin.from("audit_logs").insert({
    actor_user_id: user.id,
    action: "purchase.email_verification_requested",
    entity_type: "user",
    entity_id: user.id,
    metadata: {
      candidate_email_masked: `${candidateEmail.slice(0, 2)}***@${candidateEmail.split("@")[1]}`,
      delivery_status: delivery.status,
    },
  });

  return buildJsonResponse(
    {
      success: true,
      candidate_email: candidateEmail,
      resend_available_at: resendAvailableAt,
      expires_at: expiresAt,
    },
    200,
    req
  );
});
