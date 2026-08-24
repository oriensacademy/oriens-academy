import { getSupabaseClient } from "@/lib/supabase/client";

export const PRICING_NAVIGATION_SETTING = "navigation.show_pricing";
export const DEV_PRICING_VISIBILITY_KEY = "oriens_dev_show_pricing";

export function parseBooleanSettingValue(value: unknown, defaultValue = true): boolean {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "false" || trimmed === "0" || trimmed === "off" || trimmed === "disabled") return false;
    if (trimmed === "true" || trimmed === "1" || trimmed === "on" || trimmed === "enabled") return true;
  }
  if (typeof value === "object" && value !== null) {
    if ("visible" in value) {
      return parseBooleanSettingValue((value as { visible: unknown }).visible, defaultValue);
    }
    if ("enabled" in value) {
      return parseBooleanSettingValue((value as { enabled: unknown }).enabled, defaultValue);
    }
    if ("value" in value) {
      return parseBooleanSettingValue((value as { value: unknown }).value, defaultValue);
    }
  }
  return defaultValue;
}

/** Missing or unavailable configuration deliberately preserves the visible state unless explicitly disabled. */
export async function getPricingNavigationVisibility(): Promise<boolean> {
  if (typeof window !== "undefined") {
    try {
      const storedDev = localStorage.getItem(DEV_PRICING_VISIBILITY_KEY);
      if (storedDev !== null) {
        return parseBooleanSettingValue(storedDev, true);
      }
    } catch {
      // ignore
    }
  }

  try {
    const { data, error } = await getSupabaseClient()
      .from("site_settings")
      .select("value")
      .eq("key", PRICING_NAVIGATION_SETTING)
      .eq("is_public", true)
      .maybeSingle();

    if (error || !data) {
      if (typeof window !== "undefined") {
        try {
          const storedDev = localStorage.getItem(DEV_PRICING_VISIBILITY_KEY);
          if (storedDev !== null) return parseBooleanSettingValue(storedDev, true);
        } catch {
          // ignore
        }
      }
      return true;
    }

    return parseBooleanSettingValue(data.value, true);
  } catch {
    if (typeof window !== "undefined") {
      try {
        const storedDev = localStorage.getItem(DEV_PRICING_VISIBILITY_KEY);
        if (storedDev !== null) return parseBooleanSettingValue(storedDev, true);
      } catch {
        // ignore
      }
    }
    return true;
  }
}
