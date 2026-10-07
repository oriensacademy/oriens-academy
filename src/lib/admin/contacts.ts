import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";
import { reportAdminFailure, writeAdminAuditLog } from "@/lib/admin/audit";

export type ContactStatus = "new" | "in_progress" | "resolved" | "spam";

export type ContactRequestRow = Tables<"contact_requests">;
export type ContactReplyRow = Tables<"contact_replies">;

export type NotificationDeliveryRow = Tables<"notification_deliveries">;

export async function listContactReplies(
  contactId: string
): Promise<{ data: ContactReplyRow[]; error: string | null }> {
  const { data, error } = await getSupabaseClient()
    .from("contact_replies")
    .select("*")
    .eq("contact_request_id", contactId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function sendAdminContactReply(input: {
  contactRequestId: string;
  messageText: string;
  idempotencyKey: string;
}): Promise<{ reply: ContactReplyRow | null; duplicate: boolean; error: string | null }> {
  const { data, error } = await getSupabaseClient().functions.invoke("send-contact-reply", {
    body: input,
  });

  if (error) {
    void reportAdminFailure({ action: "contact.operation_failed", category: "contact", operation: "send_contact_reply", error, entityType: "contact_request", entityId: input.contactRequestId });
    return { reply: null, duplicate: false, error: "Yanıt gönderilemedi. Lütfen tekrar deneyin." };
  }

  const payload = data as {
    success?: boolean;
    duplicate?: boolean;
    reply?: ContactReplyRow;
    error_code?: string;
  } | null;

  if (!payload?.success || !payload.reply) {
    void reportAdminFailure({ action: "contact.operation_failed", category: "contact", operation: "send_contact_reply", error: { message: payload?.error_code || "Reply not confirmed" }, entityType: "contact_request", entityId: input.contactRequestId });
    return {
      reply: null,
      duplicate: Boolean(payload?.duplicate),
      error: payload?.error_code === "DELIVERY_FAILED"
        ? "E-posta sağlayıcısı yanıtı gönderemedi. Yeni bir deneme yapabilirsiniz."
        : "Yanıt gönderilemedi. Lütfen tekrar deneyin.",
    };
  }

  return {
    reply: payload.reply,
    duplicate: Boolean(payload.duplicate),
    error: null,
  };
}

export interface ListContactsParams {
  status?: ContactStatus | "all";
  search?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  archived?: boolean;
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
      .eq("is_archived", Boolean(params.archived))
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
      void reportAdminFailure({ action: "admin.data_load_failed", category: "admin", operation: "list_contact_requests", error, entityType: "contact_request" });
      console.error("[Admin Contacts] Error listing contact requests:", error);
      return { data: [], error: error.message };
    }

    return { data: (data as ContactRequestRow[]) || [], error: null };
  } catch (err) {
    void reportAdminFailure({ action: "admin.data_load_failed", category: "admin", operation: "list_contact_requests", error: err, entityType: "contact_request" });
    console.error("[Admin Contacts] Unexpected error listing contact requests:", err);
    return { data: [], error: "İletişim talepleri yüklenirken bir hata oluştu." };
  }
}

export async function archiveAdminContactRequest(contactId: string): Promise<{ success: boolean; error: string | null }> {
  // Generated RPC types are refreshed after migration promotion.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseClient() as any).rpc("admin_archive_contact_request", { p_contact_id: contactId });
  const result = data as { success?: boolean } | null;
  if (error || result?.success !== true) void reportAdminFailure({ action: "contact.operation_failed", category: "contact", operation: "archive_contact_request", error: error || { message: "Archive not confirmed" }, entityType: "contact_request", entityId: contactId });
  return { success: !error && result?.success === true, error: error?.message || null };
}

export async function restoreAdminContactRequest(contactId: string): Promise<{ success: boolean; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseClient() as any).rpc("admin_restore_contact_request", { p_contact_id: contactId });
  const result = data as { success?: boolean } | null;
  if (error || result?.success !== true) void reportAdminFailure({ action: "contact.operation_failed", category: "contact", operation: "restore_contact_request", error: error || { message: "Restore not confirmed" }, entityType: "contact_request", entityId: contactId });
  return { success: !error && result?.success === true, error: error?.message || null };
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
      void reportAdminFailure({ action: "contact.operation_failed", category: "contact", operation: "update_contact_status", error: updateErr, entityType: "contact_request", entityId: contactId });
      console.error("[Admin Contacts] Error updating status:", updateErr);
      return { success: false, error: updateErr.message };
    }

    await writeAdminAuditLog({ action: "contact.status_updated", category: "contact", entityType: "contact_request", entityId: contactId, metadata: { new_status: newStatus } });

    return { success: true, error: null };
  } catch (err) {
    void reportAdminFailure({ action: "contact.operation_failed", category: "contact", operation: "update_contact_status", error: err, entityType: "contact_request", entityId: contactId });
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
      .eq("is_archived", false)
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

export type ContactInboxReply = Pick<ContactReplyRow, "id" | "contact_request_id" | "direction" | "message_text" | "delivery_status" | "created_at" | "sent_at">;

/**
 * Referans İletişim Talepleri listesi: aktif ve arşiv talepleri birlikte, her
 * talebin yanıtlarıyla (son işlem ve "Siz:" özeti için) yüklenir. Filtreleme
 * istemcide yerel tarihlerle yapılır.
 */
export async function listAdminContactInbox(): Promise<{ data: ContactRequestRow[]; replies: ContactInboxReply[]; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from("contact_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      void reportAdminFailure({ action: "admin.data_load_failed", category: "admin", operation: "list_contact_requests", error, entityType: "contact_request" });
      return { data: [], replies: [], error: error.message };
    }
    const ids = (data || []).map((row) => row.id);
    const replies: ContactInboxReply[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data: chunk } = await supabase
        .from("contact_replies")
        .select("id,contact_request_id,direction,message_text,delivery_status,created_at,sent_at")
        .in("contact_request_id", ids.slice(i, i + 200))
        .order("created_at", { ascending: true });
      replies.push(...((chunk as ContactInboxReply[] | null) || []));
    }
    return { data: (data as ContactRequestRow[]) || [], replies, error: null };
  } catch (err) {
    void reportAdminFailure({ action: "admin.data_load_failed", category: "admin", operation: "list_contact_requests", error: err, entityType: "contact_request" });
    return { data: [], replies: [], error: "İletişim talepleri yüklenirken bir hata oluştu." };
  }
}
