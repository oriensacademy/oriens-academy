import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { sendTransactionalEmail } from "../_shared/email/service.ts";
import {
  renderEmailChangeOtpEmail,
  normalizeLocale,
} from "../_shared/email/templates.ts";
import { computeOtpHash, generateOtpCode } from "../_shared/otp/hash.ts";

const OTP_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const hmacSecret =
    Deno.env.get("EMAIL_CHANGE_HMAC_SECRET") ||
    Deno.env.get("PURCHASE_OTP_HMAC_SECRET") ||
    serviceRoleKey.slice(0, 32);

  if (!supabaseUrl || !serviceRoleKey) {
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
  const currentEmail = (user.email || "").toLowerCase().trim();

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

  const newEmail = String(payload.newEmail || "").trim().toLowerCase();
  const locale = normalizeLocale(payload.locale);
  const isTr = locale === "tr";

  if (!newEmail || !EMAIL_REGEX.test(newEmail)) {
    return buildJsonResponse(
      {
        success: false,
        error_code: "INVALID_EMAIL",
        message: isTr ? "Lütfen geçerli bir yeni e-posta adresi giriniz." : "Please enter a valid new email address.",
      },
      400,
      req
    );
  }

  if (newEmail === currentEmail) {
    return buildJsonResponse(
      {
        success: false,
        error_code: "SAME_EMAIL",
        message: isTr ? "Yeni e-posta adresi mevcut adresinizle aynı olamaz." : "The new email address cannot be the same as your current email.",
      },
      400,
      req
    );
  }

  // 1. Check if email is already in use by another guardian or auth account
  const { data: existingGuardian } = await supabaseAdmin
    .from("guardian_accounts")
    .select("user_id")
    .eq("email", newEmail)
    .maybeSingle();

  if (existingGuardian && existingGuardian.user_id !== user.id) {
    return buildJsonResponse(
      {
        success: false,
        error_code: "EMAIL_ALREADY_IN_USE",
        message: isTr ? "Bu e-posta adresi sistemde kayıtlı başka bir hesap tarafından kullanılmaktadır." : "This email address is already in use by another account.",
      },
      400,
      req
    );
  }

  // 2. Check rate limit / cooldown on active challenge
  const { data: existingChallenge } = await supabaseAdmin
    .from("email_change_challenges")
    .select("id, resend_available_at, expires_at")
    .eq("user_id", user.id)
    .is("verified_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = Date.now();
  if (existingChallenge?.resend_available_at) {
    const resendAvailableAt = new Date(existingChallenge.resend_available_at).getTime();
    if (resendAvailableAt > now) {
      return buildJsonResponse(
        {
          success: false,
          error_code: "RESEND_COOLDOWN",
          resend_available_at: existingChallenge.resend_available_at,
          message: isTr
            ? "Lütfen yeni bir kod istemeden önce bekleyiniz."
            : "Please wait before requesting a new code.",
        },
        429,
        req
      );
    }
  }

  // 3. Retire any earlier pending change, then generate + store the new challenge.
  // `superseded_at` keeps "you requested a newer code" distinguishable from
  // "your code expired", so the verifier can say which actually happened.
  await supabaseAdmin
    .from("email_change_challenges")
    .update({ superseded_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
    .eq("user_id", user.id)
    .is("verified_at", null)
    .is("superseded_at", null);

  const otp = generateOtpCode();
  const codeHash = await computeOtpHash({
    purpose: "email_change",
    userId: user.id,
    email: newEmail,
    code: otp,
    secret: hmacSecret,
  });
  const expiresAt = new Date(now + OTP_EXPIRATION_MS).toISOString();
  const resendAvailableAt = new Date(now + RESEND_COOLDOWN_MS).toISOString();

  const { error: insertError } = await supabaseAdmin
    .from("email_change_challenges")
    .insert({
      user_id: user.id,
      old_email: currentEmail,
      new_email: newEmail,
      code_hash: codeHash,
      resend_available_at: resendAvailableAt,
      expires_at: expiresAt,
      attempt_count: 0,
    });

  if (insertError) {
    console.error("[request-email-change] DB insert error:", insertError);
    return buildJsonResponse(
      { success: false, error_code: "DB_ERROR", message: "Doğrulama işlemi başlatılamadı." },
      500,
      req
    );
  }

  const maskedNewEmail = maskEmail(newEmail);

  // Send MAIL-007: OTP verification email to NEW email ONLY
  try {
    const otpEmail = renderEmailChangeOtpEmail({
      candidateEmail: newEmail,
      otp,
      locale,
      expiresInMinutes: 10,
    });

    await sendTransactionalEmail({
      supabaseAdmin,
      to: newEmail,
      subject: otpEmail.subject,
      html: otpEmail.html,
      text: otpEmail.text,
      eventType: "account.email_change_otp",
      entityType: "user",
      entityId: user.id,
      channel: "support",
      idempotencyKey: `email-change-otp-${user.id}-${now}`,
    });
  } catch (otpErr) {
    console.error("[request-email-change] New email OTP send failed:", otpErr);
    return buildJsonResponse(
      {
        success: false,
        error_code: "MAIL_SEND_FAILED",
        message: isTr
          ? "Yeni e-posta adresinize doğrulama kodu gönderilemedi. Lütfen adresi kontrol ediniz."
          : "Failed to send verification code to your new email address. Please check the address.",
      },
      500,
      req
    );
  }

  return buildJsonResponse(
    {
      success: true,
      new_email: newEmail,
      masked_new_email: maskedNewEmail,
      resend_available_at: resendAvailableAt,
      expires_at: expiresAt,
    },
    200,
    req
  );
});
