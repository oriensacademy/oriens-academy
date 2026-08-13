import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

export type SlotStatus = "available" | "booked" | "blocked";

export type AvailabilitySlotWithBooking = Tables<"availability_slots"> & {
  bookings: Array<{
    id: string;
    full_name: string;
    email: string;
    status: string;
    created_at: string;
  }>;
};

export interface ListAvailabilityParams {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  status?: SlotStatus | "all";
}

export interface BulkCreateSlotParams {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  selectedDays: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  timeSlots: Array<{ startTime: string; endTime: string }>; // e.g. "13:00", "14:00"
}

/**
 * Lists availability slots for administrative view, joined with associated bookings.
 */
export async function listAdminAvailabilitySlots(
  params: ListAvailabilityParams = {}
): Promise<{ data: AvailabilitySlotWithBooking[]; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    let query = supabase
      .from("availability_slots")
      .select(
        `
        *,
        bookings (
          id,
          full_name,
          email,
          status,
          created_at
        )
      `
      )
      .order("starts_at", { ascending: true });

    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }

    if (params.startDate) {
      query = query.gte("starts_at", `${params.startDate}T00:00:00.000Z`);
    }

    if (params.endDate) {
      query = query.lte("starts_at", `${params.endDate}T23:59:59.999Z`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Admin Availability] Error listing slots:", error);
      return { data: [], error: error.message };
    }

    return {
      data: (data as unknown as AvailabilitySlotWithBooking[]) || [],
      error: null,
    };
  } catch (err) {
    console.error("[Admin Availability] Unexpected error listing slots:", err);
    return { data: [], error: "Müsaitlik dilimleri yüklenirken hata oluştu." };
  }
}

/**
 * Creates a single availability slot.
 */
export async function createAdminAvailabilitySlot(
  startsAt: string,
  endsAt: string
): Promise<{ data: Tables<"availability_slots"> | null; error: string | null }> {
  const supabase = getSupabaseClient();

  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { data: null, error: "Geçersiz tarih veya saat formatı." };
  }

  if (end <= start) {
    return { data: null, error: "Bitiş zamanı başlangıç zamanından sonra olmalıdır." };
  }

  try {
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("availability_slots")
      .insert({
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: "available",
        created_by: userData.user?.id || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") { // unique_violation
        return { data: null, error: "Bu tarih ve saat dilimi zaten mevcut." };
      }
      console.error("[Admin Availability] Error creating slot:", error);
      return { data: null, error: error.message };
    }

    // Write audit log
    await supabase.from("audit_logs").insert({
      actor_user_id: userData.user?.id || null,
      action: "admin.availability.slot_created",
      entity_type: "availability_slot",
      entity_id: data.id,
      metadata: { starts_at: data.starts_at, ends_at: data.ends_at },
    });

    return { data, error: null };
  } catch (err) {
    console.error("[Admin Availability] Unexpected error creating slot:", err);
    return { data: null, error: "Dilim oluşturulurken bir hata oluştu." };
  }
}

/**
 * Deletes an availability slot if no active bookings exist.
 */
export async function deleteAdminAvailabilitySlot(
  slotId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    // Check if slot has active bookings
    const { data: activeBookings, error: checkErr } = await supabase
      .from("bookings")
      .select("id, status")
      .eq("slot_id", slotId)
      .in("status", ["pending", "confirmed", "completed", "no_show"]);

    if (checkErr) {
      console.error("[Admin Availability] Error checking slot bookings:", checkErr);
      return { success: false, error: checkErr.message };
    }

    if (activeBookings && activeBookings.length > 0) {
      return {
        success: false,
        error: "Bu zaman dilimine ait aktif bir randevu bulunmaktadır. Silinemez.",
      };
    }

    const { error: deleteErr } = await supabase
      .from("availability_slots")
      .delete()
      .eq("id", slotId);

    if (deleteErr) {
      console.error("[Admin Availability] Error deleting slot:", deleteErr);
      return { success: false, error: deleteErr.message };
    }

    // Write audit log
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      actor_user_id: userData.user?.id || null,
      action: "admin.availability.slot_deleted",
      entity_type: "availability_slot",
      entity_id: slotId,
      metadata: null,
    });

    return { success: true, error: null };
  } catch (err) {
    console.error("[Admin Availability] Unexpected error deleting slot:", err);
    return { success: false, error: "Dilim silinirken bir hata oluştu." };
  }
}

/**
 * Creates multiple availability slots in bulk over a date range.
 */
export async function bulkCreateAdminAvailabilitySlots(
  params: BulkCreateSlotParams
): Promise<{ createdCount: number; skippedCount: number; error: string | null }> {
  const supabase = getSupabaseClient();

  const start = new Date(`${params.startDate}T00:00:00`);
  const end = new Date(`${params.endDate}T23:59:59`);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return { createdCount: 0, skippedCount: 0, error: "Geçersiz tarih aralığı." };
  }

  if (!params.selectedDays || params.selectedDays.length === 0) {
    return { createdCount: 0, skippedCount: 0, error: "Lütfen en az bir gün seçiniz." };
  }

  if (!params.timeSlots || params.timeSlots.length === 0) {
    return { createdCount: 0, skippedCount: 0, error: "Lütfen en az bir saat dilimi ekleyiniz." };
  }

  try {
    const { data: userData } = await supabase.auth.getUser();
    const candidateSlots: Array<{ starts_at: string; ends_at: string; created_by: string | null }> = [];

    const curr = new Date(start);
    while (curr <= end) {
      const dayOfWeek = curr.getDay(); // 0 = Sun, 1 = Mon ...
      if (params.selectedDays.includes(dayOfWeek)) {
        const yearStr = curr.getFullYear();
        const monthStr = String(curr.getMonth() + 1).padStart(2, "0");
        const dateStr = String(curr.getDate()).padStart(2, "0");

        for (const slot of params.timeSlots) {
          const slotStart = new Date(`${yearStr}-${monthStr}-${dateStr}T${slot.startTime}:00`);
          const slotEnd = new Date(`${yearStr}-${monthStr}-${dateStr}T${slot.endTime}:00`);

          if (slotEnd > slotStart && slotStart > new Date()) {
            candidateSlots.push({
              starts_at: slotStart.toISOString(),
              ends_at: slotEnd.toISOString(),
              created_by: userData.user?.id || null,
            });
          }
        }
      }
      curr.setDate(curr.getDate() + 1);
    }

    if (candidateSlots.length === 0) {
      return {
        createdCount: 0,
        skippedCount: 0,
        error: "Seçilen kriterlere uygun gelecek zamanlı dilim oluşturulamadı.",
      };
    }

    // Insert slots in batches, handling duplicates
    let createdCount = 0;
    let skippedCount = 0;

    for (const slotCandidate of candidateSlots) {
      const { error: insertErr } = await supabase
        .from("availability_slots")
        .insert(slotCandidate);

      if (insertErr) {
        if (insertErr.code === "23505") { // unique_violation
          skippedCount++;
        } else {
          console.warn("[Admin Availability] Bulk insert warning:", insertErr);
          skippedCount++;
        }
      } else {
        createdCount++;
      }
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      actor_user_id: userData.user?.id || null,
      action: "admin.availability.bulk_slots_created",
      entity_type: "availability_slot",
      entity_id: null,
      metadata: { created_count: createdCount, skipped_count: skippedCount },
    });

    return { createdCount, skippedCount, error: null };
  } catch (err) {
    console.error("[Admin Availability] Unexpected error in bulk creation:", err);
    return { createdCount: 0, skippedCount: 0, error: "Toplu oluşturma sırasında bir hata oluştu." };
  }
}
