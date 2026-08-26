import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, handlePreflight } from "../_shared/cors.ts";
import {
  encodePaytrUserBasket,
  requestPaytrIframeToken,
} from "../_shared/payments/paytr.ts";
import { createStatusCredential, sha256 } from "../_shared/payments/security.ts";

/**
 * PayTR iFrame Token Creation Endpoint
 *
 * Authenticates the student, strictly calculates package & coupon price server-side,
 * creates a pending payment_transaction record, and securely requests
 * the PayTR iFrame token from https://www.paytr.com/odeme/api/get-token.
 */
Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return buildJsonResponse(
      { error_code: "METHOD_NOT_ALLOWED", message: "Method not allowed." },
      405,
      req,
      { Allow: "POST, OPTIONS" }
    );
  }

  // 1. Validate Supabase environment
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return buildJsonResponse(
      { error_code: "SERVER_CONFIG_ERROR", message: "Service is not configured." },
      500,
      req
    );
  }

  // 2. Validate PayTR secrets
  const merchantId = Deno.env.get("PAYTR_MERCHANT_ID") ?? "";
  const merchantKey = Deno.env.get("PAYTR_MERCHANT_KEY") ?? "";
  const merchantSalt = Deno.env.get("PAYTR_MERCHANT_SALT") ?? "";
  const testMode = Deno.env.get("PAYTR_TEST_MODE") ?? "0";
  const debugOn = Deno.env.get("PAYTR_DEBUG_ON") ?? "0";

  if (!merchantId || !merchantKey || !merchantSalt) {
    console.error(
      "[paytr-create-token] Configuration error: PayTR merchant secrets missing."
    );
    return buildJsonResponse(
      {
        error_code: "PAYTR_NOT_CONFIGURED",
        message: "Payment gateway credentials are not configured.",
      },
      503,
      req
    );
  }

  try {
    const admin = createClient(supabaseUrl, serviceKey);

    // 3. User Authentication check
    const authorization = req.headers.get("authorization") ?? "";
    const accessToken = authorization.toLowerCase().startsWith("bearer ")
      ? authorization.slice(7)
      : "";

    if (!accessToken) {
      return buildJsonResponse(
        { error_code: "UNAUTHORIZED", message: "Authentication is required." },
        401,
        req
      );
    }

    const { data: userData, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !userData.user) {
      return buildJsonResponse(
        { error_code: "UNAUTHORIZED", message: "Invalid user session." },
        401,
        req
      );
    }

    const user = userData.user;
    const userEmail = user.email ? user.email.trim().toLowerCase() : "";
    if (!userEmail) {
      return buildJsonResponse(
        { error_code: "INVALID_USER", message: "User email is required." },
        400,
        req
      );
    }

    // 4. Parse payload
    const payload = (await req.json()) as Record<string, unknown>;
    const packageId = String(payload.packageId ?? "").trim();
    const couponCode = payload.couponCode ? String(payload.couponCode).trim().toUpperCase() : null;
    const locale = payload.locale === "en" ? "en" : "tr";
    const customPayerName = payload.payerName ? String(payload.payerName).trim() : "";
    const customPayerPhone = payload.payerPhone ? String(payload.payerPhone).trim() : "";

    if (!packageId) {
      return buildJsonResponse(
        { error_code: "INVALID_PACKAGE", message: "Package ID is required." },
        400,
        req
      );
    }

    // 5. Server-side package validation (never trust client amounts)
    const { data: packageRow, error: packageError } = await admin
      .from("pricing_packages")
      .select(
        "id,name_tr,name_en,current_total,price_amount,currency,lesson_count,purchase_mode,active"
      )
      .eq("id", packageId)
      .eq("active", true)
      .maybeSingle();

    if (packageError || !packageRow || packageRow.purchase_mode !== "purchasable") {
      return buildJsonResponse(
        {
          error_code: "PACKAGE_NOT_PURCHASABLE",
          message: "Package is not available for online purchase.",
        },
        400,
        req
      );
    }

    const baseAmount = Number(packageRow.current_total ?? packageRow.price_amount);
    const currency = String(packageRow.currency ?? "TRY").trim().toUpperCase();

    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      return buildJsonResponse(
        { error_code: "PACKAGE_NOT_CONFIGURED", message: "Package pricing is invalid." },
        400,
        req
      );
    }

    // 6. Server-side discount / coupon calculation
    let discountAmount = 0;
    let couponId: string | null = null;

    if (couponCode) {
      const { data: couponValidation } = await admin.rpc(
        "validate_checkout_coupon",
        {
          p_code: couponCode,
          p_package_id: packageId,
          p_student_user_id: user.id,
        }
      );

      if (couponValidation && couponValidation.valid === true) {
        discountAmount = Number(couponValidation.discount_amount ?? 0);
        couponId = couponValidation.coupon_id ? String(couponValidation.coupon_id) : null;
      }
    }

    const finalAmount = Math.max(0, Math.round((baseAmount - discountAmount) * 100) / 100);
    const paymentAmountKurus = Math.round(finalAmount * 100).toString();

    // 7. Load student profile details
    const { data: studentProfile } = await admin
      .from("student_profiles")
      .select("id,full_name,phone,email")
      .eq("id", user.id)
      .maybeSingle();

    const payerName =
      customPayerName ||
      studentProfile?.full_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.display_name ||
      "Öğrenci";

    const payerPhone =
      customPayerPhone ||
      studentProfile?.phone ||
      user.user_metadata?.phone ||
      "05000000000";

    // 8. Generate unique merchant_oid and status credential
    const { token: statusToken, reference: merchantOid } = createStatusCredential();
    const statusTokenHash = await sha256(statusToken);

    // 9. Client IP extraction
    const rawIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "1.1.1.1";
    const userIp = rawIp.slice(0, 39);

    // 10. User Basket Construction
    const packageName =
      locale === "en"
        ? packageRow.name_en || "Oriens Academy Course Package"
        : packageRow.name_tr || "Oriens Academy Eğitim Paketi";

    const userBasket = encodePaytrUserBasket([
      [packageName, finalAmount.toFixed(2), 1],
    ]);

    // 11. Create pending transaction in DB before requesting token
    const { data: transaction, error: insertError } = await admin
      .from("payment_transactions")
      .insert({
        student_user_id: user.id,
        package_id: packageId,
        public_reference: merchantOid,
        status_token_hash: statusTokenHash,
        provider: "paytr",
        amount: finalAmount,
        currency,
        status: "pending",
        payment_method: "card",
        payer_name: payerName,
        payer_email: userEmail,
        payer_phone: payerPhone,
        metadata: {
          locale,
          coupon_code: couponCode,
          coupon_id: couponId,
          base_amount: baseAmount,
          discount_amount: discountAmount,
          user_ip: userIp,
          created_at: new Date().toISOString(),
        },
      })
      .select("id")
      .single();

    if (insertError || !transaction) {
      console.error(
        "[paytr-create-token] Database insert error:",
        insertError
      );
      return buildJsonResponse(
        {
          error_code: "PAYMENT_CREATE_FAILED",
          message: "Transaction could not be recorded.",
        },
        500,
        req
      );
    }

    // 12. Return URLs
    const publicSiteUrl = (
      Deno.env.get("PUBLIC_SITE_URL") || "https://oriens-academy.com"
    ).replace(/\/$/, "");

    const merchantOkUrl = `${publicSiteUrl}/${
      locale === "en" ? "en/payment/success" : "tr/odeme/basarili"
    }`;
    const merchantFailUrl = `${publicSiteUrl}/${
      locale === "en" ? "en/payment/failed" : "tr/odeme/basarisiz"
    }`;

    // 13. Call PayTR get-token API
    const paytrResponse = await requestPaytrIframeToken({
      merchantId,
      merchantKey,
      merchantSalt,
      userIp,
      merchantOid,
      email: userEmail,
      paymentAmount: paymentAmountKurus,
      userBasket,
      userName: payerName,
      userAddress: "Türkiye",
      userPhone: payerPhone,
      merchantOkUrl,
      merchantFailUrl,
      currency: "TL",
      testMode,
      debugOn,
      noInstallment: "0",
      maxInstallment: "0",
    });

    if (paytrResponse.status !== "success" || !paytrResponse.token) {
      console.error(
        `[paytr-create-token] PayTR API failed for merchant_oid ${merchantOid}:`,
        paytrResponse.reason
      );

      await admin
        .from("payment_transactions")
        .update({
          status: "failed",
          metadata: {
            paytr_token_error: paytrResponse.reason || "TOKEN_CREATION_FAILED",
          },
        })
        .eq("id", transaction.id);

      return buildJsonResponse(
        {
          error_code: "PAYTR_TOKEN_ERROR",
          message:
            paytrResponse.reason || "PayTR ödeme oturumu oluşturulamadı.",
        },
        502,
        req
      );
    }

    // 14. Return iframe_token to frontend
    return buildJsonResponse(
      {
        success: true,
        iframe_token: paytrResponse.token,
        merchant_oid: merchantOid,
        reference: merchantOid,
        statusToken,
        final_amount: finalAmount,
        currency,
      },
      200,
      req
    );
  } catch (err) {
    console.error("[paytr-create-token] Unexpected error:", err);
    return buildJsonResponse(
      {
        error_code: "INTERNAL_ERROR",
        message: "Payment token could not be generated.",
      },
      500,
      req
    );
  }
});
