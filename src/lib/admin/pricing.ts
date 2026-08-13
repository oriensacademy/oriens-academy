import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert, TablesUpdate, Json } from "@/types/database.types";

export type PricingPackageRow = Tables<"pricing_packages">;
export type PublicPricingPackage = Pick<
  PricingPackageRow,
  | "id"
  | "price_amount"
  | "currency"
  | "active"
  | "featured"
  | "display_order"
  | "name_tr"
  | "name_en"
  | "description_tr"
  | "description_en"
  | "lesson_count"
  | "discount_percentage"
  | "unit_price"
  | "old_total"
  | "current_total"
  | "badge_tr"
  | "badge_en"
>;
export type BillingBasis = "session" | "month" | "custom";

export interface PricingDetailsInput {
  name_tr?: string | null;
  name_en?: string | null;
  description_tr?: string | null;
  description_en?: string | null;
  lesson_count?: number | null;
  discount_percentage?: number | null;
  unit_price?: number | null;
  old_total?: number | null;
  current_total?: number | null;
  badge_tr?: string | null;
  badge_en?: string | null;
}

export interface CreatePricingPackageInput extends PricingDetailsInput {
  id: string; // e.g. "single_session", "monthly_mentorship"
  price_amount: number | null;
  currency?: string;
  billing_basis: BillingBasis;
  active?: boolean;
  featured?: boolean;
  display_order?: number;
}

export interface UpdatePricingPackageInput extends PricingDetailsInput {
  price_amount?: number | null;
  currency?: string;
  billing_basis?: BillingBasis;
  active?: boolean;
  featured?: boolean;
  display_order?: number;
}

export async function getPublicPricingPackages(): Promise<PublicPricingPackage[]> {
  if (process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_CONTENT_ENABLED !== "true") return [];

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ?? "";
    if (!supabaseUrl || !publishableKey) return [];

    const query = new URLSearchParams({
      select: "id,price_amount,currency,active,featured,display_order,name_tr,name_en,description_tr,description_en,lesson_count,discount_percentage,unit_price,old_total,current_total,badge_tr,badge_en",
      active: "eq.true",
      order: "display_order.asc",
    });
    const response = await fetch(`${supabaseUrl}/rest/v1/pricing_packages?${query}`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) return [];
    return await response.json() as PublicPricingPackage[];
  } catch {
    return [];
  }
}

/**
 * Lists all pricing packages for administrative management.
 */
export async function listAdminPricingPackages(): Promise<{
  data: PricingPackageRow[];
  error: string | null;
}> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("pricing_packages")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Admin Pricing] Error listing packages:", error);
      return { data: [], error: error.message };
    }

    return { data: (data as PricingPackageRow[]) || [], error: null };
  } catch (err) {
    console.error("[Admin Pricing] Unexpected error listing packages:", err);
    return { data: [], error: "Fiyat paketleri yüklenirken hata oluştu." };
  }
}

/**
 * Creates a new pricing package.
 * Validates check constraint (price_amount >= 0, billing_basis in ('session', 'month', 'custom')).
 */
export async function createAdminPricingPackage(
  input: CreatePricingPackageInput
): Promise<{ data: PricingPackageRow | null; error: string | null }> {
  const supabase = getSupabaseClient();

  if (!input.id || input.id.trim() === "") {
    return { data: null, error: "Paket kimliği (ID/slug) gereklidir." };
  }

  if (input.price_amount !== null && (isNaN(input.price_amount) || input.price_amount < 0)) {
    return { data: null, error: "Fiyat tutarı negatif olamaz." };
  }

  const validBasis: BillingBasis[] = ["session", "month", "custom"];
  if (!validBasis.includes(input.billing_basis)) {
    return { data: null, error: "Geçersiz faturalandırma türü." };
  }

  try {
    const { data: userData } = await supabase.auth.getUser();

    const insertPayload: TablesInsert<"pricing_packages"> = {
      id: input.id.trim().toLowerCase().replace(/\s+/g, "_"),
      price_amount: input.price_amount,
      currency: input.currency || "EUR",
      billing_basis: input.billing_basis,
      active: input.active !== undefined ? input.active : true,
      featured: input.featured !== undefined ? input.featured : false,
      display_order: input.display_order || 0,
      updated_by: userData.user?.id || null,
      name_tr: input.name_tr || null,
      name_en: input.name_en || null,
      description_tr: input.description_tr || null,
      description_en: input.description_en || null,
      lesson_count: input.lesson_count ?? null,
      discount_percentage: input.discount_percentage ?? null,
      unit_price: input.unit_price ?? null,
      old_total: input.old_total ?? null,
      current_total: input.current_total ?? input.price_amount,
      badge_tr: input.badge_tr || null,
      badge_en: input.badge_en || null,
    };

    const { data, error } = await supabase
      .from("pricing_packages")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") { // unique_violation
        return { data: null, error: "Bu paket kimliğine (ID) sahip bir fiyat paketi zaten mevcut." };
      }
      console.error("[Admin Pricing] Error creating package:", error);
      return { data: null, error: error.message };
    }

    // Write audit log
    await supabase.from("audit_logs").insert({
      actor_user_id: userData.user?.id || null,
      action: "admin.pricing.package_created",
      entity_type: "pricing_package",
      entity_id: data.id,
      metadata: { price_amount: data.price_amount, currency: data.currency, billing_basis: data.billing_basis },
    });

    return { data, error: null };
  } catch (err) {
    console.error("[Admin Pricing] Unexpected error creating package:", err);
    return { data: null, error: "Paket oluşturulurken bir hata oluştu." };
  }
}

/**
 * Updates an existing pricing package.
 */
export async function updateAdminPricingPackage(
  id: string,
  input: UpdatePricingPackageInput
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();

  if (input.price_amount !== undefined && input.price_amount !== null && (isNaN(input.price_amount) || input.price_amount < 0)) {
    return { success: false, error: "Fiyat tutarı negatif olamaz." };
  }

  try {
    const { data: userData } = await supabase.auth.getUser();

    const updatePayload: TablesUpdate<"pricing_packages"> = {
      ...input,
      updated_at: new Date().toISOString(),
      updated_by: userData.user?.id || null,
    };

    const { error } = await supabase
      .from("pricing_packages")
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      console.error("[Admin Pricing] Error updating package:", error);
      return { success: false, error: error.message };
    }

    // Write audit log
    await supabase.from("audit_logs").insert({
      actor_user_id: userData.user?.id || null,
      action: "admin.pricing.package_updated",
      entity_type: "pricing_package",
      entity_id: id,
      metadata: { updates: input } as unknown as Json,
    });

    return { success: true, error: null };
  } catch (err) {
    console.error("[Admin Pricing] Unexpected error updating package:", err);
    return { success: false, error: "Güncelleme sırasında hata oluştu." };
  }
}

/**
 * Deletes a pricing package.
 */
export async function deleteAdminPricingPackage(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from("pricing_packages")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[Admin Pricing] Error deleting package:", error);
      return { success: false, error: error.message };
    }

    // Write audit log
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      actor_user_id: userData.user?.id || null,
      action: "admin.pricing.package_deleted",
      entity_type: "pricing_package",
      entity_id: id,
      metadata: null,
    });

    return { success: true, error: null };
  } catch (err) {
    console.error("[Admin Pricing] Unexpected error deleting package:", err);
    return { success: false, error: "Silme işlemi sırasında hata oluştu." };
  }
}
