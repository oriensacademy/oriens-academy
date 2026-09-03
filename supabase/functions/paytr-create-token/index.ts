import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { calculatePaytrToken, encodePaytrUserBasket, mapCurrencyToPaytr } from "../_shared/payments/paytr.ts";
import { createStatusCredential, generatePaytrMerchantOid, sha256 } from "../_shared/payments/security.ts";

const PHONE_RE = /^\+[1-9][0-9]{6,14}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAYTR_DEFAULT_ADDRESS = "İstanbul / Türkiye";

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
  if (!supabaseUrl || !serviceKey || !merchantId || !merchantKey || !merchantSalt) return buildJsonResponse({ error_code: "SERVER_CONFIG_ERROR", message: "Payment service is not configured." }, 503, req);

  try {
    const payload = (await req.json()) as Record<string, unknown>;
    const locale: "tr" | "en" = payload.locale === "en" ? "en" : "tr";
    const admin = createClient(supabaseUrl, serviceKey);
    const authorization = req.headers.get("authorization") ?? "";
    const accessToken = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7) : "";
    const { data: actorData, error: authError } = accessToken ? await admin.auth.getUser(accessToken) : { data: { user: null }, error: new Error("missing token") };
    if (authError || !actorData.user) return buildJsonResponse({ error_code: "INVALID_SESSION", message: locale === "tr" ? "Oturumunuzun süresi dolmuş. Lütfen yeniden giriş yapın." : "Your session has expired. Please sign in again." }, 401, req);

    const actor = actorData.user;
    const rawPackageIds = Array.isArray(payload.packageIds) ? payload.packageIds : payload.packageId ? [payload.packageId] : [];
    const packageIds = rawPackageIds.map((value) => String(value).trim()).filter(Boolean);
    const learnerId = String(payload.learnerId ?? "").trim();
    const selectedGuardianId = String(payload.guardianUserId ?? "").trim();
    const couponCode = payload.couponCode ? String(payload.couponCode).trim().toUpperCase() : null;
    const termsAccepted = payload.termsAccepted === true;
    const refundPolicyAccepted = payload.refundPolicyAccepted === true;
    const legalAccepted = termsAccepted && refundPolicyAccepted;
    const legalVersions = (payload.legalVersions as Record<string, string>) || {};
    if (!packageIds.length || packageIds.length > 20 || new Set(packageIds).size !== packageIds.length) return validationError(req, locale, "INVALID_PACKAGES", "Siparişteki paketler geçersiz.", "The packages in this order are invalid.");
    if (!UUID_RE.test(learnerId)) return validationError(req, locale, "LEARNER_REQUIRED", "Ödeme yapılacak öğrenci bulunamadı.", "The learner for this payment could not be found.");

    const isAdminActor = actor.app_metadata?.role === "admin";
    if (isAdminActor) {
      const { data: adminProfile } = await admin.from("admin_profiles").select("active,role").eq("user_id", actor.id).maybeSingle();
      if (!adminProfile?.active || adminProfile.role !== "admin") return buildJsonResponse({ error_code: "ADMIN_CONTEXT_INVALID", message: "Admin authorization is invalid." }, 403, req);
      if (!UUID_RE.test(selectedGuardianId)) return validationError(req, locale, "CUSTOMER_CONTEXT_REQUIRED", "Ödeme için geçerli bir hesap sahibi seçin.", "Select a valid account holder before payment.");
    }
    const purchaserGuardianId = isAdminActor ? selectedGuardianId : actor.id;
    const selectionMethod = isAdminActor ? "admin_explicit_guardian_learner" : "account_holder_linked_learner";
    const [{ data: guardian }, { data: relation }, { data: learner }] = await Promise.all([
      admin.from("guardian_accounts").select("user_id,full_name,email,email_verified_at,active,preferred_language").eq("user_id", purchaserGuardianId).maybeSingle(),
      admin.from("guardian_students").select("active").eq("guardian_user_id", purchaserGuardianId).eq("student_id", learnerId).eq("active", true).maybeSingle(),
      admin.from("student_profiles").select("id,full_name,active,legacy_auth_user_id").eq("id", learnerId).maybeSingle(),
    ]);
    if (!guardian?.active || !relation?.active || !learner?.active) return buildJsonResponse({ error_code: "LEARNER_ACCESS_DENIED", message: locale === "tr" ? "Hesaba bağlı aktif öğrenci bulunamadı." : "No active learner linked to this account was found." }, 403, req);

    const { data: purchaserAuth } = await admin.auth.admin.getUserById(purchaserGuardianId);
    const authGuardian = purchaserAuth?.user;
    const verifiedEmail = authGuardian?.email?.trim().toLowerCase() || "";
    if (!guardian.email_verified_at || !verifiedEmail || verifiedEmail !== String(guardian.email).trim().toLowerCase()) return validationError(req, locale, "EMAIL_NOT_VERIFIED", "E-posta adresinizi doğrulayın ve tekrar deneyin.", "Verify your email address and try again.");
    const payerName = String(guardian.full_name || "").trim().replace(/\s+/g, " ");
    if (payerName.length < 2 || payerName.length > 100) return validationError(req, locale, "PAYER_NAME_REQUIRED", "Profilinizde geçerli ad soyad bulunamadı.", "A valid full name is missing from your profile.");

    // Transient, checkout-only 3D Secure phone number. Never read from or written to
    // guardian_accounts/student_profiles/auth metadata — used only for this PayTR request
    // and the resulting transaction's payer_phone snapshot.
    const payerPhone = String(payload.paymentPhone ?? "").trim().replace(/[\s().-]+/g, "");
    if (!payerPhone) return validationError(req, locale, "PHONE_REQUIRED", "Ödeme için 3D Secure telefon numarası gereklidir.", "A 3D Secure phone number is required to make a payment.");
    if (!PHONE_RE.test(payerPhone)) return validationError(req, locale, "INVALID_PHONE", "Lütfen geçerli bir telefon numarası girin.", "Please enter a valid phone number.");

    const { data: packageRows, error: packageError } = await admin.from("pricing_packages").select("id,name_tr,name_en,current_total,price_amount,currency,lesson_count,unit_price,purchase_mode,active").in("id", packageIds);
    if (packageError || !packageRows || packageRows.length !== packageIds.length) return validationError(req, locale, "PACKAGE_NOT_PURCHASABLE", "Siparişteki paketlerden biri satın almaya açık değil.", "One of the packages in this order is not available for purchase.");
    const packages = packageIds.map((id) => packageRows.find((row) => row.id === id)!);
    const currencies = new Set(packages.map((row) => String(row.currency || "TRY").toUpperCase()));
    if (currencies.size !== 1 || packages.some((row) => !row.active || row.purchase_mode !== "purchasable")) return validationError(req, locale, "PACKAGE_NOT_PURCHASABLE", "Siparişteki paketlerden biri satın almaya açık değil.", "One of the packages in this order is not available for purchase.");
    // `currency` is the app's internal/canonical code (e.g. "TRY"), stored as-is on the
    // transaction. `paytrCurrency` is the exact code the PayTR protocol expects (e.g. "TL")
    // and is only ever used at the PayTR request boundary below. Fail closed on anything
    // unsupported rather than silently forwarding an arbitrary currency code to PayTR.
    const currency = [...currencies][0];
    let paytrCurrency: string;
    try {
      paytrCurrency = mapCurrencyToPaytr(currency);
    } catch {
      return validationError(req, locale, "UNSUPPORTED_CURRENCY", "Bu para birimiyle ödeme şu anda desteklenmiyor.", "Payment in this currency is not currently supported.");
    }
    const baseAmounts = packages.map((row) => Number(row.current_total ?? row.price_amount));
    if (packages.some((row, index) => !Number.isFinite(baseAmounts[index]) || baseAmounts[index] <= 0 || !row.lesson_count)) return validationError(req, locale, "PACKAGE_NOT_CONFIGURED", "Paket ödeme bilgileri eksik.", "Package payment data is incomplete.");

    let discountAmount = 0;
    let couponId: string | null = null;
    let discountedPackageId: string | null = null;
    if (couponCode) {
      for (const packageId of packageIds) {
        const { data: validation } = await admin.rpc("validate_checkout_coupon", { p_code: couponCode, p_package_id: packageId, p_student_user_id: learnerId });
        if (validation?.valid) {
          discountAmount = Math.max(0, Number(validation.discount_amount ?? 0));
          couponId = validation.coupon_id ? String(validation.coupon_id) : null;
          discountedPackageId = packageId;
          break;
        }
      }
      if (!couponId) return validationError(req, locale, "INVALID_COUPON", "Kupon kodu geçersiz veya bu sipariş için kullanılamıyor.", "The coupon is invalid or cannot be used for this order.");
    }
    const baseAmount = Math.round(baseAmounts.reduce((sum, amount) => sum + amount, 0) * 100) / 100;
    discountAmount = Math.min(baseAmount, Math.round(discountAmount * 100) / 100);
    const finalAmount = Math.max(0, Math.round((baseAmount - discountAmount) * 100) / 100);
    const checkoutItems = packages.map((row, index) => {
      const itemDiscount = row.id === discountedPackageId ? Math.min(baseAmounts[index], discountAmount) : 0;
      return { package_id: row.id, package_name: (locale === "en" ? row.name_en : row.name_tr) || row.id, lesson_count: row.lesson_count, base_amount: baseAmounts[index], discount_amount: itemDiscount, final_amount: Math.max(0, Math.round((baseAmounts[index] - itemDiscount) * 100) / 100), unit_price: row.unit_price ?? baseAmounts[index] };
    });
    if (Math.round(checkoutItems.reduce((sum, item) => sum + item.final_amount, 0) * 100) / 100 !== finalAmount) return buildJsonResponse({ error_code: "AMOUNT_CALCULATION_FAILED", message: "Order total could not be calculated." }, 500, req);

    const sortedPackageIds = [...packageIds].sort().join(",");
    const idempotencyContext = `${actor.id}:${learnerId}:${purchaserGuardianId || ""}:${sortedPackageIds}:${finalAmount}:${currency}:${couponId || ""}`;
    const checkoutIdempotencyKey = await sha256(idempotencyContext);

    // Reuse existing active pending preload if within valid 15-minute window
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: existingTx } = await admin
      .from("payment_transactions")
      .select("id,public_reference,amount,currency,metadata,status")
      .eq("checkout_idempotency_key", checkoutIdempotencyKey)
      .eq("status", "pending")
      .eq("is_archived", false)
      .gte("created_at", fifteenMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingTx && (existingTx.metadata as Record<string, unknown>)?.iframe_token) {
      const meta = existingTx.metadata as Record<string, unknown>;
      return buildJsonResponse(
        {
          success: true,
          iframe_token: meta.iframe_token,
          merchant_oid: existingTx.public_reference,
          reference: existingTx.public_reference,
          statusToken: meta.status_token,
          final_amount: existingTx.amount,
          currency: existingTx.currency,
          legal_accepted: legalAccepted,
          reused_existing: true,
        },
        200,
        req
      );
    }

    const merchantOid = generatePaytrMerchantOid();
    const { token: statusToken } = createStatusCredential(merchantOid);
    const statusTokenHash = await sha256(statusToken);
    const nowIso = new Date().toISOString();
    const userIp = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "").slice(0, 39);
    if (finalAmount > 0 && !userIp) return validationError(req, locale, "CUSTOMER_IP_REQUIRED", "Ödeme isteği doğrulanamadı. Sayfayı yenileyip tekrar deneyin.", "The payment request could not be verified. Refresh the page and try again.");
    const { data: singlePkg } = await admin.from("pricing_packages").select("price_amount,current_total,unit_price").eq("id", "single").maybeSingle();
    const initialMetadata: Record<string, unknown> = {
      locale, learner_name: learner.full_name, coupon_code: couponCode, coupon_id: couponId, discounted_package_id: discountedPackageId,
      base_amount: baseAmount, discount_amount: discountAmount, checkout_items: checkoutItems, package_ids: packageIds,
      package_name: checkoutItems.map((item) => item.package_name).join(", "), lesson_count: checkoutItems.reduce((sum, item) => sum + Number(item.lesson_count || 0), 0),
      provider_test_mode: testMode === "1", created_at: nowIso,
      sales_terms_version: legalVersions.salesAgreement || "2026-08-27",
      sales_terms_accepted_at: legalAccepted ? nowIso : null,
      pre_information_version: legalVersions.preInformation || "2026-08-27",
      pre_information_accepted_at: legalAccepted ? nowIso : null,
      refund_policy_version: legalVersions.refundPolicy || "2026-08-27",
      refund_policy_accepted_at: legalAccepted ? nowIso : null,
      legal_accepted: legalAccepted,
      single_lesson_list_price_snapshot: Number(singlePkg?.current_total ?? singlePkg?.price_amount ?? singlePkg?.unit_price ?? 3200),
      package_list_price_snapshot: baseAmount, package_discount_snapshot: 0, coupon_discount_snapshot: discountAmount, amount_paid: finalAmount,
      is_preload: true,
      checkout_idempotency_key: checkoutIdempotencyKey,
      status_token: statusToken,
    };

    const { data: transaction, error: insertError } = await admin.from("payment_transactions").insert({
      student_user_id: learner.legacy_auth_user_id, auth_actor_user_id: actor.id, purchaser_guardian_user_id: purchaserGuardianId, package_owner_student_id: learnerId,
      package_id: packageIds[0], public_reference: merchantOid, status_token_hash: statusTokenHash, provider: finalAmount === 0 ? "coupon" : "paytr", amount: finalAmount, currency,
      status: "pending", payment_method: "card", payer_name: payerName, payer_email: verifiedEmail,
      payer_phone: payerPhone, payer_address: PAYTR_DEFAULT_ADDRESS, identity_selection_method: selectionMethod,
      is_preload: true,
      checkout_idempotency_key: checkoutIdempotencyKey,
      metadata: initialMetadata,
    }).select("id,metadata").single();

    if (insertError) {
      // If unique index collision occurred due to concurrent in-flight request, fetch and reuse the existing one
      const { data: racedTx } = await admin
        .from("payment_transactions")
        .select("id,public_reference,amount,currency,metadata")
        .eq("checkout_idempotency_key", checkoutIdempotencyKey)
        .eq("status", "pending")
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (racedTx && (racedTx.metadata as Record<string, unknown>)?.iframe_token) {
        const meta = racedTx.metadata as Record<string, unknown>;
        return buildJsonResponse(
          {
            success: true,
            iframe_token: meta.iframe_token,
            merchant_oid: racedTx.public_reference,
            reference: racedTx.public_reference,
            statusToken: meta.status_token,
            final_amount: racedTx.amount,
            currency: racedTx.currency,
            legal_accepted: legalAccepted,
            reused_existing: true,
          },
          200,
          req
        );
      }
      return buildJsonResponse({ error_code: "TRANSACTION_CREATE_FAILED", message: "Payment record could not be created." }, 500, req);
    }
    if (!transaction) return buildJsonResponse({ error_code: "TRANSACTION_CREATE_FAILED", message: "Payment record could not be created." }, 500, req);

    if (couponId) {
      const { error: redemptionError } = await admin.from("discount_coupon_redemptions").insert({ coupon_id: couponId, student_user_id: learnerId, payment_transaction_id: transaction.id, discount_amount: discountAmount });
      if (redemptionError) { await admin.from("payment_transactions").update({ status: "failed" }).eq("id", transaction.id); return buildJsonResponse({ error_code: "COUPON_RESERVATION_FAILED", message: locale === "tr" ? "Kupon bu sipariş için ayrılamadı." : "The coupon could not be reserved for this order." }, 409, req); }
    }
    if (finalAmount === 0) {
      if (legalAccepted) {
        const { error: activationError } = await admin.rpc("finalize_zero_payment_order", { p_payment_id: transaction.id });
        if (activationError) return buildJsonResponse({ error_code: "FREE_ORDER_ACTIVATION_FAILED", message: locale === "tr" ? "Ücretsiz sipariş tamamlanamadı." : "The free order could not be completed." }, 500, req);
      }
      return buildJsonResponse({ success: true, zero_payment: true, prepared: !legalAccepted, legal_accepted: legalAccepted, merchant_oid: merchantOid, reference: merchantOid, statusToken, final_amount: 0, currency }, 200, req);
    }

    const userBasket = encodePaytrUserBasket(checkoutItems.map((item) => [item.package_name, item.final_amount.toFixed(2), 1]));
    const publicSiteUrl = (Deno.env.get("PUBLIC_SITE_URL") ?? "https://oriens-academy.com").replace(/\/$/, "");
    const merchantOkUrl = `${publicSiteUrl}/${locale === "en" ? "en/payment/success" : "tr/odeme/basarili"}?reference=${encodeURIComponent(merchantOid)}&token=${encodeURIComponent(statusToken)}`;
    const merchantFailUrl = `${publicSiteUrl}/${locale === "en" ? "en/payment/failed" : "tr/odeme/basarisiz"}?reference=${encodeURIComponent(merchantOid)}&token=${encodeURIComponent(statusToken)}`;
    const paymentAmount = Math.round(finalAmount * 100).toString();
    const paytrToken = await calculatePaytrToken({ merchantId, userIp, merchantOid, email: verifiedEmail, paymentAmount, userBasket, noInstallment: "0", maxInstallment: "12", currency: paytrCurrency, testMode, merchantSalt, merchantKey });
    const formData = new URLSearchParams({ merchant_id: merchantId, user_ip: userIp, merchant_oid: merchantOid, email: verifiedEmail, payment_amount: paymentAmount, paytr_token: paytrToken, user_basket: userBasket, debug_on: debugOn, no_installment: "0", max_installment: "12", user_name: payerName, user_address: PAYTR_DEFAULT_ADDRESS, user_phone: payerPhone, merchant_ok_url: merchantOkUrl, merchant_fail_url: merchantFailUrl, timeout_limit: "30", currency: paytrCurrency, test_mode: testMode, lang: locale === "en" ? "en" : "tr" });
    const paytrRes = await fetch("https://www.paytr.com/odeme/api/get-token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: formData.toString() });
    const paytrData = paytrRes.ok ? await paytrRes.json() : null;
    if (!paytrRes.ok || paytrData?.status !== "success" || !paytrData?.token) {
      // Safe, non-secret observability: PayTR's own rejection reason, HTTP status, and our
      // internal identifiers only. Never log merchant_key/merchant_salt/Authorization/the
      // full request body.
      const safeReason = typeof paytrData?.reason === "string" ? paytrData.reason.slice(0, 500) : null;
      console.error(
        `[paytr-create-token] PAYTR_SESSION_FAILED httpStatus=${paytrRes.status} merchantOid=${merchantOid} transactionId=${transaction.id} reason=${safeReason ?? "(none)"}`
      );
      await admin.from("payment_transactions").update({
        status: "failed",
        metadata: { ...initialMetadata, failure_reason: safeReason, failure_http_status: paytrRes.status },
      }).eq("id", transaction.id);
      return buildJsonResponse({ error_code: "PAYTR_SESSION_FAILED", message: locale === "tr" ? "Güvenli ödeme oturumu başlatılamadı. Tekrar deneyin." : "The secure payment session could not be started. Try again." }, 502, req);
    }

    // Persist iframe token to metadata for idempotency reuse
    await admin.from("payment_transactions").update({
      metadata: {
        ...initialMetadata,
        iframe_token: paytrData.token,
        status_token: statusToken,
      },
    }).eq("id", transaction.id);

    return buildJsonResponse({ success: true, iframe_token: paytrData.token, merchant_oid: merchantOid, reference: merchantOid, statusToken, final_amount: finalAmount, currency, legal_accepted: legalAccepted }, 200, req);
  } catch (error) {
    console.error("[paytr-create-token] request failed", error instanceof Error ? error.name : "unknown");
    return buildJsonResponse({ error_code: "INTERNAL_ERROR", message: "Payment session could not be prepared." }, 500, req);
  }
});
