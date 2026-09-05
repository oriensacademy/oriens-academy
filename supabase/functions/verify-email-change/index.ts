import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { sendTransactionalEmail } from "../_shared/email/service.ts";
import { computeOtpHash, normalizeOtpCode } from "../_shared/otp/hash.ts";
import { renderEmailChangeSecurityNoticeEmail } from "../_shared/email/templates.ts";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
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

  // Strictly a string -- never Number()/parseInt, so "012345" survives intact.
  const code = normalizeOtpCode(payload.code);
  const locale = payload.locale === "en" ? "en" : "tr";
  const isTr = locale === "tr";

  if (!code) {
    return buildJsonResponse(
      {
        success: false,
        error_code: "INVALID_FORMAT",
        message: isTr ? "Lütfen 6 haneli doğrulama kodunu giriniz." : "Please enter the 6-digit verification code.",
      },
      400,
      req
    );
  }

  // Read every active challenge and hash the submitted code once per row: the
  // email-change OTP is bound to that row's new_email, so the expected hash
  // cannot be known before the matching row is. The RPC then atomically consumes
  // whichever row matches. This removes the old "newest challenge wins"
  // selection, which judged a correct code against a row it never came from.
  const { data: activeChallenges, error: activeErr } = await supabaseAdmin
    .from("email_change_challenges")
    .select("id, new_email")
    .eq("user_id", user.id)
    .is("verified_at", null)
    .is("superseded_at", null)
    .gt("expires_at", new Date().toISOString());

  if (activeErr) {
    console.error("[verify-email-change] Active challenge lookup failed:", activeErr.message);
    return buildJsonResponse(
      {
        success: false,
        error_code: "INTERNAL_ERROR",
        message: isTr
          ? "Doğrulama sırasında bir sorun oluştu. Lütfen tekrar deneyin."
          : "Something went wrong during verification. Please try again.",
      },
      500,
      req
    );
  }

  const candidateHashes = await Promise.all(
    (activeChallenges || []).map((row) =>
      computeOtpHash({
        purpose: "email_change",
        userId: user.id,
        email: row.new_email,
        code,
        secret: hmacSecret,
      })
    )
  );

  const { data: verifyData, error: verifyErr } = await supabaseAdmin.rpc("verify_email_change_otp", {
    p_user_id: user.id,
    p_code_hashes: candidateHashes.length ? candidateHashes : [""],
  });

  if (verifyErr) {
    // Infrastructure failures must never be reported as a wrong code.
    console.error("[verify-email-change] verify RPC failed:", verifyErr.message);
    return buildJsonResponse(
      {
        success: false,
        error_code: "INTERNAL_ERROR",
        message: isTr
          ? "Doğrulama sırasında bir sorun oluştu. Lütfen tekrar deneyin."
          : "Something went wrong during verification. Please try again.",
      },
      500,
      req
    );
  }

  const verifyResult = (verifyData ?? {}) as {
    success?: boolean;
    error_code?: string;
    remaining_attempts?: number;
    challenge_id?: string;
    old_email?: string;
    new_email?: string;
  };

  if (!verifyResult.success) {
    const errorCode = verifyResult.error_code || "INTERNAL_ERROR";
    const remaining = verifyResult.remaining_attempts;
    const copy: Record<string, { tr: string; en: string }> = {
      INVALID_CODE: {
        tr: "Girdiğiniz doğrulama kodu hatalı.",
        en: "The verification code you entered is incorrect.",
      },
      EXPIRED: {
        tr: "Doğrulama kodunun süresi doldu. Lütfen yeni bir kod isteyin.",
        en: "Your verification code has expired. Please request a new one.",
      },
      SUPERSEDED: {
        tr: "Bu kod artık geçerli değil. Size gönderilen en son e-postadaki kodu kullanın.",
        en: "This code is no longer valid. Please use the code from the most recent email.",
      },
      ALREADY_VERIFIED: {
        tr: "Bu değişiklik zaten doğrulanmış.",
        en: "This change has already been verified.",
      },
      TOO_MANY_ATTEMPTS: {
        tr: "Çok fazla hatalı deneme yapıldı. Lütfen yeni bir doğrulama kodu isteyin.",
        en: "Too many failed attempts. Please request a new verification code.",
      },
      INTERNAL_ERROR: {
        tr: "Doğrulama sırasında bir sorun oluştu. Lütfen tekrar deneyin.",
        en: "Something went wrong during verification. Please try again.",
      },
    };
    const base = (copy[errorCode] ?? copy.INTERNAL_ERROR)[isTr ? "tr" : "en"];
    return buildJsonResponse(
      {
        success: false,
        error_code: errorCode,
        remaining_attempts: remaining,
        message:
          errorCode === "INVALID_CODE" && typeof remaining === "number"
            ? isTr
              ? `${base} Kalan deneme hakkı: ${remaining}`
              : `${base} Remaining attempts: ${remaining}`
            : base,
      },
      errorCode === "INTERNAL_ERROR" ? 500 : 400,
      req
    );
  }

  const challenge = {
    id: String(verifyResult.challenge_id || ""),
    old_email: String(verifyResult.old_email || ""),
    new_email: String(verifyResult.new_email || ""),
  };

  const nowIso = new Date().toISOString();

  // The challenge was consumed and the account rows updated inside the RPC
  // transaction; only the GoTrue identity is left to sync.

  // 2. Authoritative email update in Supabase Auth
  const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    email: challenge.new_email,
    email_confirm: true,
  });

  if (authUpdateErr) {
    console.error("[verify-email-change] Auth update error:", authUpdateErr);
    return buildJsonResponse(
      {
        success: false,
        error_code: "AUTH_UPDATE_FAILED",
        message: isTr ? "Hesap e-posta adresi güncellenirken bir hata oluştu." : "Failed to update account email in auth system.",
      },
      500,
      req
    );
  }

  // 3. Update guardian_accounts
  await supabaseAdmin
    .from("guardian_accounts")
    .update({
      email: challenge.new_email,
      email_verified_at: nowIso,
      updated_at: nowIso,
    })
    .eq("user_id", user.id);

  // 4. Update student_profiles if learner email matches
  await supabaseAdmin
    .from("student_profiles")
    .update({
      email: challenge.new_email,
      updated_at: nowIso,
    })
    .eq("id", user.id);

  // 5. Audit log
  await supabaseAdmin.from("audit_logs").insert({
    actor_user_id: user.id,
    action: "account.email_change_verified",
    entity_type: "user",
    entity_id: user.id,
    metadata: {
      old_email: challenge.old_email,
      new_email: challenge.new_email,
      verified_at: nowIso,
    },
  });

  // 6. Send MAIL-039: Security notice to OLD email address
  // Sent STRICTLY after successful OTP verification and authoritative auth/database updates.
  try {
    const maskedNewEmail = maskEmail(challenge.new_email);
    const notice = renderEmailChangeSecurityNoticeEmail({
      oldEmail: challenge.old_email,
      newEmailMasked: maskedNewEmail,
      changedAt: nowIso,
      locale,
    });

    await sendTransactionalEmail({
      supabaseAdmin,
      to: challenge.old_email,
      subject: notice.subject,
      html: notice.html,
      text: notice.text,
      eventType: "account.email_change_notice",
      entityType: "user",
      entityId: user.id,
      channel: "support",
      idempotencyKey: `email-change-notice-${challenge.id}`,
    });
  } catch (noticeErr) {
    console.warn("[verify-email-change] Old email security notice warning:", noticeErr);
  }

  return buildJsonResponse(
    {
      success: true,
      email: challenge.new_email,
      verified_at: nowIso,
    },
    200,
    req
  );
});
