import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

export type NotificationDeliveryRow = Tables<"notification_deliveries"> & {
  subject?: string | null;
  payload?: Record<string, unknown> | null;
  template?: string | null;
  next_attempt_at?: string | null;
  last_error?: string | null;
};

export type DeliveryStatus = "sent" | "failed" | "pending" | "processing" | "delivered";

export async function retryAdminNotification(deliveryId: string) {
  const { data, error } = await getSupabaseClient().rpc("admin_retry_email_notification", { p_delivery_id: deliveryId });
  const result = data as { success?: boolean; error_code?: string } | null;
  return { success: !error && result?.success === true, error: error?.message || result?.error_code || null };
}

export async function deleteAdminNotification(deliveryId: string): Promise<{ success: boolean; error: string | null }> {
  // Generated RPC types are refreshed after the migration is promoted.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseClient() as any).rpc("admin_delete_notification_delivery", { p_delivery_id: deliveryId });
  const result = data as { success?: boolean; error_code?: string } | null;
  return { success: !error && result?.success === true, error: error?.message || result?.error_code || null };
}

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
  const eventTitles: Record<string, string> = {
    "consultation.created.admin_notification": "Görüşme Talebi — Yönetici Bildirimi",
    "consultation.created.student_acknowledgement": "Görüşme Talebi — Kullanıcı Bilgilendirmesi",
    "package.activated": "Paket Tanımlandı",
    "appointment.reminder": "Ders Hatırlatması",
  };
  const eventTitle = eventTitles[String(row.event_type || "").toLowerCase()];
  if (eventTitle) return eventTitle;

  if (row.subject && row.subject.trim()) {
    return eventTitles[row.subject.trim().toLowerCase()] || row.subject;
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
  if (type.includes("payment.success") || type.includes("payment_success") || type.includes("paid")) {
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

  if (type === "consultation.created.admin_notification") return "Görüşme Talebi — Yönetici Bildirimi";
  if (type === "consultation.created.student_acknowledgement") return "Görüşme Talebi — Kullanıcı Bilgilendirmesi";
  if (type === "appointment.reminder") return "Ders Hatırlatması";

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
  if (type.includes("payment.success") || type.includes("payment.paid") || type.includes("payment_success")) {
    return isTr ? "Ödeme Alındı" : "Payment Received";
  }
  if (type.includes("package.activated") || type.includes("package.assigned") || type.includes("package_assigned")) {
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
      .eq("is_archived", false)
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

// ================== E-posta Geçmişi (referans #view-bildirim) ==================

export type EmailHistoryKind = "rapor" | "odeme" | "paket" | "hosgeldin" | "otp" | "diger";
export type EmailHistoryStatus = "ok" | "fail" | "wait";

export const EMAIL_HISTORY_KIND_LABEL: Record<EmailHistoryKind, string> = {
  rapor: "Ders raporu",
  paket: "Paket tanımlandı",
  odeme: "Ödeme alındı",
  hosgeldin: "Hesap oluşturuldu",
  otp: "Doğrulama kodu",
  diger: "Diğer",
};

/** Teslimat olayını referanstaki e-posta türüne eşler. */
export function emailHistoryKind(eventType: string | null | undefined): EmailHistoryKind {
  const type = String(eventType || "").toLowerCase();
  if (type.includes("otp") || type.includes("verification") || type.includes("password")) return "otp";
  if (type.includes("welcome")) return "hosgeldin";
  if (type.startsWith("payment.") || type.includes("bank_transfer")) return "odeme";
  if (type.startsWith("package.") || type.includes("remaining_rights")) return "paket";
  if (type.includes("report") || type.startsWith("lesson.completed") || type === "lesson.completion_email") return "rapor";
  return "diger";
}

export function emailHistoryStatus(status: string | null | undefined): EmailHistoryStatus {
  if (status === "sent" || status === "delivered") return "ok";
  if (status === "failed") return "fail";
  return "wait";
}

export interface EmailHistoryPerson {
  name: string;
  role: "Veli" | "Öğrenci";
  studentName: string | null;
  studentId: string | null;
}

export interface EmailHistoryRow {
  id: string;
  kind: EmailHistoryKind;
  status: EmailHistoryStatus;
  subject: string;
  recipient: string;
  messageId: string | null;
  at: string;
  canRetry: boolean;
  person: EmailHistoryPerson | null;
  raw: NotificationDeliveryRow;
}

export interface EmailHistoryResult {
  rows: EmailHistoryRow[];
  total: number;
  okCount: number;
  failCount: number;
  error: string | null;
}

const EMAIL_HISTORY_LIMIT = 1000;

/**
 * E-posta Geçmişi listesi: son 1000 teslimat + tüm kayıtlar üzerinden durum
 * sayıları. Alıcı adı veli/öğrenci kayıtlarındaki e-postadan çözülür.
 */
export async function listAdminEmailHistory(): Promise<EmailHistoryResult> {
  const supabase = getSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const untyped = supabase as any;
  const base = () => supabase.from("notification_deliveries").select("id", { count: "exact", head: true }).eq("is_archived", false);
  const [list, okRes, failRes, guardians, links, students] = await Promise.all([
    supabase.from("notification_deliveries").select("*", { count: "exact" }).eq("is_archived", false).eq("channel", "email").order("created_at", { ascending: false }).limit(EMAIL_HISTORY_LIMIT),
    base().eq("channel", "email").in("status", ["sent", "delivered"]),
    base().eq("channel", "email").eq("status", "failed"),
    untyped.from("guardian_accounts").select("user_id,full_name,email") as Promise<{ data: { user_id: string; full_name: string | null; email: string | null }[] | null }>,
    untyped.from("guardian_students").select("guardian_user_id,student_id,is_primary").eq("active", true) as Promise<{ data: { guardian_user_id: string; student_id: string; is_primary: boolean | null }[] | null }>,
    untyped.from("student_profiles").select("id,full_name,email") as Promise<{ data: { id: string; full_name: string | null; email: string | null }[] | null }>,
  ]);
  if (list.error) return { rows: [], total: 0, okCount: 0, failCount: 0, error: "E-posta geçmişi yüklenemedi." };

  const studentById = new Map((students.data ?? []).map((s) => [s.id, s]));
  const firstStudentOfGuardian = new Map<string, string>();
  for (const link of links.data ?? []) {
    if (!firstStudentOfGuardian.has(link.guardian_user_id) || link.is_primary) firstStudentOfGuardian.set(link.guardian_user_id, link.student_id);
  }
  const people = new Map<string, EmailHistoryPerson>();
  for (const g of guardians.data ?? []) {
    const email = g.email?.trim().toLowerCase();
    if (!email || !g.full_name?.trim()) continue;
    const studentId = firstStudentOfGuardian.get(g.user_id) ?? null;
    const student = studentId ? studentById.get(studentId) : undefined;
    const self = student && student.email?.trim().toLowerCase() === email;
    people.set(email, {
      name: g.full_name.trim(),
      role: self ? "Öğrenci" : "Veli",
      studentName: !self && student?.full_name?.trim() ? student.full_name.trim() : null,
      studentId: student ? studentId : null,
    });
  }
  for (const s of students.data ?? []) {
    const email = s.email?.trim().toLowerCase();
    if (!email || people.has(email) || !s.full_name?.trim()) continue;
    people.set(email, { name: s.full_name.trim(), role: "Öğrenci", studentName: null, studentId: s.id });
  }

  const rows = ((list.data ?? []) as NotificationDeliveryRow[]).map((row) => {
    const status = emailHistoryStatus(row.status);
    return {
      id: row.id,
      kind: emailHistoryKind(row.event_type),
      status,
      subject: humanizeNotificationSubject(row, "tr"),
      recipient: row.recipient,
      messageId: row.provider_message_id ?? null,
      at: row.sent_at || row.created_at,
      canRetry: status === "fail" && Boolean(row.template),
      person: people.get(String(row.recipient || "").trim().toLowerCase()) ?? null,
      raw: row,
    };
  });
  return { rows, total: list.count ?? rows.length, okCount: okRes.count ?? 0, failCount: failRes.count ?? 0, error: null };
}

/**
 * Gönderilen şablonun tam metni sistemde saklanmaz; ayrıntı penceresinde
 * teslimat kaydındaki içerik alanları okunur biçimde gösterilir.
 */
export function emailHistoryBody(row: NotificationDeliveryRow): string {
  const payload = (typeof row.payload === "object" && row.payload !== null ? row.payload : {}) as Record<string, unknown>;
  const labels: [string, string][] = [
    ["guardian_name", "Veli"],
    ["student_name", "Öğrenci"],
    ["learner_name", "Öğrenci"],
    ["lesson_title", "Ders konusu"],
    ["lesson_date", "Ders tarihi"],
    ["completion_report", "Ders raporu"],
    ["package_name", "Paket"],
    ["total_remaining_lessons", "Kalan ders hakkı"],
    ["remaining_lessons", "Kalan ders hakkı"],
    ["amount", "Tutar"],
  ];
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const [key, label] of labels) {
    const value = payload[key];
    if (seen.has(label) && value != null) continue;
    if (value != null && value !== "") seen.add(label);
    if (key === "lesson_date" && typeof value === "string" && !Number.isNaN(Date.parse(value))) {
      lines.push(`${label}: ${new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value))}`);
    } else if (typeof value === "string" && value.trim()) lines.push(`${label}: ${value.trim()}`);
    else if (typeof value === "number") lines.push(`${label}: ${value.toLocaleString("tr-TR")}`);
  }
  if (row.last_error_code && emailHistoryStatus(row.status) === "fail") lines.push(`Hata: ${row.last_error_code}`);
  return lines.length
    ? lines.join("\n")
    : "Bu e-postanın tam metni sistemde saklanmaz. Konu, alıcı ve teslim bilgileri yukarıda yer alır.";
}
