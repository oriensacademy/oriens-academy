import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

export type NotificationDeliveryRow = Tables<"notification_deliveries">;

export type DeliveryStatus = "sent" | "failed" | "pending";

export interface ListNotificationsParams {
  status?: DeliveryStatus | "all";
  eventType?: string;
  provider?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListNotificationsResult {
  data: NotificationDeliveryRow[];
  totalCount: number;
  error: string | null;
}

/**
 * Fetches notification delivery logs for administrative inspection.
 * Supports pagination (default limit: 50) and server-side filtering.
 */
export async function listAdminNotifications(
  params: ListNotificationsParams = {}
): Promise<ListNotificationsResult> {
  const supabase = getSupabaseClient();
  const limit = params.limit || 50;
  const offset = params.offset || 0;

  try {
    let query = supabase
      .from("notification_deliveries")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }

    if (params.eventType && params.eventType !== "all") {
      query = query.ilike("event_type", `%${params.eventType}%`);
    }

    if (params.provider && params.provider !== "all") {
      query = query.eq("provider", params.provider);
    }

    if (params.search && params.search.trim() !== "") {
      const s = `%${params.search.trim()}%`;
      query = query.or(`recipient.ilike.${s},provider_message_id.ilike.${s},last_error_code.ilike.${s}`);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("[Admin Notifications] Error listing deliveries:", error);
      return { data: [], totalCount: 0, error: error.message };
    }

    return {
      data: (data as NotificationDeliveryRow[]) || [],
      totalCount: count || 0,
      error: null,
    };
  } catch (err) {
    console.error("[Admin Notifications] Unexpected error listing deliveries:", err);
    return { data: [], totalCount: 0, error: "Bildirim teslimatları yüklenirken bir hata oluştu." };
  }
}
