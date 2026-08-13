import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert, TablesUpdate, Json } from "@/types/database.types";

export type TestimonialRow = Tables<"testimonials">;

export interface CreateTestimonialInput {
  name: string;
  quote: string;
  context?: string | null;
  exam_code?: string | null;
  locale?: string;
  active?: boolean;
  verified?: boolean;
  featured?: boolean;
  display_order?: number;
  profile_image_url?: string | null;
}

export interface UpdateTestimonialInput {
  name?: string;
  quote?: string;
  context?: string | null;
  exam_code?: string | null;
  locale?: string;
  active?: boolean;
  verified?: boolean;
  featured?: boolean;
  display_order?: number;
  profile_image_url?: string | null;
}

export async function getPublicTestimonials(locale?: string): Promise<TestimonialRow[]> {
  try {
    const supabase = getSupabaseClient();
    let query = supabase
      .from("testimonials")
      .select("*")
      .eq("active", true)
      .eq("verified", true)
      .order("display_order", { ascending: true });

    if (locale) {
      query = query.eq("locale", locale);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as TestimonialRow[];
  } catch {
    return [];
  }
}

/**
 * Lists testimonials for administrative management.
 */
export async function listAdminTestimonials(params: {
  locale?: string;
  activeOnly?: boolean;
} = {}): Promise<{ data: TestimonialRow[]; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    let query = supabase
      .from("testimonials")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (params.locale) {
      query = query.eq("locale", params.locale);
    }

    if (params.activeOnly) {
      query = query.eq("active", true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Admin Content] Error listing testimonials:", error);
      return { data: [], error: error.message };
    }

    return { data: (data as TestimonialRow[]) || [], error: null };
  } catch (err) {
    console.error("[Admin Content] Unexpected error listing testimonials:", err);
    return { data: [], error: "Öğrenci yorumları yüklenirken hata oluştu." };
  }
}

/**
 * Creates a new testimonial record.
 */
export async function createAdminTestimonial(
  input: CreateTestimonialInput
): Promise<{ data: TestimonialRow | null; error: string | null }> {
  const supabase = getSupabaseClient();

  if (!input.name || input.name.trim() === "") {
    return { data: null, error: "Öğrenci / veli adı gereklidir." };
  }

  if (!input.quote || input.quote.trim() === "") {
    return { data: null, error: "Yorum / alıntı metni gereklidir." };
  }

  try {
    const { data: userData } = await supabase.auth.getUser();

    const insertPayload: TablesInsert<"testimonials"> = {
      name: input.name.trim(),
      quote: input.quote.trim(),
      context: input.context?.trim() || null,
      exam_code: input.exam_code?.trim().toLowerCase() || null,
      locale: input.locale || "tr",
      active: input.active !== undefined ? input.active : true,
      verified: input.verified !== undefined ? input.verified : true,
      featured: input.featured !== undefined ? input.featured : false,
      display_order: input.display_order || 0,
      profile_image_url: input.profile_image_url?.trim() || null,
      updated_by: userData.user?.id || null,
    };

    const { data, error } = await supabase
      .from("testimonials")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error("[Admin Content] Error creating testimonial:", error);
      return { data: null, error: error.message };
    }

    // Write audit log
    await supabase.from("audit_logs").insert({
      actor_user_id: userData.user?.id || null,
      action: "admin.content.testimonial_created",
      entity_type: "testimonial",
      entity_id: data.id,
      metadata: { name: data.name, exam_code: data.exam_code, locale: data.locale },
    });

    return { data, error: null };
  } catch (err) {
    console.error("[Admin Content] Unexpected error creating testimonial:", err);
    return { data: null, error: "Yorum oluşturulurken bir hata oluştu." };
  }
}

/**
 * Updates an existing testimonial record.
 */
export async function updateAdminTestimonial(
  id: string,
  input: UpdateTestimonialInput
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    const { data: userData } = await supabase.auth.getUser();

    const updatePayload: TablesUpdate<"testimonials"> = {
      ...input,
      updated_at: new Date().toISOString(),
      updated_by: userData.user?.id || null,
    };

    const { error } = await supabase
      .from("testimonials")
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      console.error("[Admin Content] Error updating testimonial:", error);
      return { success: false, error: error.message };
    }

    // Write audit log
    await supabase.from("audit_logs").insert({
      actor_user_id: userData.user?.id || null,
      action: "admin.content.testimonial_updated",
      entity_type: "testimonial",
      entity_id: id,
      metadata: { updates: input } as unknown as Json,
    });

    return { success: true, error: null };
  } catch (err) {
    console.error("[Admin Content] Unexpected error updating testimonial:", err);
    return { success: false, error: "Güncelleme sırasında bir hata oluştu." };
  }
}

/**
 * Deletes a testimonial record.
 */
export async function deleteAdminTestimonial(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from("testimonials")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[Admin Content] Error deleting testimonial:", error);
      return { success: false, error: error.message };
    }

    // Write audit log
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      actor_user_id: userData.user?.id || null,
      action: "admin.content.testimonial_deleted",
      entity_type: "testimonial",
      entity_id: id,
      metadata: null,
    });

    return { success: true, error: null };
  } catch (err) {
    console.error("[Admin Content] Unexpected error deleting testimonial:", err);
    return { success: false, error: "Silme işlemi sırasında bir hata oluştu." };
  }
}
