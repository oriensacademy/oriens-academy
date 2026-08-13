import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables, Json } from "@/types/database.types";

export type SiteSettingRow = Tables<"site_settings">;

export const PROTECTED_SECRET_KEYS = new Set([
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "RESEND_API_KEY",
  "TURNSTILE_SECRET_KEY",
  "DATABASE_URL",
]);

/**
 * Lists site settings for administrative management.
 */
export async function listAdminSiteSettings(): Promise<{
  data: SiteSettingRow[];
  error: string | null;
}> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .order("key", { ascending: true });

    if (error) {
      console.error("[Admin Settings] Error listing site settings:", error);
      return { data: [], error: error.message };
    }

    return { data: (data as SiteSettingRow[]) || [], error: null };
  } catch (err) {
    console.error("[Admin Settings] Unexpected error listing site settings:", err);
    return { data: [], error: "Site ayarları yüklenirken hata oluştu." };
  }
}

/**
 * Updates a site setting value.
 * Validates email format for notification recipient settings.
 * Refuses updates to protected environment secret keys.
 */
export async function updateAdminSiteSetting(
  key: string,
  value: Json
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();

  if (PROTECTED_SECRET_KEYS.has(key)) {
    return {
      success: false,
      error: "Güvenlik uyarısı: Gizli sistem anahtarları site ayarları üzerinden değiştirilemez.",
    };
  }

  // Validate email setting values if key represents an email recipient
  if (key.includes("email") && typeof value === "object" && value !== null && "email" in value) {
    const emailVal = (value as { email: string }).email;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailVal || !emailRegex.test(emailVal.trim())) {
      return {
        success: false,
        error: "Geçerli bir e-posta adresi giriniz.",
      };
    }
  }

  try {
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("site_settings")
      .update({
        value,
        updated_at: new Date().toISOString(),
        updated_by: userData.user?.id || null,
      })
      .eq("key", key);

    if (error) {
      console.error("[Admin Settings] Error updating site setting:", error);
      return { success: false, error: error.message };
    }

    // Write audit log
    await supabase.from("audit_logs").insert({
      actor_user_id: userData.user?.id || null,
      action: "admin.settings.updated",
      entity_type: "site_setting",
      entity_id: key,
      metadata: { key, updated_value: value },
    });

    return { success: true, error: null };
  } catch (err) {
    console.error("[Admin Settings] Unexpected error updating site setting:", err);
    return { success: false, error: "Ayar güncellenirken bir hata oluştu." };
  }
}
