import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { sendTransactionalEmail } from "../_shared/email/service.ts";
import { renderPasswordResetActionEmail } from "../_shared/email/templates.ts";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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

    let body: { email?: string; locale?: string };
    try {
      body = await req.json();
    } catch {
      return buildJsonResponse({ error: "Invalid JSON body" }, 400, req);
    }

    const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
      return buildJsonResponse({ error: "Invalid email format" }, 400, req);
    }

    // 1. Find user in auth.users
    const { data: userList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) {
      console.error("[request-password-recovery] listUsers failed:", listErr.message);
      return buildJsonResponse({ error: "Internal server error" }, 500, req);
    }

    const matchingUser = userList.users.find(
      (u) => u.email?.toLowerCase() === rawEmail
    );

    // Return neutral success if user does not exist to prevent enumeration
    if (!matchingUser) {
      console.log(`[request-password-recovery] User not found for ${rawEmail}, returning neutral success.`);
      return buildJsonResponse({ success: true }, 200, req);
    }

    // 2. Resolve target locale
    let targetLocale: "tr" | "en" = "tr";
    if (body.locale === "en" || body.locale === "tr") {
      targetLocale = body.locale;
    } else if (matchingUser.user_metadata?.preferred_language === "en") {
      targetLocale = "en";
    } else {
      // Check guardian_accounts or student_profiles
      const { data: guardian } = await supabaseAdmin
        .from("guardian_accounts")
        .select("preferred_language")
        .eq("user_id", matchingUser.id)
        .maybeSingle();

      if (guardian?.preferred_language === "en") {
        targetLocale = "en";
      }
    }

    // 3. Generate official Supabase Auth recovery link
    const origin = req.headers.get("origin") || "https://oriens-academy.com";
    const redirectPath = targetLocale === "en" ? "/en/reset-password" : "/tr/sifre-yenile";
    const redirectTo = `${origin}${redirectPath}`;

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: rawEmail,
      options: { redirectTo },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      console.error("[request-password-recovery] generateLink failed:", linkErr?.message);
      return buildJsonResponse({ error: "Could not generate recovery link" }, 500, req);
    }

    const recoveryUrl = linkData.properties.action_link;

    // 4. Render 100% single-language branded email
    const template = renderPasswordResetActionEmail(rawEmail, recoveryUrl, targetLocale);

    // 5. Dispatch transactional email via Google Workspace
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
      console.error("[request-password-recovery] sendTransactionalEmail failed:", delivery.errorCode);
      return buildJsonResponse({ error: "Failed to dispatch recovery email", details: delivery.errorCode }, 500, req);
    }

    // 6. Audit log
    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: matchingUser.id,
      action: "account.password_recovery_dispatched",
      entity_type: "auth_user",
      entity_id: matchingUser.id,
      metadata: {
        locale: targetLocale,
        delivery_mode: "google_workspace",
      },
    });

    console.log(`[request-password-recovery] Sent ${targetLocale.toUpperCase()} recovery email to ${rawEmail}`);
    return buildJsonResponse({ success: true }, 200, req);
  } catch (err) {
    console.error("[request-password-recovery] Unexpected handler error:", err);
    return buildJsonResponse({ error: "Internal server error", message: String(err) }, 500, req);
  }
});
