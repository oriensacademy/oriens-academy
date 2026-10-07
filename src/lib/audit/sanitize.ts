const SENSITIVE_KEY = /(password|passcode|otp|authorization|token|cookie|secret|service[_-]?role|credential|merchant|pan|cvv|card[_-]?number)/i;
const MAX_MESSAGE = 500;
const MAX_DEPTH = 5;

export function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[TRUNCATED]";
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.replace(/[\r\n\t]+/g, " ").slice(0, MAX_MESSAGE);
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeAuditValue(item, depth + 1));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value).slice(0, 40)) {
      output[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : sanitizeAuditValue(child, depth + 1);
    }
    return output;
  }
  return String(value).slice(0, MAX_MESSAGE);
}

export function sanitizeAuditError(error: unknown, context: Record<string, unknown> = {}) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  return sanitizeAuditValue({
    ...context,
    safe_error_code: record.code ?? record.error_code,
    http_status: record.status ?? record.statusCode,
    safe_message: typeof record.message === "string" ? record.message : typeof error === "string" ? error : "Unexpected operation failure",
  }) as Record<string, unknown>;
}
