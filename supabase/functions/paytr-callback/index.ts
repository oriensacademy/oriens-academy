import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  parsePaytrCallbackBody,
  verifyPaytrCallbackHash,
} from "../_shared/payments/paytr.ts";
import { recordPaymentAuditEvent } from "../_shared/payments/audit.ts";
import { getSupabaseAdminKey } from "../_shared/supabase-admin.ts";

/**
 * PayTR iFrame API Callback / Notification Endpoint
 *
 * Official PayTR Specification:
 * - Public HTTPS POST endpoint
 * - No user session or Supabase JWT auth
 * - Validates HMAC-SHA256 signature using merchant secrets
 * - Idempotent order lookup & status update
 * - Returns exactly "OK" in plain text on successful processing
 */
Deno.serve(async (req: Request) => {
  // 1. Method check: PayTR callbacks MUST be POST
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        Allow: "POST",
      },
    });
  }

  // 2. Secret validation: PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY & PAYTR_MERCHANT_SALT
  const merchantId = Deno.env.get("PAYTR_MERCHANT_ID") ?? "";
  const merchantKey = Deno.env.get("PAYTR_MERCHANT_KEY") ?? "";
  const merchantSalt = Deno.env.get("PAYTR_MERCHANT_SALT") ?? "";

  if (!merchantKey || !merchantSalt || !merchantId) {
    console.error(
      "[paytr-callback] Configuration error: Required PayTR secrets (PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY and/or PAYTR_MERCHANT_SALT) are not configured."
    );
    return new Response(
      "PAYTR_CALLBACK_CONFIG_ERROR: Merchant credentials not configured",
      {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }
    );
  }

  // 3. Supabase admin credentials check
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = getSupabaseAdminKey();
  if (!supabaseUrl || !serviceKey) {
    console.error(
      "[paytr-callback] Configuration error: Supabase service credentials missing."
    );
    return new Response("SERVER_CONFIG_ERROR: Database service not configured", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    // 4. Parse request payload safely
    const payload = await parsePaytrCallbackBody(req);
    const merchantOid = String(payload.merchant_oid ?? "").trim();
    const status = String(payload.status ?? "").trim().toLowerCase();
    const totalAmount = String(payload.total_amount ?? "").trim();
    const hash = String(payload.hash ?? "").trim();

    if (!merchantOid || !status || !totalAmount || !hash) {
      console.warn(
        `[paytr-callback] Bad request: Missing required callback parameters (merchant_oid: ${merchantOid || "missing"}, status: ${status || "missing"})`
      );
      return new Response(
        "PAYTR_CALLBACK_BAD_REQUEST: Missing required parameters",
        {
          status: 400,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }
      );
    }

    // 5. Official Hash Verification
    const isValidHash = await verifyPaytrCallbackHash({
      merchantOid,
      merchantSalt,
      merchantKey,
      status,
      totalAmount,
      hash,
    });

    if (!isValidHash) {
      console.warn(
        `[paytr-callback] Security Alert: Invalid callback hash for merchant_oid: ${merchantOid}`
      );
      await recordPaymentAuditEvent(admin, {
        action: "paytr_callback_hash_invalid",
        publicReference: merchantOid,
        severity: "CRITICAL",
        metadata: {
          merchant_oid: merchantOid,
          timestamp: new Date().toISOString(),
        },
      });
      return new Response("PAYTR_CALLBACK_FAILED: Invalid signature", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Only authenticated PayTR callbacks are allowed into the operational
    // audit stream. Logging before signature verification lets arbitrary
    // internet traffic create fake payment references and audit noise.
    await recordPaymentAuditEvent(admin, {
      action: "paytr_callback_received",
      publicReference: merchantOid,
      severity: "INFO",
      dedupe: true,
      metadata: {
        merchant_oid: merchantOid,
        provider_status: status,
        total_amount: totalAmount,
        payment_type: payload.payment_type || null,
        currency: payload.currency || null,
        test_mode: payload.test_mode || null,
        failed_reason_code: payload.failed_reason_code || null,
        failed_reason_msg: payload.failed_reason_msg || null,
      },
    });

    // 6. DB Execution via atomic & idempotent RPC
    const safePaytrMetadata = {
      status,
      total_amount: totalAmount,
      payment_type: payload.payment_type || null,
      currency: payload.currency || null,
      payment_amount: payload.payment_amount || null,
      failed_reason_code: payload.failed_reason_code || null,
      failed_reason_msg: payload.failed_reason_msg || null,
      test_mode: payload.test_mode || null,
      received_at: new Date().toISOString(),
    };

    const paymentAmountKurus = payload.payment_amount ? String(payload.payment_amount).trim() : null;

    const { data: rpcResult, error: rpcError } = await admin.rpc(
      "finalize_paytr_payment",
      {
        p_merchant_oid: merchantOid,
        p_status: status,
        p_total_amount: Number(totalAmount) / 100,
        p_paytr_payload: safePaytrMetadata,
        p_payment_amount: paymentAmountKurus ? Number(paymentAmountKurus) / 100 : null,
      }
    );

    if (rpcError || !rpcResult || rpcResult.success !== true) {
      console.error(
        `[paytr-callback] RPC finalize_paytr_payment error for merchant_oid: ${merchantOid}`,
        rpcError || rpcResult
      );

      const isNotFound = rpcResult?.error_code === "TRANSACTION_NOT_FOUND";
      const isAmountMismatch = rpcResult?.error_code === "AMOUNT_MISMATCH";

      if (isNotFound) {
        await recordPaymentAuditEvent(admin, {
          action: "paytr_callback_transaction_not_found",
          publicReference: merchantOid,
          severity: "ERROR",
          dedupe: true,
          metadata: {
            merchant_oid: merchantOid,
            provider_status: status,
          },
        });

        // The signature is valid, so this is an authentic provider callback
        // for an order that no longer exists locally (typically a cleaned-up
        // QA token session). PayTR retries every non-OK response. Acknowledge
        // this terminal orphan exactly as required by the provider protocol;
        // no payment is finalized and no entitlement is granted.
        return new Response("OK", {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      } else if (isAmountMismatch) {
        await recordPaymentAuditEvent(admin, {
          action: "paytr_callback_amount_mismatch",
          publicReference: merchantOid,
          severity: "CRITICAL",
          metadata: {
            merchant_oid: merchantOid,
            received_amount_kurus: totalAmount,
            message: rpcResult?.message,
          },
        });
      }

      return new Response(
        `PAYTR_CALLBACK_ERROR: ${rpcResult?.message || "Payment finalization failed"}`,
        {
          status: isNotFound ? 404 : 500,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }
      );
    }

    // 7. Idempotency handling: If transaction was already paid
    if (rpcResult.already_paid === true) {
      console.log(
        `[paytr-callback] Duplicate callback acknowledged. Merchant OID: ${merchantOid} was already finalized.`
      );
      return new Response("OK", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // 8. Audit logging for final outcome: payment_completed or payment_failed
    if (status === "success") {
      console.log(
        `[paytr-callback] Payment successful for merchant_oid: ${merchantOid}, transaction: ${rpcResult.transaction_id}`
      );
      await recordPaymentAuditEvent(admin, {
        action: "payment_completed",
        publicReference: merchantOid,
        transactionId: rpcResult.transaction_id,
        severity: "INFO",
        metadata: {
          transaction_id: rpcResult.transaction_id,
          public_reference: merchantOid,
          amount_kurus: Math.round(Number(rpcResult.amount ?? (Number(totalAmount) / 100)) * 100),
          currency: rpcResult.currency || payload.currency || "TRY",
          package_purchase_id: rpcResult.purchase_id || null,
          coupon_used: Boolean(rpcResult.coupon_id),
        },
      });
    } else {
      console.log(
        `[paytr-callback] Payment failed notification received for merchant_oid: ${merchantOid}, reason: ${payload.failed_reason_msg || "N/A"}`
      );
      const isCode6 = String(payload.failed_reason_code ?? "") === "6";
      await recordPaymentAuditEvent(admin, {
        action: "payment_failed",
        publicReference: merchantOid,
        transactionId: rpcResult.transaction_id,
        severity: isCode6 ? "WARNING" : "ERROR",
        metadata: {
          transaction_id: rpcResult.transaction_id,
          public_reference: merchantOid,
          failed_reason_code: payload.failed_reason_code || null,
          failed_reason_msg: payload.failed_reason_msg || null,
          failure_type: isCode6 ? "timeout_or_user_left" : "provider_declined",
          amount_kurus: Number(totalAmount),
          provider: "paytr",
        },
      });
    }

    // 9. Exact PayTR response: OK
    return new Response("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[paytr-callback] Unexpected callback execution error:", err);
    return new Response("PAYTR_CALLBACK_INTERNAL_ERROR", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});
