import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  CouponValidationResult,
  CreateCouponInput,
  DiscountCoupon,
  UpdateCouponInput,
} from "./types";
import type { TablesUpdate } from "@/types/database.types";

export async function validateCoupon(
  code: string,
  packageId: string,
  studentUserId?: string
): Promise<CouponValidationResult> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return {
      valid: false,
      error_code: "EMPTY_CODE",
      message: "Lütfen bir indirim kuponu girin.",
    };
  }

  try {
    const { data, error } = await getSupabaseClient().rpc("validate_checkout_coupon", {
      p_code: cleanCode,
      p_package_id: packageId,
      p_student_user_id: studentUserId || null,
    });

    if (error) {
      return {
        valid: false,
        error_code: "RPC_ERROR",
        message: error.message || "Kupon doğrulanamadı.",
      };
    }

    return (data as unknown) as CouponValidationResult;
  } catch {
    return {
      valid: false,
      error_code: "NETWORK_ERROR",
      message: "Kupon doğrulanırken bir hata oluştu.",
    };
  }
}

export async function listAdminCoupons(): Promise<{
  data: DiscountCoupon[];
  error: string | null;
}> {
  try {
    const supabase = getSupabaseClient();
    const { data: coupons, error } = await supabase
      .from("discount_coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return { data: [], error: error.message };
    }

    const { data: pkgMappings } = await supabase
      .from("discount_coupon_packages")
      .select("coupon_id,package_id");

    const packageMap = new Map<string, string[]>();
    pkgMappings?.forEach((row) => {
      const list = packageMap.get(row.coupon_id) || [];
      list.push(row.package_id);
      packageMap.set(row.coupon_id, list);
    });

    const enriched: DiscountCoupon[] = (coupons || []).map((c) => ({
      ...c,
      discount_type: c.discount_type as "percentage" | "fixed",
      discount_value: Number(c.discount_value),
      minimum_order_amount: c.minimum_order_amount !== null ? Number(c.minimum_order_amount) : null,
      maximum_discount_amount: c.maximum_discount_amount !== null ? Number(c.maximum_discount_amount) : null,
      package_ids: packageMap.get(c.id) || [],
    }));

    return { data: enriched, error: null };
  } catch {
    return { data: [], error: "Kuponlar yüklenemedi." };
  }
}

export async function createAdminCoupon(
  input: CreateCouponInput
): Promise<{ data: DiscountCoupon | null; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const cleanCode = input.code.trim().toUpperCase();

    const { data: coupon, error } = await supabase
      .from("discount_coupons")
      .insert({
        code: cleanCode,
        name: input.name?.trim() || null,
        discount_type: input.discount_type,
        discount_value: input.discount_value,
        currency: input.currency || "TRY",
        minimum_order_amount: input.minimum_order_amount ?? null,
        maximum_discount_amount: input.maximum_discount_amount ?? null,
        max_total_uses: input.max_total_uses ?? null,
        max_uses_per_student: input.max_uses_per_student ?? null,
        valid_from: input.valid_from || null,
        valid_until: input.valid_until || null,
        active: input.active !== undefined ? input.active : true,
        first_purchase_only: Boolean(input.first_purchase_only),
      })
      .select("*")
      .single();

    if (error || !coupon) {
      return { data: null, error: error?.message || "Kupon oluşturulamadı." };
    }

    if (input.package_ids && input.package_ids.length > 0) {
      const mappings = input.package_ids.map((pkgId) => ({
        coupon_id: coupon.id,
        package_id: pkgId,
      }));
      await supabase.from("discount_coupon_packages").insert(mappings);
    }

    return {
      data: {
        ...coupon,
        discount_type: coupon.discount_type as "percentage" | "fixed",
        discount_value: Number(coupon.discount_value),
        minimum_order_amount: coupon.minimum_order_amount !== null ? Number(coupon.minimum_order_amount) : null,
        maximum_discount_amount: coupon.maximum_discount_amount !== null ? Number(coupon.maximum_discount_amount) : null,
        package_ids: input.package_ids || [],
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Kupon kaydedilirken bir hata oluştu." };
  }
}

export async function updateAdminCoupon(
  input: UpdateCouponInput
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const updatePayload: TablesUpdate<"discount_coupons"> = {};

    if (input.code !== undefined) updatePayload.code = input.code.trim().toUpperCase();
    if (input.name !== undefined) updatePayload.name = input.name?.trim() || null;
    if (input.discount_type !== undefined) updatePayload.discount_type = input.discount_type;
    if (input.discount_value !== undefined) updatePayload.discount_value = input.discount_value;
    if (input.currency !== undefined) updatePayload.currency = input.currency;
    if (input.minimum_order_amount !== undefined) updatePayload.minimum_order_amount = input.minimum_order_amount;
    if (input.maximum_discount_amount !== undefined) updatePayload.maximum_discount_amount = input.maximum_discount_amount;
    if (input.max_total_uses !== undefined) updatePayload.max_total_uses = input.max_total_uses;
    if (input.max_uses_per_student !== undefined) updatePayload.max_uses_per_student = input.max_uses_per_student;
    if (input.valid_from !== undefined) updatePayload.valid_from = input.valid_from;
    if (input.valid_until !== undefined) updatePayload.valid_until = input.valid_until;
    if (input.active !== undefined) updatePayload.active = input.active;
    if (input.first_purchase_only !== undefined) updatePayload.first_purchase_only = input.first_purchase_only;

    const { error } = await supabase
      .from("discount_coupons")
      .update(updatePayload)
      .eq("id", input.id);

    if (error) return { success: false, error: error.message };

    if (input.package_ids !== undefined) {
      await supabase
        .from("discount_coupon_packages")
        .delete()
        .eq("coupon_id", input.id);

      if (input.package_ids.length > 0) {
        const mappings = input.package_ids.map((pkgId) => ({
          coupon_id: input.id,
          package_id: pkgId,
        }));
        await supabase.from("discount_coupon_packages").insert(mappings);
      }
    }

    return { success: true, error: null };
  } catch {
    return { success: false, error: "Kupon güncellenirken bir hata oluştu." };
  }
}

export async function deleteAdminCoupon(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await getSupabaseClient()
      .from("discount_coupons")
      .delete()
      .eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "Kupon silinemedi." };
  }
}

export async function toggleAdminCouponActive(
  id: string,
  active: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await getSupabaseClient()
      .from("discount_coupons")
      .update({ active })
      .eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "Kupon durumu güncellenemedi." };
  }
}
