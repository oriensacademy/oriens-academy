import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { isValidPaymentReference, sha256, STATUS_TOKEN_REGEX } from "../_shared/payments/security.ts";
import { recordPaymentAuditEvent } from "../_shared/payments/audit.ts";
import { getSupabaseAdminKey } from "../_shared/supabase-admin.ts";

Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;
  try {
    const payload = (await req.json()) as Record<string, unknown>;
    const reference = String(payload.reference ?? "").trim().toUpperCase();
    const token = String(payload.statusToken ?? payload.token ?? "").trim().toLowerCase();
    const clientEvent = payload.clientEvent ? String(payload.clientEvent).trim() : null;

    if (!isValidPaymentReference(reference) || !STATUS_TOKEN_REGEX.test(token)) {
      return buildJsonResponse({ error_code: "INVALID_STATUS_CREDENTIALS", message: "Invalid payment status credentials." }, 400, req);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseAdminKey();
    if (!supabaseUrl || !serviceKey) return buildJsonResponse({ error_code: "SERVER_CONFIG_ERROR", message: "Payment service is not configured." }, 500, req);
    const admin = createClient(supabaseUrl, serviceKey);
    const tokenHash = await sha256(token);
    const { data, error } = await admin
      .from("payment_transactions")
      .select("id,public_reference,package_id,amount,currency,status,payment_method,provider,created_at,updated_at,paid_at,metadata")
      .eq("public_reference", reference)
      .eq("status_token_hash", tokenHash)
      .maybeSingle();

    if (error || !data) {
      await recordPaymentAuditEvent(admin, {
        action: "payment_status_verification_error",
        publicReference: reference,
        severity: "ERROR",
        dedupe: true,
        metadata: {
          public_reference: reference,
          error_code: "PAYMENT_NOT_FOUND",
        },
      });
      return buildJsonResponse({ error_code: "PAYMENT_NOT_FOUND", message: "Payment could not be verified." }, 404, req);
    }

    const meta = (data.metadata ?? {}) as Record<string, unknown>;
    const packageIds = Array.isArray(meta.package_ids)
      ? (meta.package_ids as unknown[]).map((id) => String(id).trim()).filter(Boolean)
      : [String(data.package_id)];
    const checkoutItems = Array.isArray(meta.checkout_items)
      ? (meta.checkout_items as Array<Record<string, unknown>>)
      : [];
    const packageNames = checkoutItems
      .map((item) => {
        const count = Number(item.lesson_count ?? 0);
        return Number.isInteger(count) && count > 0 ? `${count} Ders` : "";
      })
      .filter(Boolean);
    const technicalPackageId = String(data.package_id ?? "").trim();
    const technicalCountMatch = technicalPackageId.match(/(?:package|pkg)?(\d+)$/i);
    const inferredTechnicalCount = technicalPackageId.toLowerCase() === "single"
      ? 1
      : technicalCountMatch
        ? Number(technicalCountMatch[1])
        : undefined;
    const lessonCount = Number(meta.lesson_count ?? meta.total_lessons ?? 0) || inferredTechnicalCount;
    const packageName = packageNames.join(", ")
      || (lessonCount ? `${lessonCount} Ders` : "Ders Paketi");
    const subtotalAmount = Number(meta.base_amount ?? data.amount);
    const discountAmount = Number(meta.discount_amount ?? 0);
    const couponCode = meta.coupon_code ? String(meta.coupon_code) : null;

    const statusReason = (meta.status_reason || meta.failed_reason_msg || meta.failure_reason || null) as string | null;
    const failureCode = (meta.failed_reason_code ? String(meta.failed_reason_code) : null) as string | null;

    // Handle client-reported events safely (e.g. paytr_iframe_opened, payment_success_return_reached, payment_failure_return_reached)
    if (clientEvent) {
      const allowedClientEvents = [
        "paytr_iframe_opened",
        "payment_success_return_reached",
        "payment_failure_return_reached",
      ];
      if (allowedClientEvents.includes(clientEvent)) {
        await recordPaymentAuditEvent(admin, {
          action: clientEvent,
          publicReference: reference,
          transactionId: data.id,
          severity: clientEvent === "payment_failure_return_reached" ? "WARNING" : "INFO",
          dedupe: true,
          metadata: {
            transaction_id: data.id,
            public_reference: reference,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Record status transition event with deduplication so polling loops never create log spam
    const transitionAction = `payment_status_${data.status}`;
    await recordPaymentAuditEvent(admin, {
      action: transitionAction,
      publicReference: reference,
      transactionId: data.id,
      severity: data.status === "failed" ? "WARNING" : "INFO",
      dedupe: true,
      metadata: {
        transaction_id: data.id,
        public_reference: reference,
        status: data.status,
        amount_kurus: Math.round(Number(data.amount) * 100),
        currency: data.currency,
        failure_code: failureCode,
        failure_reason: statusReason,
      },
    });

    return buildJsonResponse({
      success: true,
      payment: {
        reference: data.public_reference,
        packageId: data.package_id,
        packageIds,
        packageName,
        packageNames,
        lessonCount,
        amount: data.amount,
        subtotalAmount,
        discountAmount,
        couponCode,
        currency: data.currency,
        status: data.status,
        statusReason,
        failureCode,
        paymentMethod: data.payment_method,
        provider: data.provider,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        paidAt: data.paid_at,
      },
    }, 200, req);
  } catch {
    return buildJsonResponse({ error_code: "INTERNAL_ERROR", message: "Payment status could not be verified." }, 500, req);
  }
});
