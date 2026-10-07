/** Resolve the hosted project's named secret API key without touching legacy service-role JWTs. */
export function getSupabaseAdminKey(name = "default"): string {
  const serialized = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  if (serialized) {
    try {
      const keys = JSON.parse(serialized) as Record<string, unknown>;
      const key = keys[name];
      if (typeof key === "string" && key.startsWith("sb_secret_")) return key;
    } catch {
      // The explicit single-key variable below remains useful for local tooling.
    }
  }
  const single = Deno.env.get("SUPABASE_SECRET_KEY") || "";
  if (single.startsWith("sb_secret_")) return single;
  return "";
}

export function getSupabasePublishableKey(name = "default"): string {
  const serialized = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "";
  if (serialized) {
    try {
      const keys = JSON.parse(serialized) as Record<string, unknown>;
      const key = keys[name];
      if (typeof key === "string" && key.startsWith("sb_publishable_")) return key;
    } catch {
      // Fall through to the explicit local-development variable.
    }
  }
  const single = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  if (single.startsWith("sb_publishable_")) return single;
  return "";
}
