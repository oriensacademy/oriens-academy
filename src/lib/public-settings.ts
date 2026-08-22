import { getSupabaseClient } from "@/lib/supabase/client";

export const PRICING_NAVIGATION_SETTING = "navigation.show_pricing";

/** Missing or unavailable configuration deliberately preserves the current visible state. */
export async function getPricingNavigationVisibility(): Promise<boolean> {
  try {
    const { data, error } = await getSupabaseClient()
      .from("site_settings")
      .select("value")
      .eq("key", PRICING_NAVIGATION_SETTING)
      .eq("is_public", true)
      .maybeSingle();
    if (error || !data || typeof data.value !== "object" || data.value === null) return true;
    const visible = (data.value as { visible?: unknown }).visible;
    return typeof visible === "boolean" ? visible : true;
  } catch {
    return true;
  }
}
