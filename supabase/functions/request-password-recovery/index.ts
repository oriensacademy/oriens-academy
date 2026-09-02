import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { sendTransactionalEmail } from "../_shared/email/service.ts";
import { renderPasswordResetActionEmail } from "../_shared/email/templates.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CANONICAL_ORIGIN = "https://oriens-academy.com";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  const invalidRequest = validateMutationRequest(req, ["POST"]);
  if (invalidRequest) return invalidRequest;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) {
      return buildJsonResponse({ error: "Server configuration missing" }, 500, req);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let body: { email?: string; locale?: string; turnstileToken?: string };
    try {
      body = await req.json();
    } catch {
      return buildJsonResponse({ error: "Invalid JSON body" }, 400, req);
    }

    // 1. Strict Input Validation & Normalization
    const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
      return buildJsonResponse({ error: "Invalid email format" }, 400, req);
    }

    // Strict Locale Validation: only "tr" or "en"
    const targetLocale: "tr" | "en" = body.locale === "en" ? "en" : "tr";

    // Client IP Extraction
    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown-ip";

    // 2. Check for Authenticated Admin Caller (Admin CRM & System bypass)
    let isAdminCaller = false;
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const apikeyHeader = req.headers.get("apikey");

    if (apikeyHeader && apikeyHeader.trim() === serviceRoleKey.trim()) {
      isAdminCaller = true;
    } else if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.substring(7).trim();
      if (token === serviceRoleKey.trim()) {
        isAdminCaller = true;
      } else {
        // Also check if JWT payload is service_role
        try {
          const parts = token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            if (payload.role === "service_role") {
              isAdminCaller = true;
            }
          }
        } catch {
          // ignore
        }

        if (!isAdminCaller) {
          try {
            const callerClient = createClient(supabaseUrl, token, {
              auth: { autoRefreshToken: false, persistSession: false },
            });
            const { data: isAdmin } = await callerClient.rpc("is_admin");
            if (isAdmin === true) {
              isAdminCaller = true;
            }
          } catch {
            isAdminCaller = false;
          }
        }
      }
    }

    // 3. Server-Side Turnstile Verification (Mandatory for anonymous public users)
    if (!isAdminCaller) {
      const turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken.trim() : "";
      if (!turnstileToken) {
        return buildJsonResponse(
          {
            error_code: "BOT_VERIFICATION_REQUIRED",
            message:
              targetLocale === "tr"
                ? "Güvenlik doğrulaması gereklidir. Lütfen sayfayı yenileyip tekrar deneyiniz."
                : "Security verification token is required. Please refresh and try again.",
          },
          400,
          req
        );
      }

      const turnstileResult = await verifyTurnstile({
        token: turnstileToken,
        expectedAction: "password_recovery",
        remoteIp: clientIp,
      });

      if (!turnstileResult.success) {
        console.warn(`[request-password-recovery] Turnstile failed for IP ${clientIp}: ${turnstileResult.errorCode}`);
        return buildJsonResponse(
          {
            error_code: turnstileResult.errorCode,
            message:
              targetLocale === "tr"
                ? "Güvenlik doğrulaması tamamlanamadı. Lütfen sayfayı yenileyip tekrar deneyiniz."
                : "Security verification could not be completed. Please refresh and try again.",
          },
          400,
          req
        );
      }
    }

    // 4. Server-Side Concurrency-Safe Rate Limiting (per email & per IP)
    const emailHash = await sha256Hex(`email:${rawEmail}`);
    const ipHash = await sha256Hex(`ip:${clientIp}`);

    const { data: rateLimitResult, error: rateLimitError } = await supabaseAdmin.rpc(
      "check_and_claim_recovery_rate_limit",
      {
        p_email_hash: emailHash,
        p_ip_hash: ipHash,
      }
    );

    if (rateLimitError) {
      console.error("[request-password-recovery] Rate limit RPC error:", rateLimitError.message);
    } else if (rateLimitResult && !rateLimitResult.allowed) {
      console.warn(`[request-password-recovery] Rate limit hit (${rateLimitResult.reason}) for email_hash: ${emailHash.substring(0, 8)}`);
      return buildJsonResponse(
        {
          error_code: "RATE_LIMIT_EXCEEDED",
          message:
            targetLocale === "tr"
              ? "Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyiniz."
              : "Too many requests. Please wait a moment and try again.",
        },
        429,
        req
      );
    }

    // Neutral public message (identical whether user exists or not)
    const neutralSuccessResponse = {
      success: true,
      message:
        targetLocale === "tr"
          ? "Eğer bu e-posta adresine bağlı bir hesap varsa şifre sıfırlama bağlantısı gönderilecektir."
          : "If an account exists for this email address, a password reset link will be sent.",
    };

    // 5. User Account Lookup
    const { data: userList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) {
      console.error("[request-password-recovery] listUsers failed:", listErr.message);
      return buildJsonResponse({ error: "Internal server error" }, 500, req);
    }

    const matchingUser = userList.users.find(
      (u) => u.email?.toLowerCase() === rawEmail
    );

    // Account Enumeration Prevention: return identical neutral success if user does not exist
    if (!matchingUser) {
      return buildJsonResponse(neutralSuccessResponse, 200, req);
    }

    // 6. Canonical Fixed Origin (No Open Redirect)
    const devOrigin = req.headers.get("origin");
    const origin =
      Deno.env.get("DENO_ENV") === "development" &&
      (devOrigin === "http://localhost:3000" || devOrigin === "http://127.0.0.1:3000")
        ? devOrigin
        : CANONICAL_ORIGIN;

    const redirectPath = targetLocale === "en" ? "/en/reset-password" : "/tr/sifre-yenile";
    const redirectTo = `${origin}${redirectPath}`;

    // 7. Generate Official Supabase Auth Recovery Link
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: rawEmail,
      options: { redirectTo },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      console.error("[request-password-recovery] generateLink failed:", linkErr?.message);
      // Return neutral success to client even on generation error to avoid leakage
      return buildJsonResponse(neutralSuccessResponse, 200, req);
    }

    const recoveryUrl = linkData.properties.action_link;

    // 8. Render Single-Language Branded Email
    const template = renderPasswordResetActionEmail(rawEmail, recoveryUrl, targetLocale);

    // 9. Dispatch Transactional Email via Google Workspace
    const delivery = await sendTransactionalEmail({
      supabaseAdmin,
      to: rawEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      eventType: "account_password_recovery",
      entityType: "auth_user",
      entityId: matchingUser.id,
      channel: "general",
      idempotencyKey: `recovery-${matchingUser.id}-${Date.now()}`,
    });

    if (delivery.status === "failed") {
      console.error("[request-password-recovery] Email dispatch failed:", delivery.errorCode);
      return buildJsonResponse({ error: "Failed to dispatch recovery email" }, 500, req);
    }

    // 10. Audit Logging (Sanitized, NO tokens or links logged)
    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: matchingUser.id,
      action: "account.password_recovery_dispatched",
      entity_type: "auth_user",
      entity_id: matchingUser.id,
      metadata: {
        locale: targetLocale,
        delivery_mode: "google_workspace",
        is_admin_assisted: isAdminCaller,
      },
    });

    return buildJsonResponse(neutralSuccessResponse, 200, req);
  } catch (err) {
    console.error("[request-password-recovery] Unexpected handler error:", err);
    return buildJsonResponse({ error: "Internal server error" }, 500, req);
  }
});
