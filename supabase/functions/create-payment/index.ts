import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";

/**
 * Retained as a compatibility endpoint so old clients receive an explicit safe response.
 * New customer payments are created only by paytr-create-token, which resolves verified
 * guardian identity and linked learner ownership server-side.
 */
Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;
  let paymentMethod = "";
  let locale: "tr" | "en" = "tr";
  try {
    const payload = (await req.json()) as Record<string, unknown>;
    paymentMethod = String(payload.paymentMethod ?? "");
    locale = payload.locale === "en" ? "en" : "tr";
  } catch {
    return buildJsonResponse({ error_code: "INVALID_REQUEST", message: "Invalid request." }, 400, req);
  }
  return buildJsonResponse({
    error_code: paymentMethod === "bank_transfer" ? "BANK_TRANSFER_DISABLED" : "USE_AUTHENTICATED_PAYTR_CHECKOUT",
    message: locale === "tr"
      ? "Yeni ödemeler yalnızca doğrulanmış Veli Hesabı ile PayTR kart ekranından başlatılabilir."
      : "New payments must use the authenticated Parent Account PayTR card checkout.",
  }, 409, req);
});
