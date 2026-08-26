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
