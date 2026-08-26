/**
 * PayTR iFrame API Shared Utilities
 *
 * Provides official PayTR token calculation, hash verification,
 * basket encoding, and timing-safe comparison.
 *
 * Sensitive merchant secrets (merchant_key, merchant_salt) are only
 * accessed server-side and never logged or exposed.
 */

export interface PaytrCallbackPayload {
  merchant_oid: string;
  status: "success" | "failed" | string;
  total_amount: string;
  hash: string;
  failed_reason_code?: string;
  failed_reason_msg?: string;
  payment_type?: string;
  currency?: string;
  payment_amount?: string;
  test_mode?: string;
  [key: string]: string | undefined;
}

export interface PaytrTokenRequestParams {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
  userIp: string;
  merchantOid: string;
  email: string;
  paymentAmount: string; // minor units e.g. "2700000" for 27,000.00 TL
  userBasket: string; // Base64 encoded JSON array
  userName: string;
  userAddress: string;
  userPhone: string;
  merchantOkUrl: string;
  merchantFailUrl: string;
  timeoutLimit?: string; // default "30"
  currency?: string; // default "TL"
  testMode?: string; // "0" or "1"
  debugOn?: string; // "0" or "1"
  noInstallment?: string; // default "0"
  maxInstallment?: string; // default "0"
}

export interface PaytrTokenResponse {
  status: "success" | "failed";
  token?: string;
  reason?: string;
}

/**
 * Calculates official PayTR iFrame API Step 1 Token.
 * Formula:
 * hash_str = merchant_id + user_ip + merchant_oid + email + payment_amount +
 *            user_basket + no_installment + max_installment + currency + test_mode + merchant_salt
 * HMAC-SHA256(hash_str, merchant_key) -> Base64
 */
export async function calculatePaytrToken(params: {
  merchantId: string;
  userIp: string;
  merchantOid: string;
  email: string;
  paymentAmount: string;
  userBasket: string;
  noInstallment: string;
  maxInstallment: string;
  currency: string;
  testMode: string;
  merchantSalt: string;
  merchantKey: string;
}): Promise<string> {
  const hashStr =
    params.merchantId +
    params.userIp +
    params.merchantOid +
    params.email +
    params.paymentAmount +
    params.userBasket +
    params.noInstallment +
    params.maxInstallment +
    params.currency +
    params.testMode +
    params.merchantSalt;

  const keyData = new TextEncoder().encode(params.merchantKey);
  const messageData = new TextEncoder().encode(hashStr);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const signatureBytes = new Uint8Array(signature);

  let binary = "";
  for (let i = 0; i < signatureBytes.byteLength; i++) {
    binary += String.fromCharCode(signatureBytes[i]);
  }
  return btoa(binary);
}

/**
 * Encodes basket items into PayTR-compliant UTF-8 Base64 JSON format.
 * Structure: [ [ "Ürün Adı", "Birim Fiyat", Adet ] ]
 */
export function encodePaytrUserBasket(
  items: Array<[string, string | number, number]>
): string {
  const jsonStr = JSON.stringify(items);
  const bytes = new TextEncoder().encode(jsonStr);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Executes server-side request to PayTR get-token API.
 */
export async function requestPaytrIframeToken(
  params: PaytrTokenRequestParams
): Promise<PaytrTokenResponse> {
  const currency = params.currency || "TL";
  const testMode = params.testMode || "0";
  const debugOn = params.debugOn || "0";
  const noInstallment = params.noInstallment || "0";
  const maxInstallment = params.maxInstallment || "0";
  const timeoutLimit = params.timeoutLimit || "30";

  const paytrToken = await calculatePaytrToken({
    merchantId: params.merchantId,
    userIp: params.userIp,
    merchantOid: params.merchantOid,
    email: params.email,
    paymentAmount: params.paymentAmount,
    userBasket: params.userBasket,
    noInstallment,
    maxInstallment,
    currency,
    testMode,
    merchantSalt: params.merchantSalt,
    merchantKey: params.merchantKey,
  });

  const formBody = new URLSearchParams({
    merchant_id: params.merchantId,
    user_ip: params.userIp,
    merchant_oid: params.merchantOid,
    email: params.email,
    payment_amount: params.paymentAmount,
    paytr_token: paytrToken,
    user_basket: params.userBasket,
    debug_on: debugOn,
    no_installment: noInstallment,
    max_installment: maxInstallment,
    user_name: params.userName,
    user_address: params.userAddress || "Türkiye",
    user_phone: params.userPhone || "05000000000",
    merchant_ok_url: params.merchantOkUrl,
    merchant_fail_url: params.merchantFailUrl,
    timeout_limit: timeoutLimit,
    currency,
    test_mode: testMode,
  });

  const res = await fetch("https://www.paytr.com/odeme/api/get-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody.toString(),
  });

  const data = (await res.json()) as PaytrTokenResponse;
  return data;
}

/**
 * Calculates official PayTR iFrame API Callback hash.
 * Algorithm:
 * hash_str = merchant_oid + merchant_salt + status + total_amount
 * HMAC-SHA256(hash_str, merchant_key) -> Base64
 */
export async function calculatePaytrCallbackHash(params: {
  merchantOid: string;
  merchantSalt: string;
  status: string;
  totalAmount: string;
  merchantKey: string;
}): Promise<string> {
  const hashStr =
    params.merchantOid +
    params.merchantSalt +
    params.status +
    params.totalAmount;

  const keyData = new TextEncoder().encode(params.merchantKey);
  const messageData = new TextEncoder().encode(hashStr);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const signatureBytes = new Uint8Array(signature);

  let binary = "";
  for (let i = 0; i < signatureBytes.byteLength; i++) {
    binary += String.fromCharCode(signatureBytes[i]);
  }
  return btoa(binary);
}

/**
 * Constant-time string comparison to protect against timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verifies the incoming PayTR callback payload against official hash formula.
 */
export async function verifyPaytrCallbackHash(params: {
  merchantOid: string;
  merchantSalt: string;
  merchantKey: string;
  status: string;
  totalAmount: string;
  hash: string;
}): Promise<boolean> {
  if (
    !params.merchantOid ||
    !params.merchantSalt ||
    !params.merchantKey ||
    !params.status ||
    !params.totalAmount ||
    !params.hash
  ) {
    return false;
  }

  const expectedHash = await calculatePaytrCallbackHash({
    merchantOid: params.merchantOid,
    merchantSalt: params.merchantSalt,
    status: params.status,
    totalAmount: params.totalAmount,
    merchantKey: params.merchantKey,
  });

  return timingSafeEqual(expectedHash, params.hash);
}

/**
 * Safely parses the PayTR POST body across form-urlencoded, multipart,
 * or JSON formats.
 */
export async function parsePaytrCallbackBody(
  req: Request
): Promise<PaytrCallbackPayload> {
  const contentType = (req.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    const json = (await req.json()) as Record<string, unknown>;
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) {
      if (v !== undefined && v !== null) {
        result[k] = String(v);
      }
    }
    return result as unknown as PaytrCallbackPayload;
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await req.formData();
    const result: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        result[key] = value;
      }
    }
    return result as unknown as PaytrCallbackPayload;
  }

  // Fallback: raw body text parsing
  const text = await req.text();
  try {
    const json = JSON.parse(text);
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) {
      if (v !== undefined && v !== null) {
        result[k] = String(v);
      }
    }
    return result as unknown as PaytrCallbackPayload;
  } catch {
    const params = new URLSearchParams(text);
    const result: Record<string, string> = {};
    for (const [k, v] of params.entries()) {
      result[k] = v;
    }
    return result as unknown as PaytrCallbackPayload;
  }
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

