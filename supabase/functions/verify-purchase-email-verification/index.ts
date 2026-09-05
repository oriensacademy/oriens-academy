import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { computeOtpHash, normalizeOtpCode, normalizeOtpEmail } from "../_shared/otp/hash.ts";

/**
 * Purchase / signup email verification — 6-digit OTP only.
 *
 * The whole verification is one atomic RPC (verify_purchase_email_otp). It
 * matches the submitted hash against EVERY active challenge rather than only the
 * newest one, consumes the row that actually matches, marks the account verified
 * in the same transaction, and only touches the attempt counter when nothing
 * matched.
 *
 * Three defects this replaces, all of which made a CORRECT code report as wrong:
 *   1. The verifier compared against `order by created_at desc limit 1`, so a
 *      correct code could be judged against a challenge it never came from.
 *   2. The attempt counter was incremented BEFORE the comparison, so a correct
 *      code still consumed an attempt.
 *   3. The account update ran afterwards with its result discarded, so when it
 *      failed the caller was told verification succeeded while
 *      email_verified_at stayed NULL and the portal re-gated on every reload.
 */

type VerifyResult = {
  success?: boolean;
  error_code?: string;
  remaining_attempts?: number;
  candidate_email?: string;
  verified_at?: string;
};

const MESSAGES: Record<string, { tr: string; en: string }> = {
  INVALID_FORMAT: {
    tr: "Lütfen 6 haneli doğrulama kodunu giriniz.",
    en: "Please enter the 6-digit verification code.",
  },
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
    tr: "Bu e-posta adresi zaten doğrulanmış. Sayfayı yenileyebilirsiniz.",
    en: "This email address is already verified. You can refresh the page.",
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

function message(code: string, locale: "tr" | "en"): string {
  return (MESSAGES[code] ?? MESSAGES.INTERNAL_ERROR)[locale];
}

Deno.serve(async (req: Request) => {
  const invalidRequest = validateMutationRequest(req, ["POST"]);
  if (invalidRequest) return invalidRequest;

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return buildJsonResponse({ error_code: "UNAUTHORIZED", message: "Oturum açmanız gerekmektedir." }, 401, req);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const hmacSecret = Deno.env.get("PURCHASE_OTP_HMAC_SECRET") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !hmacSecret) {
    console.error("[verify-purchase-email-verification] Required server configuration is missing.");
    return buildJsonResponse({ error_code: "SERVER_CONFIG_ERROR", message: "Sunucu yapılandırma hatası." }, 503, req);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return buildJsonResponse({ error_code: "UNAUTHORIZED", message: "Geçersiz oturum." }, 401, req);
  }
  const user: User = userData.user;

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return buildJsonResponse({ error_code: "INVALID_REQUEST", message: "Geçersiz istek formatı." }, 400, req);
  }

  const locale: "tr" | "en" = payload.locale === "en" ? "en" : "tr";
  const candidateEmail = normalizeOtpEmail(payload.candidateEmail || user.email || "");
  // Strictly a string, and never coerced through Number() -- "012345" must stay
  // six characters wide all the way into the HMAC.
  const code = normalizeOtpCode(payload.code);

  if (!candidateEmail || !code) {
    return buildJsonResponse(
      { success: false, error_code: "INVALID_FORMAT", message: message("INVALID_FORMAT", locale) },
      400,
      req
    );
  }

  const codeHash = await computeOtpHash({
    purpose: "purchase_email_verification",
    userId: user.id,
    email: candidateEmail,
    code,
    secret: hmacSecret,
  });

  const { data, error } = await supabaseAdmin.rpc("verify_purchase_email_otp", {
    p_user_id: user.id,
    p_candidate_email: candidateEmail,
    p_code_hash: codeHash,
  });

  if (error) {
    // An infrastructure failure must never be presented as a wrong code -- that
    // is what previously burned the user's attempts on a healthy code.
    console.error("[verify-purchase-email-verification] verify RPC failed:", error.message);
    return buildJsonResponse(
      { success: false, error_code: "INTERNAL_ERROR", message: message("INTERNAL_ERROR", locale) },
      500,
      req
    );
  }

  const result = (data ?? {}) as VerifyResult;

  if (!result.success) {
    const code_ = result.error_code || "INTERNAL_ERROR";
    const remaining = result.remaining_attempts;
    const base = message(code_, locale);
    return buildJsonResponse(
      {
        success: false,
        error_code: code_,
        remaining_attempts: remaining,
        message:
          code_ === "INVALID_CODE" && typeof remaining === "number"
            ? locale === "tr"
              ? `${base} Kalan deneme hakkı: ${remaining}`
              : `${base} Remaining attempts: ${remaining}`
            : base,
      },
      code_ === "INTERNAL_ERROR" ? 500 : 400,
      req
    );
  }

  const verifiedAt = result.verified_at || new Date().toISOString();

  // The account row was marked verified inside the RPC transaction. Only the
  // GoTrue identity lives outside Postgres, so it is synced here; a failure is
  // logged but does not invalidate a verification that already committed.
  if (candidateEmail !== (user.email || "").toLowerCase()) {
    try {
      await supabaseAdmin.auth.admin.updateUserById(user.id, { email: candidateEmail, email_confirm: true });
    } catch (authUpdateErr) {
      console.error("[verify-purchase-email-verification] Auth email sync failed:", authUpdateErr);
    }
  }

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
      message:
        locale === "tr"
          ? "E-posta adresiniz başarıyla doğrulandı."
          : "Your email address has been successfully verified.",
    },
    200,
    req
  );
});
