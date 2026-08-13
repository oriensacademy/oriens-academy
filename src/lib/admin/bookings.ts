import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export type BookingWithSlot = Tables<"bookings"> & {
  availability_slots: {
    id: string;
    starts_at: string;
    ends_at: string;
    status: string;
  } | null;
};

export interface ListBookingsParams {
  status?: BookingStatus | "all";
  search?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

export interface ListBookingsResult {
  data: BookingWithSlot[];
  error: string | null;
}

/**
 * Fetches bookings joined with availability_slots for administrative view.
 * Enforces server-side database RLS policy (requires public.is_admin()).
 */
export async function listAdminBookings(
  params: ListBookingsParams = {}
): Promise<ListBookingsResult> {
  const supabase = getSupabaseClient();

  try {
    let query = supabase
      .from("bookings")
      .select(
        `
        *,
        availability_slots (
          id,
          starts_at,
          ends_at,
          status
        )
      `
      )
      .order("created_at", { ascending: false });

    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }

    if (params.startDate) {
      query = query.gte("created_at", `${params.startDate}T00:00:00.000Z`);
    }

    if (params.endDate) {
      query = query.lte("created_at", `${params.endDate}T23:59:59.999Z`);
    }

    if (params.search && params.search.trim() !== "") {
      const s = `%${params.search.trim()}%`;
      query = query.or(`full_name.ilike.${s},email.ilike.${s},phone.ilike.${s}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Admin Bookings] Error listing bookings:", error);
      return { data: [], error: error.message };
    }

    return { data: (data as unknown as BookingWithSlot[]) || [], error: null };
  } catch (err) {
    console.error("[Admin Bookings] Unexpected error listing bookings:", err);
    return { data: [], error: "Randevular yüklenirken bir hata oluştu." };
  }
}

/**
 * Updates a booking's status and optional admin notes.
 * Records audit event in public.audit_logs.
 */
export async function updateAdminBookingStatus(
  bookingId: string,
  newStatus: BookingStatus,
  notes?: string | null
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    const updatePayload: { status: BookingStatus; notes?: string | null } = {
      status: newStatus,
    };
    if (notes !== undefined) {
      updatePayload.notes = notes;
    }

    const { error: updateErr } = await supabase
      .from("bookings")
      .update(updatePayload)
      .eq("id", bookingId);

    if (updateErr) {
      console.error("[Admin Bookings] Error updating status:", updateErr);
      return { success: false, error: updateErr.message };
    }

    // Log admin audit event
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      actor_user_id: userData.user?.id || null,
      action: "admin.booking.status_updated",
      entity_type: "booking",
      entity_id: bookingId,
      metadata: { new_status: newStatus, notes },
    });

    return { success: true, error: null };
  } catch (err) {
    console.error("[Admin Bookings] Unexpected error updating status:", err);
    return { success: false, error: "Güncelleme sırasında bir hata oluştu." };
  }
}
