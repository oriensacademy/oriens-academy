import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SENSITIVE_KEY = /(password|passcode|otp|authorization|token|cookie|secret|service[_-]?role|credential|merchant|pan|cvv|card[_-]?number)/i;

export function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[TRUNCATED]";
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.replace(/[\r\n\t]+/g, " ").slice(0, 500);
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeAuditValue(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value).slice(0, 40)) out[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : sanitizeAuditValue(child, depth + 1);
    return out;
  }
  return String(value).slice(0, 500);
}

export function sanitizeAuditError(error: unknown, context: Record<string, unknown> = {}) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  return sanitizeAuditValue({ ...context, safe_error_code: record.code ?? record.error_code, http_status: record.status ?? record.statusCode, safe_message: typeof record.message === "string" ? record.message : "Unexpected operation failure" }) as Record<string, unknown>;
}

export async function writeEdgeAuditEvent(supabase: SupabaseClient, event: { action: string; category: string; severity?: string; entityType?: string; entityId?: string; correlationId?: string; metadata?: Record<string, unknown> }) {
  try {
    await supabase.rpc("write_audit_event", { p_action: event.action, p_category: event.category, p_severity: event.severity ?? "info", p_entity_type: event.entityType ?? null, p_entity_id: event.entityId ?? null, p_correlation_id: event.correlationId ?? null, p_metadata: sanitizeAuditValue(event.metadata ?? {}) });
  } catch { /* Observability is non-authoritative. */ }
}
