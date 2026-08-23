import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import {
  dispatchLiveLessonLinkEmail,
  dispatchLessonCompletedEmail,
} from "../_shared/email/service.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const [{ data: userData }, { data: isAdmin, error: adminError }] = await Promise.all([
    caller.auth.getUser(),
    caller.rpc("is_admin"),
  ]);

  if (!userData.user || adminError || isAdmin !== true) {
    return buildJsonResponse({ error_code: "ADMIN_REQUIRED" }, 403, req);
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "send_link");
  const lessonId = String(body.lessonId || "");

  if (!UUID.test(lessonId)) {
    return buildJsonResponse({ error_code: "INVALID_LESSON_ID" }, 400, req);
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === "send_link") {
    // 1. Fetch lesson & student profile
    const { data: lesson, error: lessonError } = await admin
      .from("student_lessons")
      .select("id, title, subject, exam_code, lesson_date, duration_minutes, live_meeting_url, teacher_note, student_user_id, meeting_link_sent_at")
      .eq("id", lessonId)
      .single();

    if (lessonError || !lesson) {
      return buildJsonResponse({ error_code: "LESSON_NOT_FOUND" }, 404, req);
    }

    if (!lesson.live_meeting_url) {
      return buildJsonResponse({ error_code: "NO_MEETING_URL" }, 400, req);
    }

    const { data: profile } = await admin
      .from("student_profiles")
      .select("full_name, email, preferred_language")
      .eq("id", lesson.student_user_id)
      .single();

    if (!profile || !profile.email) {
      return buildJsonResponse({ error_code: "STUDENT_NOT_FOUND" }, 404, req);
    }

    const isUpdate = Boolean(lesson.meeting_link_sent_at);
    const locale = profile.preferred_language === "en" ? "en" : "tr";

    const delivery = await dispatchLiveLessonLinkEmail(admin, {
      lessonId: lesson.id,
      studentName: profile.full_name,
      studentEmail: profile.email,
      lessonTitle: lesson.title,
      subject: lesson.subject,
      examCode: lesson.exam_code,
      lessonDate: lesson.lesson_date,
      durationMinutes: lesson.duration_minutes,
      liveMeetingUrl: lesson.live_meeting_url,
      teacherNote: lesson.teacher_note,
      isUpdate,
      locale,
    });

    // Mark link sent timestamp
    await admin
      .from("student_lessons")
      .update({ meeting_link_sent_at: new Date().toISOString() })
      .eq("id", lesson.id);

    return buildJsonResponse({ success: true, delivery }, 200, req);
  }

  if (action === "complete_lesson") {
    const packagePurchaseId = body.packagePurchaseId ? String(body.packagePurchaseId) : null;
    const teacherNote = body.teacherNote ? String(body.teacherNote) : null;

    // Call idempotent complete RPC
    const { data: rpcResult, error: rpcError } = await caller.rpc("admin_complete_student_lesson", {
      p_lesson_id: lessonId,
      p_package_purchase_id: packagePurchaseId,
      p_teacher_note: teacherNote,
    });

    if (rpcError || !rpcResult?.success) {
      return buildJsonResponse(
        { error_code: rpcResult?.error_code || rpcError?.message || "COMPLETION_FAILED" },
        400,
        req
      );
    }

    // If NOT already completed, dispatch lesson completed email once
    let delivery = null;
    if (!rpcResult.already_completed && rpcResult.student_email) {
      delivery = await dispatchLessonCompletedEmail(admin, {
        lessonId,
        studentName: rpcResult.student_name || "Öğrenci",
        studentEmail: rpcResult.student_email,
        lessonTitle: rpcResult.lesson_title || "Birebir Canlı Ders",
        lessonDate: rpcResult.lesson_date || new Date().toISOString(),
        packageName: rpcResult.package_name || "Birebir Ders Paketi",
        remainingLessons: Number(rpcResult.remaining_lessons || 0),
        totalLessons: Number(rpcResult.total_lessons || 0),
        teacherNote,
        locale: rpcResult.preferred_language === "en" ? "en" : "tr",
      });
    }

    return buildJsonResponse(
      {
        success: true,
        already_completed: Boolean(rpcResult.already_completed),
        remaining_lessons: rpcResult.remaining_lessons,
        total_lessons: rpcResult.total_lessons,
        is_package_completed: rpcResult.is_package_completed,
        delivery,
      },
      200,
      req
    );
  }

  return buildJsonResponse({ error_code: "INVALID_ACTION" }, 400, req);
});
