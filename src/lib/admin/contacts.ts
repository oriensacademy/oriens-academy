import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

export type ContactStatus = "new" | "in_progress" | "resolved" | "spam";

export type ContactRequestRow = Tables<"contact_requests">;

export type NotificationDeliveryRow = Tables<"notification_deliveries">;

export interface ListContactsParams {
  status?: ContactStatus | "all";
  search?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

export interface ListContactsResult {
  data: ContactRequestRow[];
  error: string | null;
}

/**
 * Fetches contact requests for administrative view.
 * Enforces server-side database RLS policy (requires public.is_admin()).
 */
export async function listAdminContactRequests(
  params: ListContactsParams = {}
): Promise<ListContactsResult> {
  const supabase = getSupabaseClient();

  try {
    let query = supabase
      .from("contact_requests")
      .select("*")
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
      query = query.or(
        `full_name.ilike.${s},email.ilike.${s},phone.ilike.${s},subject.ilike.${s},message.ilike.${s}`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Admin Contacts] Error listing contact requests:", error);
      return { data: [], error: error.message };
    }

    return { data: (data as ContactRequestRow[]) || [], error: null };
  } catch (err) {
    console.error("[Admin Contacts] Unexpected error listing contact requests:", err);
    return { data: [], error: "İletişim talepleri yüklenirken bir hata oluştu." };
  }
}

/**
 * Updates a contact request's workflow status.
 * Writes audit log to public.audit_logs.
 */
export async function updateAdminContactStatus(
  contactId: string,
  newStatus: ContactStatus
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    const { error: updateErr } = await supabase
      .from("contact_requests")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", contactId);

    if (updateErr) {
      console.error("[Admin Contacts] Error updating status:", updateErr);
      return { success: false, error: updateErr.message };
    }

    // Log admin audit event
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      actor_user_id: userData.user?.id || null,
      action: "admin.contact.status_updated",
      entity_type: "contact_request",
      entity_id: contactId,
      metadata: { new_status: newStatus },
    });

    return { success: true, error: null };
  } catch (err) {
    console.error("[Admin Contacts] Unexpected error updating status:", err);
    return { success: false, error: "Güncelleme sırasında bir hata oluştu." };
  }
}

/**
 * Fetches notification delivery logs for a given contact request ID.
 */
export async function getContactNotificationDeliveries(
  contactId: string
): Promise<{ data: NotificationDeliveryRow[]; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("notification_deliveries")
      .select("*")
      .eq("entity_id", contactId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Admin Contacts] Error fetching deliveries:", error);
      return { data: [], error: error.message };
    }

    return { data: (data as NotificationDeliveryRow[]) || [], error: null };
  } catch (err) {
    console.error("[Admin Contacts] Unexpected error fetching deliveries:", err);
    return { data: [], error: "Bildirim teslimatları yüklenemedi." };
  }
}

/**
 * Returns real count of new & in_progress contact requests for the admin dashboard.
 */
export async function getUnresolvedContactCounts(): Promise<{
  newCount: number;
  inProgressCount: number;
  error: string | null;
}> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("contact_requests")
      .select("status")
      .in("status", ["new", "in_progress"]);

    if (error) {
      return { newCount: 0, inProgressCount: 0, error: error.message };
    }

    const newCount = (data || []).filter((r) => r.status === "new").length;
    const inProgressCount = (data || []).filter((r) => r.status === "in_progress").length;

    return { newCount, inProgressCount, error: null };
  } catch {
    return { newCount: 0, inProgressCount: 0, error: "Count error" };
  }
}
