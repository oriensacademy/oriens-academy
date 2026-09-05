import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * DECOMMISSIONED — one-click email verification has been removed.
 *
 * Email verification is 6-digit OTP only. This endpoint used to mark a
 * verification challenge as verified on a plain GET of a tokenised URL, which
 * meant anything that fetches links in an email — corporate mail security
 * scanners, link prefetchers, antivirus gateways — consumed the user's challenge
 * before they ever opened the message. The verifier then fell through to an
 * older challenge and rejected the code the user was actually holding, reporting
 * a correct code as wrong and burning an attempt.
 *
 * Confirmed in production: audit trail `purchase.email_verified_via_link` fired
 * 31 seconds after the code was sent, while the user was still typing it.
 *
 * The stub stays only so any link already sitting in an inbox lands on a clear
 * message instead of a 404 or, worse, a still-working bypass. It verifies
 * nothing. The function should be deleted once old links have aged out
 * (`supabase functions delete verify-purchase-email-link`).
 */
Deno.serve((req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const locale = new URL(req.url).searchParams.get("locale") === "en" ? "en" : "tr";
  const isTr = locale === "tr";
  const title = isTr ? "Bu bağlantı artık kullanılmıyor" : "This link is no longer used";
  const body = isTr
    ? "E-posta doğrulaması artık yalnızca 6 haneli kod ile yapılmaktadır. Lütfen hesabınıza dönüp size gönderilen 6 haneli doğrulama kodunu giriniz."
    : "Email verification now uses a 6-digit code only. Please return to your account and enter the 6-digit verification code that was emailed to you.";

  return new Response(
    `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} | Oriens Academy</title></head>
<body style="margin:0;background:#F7F6F1;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#10271B;">
<div style="max-width:520px;margin:12vh auto;padding:32px;background:#fff;border:1px solid #DDE4DC;border-radius:18px;text-align:center;">
<h1 style="font-size:20px;margin:0 0 12px;">${title}</h1>
<p style="font-size:14px;line-height:1.65;color:#4A5A50;margin:0;">${body}</p>
</div></body></html>`,
    { status: 410, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
  );
});
