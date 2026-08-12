import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handlePreflight, buildJsonResponse, isAllowedOrigin } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  if (origin && !isAllowedOrigin(origin)) {
    return buildJsonResponse(
      { error_code: "FORBIDDEN_ORIGIN", message: "Forbidden request origin." },
      403,
      req
    );
  }

  if (req.method !== "GET") {
    return buildJsonResponse(
      { error_code: "METHOD_NOT_ALLOWED", message: `Method ${req.method} not allowed.` },
      405,
      req,
      { Allow: "GET, OPTIONS" }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY") ??
      "";

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const nowIso = new Date().toISOString();
    const maxHorizonIso = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("availability_slots")
      .select("id, starts_at, ends_at")
      .eq("status", "available")
      .gt("starts_at", nowIso)
      .lt("starts_at", maxHorizonIso)
      .order("starts_at", { ascending: true })
      .limit(100);

    if (error) {
      return buildJsonResponse(
        { error_code: "FETCH_FAILED", message: "Failed to fetch availability slots." },
        500,
        req
      );
    }

    const safeSlots = (data || []).map((slot) => ({
      id: slot.id,
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
    }));

    return buildJsonResponse(
      { slots: safeSlots },
      200,
      req,
      { "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120" }
    );
  } catch (err) {
    console.error("[booking-availability] Unexpected error:", err);
    return buildJsonResponse(
      { error_code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
      500,
      req
    );
  }
});
