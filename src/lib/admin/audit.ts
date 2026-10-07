import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";
import { sanitizeAuditError, sanitizeAuditValue } from "@/lib/audit/sanitize";

export type AuditLogRow = Tables<"audit_logs"> & {
  severity: "info" | "warning" | "error" | "critical";
  category: "auth" | "admin" | "student" | "lesson" | "package" | "payment" | "email" | "blog" | "contact" | "database" | "edge" | "system";
  correlation_id: string | null;
};

export interface ListAuditLogsParams {
  action?: string;
  entityType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  severity?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export interface ListAuditLogsResult {
  data: AuditLogRow[];
  totalCount: number;
  error: string | null;
}

export async function deleteAdminAuditLog(logId: number): Promise<{ success: boolean; error: string | null }> {
  // Generated RPC types are refreshed after the migration is promoted.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseClient() as any).rpc("admin_delete_audit_log", { p_log_id: logId });
  const result = data as { success?: boolean; error_code?: string } | null;
  return { success: !error && result?.success === true, error: error?.message || result?.error_code || null };
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
    // Generated database types are refreshed after the additive migration.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.entityType && params.entityType !== "all") {
      query = query.eq("entity_type", params.entityType);
    }
    if (params.severity && params.severity !== "all") query = query.eq("severity", params.severity);
    if (params.category && params.category !== "all") query = query.eq("category", params.category);

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
  category?: AuditLogRow["category"];
  severity?: AuditLogRow["severity"];
  entityType?: string;
  entityId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { success: false, error: "UNAUTHENTICATED" };

    // Generated RPC types intentionally lag the additive migration.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("write_audit_event", {
      p_action: params.action, p_category: params.category || "admin", p_severity: params.severity || "info",
      p_entity_type: params.entityType || null, p_entity_id: params.entityId || null,
      p_correlation_id: params.correlationId || null, p_metadata: sanitizeAuditValue(params.metadata || {}),
      p_actor_user_id: userData.user.id,
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

export async function reportAdminFailure(params: {
  action: string; category: AuditLogRow["category"]; operation: string; error: unknown;
  entityType?: string; entityId?: string; correlationId?: string; route?: string;
}) {
  const metadata = sanitizeAuditError(params.error, { operation: params.operation, route: params.route });
  const primary = await writeAdminAuditLog({
    action: params.action, category: params.category, severity: "error", entityType: params.entityType,
    entityId: params.entityId, correlationId: params.correlationId,
    metadata,
  });
  const record = params.error && typeof params.error === "object" ? params.error as Record<string, unknown> : {};
  const code = String(record.code || record.error_code || "");
  const message = String(record.message || "");
  const isRlsDenial = /row.level security|\brls\b/i.test(message);
  const isPermissionDenial = code === "42501" || /permission denied/i.test(message) || isRlsDenial;
  if (isPermissionDenial && params.action !== "database.permission_denied") {
    await writeAdminAuditLog({ action: isRlsDenial ? "database.rls_denied" : "database.permission_denied", category: "database", severity: "error", entityType: params.entityType, entityId: params.entityId, correlationId: params.correlationId, metadata });
  } else if ((code.startsWith("PGRST") || code.startsWith("PG")) && params.category !== "database") {
    await writeAdminAuditLog({ action: "database.rpc_failed", category: "database", severity: "error", entityType: params.entityType, entityId: params.entityId, correlationId: params.correlationId, metadata });
  }
  return primary;
}
