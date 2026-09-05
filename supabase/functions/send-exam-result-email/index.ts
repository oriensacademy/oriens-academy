import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;

  // MAIL-037 decommissioned: Return safe disabled success
  return buildJsonResponse(
    {
      success: true,
      disabled: true,
      message: "Exam result email notification (MAIL-037) has been decommissioned.",
    },
    200,
    req
  );
});
