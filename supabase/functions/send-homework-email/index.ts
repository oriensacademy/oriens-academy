import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;

  // MAIL-032..036 decommissioned: Return safe disabled success
  return buildJsonResponse(
    {
      success: true,
      disabled: true,
      message: "Homework email notifications (MAIL-032..036) have been decommissioned.",
    },
    200,
    req
  );
});
