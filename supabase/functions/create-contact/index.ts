import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validateMutationRequest, buildJsonResponse } from "../_shared/cors.ts";
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

    // 1. Zero-friction Bot Honeypot Protection
    const honeypot = String(payload.company_website ?? payload.website_hp ?? payload.website ?? "").trim();
    if (honeypot.length > 0) {
      // Return synthetic success without storing or dispatching email
      return buildJsonResponse(
        {
          success: true,
          contactId: "spm_" + crypto.randomUUID().slice(0, 8),
          message: "Contact request received successfully.",
          delivery_status: "ok",
        },
        200,
        req
      );
    }

    const requestedSource = String(payload.source ?? "website");
    const source = requestedSource === "quick_contact"
      ? "quick_contact"
      : requestedSource === "contact_form"
        ? "contact_form"
      : requestedSource === "consultation"
        ? "consultation"
        : "website";

    // Extract & normalize form input parameters
    const fullName = String(payload.fullName ?? "").trim().replace(/\s+/g, " ");
    const email = String(payload.email ?? "").trim().toLowerCase();
    const phone = payload.phone ? String(payload.phone).trim() : null;
    const subject = payload.subject ? String(payload.subject).trim() : null;
    const message = String(payload.message ?? "").trim();
    const locale = String(payload.locale ?? "en").trim() === "tr" ? "tr" : "en";
    const privacyConsent = payload.privacyConsent === true;
    const packageId = source === "consultation" ? String(payload.packageId ?? "").trim() : "";
    const allowedPackageIds = new Set(["single", "package5", "package10", "package20", "package30"]);

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

    if (source !== "quick_contact" && (!message || message.length < 5 || message.length > 2000)) {
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

    if ((source === "contact_form" || source === "consultation") && (!phone || phone.length < 5)) {
      return buildJsonResponse(
        { error_code: "INVALID_PHONE", message: "A valid phone number is required for the contact form." },
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

    if (packageId && !allowedPackageIds.has(packageId)) {
      return buildJsonResponse(
        { error_code: "INVALID_PACKAGE", message: "The selected pricing package is invalid." },
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
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // 2. Server-side Rate Limiting (per email in last hour)
    const { count: emailCount } = await supabaseAdmin
      .from("contact_requests")
      .select("*", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", oneHourAgo);

    if (emailCount && emailCount >= 5) {
      return buildJsonResponse(
        {
          error_code: "RATE_LIMITED",
          message: locale === "tr"
            ? "Çok fazla talep gönderildi. Lütfen bir süre sonra tekrar deneyin."
            : "Too many requests. Please try again later.",
        },
        429,
        req
      );
    }

    let selectedPackage: {
      id: string;
      name: string;
      price: number | null;
      currency: string;
      lessons: number | null;
    } | null = null;

    if (packageId) {
      const { data: packageRow, error: packageError } = await supabaseAdmin
        .from("pricing_packages")
        .select("id,name_tr,name_en,lesson_count,currency,current_total,price_amount,active")
        .eq("id", packageId)
        .eq("active", true)
        .maybeSingle();

      if (packageError || !packageRow) {
        return buildJsonResponse(
          { error_code: "INVALID_PACKAGE", message: "The selected pricing package is unavailable." },
          400,
          req
        );
      }

      selectedPackage = {
        id: packageRow.id,
        name: (locale === "tr" ? packageRow.name_tr : packageRow.name_en) || packageRow.name_tr || packageRow.name_en || packageRow.id,
        price: packageRow.current_total ?? packageRow.price_amount ?? null,
        currency: packageRow.currency || "TRY",
        lessons: packageRow.lesson_count ?? null,
      };
    }

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
        metadata: selectedPackage ? {
          package_id: selectedPackage.id,
          package_name: selectedPackage.name,
          package_price: selectedPackage.price,
          package_currency: selectedPackage.currency,
          package_lessons: selectedPackage.lessons,
        } : {},
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

    // Complete notification writes
    const delivery = await dispatchContactEmails(supabaseAdmin, {
      contactId: contactRow.id,
      fullName,
      email,
      phone,
      subject,
      message,
      locale,
      source,
      createdAt: contactRow.created_at || nowIso,
      package: selectedPackage,
    }).catch((err) => {
      console.error("[create-contact] Email dispatch background error:", err);
      return { status: "partial" as const };
    });

    return buildJsonResponse(
      {
        success: true,
        contactId: contactRow.id,
        message: locale === "tr" ? "Talebiniz başarıyla alındı." : "Contact request submitted successfully.",
        delivery_status: delivery.status,
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
