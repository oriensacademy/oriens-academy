import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

export type AuditLogRow = Tables<"audit_logs">;

export interface ListAuditLogsParams {
  action?: string;
  entityType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface ListAuditLogsResult {
  data: AuditLogRow[];
  totalCount: number;
  error: string | null;
}

/**
 * Fetches audit log history for administrative inspection.
 * Strictly read-only query module.
 */
export async function listAdminAuditLogs(
  params: ListAuditLogsParams = {}
): Promise<ListAuditLogsResult> {
  const supabase = getSupabaseClient();
  const limit = params.limit || 50;
  const offset = params.offset || 0;

  try {
    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.entityType && params.entityType !== "all") {
      query = query.eq("entity_type", params.entityType);
    }

    if (params.action && params.action.trim() !== "") {
      query = query.ilike("action", `%${params.action.trim()}%`);
    }

    if (params.search && params.search.trim() !== "") {
      const s = `%${params.search.trim()}%`;
      query = query.or(`action.ilike.${s},entity_type.ilike.${s},entity_id.ilike.${s}`);
    }
    if (params.dateFrom) query = query.gte("created_at", `${params.dateFrom}T00:00:00.000Z`);
    if (params.dateTo) query = query.lte("created_at", `${params.dateTo}T23:59:59.999Z`);

    const { data, count, error } = await query;

    if (error) {
      console.error("[Admin Audit] Error listing audit logs:", error);
      return { data: [], totalCount: 0, error: error.message };
    }

    return {
      data: (data as AuditLogRow[]) || [],
      totalCount: count || 0,
      error: null,
    };
  } catch (err) {
    console.error("[Admin Audit] Unexpected error listing audit logs:", err);
    return { data: [], totalCount: 0, error: "Denetim kayıtları yüklenirken hata oluştu." };
  }
}

/**
 * Writes an administrative audit log record.
 */
export async function writeAdminAuditLog(params: {
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { success: false, error: "UNAUTHENTICATED" };

    const { error } = await supabase.from("audit_logs").insert({
      actor_user_id: userData.user.id,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      metadata: (params.metadata || {}) as never,
    });

    if (error) {
      console.warn("[Admin Audit] Error inserting audit log:", error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    console.warn("[Admin Audit] Unexpected error writing audit log:", err);
    return { success: false, error: "AUDIT_LOG_FAILED" };
  }
}
