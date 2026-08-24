import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { dispatchSupportCreatedEmail } from "../_shared/email/service.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CATEGORY_LABELS: Record<string, { tr: string; en: string }> = {
  general: { tr: "Genel Destek", en: "General Support" },
  academic: { tr: "Ders / Akademik", en: "Lesson / Academic" },
  booking: { tr: "Randevu", en: "Appointment" },
  homework: { tr: "Ödev", en: "Homework" },
  package: { tr: "Paket", en: "Package" },
  payment: { tr: "Ödeme", en: "Payment" },
  technical: { tr: "Teknik Sorun", en: "Technical Issue" },
  other: { tr: "Diğer", en: "Other" },
};

Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authorization = req.headers.get("authorization") || "";

  if (!url || !anon || !service || !authorization) {
    return buildJsonResponse({ error_code: "SERVER_CONFIG_ERROR" }, 500, req);
  }

  const caller = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return buildJsonResponse({ error_code: "UNAUTHORIZED" }, 401, req);
  }

  const body = await req.json().catch(() => ({}));
  const threadId = String(body.threadId || "");
  const locale = body.locale === "en" ? "en" : "tr";

  if (!UUID.test(threadId)) {
    return buildJsonResponse({ error_code: "INVALID_THREAD_ID" }, 400, req);
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Fetch thread details
  const { data: thread, error: threadError } = await admin
    .from("support_threads")
    .select("id, student_user_id, subject, category, status, created_at")
    .eq("id", threadId)
    .single();

  if (threadError || !thread) {
    return buildJsonResponse({ error_code: "THREAD_NOT_FOUND" }, 404, req);
  }

  // Verify ownership: caller must be thread owner or admin
  const isOwner = thread.student_user_id === userData.user.id;
  if (!isOwner) {
    const { data: isAdmin } = await caller.rpc("is_admin");
    if (!isAdmin) {
      return buildJsonResponse({ error_code: "FORBIDDEN" }, 403, req);
    }
  }

  // Fetch student profile for verified email
  const { data: profile } = await admin
    .from("student_profiles")
    .select("full_name, email, preferred_language")
    .eq("id", thread.student_user_id)
    .single();

  const studentEmail = profile?.email || userData.user.email;
  const studentName = profile?.full_name || userData.user.user_metadata?.full_name || "Öğrenci";
  const userLocale = (profile?.preferred_language === "en" ? "en" : locale) as "tr" | "en";

  if (!studentEmail) {
    return buildJsonResponse({ error_code: "STUDENT_EMAIL_NOT_FOUND" }, 400, req);
  }

  const categoryObj = CATEGORY_LABELS[thread.category] || { tr: thread.category, en: thread.category };
  const categoryLabel = userLocale === "en" ? categoryObj.en : categoryObj.tr;

  const delivery = await dispatchSupportCreatedEmail(admin, {
    threadId: thread.id,
    studentName,
    studentEmail,
    subject: thread.subject,
    categoryLabel,
    locale: userLocale,
  });

  return buildJsonResponse({ success: true, delivery }, 200, req);
});
