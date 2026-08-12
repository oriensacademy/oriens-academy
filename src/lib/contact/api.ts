import { getSupabaseClient } from "@/lib/supabase/client";
import type { ContactRequestPayload, ContactResult } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/**
 * Submits a contact inquiry to the create-contact Edge Function.
 * Direct browser INSERT into contact_requests is blocked by RLS.
 */
export async function submitContact(
  payload: ContactRequestPayload
): Promise<ContactResult> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke("create-contact", {
      body: payload,
    });

    if (error) {
      return await submitContactFallback(payload);
    }

    if (data && data.success) {
      return {
        success: true,
        contactId: data.contactId,
        message: data.message,
      };
    }

    return {
      success: false,
      errorCode: data?.error_code || "STORAGE_FAILED",
      message: data?.message || "Contact request could not be submitted.",
    };
  } catch (err) {
    console.warn("[contact/api] Error submitting contact, attempting fallback fetch...", err);
    return await submitContactFallback(payload);
  }
}

async function submitContactFallback(
  payload: ContactRequestPayload
): Promise<ContactResult> {
  if (!SUPABASE_URL || SUPABASE_URL.includes("placeholder")) {
    return {
      success: false,
      errorCode: "NETWORK_ERROR",
      message: "Supabase environment configuration is missing.",
    };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-contact`, {
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
        contactId: json.contactId,
        message: json.message,
      };
    }

    return {
      success: false,
      errorCode: json.error_code || "STORAGE_FAILED",
      message: json.message || "Contact request could not be submitted.",
    };
  } catch {
    return {
      success: false,
      errorCode: "NETWORK_ERROR",
      message: "Network error occurred while connecting to the contact service.",
    };
  }
}
