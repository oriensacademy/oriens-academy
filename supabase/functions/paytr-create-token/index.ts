import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { calculatePaytrToken, encodePaytrUserBasket } from "../_shared/payments/paytr.ts";
import { createStatusCredential, generatePaytrMerchantOid, sha256 } from "../_shared/payments/security.ts";

const PHONE_RE = /^\+[1-9][0-9]{6,14}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validationError(req: Request, locale: "tr" | "en", code: string, tr: string, en: string) {
  return buildJsonResponse({ error_code: code, message: locale === "en" ? en : tr }, 400, req);
}

Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const merchantId = Deno.env.get("PAYTR_MERCHANT_ID") ?? "";
  const merchantKey = Deno.env.get("PAYTR_MERCHANT_KEY") ?? "";
  const merchantSalt = Deno.env.get("PAYTR_MERCHANT_SALT") ?? "";
  const testMode = Deno.env.get("PAYTR_TEST_MODE") || "0";
  const debugOn = Deno.env.get("PAYTR_DEBUG_ON") || "0";
  if (!supabaseUrl || !serviceKey || !merchantId || !merchantKey || !merchantSalt) {
    return buildJsonResponse({ error_code: "SERVER_CONFIG_ERROR", message: "Payment service is not configured." }, 503, req);
  }

  try {
    const admin = createClient(supabaseUrl, serviceKey);
    const authorization = req.headers.get("authorization") ?? "";
    const accessToken = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7) : "";
    const { data: actorData, error: authError } = accessToken
      ? await admin.auth.getUser(accessToken)
      : { data: { user: null }, error: new Error("missing token") };
    if (authError || !actorData.user) {
      return buildJsonResponse({ error_code: "INVALID_SESSION", message: "Invalid user session." }, 401, req);
    }

    const actor = actorData.user;
    const payload = (await req.json()) as Record<string, unknown>;
    const locale: "tr" | "en" = payload.locale === "en" ? "en" : "tr";
    const packageId = String(payload.packageId ?? "").trim();
    const learnerId = String(payload.learnerId ?? "").trim();
    const selectedGuardianId = String(payload.guardianUserId ?? "").trim();
    const payerAddress = String(payload.payerAddress ?? "").trim().replace(/\s+/g, " ");
    const couponCode = payload.couponCode ? String(payload.couponCode).trim().toUpperCase() : null;
    const termsAccepted = payload.termsAccepted === true;
    const refundPolicyAccepted = payload.refundPolicyAccepted === true;
    const legalVersions = (payload.legalVersions as Record<string, string>) || {};
    if (!termsAccepted || !refundPolicyAccepted) return validationError(req, locale, "LEGAL_ACCEPTANCE_REQUIRED", "Ödemeye devam etmek için sözleşmeleri onaylayın.", "Accept the agreements to continue to payment.");
    if (!packageId) return validationError(req, locale, "INVALID_PACKAGE", "Lütfen geçerli bir paket seçin.", "Select a valid package.");
    if (!UUID_RE.test(learnerId)) return validationError(req, locale, "LEARNER_REQUIRED", "Ödeme yapılacak öğrenciyi seçin.", "Select the learner who will own the package.");

    const isAdminActor = actor.app_metadata?.role === "admin";
    if (isAdminActor) {
      const { data: adminProfile } = await admin.from("admin_profiles").select("active,role").eq("user_id", actor.id).maybeSingle();
      if (!adminProfile?.active || adminProfile.role !== "admin") return buildJsonResponse({ error_code: "ADMIN_CONTEXT_INVALID", message: "Admin authorization is invalid." }, 403, req);
      if (!UUID_RE.test(selectedGuardianId)) return validationError(req, locale, "CUSTOMER_CONTEXT_REQUIRED", "Ödeme için geçerli bir veli ve öğrenci seçin.", "Select a valid guardian and learner before payment.");
    }
    const purchaserGuardianId = isAdminActor ? selectedGuardianId : actor.id;
    const selectionMethod = isAdminActor ? "admin_explicit_guardian_learner" : "guardian_selected_learner";
    const [{ data: guardian }, { data: relation }, { data: learner }] = await Promise.all([
      admin.from("guardian_accounts").select("user_id,full_name,email,phone,contact_address,email_verified_at,active,preferred_language").eq("user_id", purchaserGuardianId).maybeSingle(),
      admin.from("guardian_students").select("active").eq("guardian_user_id", purchaserGuardianId).eq("student_id", learnerId).eq("active", true).maybeSingle(),
      admin.from("student_profiles").select("id,full_name,active").eq("id", learnerId).maybeSingle(),
    ]);
    if (!guardian?.active || !relation?.active || !learner?.active) return buildJsonResponse({ error_code: "LEARNER_ACCESS_DENIED", message: locale === "tr" ? "Seçilen öğrenci bu hesaba bağlı değil." : "The selected learner is not linked to this account." }, 403, req);

    const { data: purchaserAuth } = await admin.auth.admin.getUserById(purchaserGuardianId);
    const authGuardian = purchaserAuth?.user;
    const verifiedEmail = authGuardian?.email?.trim().toLowerCase() || "";
    if (!authGuardian?.email_confirmed_at || !guardian.email_verified_at || !verifiedEmail || verifiedEmail !== String(guardian.email).trim().toLowerCase()) {
      return validationError(req, locale, "EMAIL_NOT_VERIFIED", "E-posta adresinizi doğrulayın ve tekrar deneyin.", "Verify your email address and try again.");
    }
    const payerName = String(guardian.full_name || "").trim().replace(/\s+/g, " ");
    const payerPhone = String(guardian.phone || "").trim().replace(/[\s().-]+/g, "");
    if (payerName.length < 2 || payerName.length > 100) return validationError(req, locale, "PAYER_NAME_REQUIRED", "Lütfen ad ve soyadınızı eksiksiz giriniz.", "Enter your full name in your guardian profile.");
    if (!PHONE_RE.test(payerPhone)) return validationError(req, locale, "PHONE_REQUIRED", "Ödeme için profilinizde geçerli telefon numarası bulunamadı.", "A valid phone number is missing from your guardian profile.");
    if (payerAddress.length < 10 || payerAddress.length > 300) return validationError(req, locale, "ADDRESS_REQUIRED", "Fatura / ödeme adresi 10–300 karakter olmalıdır.", "Billing address must be between 10 and 300 characters.");

    const { data: packageRow, error: packageError } = await admin.from("pricing_packages")
      .select("id,name_tr,name_en,current_total,price_amount,currency,lesson_count,unit_price,purchase_mode,active")
      .eq("id", packageId).eq("active", true).maybeSingle();
    if (packageError || !packageRow || packageRow.purchase_mode !== "purchasable") return validationError(req, locale, "PACKAGE_NOT_PURCHASABLE", "Bu paket çevrim içi satın almaya açık değil.", "This package is not available for online purchase.");
    const baseAmount = Number(packageRow.current_total ?? packageRow.price_amount);
    if (!Number.isFinite(baseAmount) || baseAmount <= 0 || !packageRow.lesson_count) return buildJsonResponse({ error_code: "PACKAGE_NOT_CONFIGURED", message: "Package payment data is incomplete." }, 400, req);

    let discountAmount = 0;
    let couponId: string | null = null;
    if (couponCode) {
      const { data: couponValidation } = await admin.rpc("validate_checkout_coupon", { p_code: couponCode, p_package_id: packageId, p_student_user_id: learnerId });
      if (!couponValidation?.valid) return validationError(req, locale, "INVALID_COUPON", "Kupon kodu geçersiz veya bu paket için kullanılamıyor.", "The coupon is invalid or cannot be used for this package.");
      discountAmount = Number(couponValidation.discount_amount ?? 0);
      couponId = couponValidation.coupon_id ? String(couponValidation.coupon_id) : null;
    }
    const finalAmount = Math.max(0, Math.round((baseAmount - discountAmount) * 100) / 100);
    if (finalAmount <= 0) return validationError(req, locale, "INVALID_AMOUNT", "Ödeme tutarı geçersiz.", "The payment amount is invalid.");

    const { error: addressSaveError } = await admin.from("guardian_accounts")
      .update({ contact_address: payerAddress })
      .eq("user_id", purchaserGuardianId);
    if (addressSaveError) return buildJsonResponse({ error_code: "ADDRESS_SAVE_FAILED", message: locale === "tr" ? "Ödeme adresi hesabınıza kaydedilemedi." : "Billing address could not be saved to your account." }, 500, req);

    const { data: singlePkg } = await admin.from("pricing_packages").select("price_amount,current_total,unit_price").eq("id", "single").maybeSingle();
    const merchantOid = generatePaytrMerchantOid();
    const { token: statusToken } = createStatusCredential(merchantOid);
    const statusTokenHash = await sha256(statusToken);
    const userIp = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "").slice(0, 39);
    if (!userIp) return validationError(req, locale, "CUSTOMER_IP_REQUIRED", "Ödeme isteği doğrulanamadı. Lütfen sayfayı yenileyip tekrar deneyin.", "The payment request could not be verified. Refresh the page and try again.");
    const packageName = locale === "en" ? packageRow.name_en : packageRow.name_tr;
    const userBasket = encodePaytrUserBasket([[packageName || packageRow.id, finalAmount.toFixed(2), 1]]);
    const nowIso = new Date().toISOString();
    const currency = String(packageRow.currency || "TRY").toUpperCase();
    const { data: transaction, error: insertError } = await admin.from("payment_transactions").insert({
      student_user_id: learnerId, auth_actor_user_id: actor.id, purchaser_guardian_user_id: purchaserGuardianId,
      package_owner_student_id: learnerId, package_id: packageId, public_reference: merchantOid,
      status_token_hash: statusTokenHash, provider: "paytr", amount: finalAmount, currency,
      status: "pending", payment_method: "card", payer_name: payerName, payer_email: verifiedEmail,
      payer_phone: payerPhone, payer_address: payerAddress, identity_selection_method: selectionMethod,
      metadata: {
        locale, learner_name: learner.full_name, coupon_code: couponCode, coupon_id: couponId,
        base_amount: baseAmount, discount_amount: discountAmount, lesson_count: packageRow.lesson_count,
        package_name: packageName, unit_price: packageRow.unit_price ?? baseAmount, provider_test_mode: testMode === "1",
        created_at: nowIso, sales_terms_version: legalVersions.salesAgreement || "2026-08-27", sales_terms_accepted_at: nowIso,
        pre_information_version: legalVersions.preInformation || "2026-08-27", pre_information_accepted_at: nowIso,
        refund_policy_version: legalVersions.refundPolicy || "2026-08-27", refund_policy_accepted_at: nowIso,
        single_lesson_list_price_snapshot: Number(singlePkg?.current_total ?? singlePkg?.price_amount ?? singlePkg?.unit_price ?? 3200),
        package_list_price_snapshot: baseAmount, package_discount_snapshot: discountAmount,
        coupon_discount_snapshot: discountAmount, amount_paid: finalAmount,
      },
    }).select("id").single();
    if (insertError || !transaction) return buildJsonResponse({ error_code: "TRANSACTION_CREATE_FAILED", message: "Payment record could not be created." }, 500, req);

    const publicSiteUrl = (Deno.env.get("PUBLIC_SITE_URL") ?? "https://oriens-academy.com").replace(/\/$/, "");
    const merchantOkUrl = `${publicSiteUrl}/${locale === "en" ? "en/payment/success" : "tr/odeme/basarili"}?reference=${encodeURIComponent(merchantOid)}&token=${encodeURIComponent(statusToken)}`;
    const merchantFailUrl = `${publicSiteUrl}/${locale === "en" ? "en/payment/failed" : "tr/odeme/basarisiz"}?reference=${encodeURIComponent(merchantOid)}&token=${encodeURIComponent(statusToken)}`;
    const paymentAmount = Math.round(finalAmount * 100).toString();
    const paytrToken = await calculatePaytrToken({ merchantId, userIp, merchantOid, email: verifiedEmail, paymentAmount, userBasket, noInstallment: "0", maxInstallment: "12", currency, testMode, merchantSalt, merchantKey });
    const formData = new URLSearchParams({ merchant_id: merchantId, user_ip: userIp, merchant_oid: merchantOid, email: verifiedEmail, payment_amount: paymentAmount, paytr_token: paytrToken, user_basket: userBasket, debug_on: debugOn, no_installment: "0", max_installment: "12", user_name: payerName, user_address: payerAddress, user_phone: payerPhone, merchant_ok_url: merchantOkUrl, merchant_fail_url: merchantFailUrl, timeout_limit: "30", currency, test_mode: testMode, lang: locale === "en" ? "en" : "tr" });
    const paytrRes = await fetch("https://www.paytr.com/odeme/api/get-token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: formData.toString() });
    const paytrData = paytrRes.ok ? await paytrRes.json() : null;
    if (!paytrRes.ok || paytrData?.status !== "success" || !paytrData?.token) {
      await admin.from("payment_transactions").update({ status: "failed" }).eq("id", transaction.id);
      return buildJsonResponse({ error_code: "PAYTR_SESSION_FAILED", message: locale === "tr" ? "Güvenli ödeme oturumu başlatılamadı. Lütfen tekrar deneyin." : "The secure payment session could not be started. Try again." }, 502, req);
    }
    return buildJsonResponse({ success: true, iframe_token: paytrData.token, merchant_oid: merchantOid, reference: merchantOid, statusToken, final_amount: finalAmount, currency }, 200, req);
  } catch (error) {
    console.error("[paytr-create-token] request failed", error instanceof Error ? error.name : "unknown");
    return buildJsonResponse({ error_code: "INTERNAL_ERROR", message: "Payment session could not be prepared." }, 500, req);
  }
});
