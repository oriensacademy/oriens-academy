import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";

/**
 * DECOMMISSIONED.
 *
 * The student support/ticket system (support_threads / support_messages and the
 * student_support_confirmation email) was removed -- see
 * 20260905150000_remove_student_support_ticket_system.sql. The public contact
 * form (create-contact / send-contact-reply) is unaffected and stays active.
 *
 * This stub stays only so any still-deployed caller gets a safe, non-erroring
 * response. The function should be removed from the project entirely
 * (supabase functions delete send-support-email).
 */
Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;

  return buildJsonResponse(
    {
      success: true,
      disabled: true,
      message: "Student support ticket emails have been decommissioned.",
    },
    200,
    req
  );
});
