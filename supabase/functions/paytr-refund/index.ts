import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { calculatePaytrRefundToken, calculatePaytrStatusToken } from "../_shared/payments/paytr.ts";

type RpcResult = Record<string, unknown> | null;

function localized(req: Request, locale: "tr" | "en", code: string, tr: string, en: string, status = 400) {
  return buildJsonResponse({ success: false, error_code: code, message: locale === "en" ? en : tr }, status, req);
}

Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const merchantId = Deno.env.get("PAYTR_MERCHANT_ID") ?? "";
  const merchantKey = Deno.env.get("PAYTR_MERCHANT_KEY") ?? "";
  const merchantSalt = Deno.env.get("PAYTR_MERCHANT_SALT") ?? "";
  if (!supabaseUrl || !serviceKey || !anonKey || !merchantId || !merchantKey || !merchantSalt) {
    return localized(req, "en", "SERVER_CONFIG_ERROR", "İade servisi yapılandırılmamış.", "Refund service is not configured.", 503);
  }

  const authorization = req.headers.get("authorization") ?? "";
  const accessToken = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7) : "";
  const admin = createClient(supabaseUrl, serviceKey);
  const actorClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } });

  try {
    const payload = (await req.json()) as Record<string, unknown>;
    const locale: "tr" | "en" = payload.locale === "en" ? "en" : "tr";
    const transactionId = String(payload.transactionId ?? "").trim();
    const amount = Math.round(Number(payload.refundAmount ?? 0) * 100) / 100;
    const lessons = Number(payload.lessonsToRevoke ?? 0);
    const reason = String(payload.reason ?? "").trim().replace(/\s+/g, " ");
    const idempotencyKey = String(payload.idempotencyKey ?? "").trim();

    const { data: actorData, error: authError } = accessToken ? await admin.auth.getUser(accessToken) : { data: { user: null }, error: new Error("missing token") };
    if (authError || !actorData.user) return localized(req, locale, "INVALID_SESSION", "Geçersiz oturum.", "Invalid session.", 401);
    const { data: adminProfile } = await admin.from("admin_profiles").select("active,role").eq("user_id", actorData.user.id).maybeSingle();
    if (actorData.user.app_metadata?.role !== "admin" || !adminProfile?.active || adminProfile.role !== "admin") {
      return localized(req, locale, "ADMIN_REQUIRED", "Bu işlem için yönetici yetkisi gerekir.", "Administrator authorization is required.", 403);
    }
    if (!transactionId || !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(lessons) || lessons <= 0 || reason.length < 3 || idempotencyKey.length < 8) {
      return localized(req, locale, "INVALID_REFUND_REQUEST", "İade tutarı, ders hakkı, neden ve işlem anahtarını kontrol edin.", "Review the refund amount, lesson rights, reason, and request key.");
    }

    const { data: intentData, error: intentError } = await actorClient.rpc("admin_create_payment_refund_intent", {
      p_transaction_id: transactionId,
      p_refund_amount: amount,
      p_lesson_rights_to_revoke: lessons,
      p_reason: reason,
      p_idempotency_key: idempotencyKey,
    });
    const intent = intentData as RpcResult;
    if (intentError || !intent?.success) {
      return localized(req, locale, String(intent?.error_code || "REFUND_INTENT_FAILED"), "İade talebi doğrulanamadı.", "The refund request could not be validated.");
    }
    const refundId = String(intent.refund_id);

    const { data: claimData, error: claimError } = await admin.rpc("claim_payment_refund_provider_call", { p_refund_id: refundId });
    const claim = claimData as RpcResult;
    if (claimError || !claim?.success) return localized(req, locale, "REFUND_CLAIM_FAILED", "İade işlemi kilitlenemedi.", "The refund operation could not be claimed.", 500);

    if (claim.status === "refund_succeeded") {
      return buildJsonResponse({ success: true, already_processed: true, refund_id: refundId }, 200, req);
    }
    if (claim.status === "provider_succeeded") {
      const { data: finalData, error: finalError } = await admin.rpc("finalize_payment_refund", { p_refund_id: refundId });
      const finalized = finalData as RpcResult;
      if (finalError || !finalized?.success) return localized(req, locale, "LOCAL_FINALIZATION_RETRY_REQUIRED", "PayTR iadesi başarılı; yerel kayıt tamamlanmayı bekliyor. Aynı işlem anahtarıyla tekrar deneyin.", "PayTR refund succeeded; local finalization is pending. Retry with the same request key.", 503);
      return buildJsonResponse({ ...finalized, success: true }, 200, req);
    }
    if (claim.status === "refund_failed") return localized(req, locale, "REFUND_PREVIOUSLY_FAILED", "Bu iade denemesi başarısız oldu; yeni bir işlem anahtarıyla yeniden değerlendirin.", "This refund attempt failed; review it with a new request key.", 409);
    if (!claim.claimed && claim.status === "provider_calling") {
      // A prior process may have stopped after PayTR accepted the refund but before
      // local acknowledgement. Query the order; never issue the refund a second time.
      const merchantOid = String(claim.merchant_oid);
      const statusToken = await calculatePaytrStatusToken({ merchantId, merchantOid, merchantSalt, merchantKey });
      const statusBody = new URLSearchParams({ merchant_id: merchantId, merchant_oid: merchantOid, paytr_token: statusToken });
      const statusResponse = await fetch("https://www.paytr.com/odeme/durum-sorgu", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: statusBody.toString() });
      let statusData: Record<string, unknown> = {};
      try { statusData = await statusResponse.json(); } catch { statusData = {}; }
      const returns = Array.isArray(statusData.returns) ? statusData.returns as Array<Record<string, unknown>> : [];
      const reconciledReturn = returns.find((item) =>
        String(item.reference_no ?? "") === String(claim.provider_reference) &&
        Number(item.return_amount ?? -1).toFixed(2) === Number(claim.return_amount).toFixed(2)
      );
      if (statusResponse.ok && statusData.status === "success" && reconciledReturn) {
        const safeReconciliation = { status: "success", reference_no: String(reconciledReturn.reference_no), return_amount: String(reconciledReturn.return_amount ?? claim.return_amount), reconciled: true };
        const { error: markError } = await admin.rpc("mark_payment_refund_provider_succeeded", { p_refund_id: refundId, p_provider_response: safeReconciliation });
        if (!markError) {
          const { data: finalData, error: finalError } = await admin.rpc("finalize_payment_refund", { p_refund_id: refundId });
          const finalized = finalData as RpcResult;
          if (!finalError && finalized?.success) return buildJsonResponse({ ...finalized, success: true, reconciled: true }, 200, req);
        }
      }
      return localized(req, locale, "REFUND_RECONCILIATION_REQUIRED", "PayTR çağrısının sonucu uzlaştırılmayı bekliyor. Sağlayıcı tekrar çağrılmadı.", "The PayTR call requires reconciliation. The provider was not called again.", 409);
    }
    if (!claim.claimed) {
      return localized(req, locale, "REFUND_RECONCILIATION_REQUIRED", "PayTR çağrısının sonucu uzlaştırılmayı bekliyor. Sağlayıcı tekrar çağrılmadı.", "The PayTR call requires reconciliation. The provider was not called again.", 409);
    }

    const merchantOid = String(claim.merchant_oid);
    const returnAmount = Number(claim.return_amount).toFixed(2);
    const providerReference = String(claim.provider_reference);
    const paytrToken = await calculatePaytrRefundToken({ merchantId, merchantOid, returnAmount, merchantSalt, merchantKey });
    const body = new URLSearchParams({
      merchant_id: merchantId,
      merchant_oid: merchantOid,
      return_amount: returnAmount,
      paytr_token: paytrToken,
      reference_no: providerReference,
    });
    const providerResponse = await fetch("https://www.paytr.com/odeme/iade", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    let providerData: Record<string, unknown> = {};
    try { providerData = await providerResponse.json(); } catch { providerData = { status: "error", err_no: "INVALID_RESPONSE" }; }
    const safeProviderData = {
      status: String(providerData.status ?? "error"),
      err_no: providerData.err_no ? String(providerData.err_no).slice(0, 100) : null,
      err_msg: providerData.err_msg ? String(providerData.err_msg).slice(0, 500) : null,
      merchant_oid: providerData.merchant_oid ? String(providerData.merchant_oid) : merchantOid,
      return_amount: providerData.return_amount ? String(providerData.return_amount) : returnAmount,
      reference_no: providerData.reference_no ? String(providerData.reference_no) : providerReference,
      is_test: providerData.is_test ?? null,
    };

    if (!providerResponse.ok || providerData.status !== "success") {
      await admin.rpc("mark_payment_refund_failed", {
        p_refund_id: refundId,
        p_error_code: String(providerData.err_no || `HTTP_${providerResponse.status}`),
        p_error_message: String(providerData.err_msg || "PayTR refund request failed"),
        p_provider_response: safeProviderData,
      });
      return localized(req, locale, "PAYTR_REFUND_FAILED", "PayTR iade işlemini onaylamadı; ders hakları değiştirilmedi.", "PayTR did not approve the refund; lesson rights were not changed.", 502);
    }

    const { error: markError } = await admin.rpc("mark_payment_refund_provider_succeeded", { p_refund_id: refundId, p_provider_response: safeProviderData });
    if (markError) return localized(req, locale, "REFUND_RECONCILIATION_REQUIRED", "PayTR iadesi başarılı; yerel sağlayıcı kaydı uzlaştırılmalı. Sağlayıcıyı tekrar çağırmayın.", "PayTR refund succeeded; the local provider record needs reconciliation. Do not call the provider again.", 503);
    const { data: finalData, error: finalError } = await admin.rpc("finalize_payment_refund", { p_refund_id: refundId });
    const finalized = finalData as RpcResult;
    if (finalError || !finalized?.success) return localized(req, locale, "LOCAL_FINALIZATION_RETRY_REQUIRED", "PayTR iadesi başarılı; ders hakkı güncellemesi aynı işlem anahtarıyla yeniden denenmeli.", "PayTR refund succeeded; retry the lesson-right finalization with the same request key.", 503);
    return buildJsonResponse({ ...finalized, success: true }, 200, req);
  } catch (error) {
    console.error("[paytr-refund] request failed", error instanceof Error ? error.name : "unknown");
    return buildJsonResponse({ success: false, error_code: "INTERNAL_ERROR", message: "Refund request could not be processed." }, 500, req);
  }
});
