import { buildJsonResponse, handlePreflight } from "../_shared/cors.ts";

// Legacy bank/3DS callback compatibility endpoint. Customer payments are PayTR-only;
// accepting this old two-step update/activation path would bypass the canonical,
// atomic PayTR finalizer and its durable notification outbox.
Deno.serve((req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  return buildJsonResponse({
    error_code: "LEGACY_PAYMENT_CALLBACK_DISABLED",
    message: "Customer payments are finalized only through the verified PayTR callback.",
  }, 409, req, { Allow: "POST, OPTIONS" });
});
