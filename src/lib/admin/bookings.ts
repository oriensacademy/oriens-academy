import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export type ScheduleEventType =
  | "lesson"
  | "discovery"
  | "pre_consultation"
  | "additional_consultation"
  | "consultation"
  | "other";

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

export interface CreateManualBookingParams {
  fullName: string;
  email: string;
  phone: string;
  exam: string;
  subject: string;
  startsAt: string;
  endsAt: string;
  notes?: string;
  status: BookingStatus;
  privacyConsent: boolean;
  studentUserId?: string | null;
  liveMeetingUrl?: string | null;
  eventType: ScheduleEventType;
}

export async function createManualAdminBooking(
  params: CreateManualBookingParams
): Promise<{ bookingId: string | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const rpcArgs = {
    p_full_name: params.fullName.trim(),
    p_email: params.email.trim().toLowerCase(),
    p_phone: params.phone.trim(),
    p_exam: params.exam.trim(),
    p_starts_at: params.startsAt,
    p_ends_at: params.endsAt,
    p_privacy_consent: params.privacyConsent,
    p_notes: params.notes?.trim() || "",
    p_status: params.status,
    p_live_meeting_url: params.liveMeetingUrl?.trim() || null,
  };

  const { data, error } = params.studentUserId
    ? await supabase.rpc("admin_create_student_booking" as unknown as "admin_create_booking", {
        ...rpcArgs,
        p_student_id: params.studentUserId,
        p_subject: params.subject.trim(),
      } as unknown as { p_full_name: string; p_email: string; p_phone: string; p_exam: string; p_starts_at: string; p_ends_at: string; p_privacy_consent: boolean; p_notes?: string; p_status?: string })
    : await supabase.rpc("admin_create_booking", rpcArgs as unknown as { p_full_name: string; p_email: string; p_phone: string; p_exam: string; p_starts_at: string; p_ends_at: string; p_privacy_consent: boolean; p_notes?: string; p_status?: string });

  if (error) return { bookingId: null, error: error.message };
  const result = data as { success?: boolean; booking_id?: string; error_code?: string } | null;
  if (!result?.success) {
    return {
      bookingId: null,
      error: result?.error_code === "SLOT_UNAVAILABLE"
        ? "Bu saat dilimi dolu veya engellenmiş. Lütfen başka bir saat seçin."
        : "Randevu bilgileri geçersiz veya randevu zamanı geçmişte.",
    };
  }

  // Update live_meeting_url if not handled by older RPC version
  if (result.booking_id) {
    await supabase
      .from("bookings")
      .update({
        live_meeting_url: params.liveMeetingUrl?.trim() || null,
        event_type: params.eventType,
      } as never)
      .eq("id", result.booking_id);
  }

  // Send confirmation email via Edge Function
  if (result.booking_id) {
    try {
      const { error: emailError } = await supabase.functions.invoke("send-student-appointment", {
        body: { bookingId: result.booking_id },
      });
      if (emailError) console.error("[Admin Booking] Notification dispatch status:", emailError);
    } catch {
      // Safe fallback
    }
  }

  return { bookingId: result.booking_id || null, error: null };
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
    const { data, error: updateErr } = await supabase.rpc("admin_update_booking_status", {
      p_booking_id: bookingId,
      p_status: newStatus,
      p_notes: notes || "",
    });

    if (updateErr) {
      console.error("[Admin Bookings] Error updating status:", updateErr);
      return { success: false, error: updateErr.message };
    }
    const result = data as { success?: boolean; error_code?: string } | null;
    if (!result?.success) return { success: false, error: result?.error_code || "Güncelleme başarısız." };

    return { success: true, error: null };
  } catch (err) {
    console.error("[Admin Bookings] Unexpected error updating status:", err);
    return { success: false, error: "Güncelleme sırasında bir hata oluştu." };
  }
}
