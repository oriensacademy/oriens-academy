import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";
import { getBankPaymentProvider } from "../_shared/payments/provider.ts";
import { createStatusCredential, sha256 } from "../_shared/payments/security.ts";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PACKAGE_REGEX = /^[a-z0-9_-]{1,80}$/;

Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;
  try {
    const payload = await req.json() as Record<string, unknown>;
    const packageId = String(payload.packageId ?? "").trim();
    const paymentMethod = String(payload.paymentMethod ?? "");
    const locale = payload.locale === "tr" ? "tr" : "en";
    const payerName = String(payload.payerName ?? "").trim().replace(/\s+/g, " ");
    const payerEmail = String(payload.payerEmail ?? "").trim().toLowerCase();
    const payerPhone = payload.payerPhone ? String(payload.payerPhone).trim() : null;
    const turnstileToken = String(payload.turnstileToken ?? "");

    if (!PACKAGE_REGEX.test(packageId)) return buildJsonResponse({ error_code: "INVALID_PACKAGE", message: "Invalid package." }, 400, req);
    if (paymentMethod !== "card" && paymentMethod !== "bank_transfer") return buildJsonResponse({ error_code: "INVALID_PAYMENT_METHOD", message: "Invalid payment method." }, 400, req);
    if (payerName.length < 2 || payerName.length > 100 || !EMAIL_REGEX.test(payerEmail) || payerEmail.length > 120 || (payerPhone && payerPhone.length > 30)) {
      return buildJsonResponse({ error_code: "INVALID_PAYER", message: "Invalid payer details." }, 400, req);
    }
    if (payload.termsAccepted !== true) return buildJsonResponse({ error_code: "TERMS_REQUIRED", message: "Terms must be accepted." }, 400, req);

    const turnstile = await verifyTurnstile({ token: turnstileToken, expectedAction: "payment_create", remoteIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() });
    if (!turnstile.success) return buildJsonResponse({ error_code: turnstile.errorCode, message: turnstile.message }, turnstile.errorCode === "SERVER_CONFIG_ERROR" ? 500 : 400, req);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) return buildJsonResponse({ error_code: "SERVER_CONFIG_ERROR", message: "Payment service is not configured." }, 500, req);
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: packageRow, error: packageError } = await admin.from("pricing_packages").select("id,current_total,price_amount,currency,lesson_count,purchase_mode,active").eq("id", packageId).eq("active", true).maybeSingle();
    if (packageError || !packageRow || packageRow.purchase_mode !== "purchasable") return buildJsonResponse({ error_code: "PACKAGE_NOT_PURCHASABLE", message: "Package is not available for online purchase." }, 400, req);
    const amount = Number(packageRow.current_total ?? packageRow.price_amount);
    const currency = String(packageRow.currency ?? "").trim().toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || !packageRow.lesson_count || !/^[A-Z]{3}$/.test(currency)) return buildJsonResponse({ error_code: "PACKAGE_NOT_CONFIGURED", message: "Package payment data is incomplete." }, 400, req);

    const provider = getBankPaymentProvider();
    if (paymentMethod === "card") {
      if (!provider.capabilities.configured || (!provider.capabilities.hostedPayment && !provider.capabilities.tokenizedPayment)) {
        return buildJsonResponse({ error_code: "PENDING_BANK_CREDENTIALS", message: "Card payment provider is not configured.", capabilities: provider.capabilities }, 503, req);
      }
    }

    const { token, reference } = createStatusCredential();
    const statusTokenHash = await sha256(token);
    const authorization = req.headers.get("authorization") ?? "";
    const accessToken = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7) : "";
    const { data: userData } = accessToken ? await admin.auth.getUser(accessToken) : { data: { user: null } };
    let studentUserId: string | null = null;
    if (userData.user && userData.user.app_metadata?.role !== "admin") {
      const { data: studentProfile } = await admin.from("student_profiles").select("id,email,active").eq("id", userData.user.id).maybeSingle();
      if (studentProfile?.active && studentProfile.email.toLowerCase() === payerEmail) studentUserId = userData.user.id;
    }

    const { data: transaction, error: insertError } = await admin.from("payment_transactions").insert({
      student_user_id: studentUserId,
      package_id: packageId,
      public_reference: reference,
      status_token_hash: statusTokenHash,
      provider: paymentMethod === "bank_transfer" ? "manual_bank_transfer" : provider.id,
      amount,
      currency,
      status: "pending",
      payment_method: paymentMethod,
      payer_name: payerName,
      payer_email: payerEmail,
      payer_phone: payerPhone,
      metadata: { locale, terms_version: "2026-08-22" },
    }).select("id").single();
    if (insertError || !transaction) return buildJsonResponse({ error_code: "PAYMENT_CREATE_FAILED", message: "Payment could not be created." }, 500, req);

    if (paymentMethod === "card") {
      const publicSiteUrl = (Deno.env.get("PUBLIC_SITE_URL") ?? "").replace(/\/$/, "");
      if (!publicSiteUrl.startsWith("https://")) {
        await admin.from("payment_transactions").update({ status: "failed" }).eq("id", transaction.id);
        return buildJsonResponse({ error_code: "SERVER_CONFIG_ERROR", message: "Secure payment return URL is not configured." }, 500, req);
      }
      try {
        const created = await provider.createPayment({
          internalReference: reference,
          amount,
          currency,
          returnUrl: `${publicSiteUrl}/${locale === "tr" ? "tr/odeme/sonuc" : "en/payment/result"}?reference=${encodeURIComponent(reference)}&token=${encodeURIComponent(token)}`,
          callbackUrl: `${supabaseUrl}/functions/v1/payment-callback`,
        });
        const redirect = new URL(created.redirectUrl);
        if (redirect.protocol !== "https:" || !created.providerTransactionId || !["requires_action", "processing"].includes(created.status)) {
          throw new Error("Invalid provider payment session");
        }
        await admin.from("payment_transactions").update({ provider_transaction_id: created.providerTransactionId, status: created.status }).eq("id", transaction.id);
        return buildJsonResponse({ success: true, reference, statusToken: token, status: created.status, paymentMethod, redirectUrl: redirect.toString() }, 201, req);
      } catch {
        await admin.from("payment_transactions").update({ status: "failed" }).eq("id", transaction.id);
        return buildJsonResponse({ error_code: "PROVIDER_CREATE_FAILED", message: "The bank payment session could not be created." }, 502, req);
      }
    }

    return buildJsonResponse({ success: true, reference, statusToken: token, status: "pending", paymentMethod }, 201, req);
  } catch {
    return buildJsonResponse({ error_code: "INTERNAL_ERROR", message: "Payment request could not be processed." }, 500, req);
  }
});
