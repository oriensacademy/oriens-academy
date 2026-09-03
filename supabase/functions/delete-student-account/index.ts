import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";

/**
 * Self-service account deletion/anonymization.
 *
 * Requires the caller's own bearer token (self-delete only, no service-role/admin
 * bypass). Password is re-verified server-side via signInWithPassword on a throwaway
 * anon-key client -- never trusted from the client alone, never logged, never written
 * anywhere. Only after that succeeds does the caller-scoped RPC run, which performs the
 * actual public-schema mutation (delete or anonymize, decided by whether any
 * purchase/payment history exists) and returns which mode it took.
 */
Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("[delete-student-account] Required server configuration is missing.");
    return buildJsonResponse({ error_code: "SERVER_CONFIG_ERROR", message: "Server configuration error." }, 503, req);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return buildJsonResponse({ error_code: "UNAUTHORIZED", message: "Oturum açmanız gerekmektedir." }, 401, req);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return buildJsonResponse({ error_code: "INVALID_REQUEST", message: "Geçersiz istek formatı." }, 400, req);
  }

  const locale: "tr" | "en" = payload.locale === "en" ? "en" : "tr";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!password) {
    return buildJsonResponse(
      { error_code: "PASSWORD_REQUIRED", message: locale === "tr" ? "Şifre gereklidir." : "Password is required." },
      400,
      req
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // 1. Resolve caller identity from their own bearer token.
  const { data: callerData, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !callerData?.user) {
    return buildJsonResponse(
      { error_code: "UNAUTHORIZED", message: locale === "tr" ? "Geçersiz oturum." : "Invalid session." },
      401,
      req
    );
  }
  const caller = callerData.user;

  // Idempotent-retry guard: an already scrubbed/banned account can't be deleted again.
  const alreadyDeleted =
    Boolean(caller.banned_until && new Date(caller.banned_until).getTime() > Date.now()) ||
    (caller.email || "").endsWith("@deleted.oriens-academy.invalid");
  if (alreadyDeleted) {
    return buildJsonResponse(
      { error_code: "ACCOUNT_ALREADY_DELETED", message: locale === "tr" ? "Bu hesap zaten silinmiş." : "This account has already been deleted." },
      401,
      req
    );
  }

  const callerEmail = caller.email || "";
  if (!callerEmail) {
    return buildJsonResponse({ error_code: "UNAUTHORIZED", message: "Invalid session." }, 401, req);
  }

  // 2. Server-side password re-authentication on a throwaway anon-key client.
  // Never logged, never persisted, never compared via a service-role shortcut.
  const reauthClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: reauthData, error: reauthError } = await reauthClient.auth.signInWithPassword({
    email: callerEmail,
    password,
  });

  if (reauthError || !reauthData?.user || reauthData.user.id !== caller.id) {
    return buildJsonResponse(
      {
        error_code: "INVALID_CREDENTIALS",
        message: locale === "tr" ? "Şifreniz doğrulanamadı." : "Your password could not be verified.",
      },
      401,
      req
    );
  }

  // 3. Run the deletion/anonymization RPC as the caller (auth.uid() resolves from
  // their own token), so it is architecturally impossible to act on another account.
  const callerScopedClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: rpcData, error: rpcError } = await callerScopedClient.rpc("delete_or_anonymize_own_account");
  if (rpcError) {
    console.error("[delete-student-account] RPC error:", rpcError.message);
    return buildJsonResponse(
      { error_code: "INTERNAL_ERROR", message: locale === "tr" ? "Üyelik silme işlemi gerçekleştirilemedi." : "Your account could not be deleted." },
      500,
      req
    );
  }

  const result = rpcData as { success?: boolean; error_code?: string; mode?: "deleted" | "anonymized" } | null;

  if (!result?.success) {
    if (result?.error_code === "ACTIVE_ENTITLEMENT_EXISTS") {
      return buildJsonResponse(
        {
          error_code: "ACTIVE_ENTITLEMENT_EXISTS",
          message: locale === "tr"
            ? "Aktif ders hakkınız, yaklaşan dersiniz veya devam eden bir ödeme/iade işleminiz bulunduğu için hesabınızı şu anda silemezsiniz. Yardım için bizimle iletişime geçin."
            : "Your account cannot be deleted right now because you have active lesson rights, an upcoming lesson, or an in-progress payment/refund. Please contact us for help.",
        },
        409,
        req
      );
    }
    return buildJsonResponse(
      { error_code: result?.error_code || "INTERNAL_ERROR", message: locale === "tr" ? "Üyelik silme işlemi gerçekleştirilemedi." : "Your account could not be deleted." },
      500,
      req
    );
  }

  // 4. Only now touch the GoTrue auth account, using the service-role client.
  try {
    if (result.mode === "deleted") {
      await admin.auth.admin.deleteUser(caller.id);
    } else {
      const randomPassword = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      await admin.auth.admin.updateUserById(caller.id, {
        email: `deleted+${caller.id}@deleted.oriens-academy.invalid`,
        password: randomPassword,
        ban_duration: "87600h",
        user_metadata: {},
      });
    }
  } catch (err) {
    console.error("[delete-student-account] Auth account finalization failed:", err instanceof Error ? err.message : "unknown");
    // Public-schema data is already anonymized/removed at this point; the auth row
    // finalization failure is logged for manual follow-up but not surfaced as a
    // rollback (there is nothing left to roll back to).
  }

  // Best-effort session revocation for the token used in this request.
  try {
    await admin.auth.admin.signOut(token, "global");
  } catch {
    // Non-fatal; the access token will still expire naturally.
  }

  return buildJsonResponse({ success: true, mode: result.mode }, 200, req);
});
