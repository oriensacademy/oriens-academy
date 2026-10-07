/**
 * Safe Payment Audit Logging Helper for Supabase Edge Functions
 *
 * Enforces:
 * 1. Zero PCI / Cardholder data logging (PAN, CVV, expiry strictly prohibited)
 * 2. Zero Secrets / Credential logging (merchant_key, merchant_salt, raw status/iframe tokens prohibited)
 * 3. Canonical correlation fields (transaction_id, public_reference, correlation_id)
 * 4. Entity type canonicalization (entity_type = "payment_transaction", entity_id = public_reference)
 * 5. Optional deduplication (dedupe = true) to prevent polling loops / repeated events
 * 6. Non-blocking fail-safe execution
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type AuditSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export interface PaymentAuditEventInput {
  action: string;
  publicReference: string;
  transactionId?: string | null;
  actorUserId?: string | null;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
  dedupe?: boolean;
}

const FORBIDDEN_KEY_PATTERNS = [
  /pan/i,
  /card_number/i,
  /cardnumber/i,
  /cvv/i,
  /cvc/i,
  /expiry/i,
  /expiration/i,
  /card_holder/i,
  /cardholder/i,
  /merchant_key/i,
  /merchant_salt/i,
  /merchantkey/i,
  /merchantsalt/i,
  /\bhash\b/i,
  /\btoken\b/i,
  /status_token/i,
  /statustoken/i,
  /iframe_token/i,
  /iframetoken/i,
  /paytr_token/i,
  /paytrtoken/i,
  /password/i,
  /authorization/i,
  /cookie/i,
];

/**
 * Recursively redacts any forbidden keys from metadata objects.
 */
export function sanitizePaymentMetadata(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || obj === undefined) return null;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizePaymentMetadata(item, depth + 1));
  }

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // Check if key is forbidden
    const isForbidden = FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isForbidden) {
      // Omit sensitive data entirely
      continue;
    }

    if (typeof value === "object" && value !== null) {
      clean[key] = sanitizePaymentMetadata(value, depth + 1);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Records a safe payment audit log row into public.audit_logs.
 * Non-blocking: logs warnings on failure without throwing or aborting.
 */
export async function recordPaymentAuditEvent(
  admin: SupabaseClient,
  input: PaymentAuditEventInput
): Promise<boolean> {
  try {
    const action = String(input.action ?? "").trim();
    const publicReference = String(input.publicReference ?? "").trim();

    if (!action || !publicReference) {
      return false;
    }

    // Optional canonical deduplication (e.g. For polling states or repeated UI events)
    if (input.dedupe) {
      const { data: existing } = await admin
        .from("audit_logs")
        .select("id")
        .eq("entity_id", publicReference)
        .eq("action", action)
        .limit(1)
        .maybeSingle();

      if (existing) {
        return true; // Already recorded, skip duplicate
      }
    }

    const rawMeta = {
      ...(input.metadata ?? {}),
      transaction_id: input.transactionId || input.metadata?.transaction_id || null,
      public_reference: publicReference,
      correlation_id: input.transactionId || publicReference,
      severity: input.severity || "INFO",
      logged_at: new Date().toISOString(),
    };

    const safeMetadata = sanitizePaymentMetadata(rawMeta) as Record<string, unknown>;

    const { error } = await admin.from("audit_logs").insert({
      actor_user_id: input.actorUserId || null,
      action,
      category: "payment",
      severity: (input.severity || "INFO").toLowerCase(),
      correlation_id: input.transactionId || publicReference,
      entity_type: "payment_transaction",
      entity_id: publicReference,
      metadata: safeMetadata,
    });

    if (error) {
      console.warn(`[payment-audit] Failed to write audit log action=${action}: ${error.message}`);
      return false;
    }

    return true;
  } catch (err) {
    console.warn(`[payment-audit] Unexpected error writing audit log action=${input.action} type=${err instanceof Error ? err.name : "unknown"}`);
    return false;
  }
}
