import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import {
  parseTcmbEurForexSelling,
  TCMB_DAILY_RATES_URL,
} from "../_shared/tcmb-parser.mjs";
import { getSupabasePublishableKey } from "../_shared/supabase-admin.ts";

const CACHE_MS = 45 * 60 * 1000;
const TIMEOUT_MS = 7000;
let lastValid: ({ rate: number; rateType: "ForexSelling"; sourceDate: string; fetchedAt: string } & { cached?: boolean }) | null = null;

Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = getSupabasePublishableKey();
  const authorization = req.headers.get("authorization") || "";
  if (!url || !anonKey || !authorization) return buildJsonResponse({ error_code: "SERVER_CONFIG_ERROR" }, 500, req);

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [{ data: userData, error: userError }, { data: isAdmin }] = await Promise.all([
    caller.auth.getUser(),
    caller.rpc("is_admin"),
  ]);
  if (userError || !userData.user) return buildJsonResponse({ error_code: "UNAUTHORIZED" }, 401, req);
  if (!isAdmin) return buildJsonResponse({ error_code: "FORBIDDEN" }, 403, req);

  const body = await req.json().catch(() => ({}));
  const forceRefresh = body?.forceRefresh === true;
  const now = Date.now();
  if (!forceRefresh && lastValid && now - Date.parse(lastValid.fetchedAt) < CACHE_MS) {
    return buildJsonResponse({ success: true, rate: { ...lastValid, cached: true } }, 200, req);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(TCMB_DAILY_RATES_URL, {
      signal: controller.signal,
      headers: { Accept: "application/xml,text/xml" },
    });
    if (!response.ok) throw new Error("TCMB_UPSTREAM_ERROR");
    const parsed = parseTcmbEurForexSelling(await response.text());
    lastValid = {
      rate: parsed.rate,
      rateType: "ForexSelling",
      sourceDate: parsed.sourceDate,
      fetchedAt: new Date(now).toISOString(),
    };
    return buildJsonResponse({ success: true, rate: { ...lastValid, cached: false } }, 200, req);
  } catch {
    if (lastValid) {
      return buildJsonResponse({ success: true, rate: { ...lastValid, cached: true }, stale: true }, 200, req);
    }
    return buildJsonResponse({ success: false, error_code: "TCMB_RATE_UNAVAILABLE" }, 503, req);
  } finally {
    clearTimeout(timeout);
  }
});
