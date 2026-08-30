import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database.types";

export type TestimonialRow = Tables<"testimonials"> & {
  source_hash: string | null;
  source_topic: string | null;
  source_author: string | null;
  source_date: string | null;
  source_import_id: string | null;
  imported_from_source: boolean;
  pinned_at: string | null;
  pin_order: number | null;
  archived_at: string | null;
};

export type PublicTestimonialsResult = {
  data: TestimonialRow[];
  error: string | null;
};

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
  pinned_at?: string | null;
  pin_order?: number | null;
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
  pinned_at?: string | null;
  pin_order?: number | null;
}

export async function getPublicTestimonials(locale?: string): Promise<PublicTestimonialsResult> {
  try {
    const supabase = getSupabaseClient();
    // Generated database types intentionally lag additive rollout migrations.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("testimonials")
      .select("*")
      .eq("active", true)
      .eq("verified", true)
      .is("archived_at", null)
      .order("pin_order", { ascending: true, nullsFirst: false })
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("featured", { ascending: false })
      .order("display_order", { ascending: true });

    if (locale) {
      query = query.eq("locale", locale);
    }

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };
    return { data: (data || []) as TestimonialRow[], error: null };
  } catch (error) {
    return {
      data: [],
      error: error instanceof Error ? error.message : "Testimonials are temporarily unavailable.",
    };
  }
}

/**
 * Lists testimonials for administrative management.
 */
export async function listAdminTestimonials(params: {
  locale?: string;
  activeOnly?: boolean;
} = {}): Promise<{ data: TestimonialRow[]; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("testimonials")
      .select("*")
      .order("pin_order", { ascending: true, nullsFirst: false })
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (params.locale && params.locale !== "all") {
      query = query.eq("locale", params.locale);
    }

    if (params.activeOnly) {
      query = query.eq("active", true);
    }

    const { data, error } = await query;

    if (error) return { data: [], error: error.message };
    return { data: (data || []) as TestimonialRow[], error: null };
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : "Yorumlar yüklenemedi." };
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
    await (supabase.from("audit_logs") as unknown as { insert: (row: Record<string, unknown>) => Promise<unknown> }).insert({
      actor_user_id: userData.user?.id || null,
      action: "admin.content.testimonial_created",
      entity_type: "testimonial",
      entity_id: data.id,
      details: {
        name: data.name,
        locale: data.locale,
        exam_code: data.exam_code,
      },
    });

    return { data: data as TestimonialRow, error: null };
  } catch (err) {
    console.error("[Admin Content] Unexpected error creating testimonial:", err);
    return { data: null, error: "Öğrenci yorumu eklenirken bir hata oluştu." };
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
      updated_by: userData.user?.id || null,
    };

    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.quote !== undefined) updatePayload.quote = input.quote.trim();
    if (input.context !== undefined) updatePayload.context = input.context?.trim() || null;
    if (input.exam_code !== undefined) updatePayload.exam_code = input.exam_code?.trim().toLowerCase() || null;
    if (input.locale !== undefined) updatePayload.locale = input.locale;
    if (input.active !== undefined) updatePayload.active = input.active;
    if (input.verified !== undefined) updatePayload.verified = input.verified;
    if (input.featured !== undefined) updatePayload.featured = input.featured;
    if (input.display_order !== undefined) updatePayload.display_order = input.display_order;
    if (input.profile_image_url !== undefined) updatePayload.profile_image_url = input.profile_image_url?.trim() || null;
    if (input.pinned_at !== undefined) (updatePayload as Record<string, unknown>).pinned_at = input.pinned_at;
    if (input.pin_order !== undefined) (updatePayload as Record<string, unknown>).pin_order = input.pin_order;

    const { error } = await supabase
      .from("testimonials")
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      console.error("[Admin Content] Error updating testimonial:", error);
      return { success: false, error: error.message };
    }

    // Write audit log
    await (supabase.from("audit_logs") as unknown as { insert: (row: Record<string, unknown>) => Promise<unknown> }).insert({
      actor_user_id: userData.user?.id || null,
      action: "admin.content.testimonial_updated",
      entity_type: "testimonial",
      entity_id: id,
      details: updatePayload as Record<string, unknown>,
    });

    return { success: true, error: null };
  } catch (err) {
    console.error("[Admin Content] Unexpected error updating testimonial:", err);
    return { success: false, error: "Öğrenci yorumu güncellenirken bir hata oluştu." };
  }
}

/**
 * Archives a testimonial. Source records are never hard-deleted.
 */
export async function archiveAdminTestimonial(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    const { data: userData } = await supabase.auth.getUser();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("testimonials")
      .update({ active: false, archived_at: new Date().toISOString(), updated_by: userData.user?.id || null })
      .eq("id", id);

    if (error) {
      console.error("[Admin Content] Error archiving testimonial:", error);
      return { success: false, error: error.message };
    }

    // Write audit log
    await (supabase.from("audit_logs") as unknown as { insert: (row: Record<string, unknown>) => Promise<unknown> }).insert({
      actor_user_id: userData.user?.id || null,
      action: "admin.content.testimonial_archived",
      entity_type: "testimonial",
      entity_id: id,
    });

    return { success: true, error: null };
  } catch (err) {
    console.error("[Admin Content] Unexpected error archiving testimonial:", err);
    return { success: false, error: "Öğrenci yorumu arşivlenirken bir hata oluştu." };
  }
}
