import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

export type NotificationDeliveryRow = Tables<"notification_deliveries"> & {
  subject?: string | null;
  payload?: Record<string, unknown> | null;
};

export type DeliveryStatus = "sent" | "failed" | "pending" | "delivered";

export interface ListNotificationsParams {
  status?: DeliveryStatus | "all";
  eventType?: string;
  provider?: string;
  channel?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface ListNotificationsResult {
  data: NotificationDeliveryRow[];
  totalCount: number;
  error: string | null;
}

/**
 * Derives a human-readable notification subject/title from the delivery row.
 */
export function humanizeNotificationSubject(row: NotificationDeliveryRow, locale: "tr" | "en" = "tr"): string {
  if (row.subject && row.subject.trim()) {
    return row.subject;
  }

  const isTr = locale === "tr";
  const payload = (typeof row.payload === "object" && row.payload !== null ? row.payload : {}) as Record<string, unknown>;

  // Check if subject is inside payload
  if (typeof payload.subject === "string" && payload.subject.trim()) {
    return payload.subject;
  }

  const type = String(row.event_type || "");

  if (type.includes("welcome")) {
    return isTr ? "Hoş Geldiniz — Oriens Academy" : "Welcome to Oriens Academy";
  }
  if (type.includes("booking_confirmed") || type.includes("appointment_confirmed")) {
    return isTr ? "Ders Randevunuz Onaylandı" : "Lesson Appointment Confirmed";
  }
  if (type.includes("appointment_updated") || type.includes("reschedule")) {
    return isTr ? "Ders / Görüşme Bilgileriniz Güncellendi" : "Lesson / Meeting Rescheduled";
  }
  if (type.includes("payment_success") || type.includes("paid")) {
    return isTr ? "Ödeme Başarılı & Paket Onayı" : "Payment Received & Package Active";
  }
  if (type.includes("bank_transfer_pending")) {
    return isTr ? "Banka Havalesi Ödeme Bilgileri" : "Bank Transfer Payment Instructions";
  }
  if (type.includes("bank_transfer_approved")) {
    return isTr ? "Havaleniz Onaylandı & Paket Aktif" : "Bank Transfer Approved & Package Active";
  }
  if (type.includes("admin_payment_notification")) {
    return isTr ? "Yeni Ödeme Bildirimi (Admin)" : "New Payment Notification (Admin)";
  }
  if (type.includes("contact_request")) {
    return isTr ? "Yeni İletişim / Danışmanlık Talebi" : "New Contact / Consultation Inquiry";
  }
  if (type.includes("homework")) {
    return isTr ? "Ödev / Çalışma Bildirimi" : "Homework / Assignment Notification";
  }

  return type
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Maps raw event_type strings to clean, operator-friendly humanized labels.
 */
export function humanizeEventType(eventType: string, locale: "tr" | "en" = "tr"): string {
  const isTr = locale === "tr";
  const type = String(eventType || "").toLowerCase();

  if (type.includes("support.ticket_created") || type.includes("support_ticket_created")) {
    return isTr ? "Destek Talebi Oluşturuldu" : "Support Ticket Created";
  }
  if (type.includes("support.reply") || type.includes("support_reply")) {
    return isTr ? "Destek Yanıtı İletildi" : "Support Reply Delivered";
  }
  if (type.includes("lesson.created") || type.includes("lesson_scheduled") || type.includes("booking_confirmed")) {
    return isTr ? "Ders Planlandı" : "Lesson Scheduled";
  }
  if (type.includes("lesson.updated") || type.includes("appointment_updated") || type.includes("reschedule")) {
    return isTr ? "Ders / Görüşme Güncellendi" : "Lesson / Meeting Rescheduled";
  }
  if (type.includes("lesson.completed")) {
    return isTr ? "Ders Tamamlandı" : "Lesson Completed";
  }
  if (type.includes("payment.paid") || type.includes("payment_success")) {
    return isTr ? "Ödeme Alındı" : "Payment Received";
  }
  if (type.includes("package.assigned") || type.includes("package_assigned")) {
    return isTr ? "Paket Tanımlandı" : "Package Assigned";
  }
  if (type.includes("welcome")) {
    return isTr ? "Hesap Oluşturuldu / Hoş Geldiniz" : "Account Welcome";
  }
  if (type.includes("contact_request") || type.includes("contact_form")) {
    return isTr ? "İletişim / Danışmanlık Talebi" : "Contact / Consultation Request";
  }
  if (type.includes("homework")) {
    return isTr ? "Ödev / Çalışma Bildirimi" : "Homework / Assignment Notification";
  }
  if (type.includes("bank_transfer_pending")) {
    return isTr ? "Havale / EFT Bildirimi" : "Bank Transfer Pending";
  }
  if (type.includes("bank_transfer_approved")) {
    return isTr ? "Havale Onaylandı" : "Bank Transfer Approved";
  }

  return type
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Marks specific notification deliveries or all as read.
 */
export async function adminMarkNotificationsRead(
  notificationIds?: string[],
  markAll = false
): Promise<{ success: boolean; updatedCount: number; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("admin_mark_notifications_read", {
      p_notification_ids: notificationIds || null,
      p_mark_all: markAll,
    });

    if (error) {
      console.error("[Admin Notifications] Error marking read:", error);
      return { success: false, updatedCount: 0, error: error.message };
    }

    return {
      success: true,
      updatedCount: data?.updated_count || 0,
      error: null,
    };
  } catch (err) {
    console.error("[Admin Notifications] Unexpected error marking read:", err);
    return { success: false, updatedCount: 0, error: "Bildirimler okundu olarak işaretlenemedi." };
  }
}

/**
 * Fetches notification delivery logs for administrative inspection.
 * Supports pagination (default limit: 25) and server-side filtering.
 */
export async function listAdminNotifications(
  params: ListNotificationsParams = {}
): Promise<ListNotificationsResult> {
  const supabase = getSupabaseClient();
  const limit = params.limit || 25;
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

    if (params.channel && params.channel !== "all") {
      query = query.eq("channel", params.channel);
    }

    if (params.dateFrom) {
      query = query.gte("created_at", `${params.dateFrom}T00:00:00.000Z`);
    }

    if (params.dateTo) {
      query = query.lte("created_at", `${params.dateTo}T23:59:59.999Z`);
    }

    if (params.search && params.search.trim() !== "") {
      const s = `%${params.search.trim()}%`;
      query = query.or(`recipient.ilike.${s},provider_message_id.ilike.${s},last_error_code.ilike.${s},event_type.ilike.${s}`);
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
