/**
 * Canonical OTP hashing — the ONLY place an OTP is turned into a stored hash.
 *
 * Producer and verifier previously each carried their own copy of this
 * function. They happened to agree, but nothing enforced that: a one-character
 * drift in the message layout between the two files would silently reject every
 * correct code, and would be invisible in review. Both sides now import this.
 *
 * The message layouts below are FROZEN. Changing one invalidates every OTP that
 * is already in a user's inbox, so a change here needs a migration strategy,
 * not just an edit.
 */

/** Which flow an OTP belongs to. Bound into the hash so codes cannot cross flows. */
export type OtpPurpose = "purchase_email_verification" | "email_change";

export interface OtpHashInput {
  purpose: OtpPurpose;
  userId: string;
  /** The address the code was sent to. Always normalized before hashing. */
  email: string;
  /** The 6-digit code, as a string. Never a number — see normalizeOtpCode. */
  code: string;
  secret: string;
}

/** Exactly six ASCII digits. Leading zeros are significant and preserved. */
export const OTP_PATTERN = /^[0-9]{6}$/;

/**
 * The single normalization applied to a submitted code: trim surrounding
 * whitespace and strip the separators mail clients and password managers like
 * to insert (`123 456`, `123-456`). Anything else is rejected rather than
 * coerced, and the result is always a string.
 */
export function normalizeOtpCode(raw: unknown): string {
  if (typeof raw === "number") {
    // A number cannot represent "012345". Reaching here means a caller lost the
    // leading zero before we ever saw the value, so refuse instead of guessing.
    return "";
  }
  if (typeof raw !== "string") return "";
  const cleaned = raw.trim().replace(/[\s\-_.]/g, "");
  return OTP_PATTERN.test(cleaned) ? cleaned : "";
}

/** Lowercased, trimmed address. Both sides must hash the identical string. */
export function normalizeOtpEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

/**
 * Generates a 6-digit code as a string, uniformly distributed over the full
 * 000000..999999 range — including codes with leading zeros, which the previous
 * `100000 + (n % 900000)` formula could never produce.
 */
export function generateOtpCode(): string {
  const buffer = new Uint32Array(1);
  // Rejection sampling: 4294967295 is not a multiple of 1000000, so a plain
  // modulo would bias the low codes. Resample the tail instead.
  const limit = Math.floor(0xffffffff / 1000000) * 1000000;
  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return String(value % 1000000).padStart(6, "0");
}

function messageFor(input: OtpHashInput): string {
  const email = normalizeOtpEmail(input.email);
  // FROZEN LAYOUTS — see the file header before touching these.
  return input.purpose === "email_change"
    ? `email_change:${input.userId}:${email}:${input.code}`
    : `${input.userId}:${email}:${input.code}`;
}

export async function computeOtpHash(input: OtpHashInput): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(input.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(messageFor(input)));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Length-independent comparison for two hex digests. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
