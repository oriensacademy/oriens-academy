import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validateMutationRequest, buildJsonResponse } from "../_shared/cors.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";
import { dispatchBookingEmails } from "../_shared/email/service.ts";

const ALLOWED_EXAM_CODES = new Set([
  "ib",
  "ap",
  "sat",
  "act",
  "a_levels",
  "igcse",
  "gmat",
  "gre",
  "ielts",
  "toefl",
]);

const ALLOWED_SUPPORT_TYPES = new Set([
  "exam_preparation",
  "university_support",
  "general_consultation",
]);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

    // Extract Turnstile token (from body or header)
    const turnstileToken =
      String(payload.turnstileToken ?? "").trim() ||
      req.headers.get("x-turnstile-token") ||
      req.headers.get("turnstile-token") ||
      "";

    // Perform Cloudflare Turnstile bot verification
    const turnstileResult = await verifyTurnstile({
      token: turnstileToken,
      expectedAction: "booking_submit",
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
    const slotId = String(payload.slotId ?? "").trim();
    const fullName = String(payload.fullName ?? "").trim().replace(/\s+/g, " ");
    const email = String(payload.email ?? "").trim().toLowerCase();
    const phone = payload.phone ? String(payload.phone).trim() : null;
    const supportType = String(payload.supportType ?? "general_consultation").trim();
    const examCode = payload.examCode ? String(payload.examCode).trim() : null;
    const customExam = payload.customExam ? String(payload.customExam).trim() : null;
    const notes = payload.notes ? String(payload.notes).trim() : null;
    const locale = String(payload.locale ?? "en").trim() === "tr" ? "tr" : "en";
    const privacyConsent = payload.privacyConsent === true;
    const marketingConsent = payload.marketingConsent === true;

    // Strict input validations
    if (!slotId || !UUID_REGEX.test(slotId)) {
      return buildJsonResponse(
        { error_code: "INVALID_SLOT_ID", message: "A valid slot identifier is required." },
        400,
        req
      );
    }

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

    if (!privacyConsent) {
      return buildJsonResponse(
        { error_code: "PRIVACY_CONSENT_REQUIRED", message: "Privacy consent must be accepted." },
        400,
        req
      );
    }

    if (!ALLOWED_SUPPORT_TYPES.has(supportType)) {
      return buildJsonResponse(
        { error_code: "INVALID_SUPPORT_TYPE", message: "Invalid support type selected." },
        400,
        req
      );
    }

    if (examCode && !ALLOWED_EXAM_CODES.has(examCode)) {
      return buildJsonResponse(
        { error_code: "INVALID_EXAM_CODE", message: "Invalid exam code selected." },
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

    if (notes && notes.length > 1000) {
      return buildJsonResponse(
        { error_code: "INVALID_NOTES", message: "Notes exceed maximum allowable length of 1000 characters." },
        400,
        req
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[create-booking] Missing server credentials in environment.");
      return buildJsonResponse(
        { error_code: "SERVER_CONFIG_ERROR", message: "Server configuration error." },
        500,
        req
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    let studentUserId: string | null = null;
    const authorization = req.headers.get("authorization") ?? "";
    const accessToken = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7) : "";
    if (accessToken) {
      const { data: authData } = await supabaseAdmin.auth.getUser(accessToken);
      const authUser = authData.user;
      if (authUser && authUser.app_metadata?.role !== "admin") {
        const { data: studentProfile } = await supabaseAdmin.from("student_profiles")
          .select("id,email,active").eq("id", authUser.id).maybeSingle();
        if (studentProfile?.active && studentProfile.email.toLowerCase() === email) studentUserId = authUser.id;
      }
    }

    // Invoke atomic RPC function
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      "reserve_booking_slot",
      {
        p_slot_id: slotId,
        p_full_name: fullName,
        p_email: email,
        p_phone: phone,
        p_exam_code: examCode,
        p_custom_exam: customExam,
        p_locale: locale,
        p_notes: notes,
        p_support_type: supportType,
        p_privacy_consent: privacyConsent,
        p_marketing_consent: marketingConsent,
      }
    );

    if (rpcError) {
      console.error("[create-booking] RPC error:", rpcError);
      return buildJsonResponse(
        { error_code: "RESERVATION_FAILED", message: "Failed to process slot reservation." },
        500,
        req
      );
    }

    const result = rpcResult as {
      success: boolean;
      error_code?: string;
      message?: string;
      booking_id?: string;
      slot_id?: string;
      starts_at?: string;
      ends_at?: string;
      status?: string;
    };

    if (!result.success) {
      const httpStatus = result.error_code === "SLOT_UNAVAILABLE" ? 409 : 400;
      return buildJsonResponse(
        {
          error_code: result.error_code || "RESERVATION_FAILED",
          message: result.message || "Slot reservation failed.",
        },
        httpStatus,
        req
      );
    }

    if (studentUserId && result.booking_id) {
      const { error: linkError } = await supabaseAdmin.from("bookings")
        .update({ student_user_id: studentUserId }).eq("id", result.booking_id);
      if (linkError) console.error("[create-booking] Student identity link failed for booking.");
    }

    // Complete both delivery attempts and their logs before the edge runtime exits.
    await dispatchBookingEmails(supabaseAdmin, {
      bookingId: result.booking_id!,
      fullName,
      email,
      phone,
      supportType,
      examCode,
      customExam,
      startsAt: result.starts_at,
      endsAt: result.ends_at,
      locale,
      notes,
      status: result.status || "pending",
    }).catch((err) => {
      console.error("[create-booking] Email dispatch background error:", err);
    });

    return buildJsonResponse(
      {
        success: true,
        bookingId: result.booking_id,
        slotId: result.slot_id,
        startsAt: result.starts_at,
        endsAt: result.ends_at,
        status: result.status,
      },
      200,
      req
    );
  } catch (err) {
    console.error("[create-booking] Unexpected error:", err);
    return buildJsonResponse(
      { error_code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
      500,
      req
    );
  }
});
