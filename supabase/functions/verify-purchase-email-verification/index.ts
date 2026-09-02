import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";

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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
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
    console.error("[verify-purchase-email-verification] Required server configuration is missing.");
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
  const code = String(payload.code || "").trim();
  const locale = payload.locale === "en" ? "en" : "tr";

  if (!code || !/^\d{6}$/.test(code)) {
    return buildJsonResponse(
      {
        success: false,
        error_code: "INVALID_FORMAT",
        message: locale === "tr"
          ? "Lütfen 6 haneli doğrulama kodunu giriniz."
          : "Please enter the 6-digit verification code.",
      },
      400,
      req
    );
  }

  const now = new Date();

  // Find active challenge
  const { data: challenge, error: challengeError } = await supabaseAdmin
    .from("purchase_email_verification_challenges")
    .select("*")
    .eq("user_id", user.id)
    .eq("candidate_email", candidateEmail)
    .is("verified_at", null)
    .gt("expires_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (challengeError || !challenge) {
    return buildJsonResponse(
      {
        success: false,
        error_code: "CHALLENGE_EXPIRED_OR_NOT_FOUND",
        message: locale === "tr"
          ? "Doğrulama kodunun süresi dolmuş veya kod bulunamadı. Lütfen yeni bir kod isteyin."
          : "Verification code expired or not found. Please request a new code.",
      },
      400,
      req
    );
  }

  if (challenge.attempt_count >= 5) {
    await supabaseAdmin
      .from("purchase_email_verification_challenges")
      .update({ expires_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("id", challenge.id);

    return buildJsonResponse(
      {
        success: false,
        error_code: "TOO_MANY_ATTEMPTS",
        message: locale === "tr"
          ? "Çok fazla hatalı deneme yapıldı. Lütfen yeni bir kod isteyin."
          : "Too many failed attempts. Please request a new code.",
      },
      400,
      req
    );
  }

  // Increment attempt count
  const newAttemptCount = challenge.attempt_count + 1;
  await supabaseAdmin
    .from("purchase_email_verification_challenges")
    .update({ attempt_count: newAttemptCount, updated_at: now.toISOString() })
    .eq("id", challenge.id);

  const expectedHash = await computeOtpHmac(user.id, candidateEmail, code, hmacSecret);
  if (!timingSafeEqual(challenge.code_hash, expectedHash)) {
    const remaining = Math.max(0, 5 - newAttemptCount);
    return buildJsonResponse(
      {
        success: false,
        error_code: "INVALID_CODE",
        remaining_attempts: remaining,
        message: locale === "tr"
          ? `Girdiğiniz doğrulama kodu hatalı. Kalan deneme hakkı: ${remaining}`
          : `Invalid verification code. Remaining attempts: ${remaining}`,
      },
      400,
      req
    );
  }

  // Verification SUCCESS
  const verifiedAt = now.toISOString();

  // 1. Mark challenge verified
  await supabaseAdmin
    .from("purchase_email_verification_challenges")
    .update({ verified_at: verifiedAt, updated_at: verifiedAt })
    .eq("id", challenge.id);

  // 2. Update guardian account with verified timestamp
  await supabaseAdmin
    .from("guardian_accounts")
    .update({
      email: candidateEmail,
      email_verified_at: verifiedAt,
      updated_at: verifiedAt,
    })
    .eq("user_id", user.id);

  // 3. Update self student profile if email matched
  await supabaseAdmin
    .from("student_profiles")
    .update({
      email: candidateEmail,
      updated_at: verifiedAt,
    })
    .eq("id", user.id);

  // 4. If candidateEmail differs from auth user email, update auth user in place
  if (candidateEmail !== user.email?.toLowerCase()) {
    try {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email: candidateEmail,
        email_confirm: true,
      });
    } catch (authUpdateErr) {
      console.error("[verify-purchase-email-verification] Auth email update failed:", authUpdateErr);
    }
  }

  // 5. Audit log
  await supabaseAdmin.from("audit_logs").insert({
    actor_user_id: user.id,
    action: "purchase.email_verified",
    entity_type: "user",
    entity_id: user.id,
    metadata: {
      candidate_email_masked: `${candidateEmail.slice(0, 2)}***@${candidateEmail.split("@")[1]}`,
      verified_at: verifiedAt,
    },
  });

  return buildJsonResponse(
    {
      success: true,
      email: candidateEmail,
      verified_at: verifiedAt,
      message: locale === "tr"
        ? "E-posta adresiniz başarıyla doğrulandı."
        : "Your email address has been successfully verified.",
    },
    200,
    req
  );
});
