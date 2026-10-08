import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { sendTransactionalEmail } from "../_shared/email/service.ts";
import { renderPurchaseEmailVerificationOtpEmail, normalizeLocale } from "../_shared/email/templates.ts";
import { computeOtpHash, generateOtpCode, normalizeOtpEmail } from "../_shared/otp/hash.ts";
import { getSupabaseAdminKey } from "../_shared/supabase-admin.ts";
import { sanitizeAuditError, writeEdgeAuditEvent } from "../_shared/audit.ts";

const OTP_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_REQUESTS_PER_HOUR = 10;
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
  const serviceRoleKey = getSupabaseAdminKey();
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

  const candidateEmail = normalizeOtpEmail(payload.candidateEmail || user.email || "");
  const locale = normalizeLocale(typeof payload.locale === "string" ? payload.locale : null);

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
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("actor_user_id", user.id)
    .eq("action", "purchase.email_verification_requested")
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

  const otp = generateOtpCode();
  const codeHash = await computeOtpHash({
    purpose: "purchase_email_verification",
    userId: user.id,
    email: candidateEmail,
    code: otp,
    secret: hmacSecret,
  });

  const expiresAt = new Date(now.getTime() + OTP_EXPIRATION_MS).toISOString();
  const resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_MS).toISOString();

  // Keep the code unusable until the provider accepts its email.
  const { data: provisionalChallenge, error: insertError } = await supabaseAdmin
    .from("purchase_email_verification_challenges")
    .insert({
      user_id: user.id,
      candidate_email: candidateEmail,
      code_hash: codeHash,
      expires_at: now.toISOString(),
      resend_available_at: now.toISOString(),
      superseded_at: now.toISOString(),
      attempt_count: 0,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !provisionalChallenge?.id) {
    await writeEdgeAuditEvent(supabaseAdmin, { action: "auth.otp_verification_failed", category: "auth", severity: "error", entityType: "auth_user", entityId: user.id, correlationId: user.id, metadata: sanitizeAuditError(insertError, { operation: "create_otp_challenge" }) });
    console.error(`[request-purchase-email-verification] Failed to save challenge code=${insertError?.code || "unknown"}`);
    return buildJsonResponse(
      { error_code: "DB_ERROR", message: "Doğrulama isteği kaydedilemedi." },
      500,
      req
    );
  }

  // Render & dispatch: 6-digit OTP only. Verification links are deliberately
  // not issued -- see supabase/functions/_shared/email/templates.ts.
  const template = renderPurchaseEmailVerificationOtpEmail({
    candidateEmail,
    otp,
    locale,
    expiresInMinutes: 10,
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
    channel: "general",
    idempotencyKey: `otp-verify-${user.id}-${Date.now()}`,
  });

  if (delivery.status !== "sent") {
    await writeEdgeAuditEvent(supabaseAdmin, { action: "auth.otp_verification_failed", category: "auth", severity: "error", entityType: "auth_user", entityId: user.id, correlationId: user.id, metadata: { operation: "dispatch_otp_email", safe_error_code: delivery.errorCode } });
    console.error("[request-purchase-email-verification] Email delivery failed:", delivery.errorCode);
    return buildJsonResponse(
      {
        success: false,
        error_code: "VERIFICATION_EMAIL_SEND_FAILED",
        message: locale === "tr"
          ? "Doğrulama kodu gönderilemedi. Lütfen tekrar deneyin."
          : "The verification code could not be sent. Please try again.",
      },
      502,
      req
    );
  }

  const { data: activated, error: activationError } = await supabaseAdmin.rpc(
    "activate_purchase_email_verification_challenge",
    {
      p_challenge_id: provisionalChallenge.id,
      p_user_id: user.id,
      p_expires_at: expiresAt,
      p_resend_available_at: resendAvailableAt,
    }
  );

  if (activationError || activated !== true) {
    await writeEdgeAuditEvent(supabaseAdmin, { action: "auth.otp_verification_failed", category: "auth", severity: "error", entityType: "auth_user", entityId: user.id, correlationId: user.id, metadata: sanitizeAuditError(activationError, { operation: "activate_otp_challenge" }) });
    console.error(`[request-purchase-email-verification] Failed to activate challenge code=${activationError?.code || "unknown"}`);
    return buildJsonResponse(
      {
        success: false,
        error_code: "VERIFICATION_CHALLENGE_ACTIVATION_FAILED",
        message: locale === "tr"
          ? "Doğrulama kodu etkinleştirilemedi. Lütfen yeni bir kod isteyin."
          : "The verification code could not be activated. Please request a new code.",
      },
      500,
      req
    );
  }

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
