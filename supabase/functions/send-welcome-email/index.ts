import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { dispatchWelcomeEmail } from "../_shared/email/service.ts";

Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authorization = req.headers.get("authorization") || "";

  if (!url || !anon || !service) {
    return buildJsonResponse({ error_code: "SERVER_CONFIG_ERROR" }, 500, req);
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = await req.json().catch(() => ({}));
  let studentUserId: string | null = null;
  let studentEmail: string = "";
  let studentName: string = "";
  let preferredLanguage: "tr" | "en" = "tr";

  // 1. Verify caller identity via Authorization Header or direct payload
  if (authorization) {
    const caller = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await caller.auth.getUser();

    if (!userError && userData.user) {
      // Exclude Admin accounts from receiving student welcome email
      if (userData.user.app_metadata?.role === "admin") {
        return buildJsonResponse({ success: true, skipped: true, reason: "ADMIN_EXCLUDED" }, 200, req);
      }
      studentUserId = userData.user.id;
      studentEmail = userData.user.email || "";
      studentName = (userData.user.user_metadata?.full_name as string) || "";
      preferredLanguage = userData.user.user_metadata?.preferred_language === "en" ? "en" : "tr";
    }
  }

  // Fallback / direct payload if provided during signup flow
  if (!studentUserId && body.studentUserId) {
    studentUserId = String(body.studentUserId);
  }
  if (!studentEmail && body.email) {
    studentEmail = String(body.email).trim().toLowerCase();
  }
  if (!studentName && body.fullName) {
    studentName = String(body.fullName).trim();
  }
  if (body.locale === "en") {
    preferredLanguage = "en";
  }

  if (!studentUserId && !studentEmail) {
    return buildJsonResponse({ error_code: "UNAUTHORIZED_OR_MISSING_IDENTIFIER" }, 401, req);
  }

  // Fetch verified profile from database if user ID is available
  if (studentUserId) {
    const { data: profile } = await admin
      .from("student_profiles")
      .select("id, full_name, email, preferred_language, active")
      .eq("id", studentUserId)
      .maybeSingle();

    if (profile) {
      studentName = profile.full_name || studentName;
      studentEmail = profile.email || studentEmail;
      preferredLanguage = profile.preferred_language === "en" ? "en" : preferredLanguage;
    }
  }

  if (!studentEmail || !studentEmail.includes("@")) {
    return buildJsonResponse({ error_code: "INVALID_EMAIL" }, 400, req);
  }

  const uniqueEntityId = studentUserId || studentEmail;

  // 2. SERVER-SIDE IDEMPOTENCY CHECK
  // Exactly ONE welcome email per newly registered student.
  const { data: existingDelivery } = await admin
    .from("notification_deliveries")
    .select("id, status, created_at")
    .eq("event_type", "student.welcome_email")
    .eq("entity_id", uniqueEntityId)
    .in("status", ["sent", "delivered"])
    .maybeSingle();

  if (existingDelivery) {
    return buildJsonResponse({
      success: true,
      skipped: true,
      reason: "ALREADY_SENT",
      previousDeliveryId: existingDelivery.id,
    }, 200, req);
  }

  // 3. Dispatch Welcome Email
  try {
    const delivery = await dispatchWelcomeEmail(admin, {
      studentUserId: uniqueEntityId,
      studentName: studentName || (preferredLanguage === "en" ? "Student" : "Öğrenci"),
      studentEmail,
      locale: preferredLanguage,
    });

    return buildJsonResponse({
      success: true,
      delivered: delivery.status === "sent",
      providerMessageId: delivery.providerMessageId,
    }, 200, req);
  } catch (err: unknown) {
    console.error("[send-welcome-email] Failed to send welcome email:", err);
    // Non-blocking response: never crash registration flow on email provider failure
    return buildJsonResponse({
      success: true,
      delivered: false,
      error: "EMAIL_DELIVERY_FAILED",
    }, 200, req);
  }
});
