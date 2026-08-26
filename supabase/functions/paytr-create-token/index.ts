import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import {
  generatePaytrToken,
  encodePaytrUserBasket,
  generatePaytrMerchantOid,
} from "../_shared/payments/paytr.ts";
import { createStatusCredential, sha256 } from "../_shared/payments/security.ts";

Deno.serve(async (req: Request) => {
  // 1. CORS Preflight & Method Validation
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;

  // 2. Load and validate server environment variables
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const merchantId = Deno.env.get("PAYTR_MERCHANT_ID") ?? "";
  const merchantKey = Deno.env.get("PAYTR_MERCHANT_KEY") ?? "";
  const merchantSalt = Deno.env.get("PAYTR_MERCHANT_SALT") ?? "";

  // Test mode flag & debug flag from Supabase environment
  const testMode = Deno.env.get("PAYTR_TEST_MODE") || "0";
  const debugOn = Deno.env.get("PAYTR_DEBUG_ON") || "0";

  if (!supabaseUrl || !serviceKey) {
    console.error("[paytr-create-token] Missing Supabase server credentials.");
    return buildJsonResponse(
      { error_code: "SERVER_CONFIG_ERROR", message: "Server configuration error." },
      500,
      req
    );
  }

  if (!merchantId || !merchantKey || !merchantSalt) {
    console.error("[paytr-create-token] Missing PayTR merchant credentials.");
    return buildJsonResponse(
      {
        error_code: "PAYTR_NOT_CONFIGURED",
        message: "PayTR ödeme altyapısı henüz yapılandırılmamış.",
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
    const termsAccepted = payload.termsAccepted === true;
    const refundPolicyAccepted = payload.refundPolicyAccepted === true;
    const legalVersions = (payload.legalVersions as Record<string, string>) || {};

    // 5. Mandatory Legal Acceptance Validation (Server-side gating)
    if (!termsAccepted || !refundPolicyAccepted) {
      return buildJsonResponse(
        {
          error_code: "LEGAL_ACCEPTANCE_REQUIRED",
          message:
            locale === "en"
              ? "You must accept the Pre-Information Form, Distance Sales Agreement, and Cancellation & Refund Policy to proceed."
              : "Ödeme işlemine devam edebilmek için Ön Bilgilendirme Formu, Mesafeli Satış Sözleşmesi ve İptal/İade Koşullarını kabul etmeniz gerekmektedir.",
        },
        400,
        req
      );
    }

    if (!packageId) {
      return buildJsonResponse(
        { error_code: "INVALID_PACKAGE", message: "Package ID is required." },
        400,
        req
      );
    }

    // 6. Server-side package validation (never trust client amounts)
    const { data: packageRow, error: packageError } = await admin
      .from("pricing_packages")
      .select(
        "id,name_tr,name_en,current_total,price_amount,currency,lesson_count,unit_price,purchase_mode,active"
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

    // 7. Coupon Validation if present
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

    // 8. Load student profile details & validate phone
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

    const rawPhone =
      customPayerPhone ||
      studentProfile?.phone ||
      user.user_metadata?.phone ||
      "";

    const cleanedPhone = rawPhone.replace(/\s+/g, "").replace(/-/g, "");

    // Phone is mandatory for PayTR payment processing; never fallback to fake numbers
    if (!cleanedPhone || cleanedPhone.length < 10) {
      return buildJsonResponse(
        {
          error_code: "PHONE_REQUIRED",
          message:
            locale === "en"
              ? "A valid phone number is required for payment processing."
              : "Ödeme işlemi için geçerli bir telefon numarası gereklidir.",
        },
        400,
        req
      );
    }

    const payerPhone = cleanedPhone;

    // 9. Query Single Lesson List Price Snapshot (for permanent historical refund reference)
    const { data: singlePkg } = await admin
      .from("pricing_packages")
      .select("price_amount,current_total,unit_price")
      .eq("id", "single")
      .maybeSingle();

    const singleLessonListPrice = Number(
      singlePkg?.current_total ?? singlePkg?.price_amount ?? singlePkg?.unit_price ?? 3200
    );

    // 10. Generate unique canonical alphanumeric merchant_oid and status credential
    const merchantOid = generatePaytrMerchantOid();
    if (!/^[A-Za-z0-9]{1,64}$/.test(merchantOid)) {
      console.error("[paytr-create-token] Invalid merchant_oid generated:", merchantOid);
      return buildJsonResponse(
        { error_code: "INTERNAL_ERROR", message: "Geçersiz sipariş numarası oluşturuldu." },
        500,
        req
      );
    }

    const { token: statusToken } = createStatusCredential(merchantOid);
    const statusTokenHash = await sha256(statusToken);

    // 11. Client IP extraction
    const rawIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "1.1.1.1";
    const userIp = rawIp.slice(0, 39);

    // 12. User Basket Construction
    const packageName =
      locale === "en"
        ? packageRow.name_en || "Oriens Academy Course Package"
        : packageRow.name_tr || "Oriens Academy Eğitim Paketi";

    const userBasket = encodePaytrUserBasket([
      [packageName, finalAmount.toFixed(2), 1],
    ]);

    const nowIso = new Date().toISOString();

    // 13. Create pending transaction in DB before requesting token
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
          lesson_count: packageRow.lesson_count ?? 1,
          package_name: packageName,
          unit_price: packageRow.unit_price ?? baseAmount,
          user_ip: userIp,
          provider_test_mode: testMode === "1",
          created_at: nowIso,
          // Legal acceptance evidence (server-generated timestamps)
          sales_terms_version: legalVersions.salesAgreement || "2026-08-27",
          sales_terms_accepted_at: nowIso,
          pre_information_version: legalVersions.preInformation || "2026-08-27",
          pre_information_accepted_at: nowIso,
          refund_policy_version: legalVersions.refundPolicy || "2026-08-27",
          refund_policy_accepted_at: nowIso,
          // Historic Refund Price Snapshots
          single_lesson_list_price_snapshot: singleLessonListPrice,
          package_list_price_snapshot: baseAmount,
          package_discount_snapshot: discountAmount,
          coupon_discount_snapshot: discountAmount,
          amount_paid: finalAmount,
        },
      })
      .select("id")
      .single();

    if (insertError || !transaction) {
      console.error("[paytr-create-token] Database insert error:", insertError);
      return buildJsonResponse(
        { error_code: "TRANSACTION_CREATE_FAILED", message: "İşlem kaydı oluşturulamadı." },
        500,
        req
      );
    }

    // 14. Determine Merchant Ok and Fail URLs
    const publicSiteUrl = (Deno.env.get("PUBLIC_SITE_URL") ?? "https://oriens-academy.com").replace(
      /\/$/,
      ""
    );
    const merchantOkUrl = `${publicSiteUrl}/${locale === "en" ? "en/payment/success" : "tr/odeme/basarili"}?reference=${encodeURIComponent(merchantOid)}&token=${encodeURIComponent(statusToken)}`;
    const merchantFailUrl = `${publicSiteUrl}/${locale === "en" ? "en/payment/failed" : "tr/odeme/basarisiz"}?reference=${encodeURIComponent(merchantOid)}&token=${encodeURIComponent(statusToken)}`;

    // 15. Generate PayTR HMAC-SHA256 Token Signature
    const paytrToken = generatePaytrToken(
      {
        merchantId,
        userIp,
        merchantOid,
        email: userEmail,
        paymentAmount: paymentAmountKurus,
        userBasket,
        noInstallment: "0",
        maxInstallment: "12",
        currency,
        testMode,
      },
      merchantKey,
      merchantSalt
    );

    // 16. Request iframe token from PayTR API
    const formData = new URLSearchParams();
    formData.append("merchant_id", merchantId);
    formData.append("user_ip", userIp);
    formData.append("merchant_oid", merchantOid);
    formData.append("email", userEmail);
    formData.append("payment_amount", paymentAmountKurus);
    formData.append("paytr_token", paytrToken);
    formData.append("user_basket", userBasket);
    formData.append("debug_on", debugOn);
    formData.append("no_installment", "0");
    formData.append("max_installment", "12");
    formData.append("user_name", payerName);
    formData.append("user_address", "Emaar Square, The Heights E Blok, Istanbul");
    formData.append("user_phone", payerPhone);
    formData.append("merchant_ok_url", merchantOkUrl);
    formData.append("merchant_fail_url", merchantFailUrl);
    formData.append("timeout_limit", "30");
    formData.append("currency", currency);
    formData.append("test_mode", testMode);
    formData.append("lang", locale === "en" ? "en" : "tr");

    const paytrRes = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    if (!paytrRes.ok) {
      console.error("[paytr-create-token] PayTR HTTP Error:", paytrRes.status, paytrRes.statusText);
      await admin.from("payment_transactions").update({ status: "failed" }).eq("id", transaction.id);
      return buildJsonResponse(
        {
          error_code: "PAYTR_HTTP_ERROR",
          message: "PayTR servis bağlantısı başarısız oldu.",
        },
        502,
        req
      );
    }

    const paytrData = await paytrRes.json();

    if (paytrData.status === "success" && paytrData.token) {
      return buildJsonResponse(
        {
          success: true,
          iframe_token: paytrData.token,
          merchant_oid: merchantOid,
          reference: merchantOid,
          statusToken,
          final_amount: finalAmount,
          currency,
        },
        200,
        req
      );
    }

    console.error("[paytr-create-token] PayTR Rejected:", paytrData.reason);
    await admin.from("payment_transactions").update({ status: "failed" }).eq("id", transaction.id);

    return buildJsonResponse(
      {
        error_code: "PAYTR_REJECTED",
        message: paytrData.reason || "Ödeme oturumu başlatılamadı.",
      },
      400,
      req
    );
  } catch (err) {
    console.error("[paytr-create-token] Unexpected error:", err);
    return buildJsonResponse(
      {
        error_code: "INTERNAL_ERROR",
        message: "Beklenmeyen bir sunucu hatası oluştu.",
      },
      500,
      req
    );
  }
});
