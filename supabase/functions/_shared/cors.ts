const ALLOWED_ORIGINS = new Set([
  "https://oriens-academy.com",
  "https://www.oriens-academy.com",
  "https://oriens-academy-official.pages.dev",
  "https://oriens-academy.pages.dev",
]);

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // Server-to-server or direct requests without Origin header
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.oriens-academy-official\.pages\.dev$/.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.oriens-academy\.pages\.dev$/.test(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}


export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) && origin ? origin : "https://oriens-academy.com";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, turnstile-token, x-turnstile-token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function buildJsonResponse(
  payload: Record<string, unknown>,
  status: number,
  req: Request,
  extraHeaders?: Record<string, string>
): Response {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  const securityHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    ...corsHeaders,
    ...extraHeaders,
  };

  return new Response(JSON.stringify(payload), {
    status,
    headers: securityHeaders,
  });
}

export function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    if (origin && !isAllowedOrigin(origin)) {
      return new Response("Forbidden origin", { status: 403 });
    }
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }
  return null;
}

export function validateMutationRequest(req: Request, allowedMethods: string[] = ["POST"]): Response | null {
  const preflightResponse = handlePreflight(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  if (origin && !isAllowedOrigin(origin)) {
    return buildJsonResponse(
      { error_code: "FORBIDDEN_ORIGIN", message: "Forbidden request origin." },
      403,
      req
    );
  }

  if (!allowedMethods.includes(req.method)) {
    return buildJsonResponse(
      { error_code: "METHOD_NOT_ALLOWED", message: `Method ${req.method} not allowed.` },
      405,
      req,
      { Allow: allowedMethods.concat("OPTIONS").join(", ") }
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return buildJsonResponse(
      { error_code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type must be application/json." },
      415,
      req
    );
  }

  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader) {
    const length = parseInt(contentLengthHeader, 10);
    if (!isNaN(length) && length > 32768) {
      return buildJsonResponse(
        { error_code: "PAYLOAD_TOO_LARGE", message: "Request body size exceeds allowable limit of 32 KB." },
        413,
        req
      );
    }
  }

  return null;
}
