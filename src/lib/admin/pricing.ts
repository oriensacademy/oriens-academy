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
  | "purchase_mode"
>;
export type BillingBasis = "session" | "month" | "custom";
export type PurchaseMode = "consultation_only" | "purchasable";

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
  purchase_mode?: PurchaseMode;
}

export interface CreatePricingPackageInput extends PricingDetailsInput {
  id: string; // e.g. "single", "package10"
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

export const CANONICAL_DEFAULT_PACKAGES: PublicPricingPackage[] = [
  {
    id: "single",
    name_tr: "1 Ders",
    name_en: "Single Lesson",
    description_tr: "Esnek ve ihtiyaca yönelik birebir ders.",
    description_en: "Flexible support based on your needs.",
    lesson_count: 1,
    price_amount: 3200,
    current_total: 3200,
    old_total: null,
    unit_price: 3200,
    discount_percentage: null,
    currency: "TRY",
    active: true,
    featured: false,
    display_order: 1,
    badge_tr: null,
    badge_en: null,
    purchase_mode: "purchasable",
  },
  {
    id: "package5",
    name_tr: "5 Derslik Paket",
    name_en: "5-Lesson Package",
    description_tr: "Düzenli çalışmaya başlamak ve kısa vadeli konu hedeflerini takip etmek için esnek paket.",
    description_en: "A flexible package for starting structured study and tracking short-term topic goals.",
    lesson_count: 5,
    price_amount: 15000,
    current_total: 15000,
    old_total: 16000,
    unit_price: 3000,
    discount_percentage: 7,
    currency: "TRY",
    active: true,
    featured: false,
    display_order: 2,
    badge_tr: null,
    badge_en: null,
    purchase_mode: "purchasable",
  },
  {
    id: "package10",
    name_tr: "10 Derslik Paket",
    name_en: "10-Lesson Package",
    description_tr: "Sınav hazırlığı ve düzenli konu takibini birlikte yürüten dengeli paket.",
    description_en: "A balanced package combining exam prep and regular progress review.",
    lesson_count: 10,
    price_amount: 27000,
    current_total: 27000,
    old_total: 32000,
    unit_price: 2700,
    discount_percentage: 15,
    currency: "TRY",
    active: true,
    featured: true,
    display_order: 3,
    badge_tr: "En Çok Tercih Edilen",
    badge_en: "Most Popular",
    purchase_mode: "purchasable",
  },
  {
    id: "package20",
    name_tr: "20 Derslik Paket",
    name_en: "20-Lesson Package",
    description_tr: "Derinlemesine konu hakimiyeti, ödev takip ve deneme sınavı analizleri.",
    description_en: "In-depth subject mastery, lesson-right tracking, and academic progress analysis.",
    lesson_count: 20,
    price_amount: 51000,
    current_total: 51000,
    old_total: 64000,
    unit_price: 2550,
    discount_percentage: 20,
    currency: "TRY",
    active: true,
    featured: false,
    display_order: 4,
    badge_tr: null,
    badge_en: null,
    purchase_mode: "purchasable",
  },
  {
    id: "package30",
    name_tr: "30 Derslik Paket",
    name_en: "30-Lesson Package",
    description_tr: "Tüm akademik yıl boyunca kesintisiz destek ve maksimum avantaj.",
    description_en: "Complete academic year guidance and maximum value.",
    lesson_count: 30,
    price_amount: 72000,
    current_total: 72000,
    old_total: 96000,
    unit_price: 2400,
    discount_percentage: 25,
    currency: "TRY",
    active: true,
    featured: false,
    display_order: 5,
    badge_tr: "En Avantajlı Paket",
    badge_en: "Best Value",
    purchase_mode: "purchasable",
  },
];

/**
 * Fetches public pricing packages directly from Supabase at runtime.
 * Ensures runtime dynamism on static Next.js export builds without rebuild.
 */
export async function getPublicPricingPackages(): Promise<PublicPricingPackage[]> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      "";
    if (!supabaseUrl || !publishableKey) return CANONICAL_DEFAULT_PACKAGES;

    const query = new URLSearchParams({
      select:
        "id,price_amount,currency,active,featured,display_order,name_tr,name_en,description_tr,description_en,lesson_count,discount_percentage,unit_price,old_total,current_total,badge_tr,badge_en,purchase_mode",
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

    if (!response.ok) return CANONICAL_DEFAULT_PACKAGES;
    const data = (await response.json()) as PublicPricingPackage[];
    if (data && data.length > 0) {
      // Normalize price_amount and current_total to prevent any drift
      return data.map((pkg) => {
        const canonicalPrice = Number(pkg.current_total ?? pkg.price_amount ?? 0);
        return {
          ...pkg,
          price_amount: canonicalPrice,
          current_total: canonicalPrice,
          purchase_mode: "purchasable",
        };
      });
    }
    return CANONICAL_DEFAULT_PACKAGES;
  } catch {
    return CANONICAL_DEFAULT_PACKAGES;
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
      return { data: (CANONICAL_DEFAULT_PACKAGES as unknown) as PricingPackageRow[], error: null };
    }

    return {
      data: (data as PricingPackageRow[]) || ((CANONICAL_DEFAULT_PACKAGES as unknown) as PricingPackageRow[]),
      error: null,
    };
  } catch {
    return { data: (CANONICAL_DEFAULT_PACKAGES as unknown) as PricingPackageRow[], error: null };
  }
}

/**
 * Creates a new pricing package.
 */
export async function createAdminPricingPackage(
  input: CreatePricingPackageInput
): Promise<{ data: PricingPackageRow | null; error: string | null }> {
  const supabase = getSupabaseClient();

  if (!input.id || input.id.trim() === "") {
    return { data: null, error: "Paket kimliği (ID/slug) gereklidir." };
  }

  const effectivePrice = input.price_amount ?? input.current_total ?? 0;
  if (isNaN(effectivePrice) || effectivePrice < 0) {
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
      price_amount: effectivePrice,
      current_total: effectivePrice,
      currency: input.currency || "TRY",
      billing_basis: input.billing_basis,
      active: true,
      featured: input.featured ?? false,
      display_order: input.display_order || 0,
      updated_by: userData.user?.id || null,
      name_tr: input.name_tr || null,
      name_en: input.name_en || null,
      description_tr: input.description_tr || null,
      description_en: input.description_en || null,
      lesson_count: input.lesson_count ?? 1,
      discount_percentage: input.discount_percentage ?? null,
      unit_price: input.unit_price ?? (input.lesson_count ? Math.round(effectivePrice / input.lesson_count) : effectivePrice),
      old_total: input.old_total ?? null,
      badge_tr: input.badge_tr || null,
      badge_en: input.badge_en || null,
      purchase_mode: "purchasable",
    };

    const { data, error } = await supabase
      .from("pricing_packages")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
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
 * Updates an existing pricing package with strict price synchronization.
 */
export async function updateAdminPricingPackage(
  id: string,
  input: UpdatePricingPackageInput
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();

  const effectivePrice = input.price_amount !== undefined && input.price_amount !== null
    ? input.price_amount
    : input.current_total !== undefined && input.current_total !== null
    ? input.current_total
    : undefined;

  if (effectivePrice !== undefined && (isNaN(effectivePrice) || effectivePrice < 0)) {
    return { success: false, error: "Fiyat tutarı geçerli ve pozitif bir sayı olmalıdır." };
  }

  try {
    const { data: userData } = await supabase.auth.getUser();

    const updatePayload: TablesUpdate<"pricing_packages"> = {
      ...input,
      ...(effectivePrice !== undefined ? { price_amount: effectivePrice, current_total: effectivePrice } : {}),
      purchase_mode: "purchasable",
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
