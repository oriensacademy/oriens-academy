import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, handlePreflight } from "../_shared/cors.ts";
import { getBankPaymentProvider } from "../_shared/payments/provider.ts";

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return buildJsonResponse({ error_code: "METHOD_NOT_ALLOWED", message: "Method not allowed." }, 405, req, { Allow: "POST, OPTIONS" });
  const provider = getBankPaymentProvider();
  if (!provider.capabilities.configured) return buildJsonResponse({ error_code: "PENDING_BANK_CREDENTIALS", message: "Bank callback verification is not configured." }, 503, req);
  try {
    // The provider implementation must validate the bank signature and must
    // return only verified, normalized fields. Never log the callback body.
    const verified = await provider.handle3DSecureCallback(req.clone());
    if (!verified.verified) return buildJsonResponse({ error_code: "CALLBACK_NOT_VERIFIED", message: "Callback verification failed." }, 400, req);
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) return buildJsonResponse({ error_code: "SERVER_CONFIG_ERROR", message: "Payment service is not configured." }, 500, req);
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: existing, error: lookupError } = await admin.from("payment_transactions")
      .select("id,status,provider,provider_transaction_id")
      .eq("public_reference", verified.internalReference)
      .eq("provider", provider.id)
      .maybeSingle();
    if (lookupError || !existing) return buildJsonResponse({ error_code: "PAYMENT_NOT_FOUND", message: "Verified payment reference was not found." }, 404, req);
    if (existing.provider_transaction_id && existing.provider_transaction_id !== verified.providerTransactionId) {
      return buildJsonResponse({ error_code: "TRANSACTION_REFERENCE_MISMATCH", message: "Verified bank transaction does not match the payment session." }, 409, req);
    }
    if (existing.status === "paid" && verified.status !== "paid") {
      return buildJsonResponse({ error_code: "INVALID_STATUS_TRANSITION", message: "A paid transaction cannot be downgraded by a later callback." }, 409, req);
    }
    const update = { status: verified.status, provider_transaction_id: verified.providerTransactionId, paid_at: verified.status === "paid" ? new Date().toISOString() : null };
    const { data: transaction, error } = await admin.from("payment_transactions").update(update).eq("id", existing.id).select("id").single();
    if (error || !transaction) return buildJsonResponse({ error_code: "PAYMENT_UPDATE_FAILED", message: "Verified transaction could not be updated." }, 500, req);
    if (verified.status === "paid") {
      const { error: activationError } = await admin.rpc("activate_paid_package", { p_payment_id: transaction.id });
      if (activationError) return buildJsonResponse({ error_code: "PACKAGE_ACTIVATION_FAILED", message: "Payment verified; package activation requires review." }, 500, req);

      try {
        const { data: fullTx } = await admin.from("payment_transactions").select("id,public_reference,payer_name,payer_email,payer_phone,package_id,amount,currency,payment_method,metadata").eq("id", transaction.id).single();
        if (fullTx?.payer_email) {
          const { dispatchPaymentSuccessEmail, dispatchAdminPaymentAlert } = await import("../_shared/email/service.ts");
          Promise.allSettled([
            dispatchPaymentSuccessEmail(admin, {
              paymentReference: fullTx.public_reference,
              studentName: fullTx.payer_name || "Öğrenci",
              studentEmail: fullTx.payer_email,
              packageName: fullTx.package_id,
              amountPaid: Number(fullTx.amount),
              currency: fullTx.currency,
              paymentMethod: fullTx.payment_method,
              paidAt: new Date().toISOString(),
              locale: (fullTx.metadata as Record<string, string>)?.locale === "en" ? "en" : "tr",
            }),
            dispatchAdminPaymentAlert(admin, {
              paymentReference: fullTx.public_reference,
              payerName: fullTx.payer_name || "Öğrenci",
              payerEmail: fullTx.payer_email,
              payerPhone: fullTx.payer_phone,
              packageName: fullTx.package_id,
              amount: Number(fullTx.amount),
              currency: fullTx.currency,
              paymentMethod: fullTx.payment_method,
              status: "paid",
              createdAt: new Date().toISOString(),
              locale: (fullTx.metadata as Record<string, string>)?.locale === "en" ? "en" : "tr",
            }),
          ]).catch((err) => console.error("[payment-callback] Email dispatch background error:", err));
        }
      } catch (emailErr) {
        console.error("[payment-callback] Failed to dispatch success email:", emailErr);
      }
    }
    return buildJsonResponse({ success: true }, 200, req);
  } catch {
    return buildJsonResponse({ error_code: "CALLBACK_VERIFICATION_FAILED", message: "Callback could not be verified." }, 502, req);
  }
});
