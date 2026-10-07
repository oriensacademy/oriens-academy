export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates an official, strictly alphanumeric PayTR merchant_oid.
 *
 * Official PayTR Specification:
 * - Must strictly match: ^[A-Za-z0-9]{1,64}$
 * - Unique per payment attempt
 * - Max 64 characters
 * - No hyphens, underscores, slashes, spaces, or special characters.
 */
export function generatePaytrMerchantOid(): string {
  const now = new Date();
  const year = now.getUTCFullYear().toString();
  const month = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = now.getUTCDate().toString().padStart(2, "0");
  const hours = now.getUTCHours().toString().padStart(2, "0");
  const mins = now.getUTCMinutes().toString().padStart(2, "0");
  const secs = now.getUTCSeconds().toString().padStart(2, "0");
  const dateStr = `${year}${month}${day}${hours}${mins}${secs}`;

  const randomBytes = crypto.getRandomValues(new Uint8Array(6));
  const randomHex = Array.from(randomBytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();

  const oid = `ORI${dateStr}${randomHex}`;

  if (!/^[A-Za-z0-9]{1,64}$/.test(oid)) {
    throw new Error(`Generated merchant_oid "${oid}" does not match ^[A-Za-z0-9]{1,64}$`);
  }

  return oid;
}

export function createStatusCredential(customReference?: string) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(tokenBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const reference = customReference || generatePaytrMerchantOid();
  return { token, reference };
}

export const STATUS_TOKEN_REGEX = /^[a-f0-9]{64}$/;

/**
 * Validates public payment references against canonical supported formats:
 * 1. Current PayTR merchant_oid format: "ORI" prefix + alphanumeric, max 64 chars.
 *    Example: "ORI202609051733579A789DD7E625" (29 chars)
 * 2. Legacy internal format: "OA-" + alphanumeric uppercase + 6 hex chars.
 *    Example: "OA-SINGLE-A1B2C3"
 *
 * Strict protection against injection, whitespace, and malformed strings.
 */
export function isValidPaymentReference(ref: unknown): boolean {
  if (typeof ref !== "string") return false;
  const trimmed = ref.trim().toUpperCase();
  if (!trimmed || trimmed.length > 64) return false;
  if (/^ORI[A-Z0-9]{10,61}$/.test(trimmed)) return true;
  if (/^OA-[A-Z0-9]+-[A-F0-9]{6}$/.test(trimmed)) return true;
  return false;
}

