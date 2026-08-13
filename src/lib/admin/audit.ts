import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

export type AuditLogRow = Tables<"audit_logs">;

export interface ListAuditLogsParams {
  action?: string;
  entityType?: string;
  search?: string;
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
