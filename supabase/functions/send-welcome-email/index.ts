import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { dispatchWelcomeEmail } from "../_shared/email/service.ts";
import { normalizeLocale } from "../_shared/email/templates.ts";
import { getSupabaseAdminKey, getSupabasePublishableKey } from "../_shared/supabase-admin.ts";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^@\s,()]+@[^@\s,()]+\.[^@\s,()]+$/;

Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = getSupabasePublishableKey();
  const service = getSupabaseAdminKey();
  const authorization = req.headers.get("authorization") || "";

  if (!url || !anon || !service) {
    return buildJsonResponse({ error_code: "SERVER_CONFIG_ERROR" }, 500, req);
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = await req.json().catch(() => ({}));
  const bearer = authorization.replace(/^Bearer\s+/i, "").trim();
  const isServiceRequest = Boolean(bearer) && bearer === service;
  let studentUserId: string | null = null;
  let preferredLanguage: "tr" | "en" = "tr";

  // 1. Resolve the account. The recipient is never taken from the request body:
  // a signed-in user can only trigger their own welcome mail, and a service caller
  // names an account id whose address is read from the database.
  if (isServiceRequest) {
    const candidate = typeof body.studentUserId === "string" ? body.studentUserId.trim() : "";
    if (UUID_REGEX.test(candidate)) studentUserId = candidate;
  } else if (bearer) {
    const caller = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (!userError && userData.user) studentUserId = userData.user.id;
  }

  if (!studentUserId) {
    return buildJsonResponse({ error_code: "UNAUTHORIZED_OR_MISSING_IDENTIFIER" }, 401, req);
  }

  const { data: authUser } = await admin.auth.admin.getUserById(studentUserId);
  const account = authUser?.user;
  if (!account) {
    return buildJsonResponse({ error_code: "UNAUTHORIZED_OR_MISSING_IDENTIFIER" }, 401, req);
  }

  // Exclude Admin accounts from receiving student welcome email
  if (account.app_metadata?.role === "admin") {
    return buildJsonResponse({ success: true, skipped: true, reason: "ADMIN_EXCLUDED" }, 200, req);
  }

  let studentEmail = (account.email || "").trim().toLowerCase();
  let studentName = (account.user_metadata?.full_name as string) || "";
  preferredLanguage = normalizeLocale(account.user_metadata?.preferred_language as string | undefined);
  if (typeof body.locale === "string" && normalizeLocale(body.locale) === "en") {
    preferredLanguage = "en";
  }

  const { data: profile } = await admin
    .from("student_profiles")
    .select("id, full_name, email, preferred_language, active")
    .eq("id", studentUserId)
    .maybeSingle();

  if (profile) {
    studentName = profile.full_name || studentName;
    studentEmail = (profile.email || studentEmail).trim().toLowerCase();
    preferredLanguage = normalizeLocale(profile.preferred_language) === "en" ? "en" : preferredLanguage;
  }

  if (!studentEmail || !EMAIL_REGEX.test(studentEmail)) {
    return buildJsonResponse({ error_code: "INVALID_EMAIL" }, 400, req);
  }

  const uniqueEntityId = studentUserId;

  // 2. EMAIL VERIFICATION GATE
  // Account welcome emails must only be sent AFTER email address verification
  if (!account.email_confirmed_at) {
    return buildJsonResponse({
      success: true,
      skipped: true,
      reason: "EMAIL_NOT_VERIFIED",
      message: "Welcome email is deferred until the account email address is confirmed.",
    }, 200, req);
  }

  // 3. SERVER-SIDE IDEMPOTENCY & DEDUPLICATION CHECK
  // Exactly ONE welcome email per registered student/guardian across both trigger and edge function flows
  const { data: existingDelivery } = await admin
    .from("notification_deliveries")
    .select("id, status, created_at")
    .or(`recipient.eq.${studentEmail},entity_id.eq.${uniqueEntityId}`)
    .in("event_type", ["guardian.welcome", "student.welcome_email"])
    .in("status", ["pending", "processing", "sent", "delivered"])
    .order("created_at", { ascending: false })
    .limit(1)
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
      providerMessageId: "providerMessageId" in delivery ? delivery.providerMessageId : undefined,
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
