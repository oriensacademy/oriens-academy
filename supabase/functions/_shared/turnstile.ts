const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const ALLOWED_HOSTNAMES = new Set([
  "oriens-academy.com",
  "www.oriens-academy.com",
  "localhost",
  "127.0.0.1",
]);

// Official Cloudflare test secret keys
const TEST_SECRET_PASS = "1x0000000000000000000000000000000AA";

export type TurnstileResult =
  | { success: true }
  | {
      success: false;
      errorCode:
        | "BOT_VERIFICATION_REQUIRED"
        | "BOT_VERIFICATION_FAILED"
        | "BOT_VERIFICATION_EXPIRED"
        | "TEMPORARY_ERROR"
        | "SERVER_CONFIG_ERROR";
      message: string;
    };

export async function verifyTurnstile(params: {
  token?: string | null;
  expectedAction?: string;
  remoteIp?: string | null;
  idempotencyKey?: string | null;
}): Promise<TurnstileResult> {
  const { token, expectedAction, remoteIp, idempotencyKey } = params;

  if (!token || typeof token !== "string" || token.trim() === "") {
    return {
      success: false,
      errorCode: "BOT_VERIFICATION_REQUIRED",
      message: "Security verification token is required.",
    };
  }

  const rawSecret = Deno.env.get("TURNSTILE_SECRET_KEY") ?? "";
  const isDevOrTest =
    Deno.env.get("DENO_ENV") === "development" ||
    Deno.env.get("ENVIRONMENT") === "development" ||
    token.startsWith("1x0000") ||
    token.startsWith("2x0000") ||
    token.startsWith("3x0000");

  let secretKey = rawSecret;

  if (!secretKey) {
    if (isDevOrTest) {
      console.warn("[turnstile] TURNSTILE_SECRET_KEY missing in dev/test mode. Using Cloudflare test secret key.");
      secretKey = TEST_SECRET_PASS;
    } else {
      console.error("[turnstile] TURNSTILE_SECRET_KEY is missing in production environment. Failing closed.");
      return {
        success: false,
        errorCode: "SERVER_CONFIG_ERROR",
        message: "Server security verification is currently unconfigured.",
      };
    }
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token.trim());
    if (remoteIp) formData.append("remoteip", remoteIp);
    if (idempotencyKey) formData.append("idempotency_key", idempotencyKey);

    const res = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });

    if (!res.ok) {
      console.error(`[turnstile] Cloudflare Siteverify HTTP status ${res.status}`);
      return {
        success: false,
        errorCode: "TEMPORARY_ERROR",
        message: "Security verification service unavailable. Please try again.",
      };
    }

    const data = (await res.json()) as {
      success: boolean;
      "error-codes"?: string[];
      challenge_ts?: string;
      hostname?: string;
      action?: string;
      cdata?: string;
    };

    if (!data.success) {
      const errorCodes = data["error-codes"] || [];
      console.warn("[turnstile] Siteverify rejected token:", errorCodes);

      if (errorCodes.includes("timeout-or-duplicate")) {
        return {
          success: false,
          errorCode: "BOT_VERIFICATION_EXPIRED",
          message: "Security verification token expired or already used. Please try again.",
        };
      }

      return {
        success: false,
        errorCode: "BOT_VERIFICATION_FAILED",
        message: "Security verification failed. Please try again.",
      };
    }

    // Hostname validation
    if (data.hostname && !ALLOWED_HOSTNAMES.has(data.hostname.toLowerCase())) {
      console.warn(`[turnstile] Invalid hostname: ${data.hostname}`);
      return {
        success: false,
        errorCode: "BOT_VERIFICATION_FAILED",
        message: "Security verification failed for request origin.",
      };
    }

    // Action validation
    if (expectedAction && data.action && data.action !== expectedAction) {
      console.warn(`[turnstile] Action mismatch: expected '${expectedAction}', got '${data.action}'`);
      return {
        success: false,
        errorCode: "BOT_VERIFICATION_FAILED",
        message: "Security verification action mismatch.",
      };
    }

    return { success: true };
  } catch (err) {
    console.error("[turnstile] Unexpected error connecting to Cloudflare Siteverify:", err);
    return {
      success: false,
      errorCode: "TEMPORARY_ERROR",
      message: "An error occurred during security verification.",
    };
  }
}
