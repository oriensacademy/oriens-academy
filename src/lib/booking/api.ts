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
      // Do NOT retry with the same payload: turnstileToken is single-use, and
      // the original request may have already reached and been processed by
      // the server. Resubmitting here would fail Turnstile verification with
      // a confusing "token already used" error, or risk a duplicate booking
      // attempt. Let the caller surface this and have the user retry with a
      // fresh token.
      console.warn("[booking/api] Error submitting booking:", error);
      return {
        success: false,
        errorCode: "NETWORK_ERROR",
        message: "Network error occurred while connecting to the booking service.",
      };
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
    console.warn("[booking/api] Unexpected error submitting booking:", err);
    return {
      success: false,
      errorCode: "NETWORK_ERROR",
      message: "Network error occurred while connecting to the booking service.",
    };
  }
}
