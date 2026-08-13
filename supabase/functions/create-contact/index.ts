import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validateMutationRequest, buildJsonResponse } from "../_shared/cors.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";
import { dispatchContactEmails } from "../_shared/email/service.ts";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req: Request) => {
  const invalidRequestResponse = validateMutationRequest(req, ["POST"]);
  if (invalidRequestResponse) return invalidRequestResponse;

  try {
    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return buildJsonResponse(
        { error_code: "INVALID_JSON", message: "Malformed JSON request body." },
        400,
        req
      );
    }

    const requestedSource = String(payload.source ?? "website");
    const source = requestedSource === "quick_contact"
      ? "quick_contact"
      : requestedSource === "consultation"
        ? "consultation"
        : "website";

    // Extract Turnstile token (from body or header)
    const turnstileToken =
      String(payload.turnstileToken ?? "").trim() ||
      req.headers.get("x-turnstile-token") ||
      req.headers.get("turnstile-token") ||
      "";

    // Perform Cloudflare Turnstile bot verification
    const turnstileResult = await verifyTurnstile({
      token: turnstileToken,
      expectedAction: source === "quick_contact"
        ? "quick_contact_submit"
        : source === "consultation"
          ? "consultation_submit"
          : "contact_submit",
      remoteIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });

    if (!turnstileResult.success) {
      const httpStatus = turnstileResult.errorCode === "SERVER_CONFIG_ERROR" ? 500 : 400;
      return buildJsonResponse(
        {
          error_code: turnstileResult.errorCode,
          message: turnstileResult.message,
        },
        httpStatus,
        req
      );
    }

    // Extract & normalize form input parameters
    const fullName = String(payload.fullName ?? "").trim().replace(/\s+/g, " ");
    const email = String(payload.email ?? "").trim().toLowerCase();
    const phone = payload.phone ? String(payload.phone).trim() : null;
    const subject = payload.subject ? String(payload.subject).trim() : null;
    const message = String(payload.message ?? "").trim();
    const locale = String(payload.locale ?? "en").trim() === "tr" ? "tr" : "en";
    const privacyConsent = payload.privacyConsent === true;

    // Server-side validations
    if (!fullName || fullName.length < 2 || fullName.length > 100) {
      return buildJsonResponse(
        { error_code: "INVALID_FULL_NAME", message: "Full name must be between 2 and 100 characters." },
        400,
        req
      );
    }

    if (!email || email.length > 120 || !EMAIL_REGEX.test(email)) {
      return buildJsonResponse(
        { error_code: "INVALID_EMAIL", message: "A valid email address is required." },
        400,
        req
      );
    }

    if (!message || message.length < 5 || message.length > 2000) {
      return buildJsonResponse(
        { error_code: "INVALID_MESSAGE", message: "Message must be between 5 and 2000 characters." },
        400,
        req
      );
    }

    if (!privacyConsent) {
      return buildJsonResponse(
        { error_code: "PRIVACY_CONSENT_REQUIRED", message: "Privacy consent must be accepted." },
        400,
        req
      );
    }

    if (phone && phone.length > 30) {
      return buildJsonResponse(
        { error_code: "INVALID_PHONE", message: "Phone number exceeds maximum allowable length." },
        400,
        req
      );
    }

    if (subject && subject.length > 200) {
      return buildJsonResponse(
        { error_code: "INVALID_SUBJECT", message: "Subject exceeds maximum allowable length of 200 characters." },
        400,
        req
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[create-contact] Missing server credentials in environment.");
      return buildJsonResponse(
        { error_code: "SERVER_CONFIG_ERROR", message: "Server configuration error." },
        500,
        req
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const nowIso = new Date().toISOString();

    // Insert contact request (status = 'new')
    const { data: contactRow, error: insertError } = await supabaseAdmin
      .from("contact_requests")
      .insert({
        full_name: fullName,
        email,
        phone,
        subject,
        message,
        locale,
        status: "new",
        privacy_consent: privacyConsent,
        source,
      })
      .select("id, created_at")
      .single();

    if (insertError || !contactRow) {
      console.error("[create-contact] Database insert error:", insertError);
      return buildJsonResponse(
        { error_code: "STORAGE_FAILED", message: "Failed to store contact request." },
        500,
        req
      );
    }

    // Complete both queued notification writes before the edge runtime can terminate.
    await dispatchContactEmails(supabaseAdmin, {
      contactId: contactRow.id,
      fullName,
      email,
      phone,
      subject,
      message,
      locale,
      source,
      createdAt: contactRow.created_at || nowIso,
    }).catch((err) => {
      console.error("[create-contact] Email dispatch background error:", err);
    });

    return buildJsonResponse(
      {
        success: true,
        contactId: contactRow.id,
        message: "Contact request submitted successfully.",
      },
      200,
      req
    );
  } catch (err) {
    console.error("[create-contact] Unexpected error:", err);
    return buildJsonResponse(
      { error_code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
      500,
      req
    );
  }
});
