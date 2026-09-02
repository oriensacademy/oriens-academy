import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { sha256 } from "../_shared/payments/security.ts";

const REFERENCE_REGEX = /^OA-[A-Z0-9]+-[A-F0-9]{6}$/;
const TOKEN_REGEX = /^[a-f0-9]{64}$/;

Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;
  try {
    const payload = await req.json() as Record<string, unknown>;
    const reference = String(payload.reference ?? "").trim().toUpperCase();
    const token = String(payload.statusToken ?? "").trim().toLowerCase();
    if (!REFERENCE_REGEX.test(reference) || !TOKEN_REGEX.test(token)) return buildJsonResponse({ error_code: "INVALID_STATUS_CREDENTIALS", message: "Invalid payment status credentials." }, 400, req);
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) return buildJsonResponse({ error_code: "SERVER_CONFIG_ERROR", message: "Payment service is not configured." }, 500, req);
    const admin = createClient(supabaseUrl, serviceKey);
    const tokenHash = await sha256(token);
    const { data, error } = await admin
      .from("payment_transactions")
      .select("public_reference,package_id,amount,currency,status,payment_method,provider,created_at,paid_at,metadata")
      .eq("public_reference", reference)
      .eq("status_token_hash", tokenHash)
      .maybeSingle();

    if (error || !data) return buildJsonResponse({ error_code: "PAYMENT_NOT_FOUND", message: "Payment could not be verified." }, 404, req);

    const meta = (data.metadata ?? {}) as Record<string, unknown>;
    const packageIds = Array.isArray(meta.package_ids)
      ? (meta.package_ids as unknown[]).map((id) => String(id).trim()).filter(Boolean)
      : [String(data.package_id)];

    return buildJsonResponse({
      success: true,
      payment: {
        reference: data.public_reference,
        packageId: data.package_id,
        packageIds,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        statusReason: meta.status_reason || null,
        paymentMethod: data.payment_method,
        provider: data.provider,
        createdAt: data.created_at,
        paidAt: data.paid_at,
      },
    }, 200, req);
  } catch {
    return buildJsonResponse({ error_code: "INTERNAL_ERROR", message: "Payment status could not be verified." }, 500, req);
  }
});
