import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  PublicAvailabilitySlot,
  BookingRequestPayload,
  BookingResult,
} from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/**
 * Fetches available upcoming appointment slots from the public booking-availability Edge Function.
 * Direct browser SELECT from availability_slots table is disabled by RLS.
 */
export async function getPublicAvailability(): Promise<PublicAvailabilitySlot[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke("booking-availability", {
      method: "GET",
    });

    if (error) {
      console.warn("[booking/api] Edge function invocation error, trying fallback fetch...", error);
      return await getPublicAvailabilityFallback();
    }

    if (data && Array.isArray(data.slots)) {
      return data.slots;
    }
    return [];
  } catch (err) {
    console.warn("[booking/api] Unexpected error fetching availability, trying fallback...", err);
    return await getPublicAvailabilityFallback();
  }
}

async function getPublicAvailabilityFallback(): Promise<PublicAvailabilitySlot[]> {
  if (!SUPABASE_URL || SUPABASE_URL.includes("placeholder")) return [];

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/booking-availability`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      },
    });

    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.slots) ? json.slots : [];
  } catch {
    return [];
  }
}

/**
 * Submits a booking reservation to the create-booking public Edge Function.
 * The Edge Function validates payload and executes atomic DB locking.
 */
export async function submitBooking(
  payload: BookingRequestPayload
): Promise<BookingResult> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke("create-booking", {
      body: payload,
    });

    if (error) {
      // Try fallback direct HTTP fetch if functions SDK encounters gateway mismatch
      return await submitBookingFallback(payload);
    }

    if (data && data.success) {
      return {
        success: true,
        bookingId: data.bookingId,
        slotId: data.slotId,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        status: data.status,
      };
    }

    return {
      success: false,
      errorCode: data?.error_code || "RESERVATION_FAILED",
      message: data?.message || "Slot reservation could not be completed.",
    };
  } catch (err) {
    console.warn("[booking/api] Error submitting booking, attempting fallback fetch...", err);
    return await submitBookingFallback(payload);
  }
}

async function submitBookingFallback(
  payload: BookingRequestPayload
): Promise<BookingResult> {
  if (!SUPABASE_URL || SUPABASE_URL.includes("placeholder")) {
    return {
      success: false,
      errorCode: "NETWORK_ERROR",
      message: "Supabase environment configuration is missing.",
    };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-booking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey:
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
          "",
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (res.ok && json.success) {
      return {
        success: true,
        bookingId: json.bookingId,
        slotId: json.slotId,
        startsAt: json.startsAt,
        endsAt: json.endsAt,
        status: json.status,
      };
    }

    return {
      success: false,
      errorCode: json.error_code || "RESERVATION_FAILED",
      message: json.message || "Slot reservation could not be completed.",
    };
  } catch {
    return {
      success: false,
      errorCode: "NETWORK_ERROR",
      message: "Network error occurred while connecting to the booking service.",
    };
  }
}
