import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, buildJsonResponse } from "../_shared/cors.ts";

async function computeTokenHmac(rawToken: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const messageData = encoder.encode(`purchase_link:${rawToken}`);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getSafeRedirectUrl(locale: string, status: "success" | "expired" | "invalid"): string {
  const isTr = locale !== "en";
  const baseUrl = "https://oriens-academy.com";
  const accountSegment = isTr ? "/tr/hesabim/" : "/en/account/";

  if (status === "success") {
    return `${baseUrl}${accountSegment}?verified=true`;
  }
  return `${baseUrl}${accountSegment}?email_verify_status=${status}`;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim();
  const rawLocale = (url.searchParams.get("locale") || "tr").toLowerCase();
  const locale = rawLocale === "en" ? "en" : "tr";

  if (!token || token.length < 32 || !/^[0-9a-fA-F]+$/.test(token)) {
    return Response.redirect(getSafeRedirectUrl(locale, "invalid"), 302);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const hmacSecret = Deno.env.get("PURCHASE_OTP_HMAC_SECRET") || "";

  if (!supabaseUrl || !serviceRoleKey || !hmacSecret) {
    console.error("[verify-purchase-email-link] Server config error: missing secrets.");
    return buildJsonResponse({ error_code: "SERVER_CONFIG_ERROR" }, 500, req);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tokenHash = await computeTokenHmac(token, hmacSecret);
  const now = new Date();

  // Find active challenge by token hash (must not be expired and not verified)
  const { data: challenge, error: challengeError } = await supabaseAdmin
    .from("purchase_email_verification_challenges")
    .select("*")
    .eq("verification_token_hash", tokenHash)
    .is("verified_at", null)
    .gt("expires_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (challengeError || !challenge) {
    console.warn("[verify-purchase-email-link] Challenge not found, expired, or already consumed.");
    return Response.redirect(getSafeRedirectUrl(locale, "expired"), 302);
  }

  const verifiedAt = now.toISOString();

  // 1. Mark challenge verified (atomically invalidates BOTH the OTP and this link token)
  const { error: updateChallengeErr } = await supabaseAdmin
    .from("purchase_email_verification_challenges")
    .update({
      verified_at: verifiedAt,
      updated_at: verifiedAt,
      attempt_count: (challenge.attempt_count || 0) + 1,
    })
    .eq("id", challenge.id);

  if (updateChallengeErr) {
    console.error("[verify-purchase-email-link] Failed to update challenge:", updateChallengeErr);
    return Response.redirect(getSafeRedirectUrl(locale, "invalid"), 302);
  }

  // 2. Update guardian account with verified timestamp
  await supabaseAdmin
    .from("guardian_accounts")
    .update({
      email: challenge.candidate_email,
      email_verified_at: verifiedAt,
      updated_at: verifiedAt,
    })
    .eq("user_id", challenge.user_id);

  // 3. Update self student profile
  await supabaseAdmin
    .from("student_profiles")
    .update({
      email: challenge.candidate_email,
      updated_at: verifiedAt,
    })
    .eq("id", challenge.user_id);

  // 4. Update auth user email if it differs
  try {
    const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(challenge.user_id);
    if (authUserData?.user?.email && authUserData.user.email.toLowerCase() !== challenge.candidate_email) {
      await supabaseAdmin.auth.admin.updateUserById(challenge.user_id, {
        email: challenge.candidate_email,
        email_confirm: true,
      });
    }
  } catch (authUpdateErr) {
    console.warn("[verify-purchase-email-link] Auth user email sync warning:", authUpdateErr);
  }

  // 5. Audit log
  await supabaseAdmin.from("audit_logs").insert({
    actor_user_id: challenge.user_id,
    action: "purchase.email_verified_via_link",
    entity_type: "purchase_verification",
    entity_id: challenge.id,
    metadata: {
      candidate_email: challenge.candidate_email,
      verified_at: verifiedAt,
      method: "one_click_link",
    },
  });

  // 6. Safe fixed redirect to checkout with verified=true marker
  return Response.redirect(getSafeRedirectUrl(locale, "success"), 302);
});
