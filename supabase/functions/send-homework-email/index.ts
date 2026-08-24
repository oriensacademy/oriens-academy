import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import {
  dispatchHomeworkAssignedEmail,
  dispatchHomeworkReviewedEmail,
  dispatchHomeworkRevisionRequestedEmail,
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

  const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const [{ data: userData }, { data: isAdmin, error: adminError }] = await Promise.all([
    caller.auth.getUser(),
    caller.rpc("is_admin"),
  ]);
  if (!userData.user || adminError || isAdmin !== true) {
    return buildJsonResponse({ error_code: "ADMIN_REQUIRED" }, 403, req);
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  if (action === "assigned") {
    const assignmentId = String(body.assignmentId || "");
    if (!UUID.test(assignmentId)) return buildJsonResponse({ error_code: "INVALID_ASSIGNMENT_ID" }, 400, req);

    const [{ data: rows, error }, { data: assignment }] = await Promise.all([
      admin.from("student_homework").select("id, due_date, student_user_id, content_type").eq("assignment_id", assignmentId),
      admin.from("homework_assignments").select("title, description, lesson_id, content_type").eq("id", assignmentId).single(),
    ]);
    if (error || !rows?.length || !assignment) return buildJsonResponse({ error_code: "HOMEWORK_NOT_FOUND" }, 404, req);
    const [{ data: profiles }, { data: lesson }] = await Promise.all([
      admin.from("student_profiles").select("id, full_name, email, preferred_language").in("id", rows.map((row) => row.student_user_id)),
      assignment.lesson_id
        ? admin.from("student_lessons").select("title, subject").eq("id", assignment.lesson_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const deliveries = [];
    for (const row of rows) {
      const profile = profiles?.find((item) => item.id === row.student_user_id);
      if (!profile?.email) continue;
      deliveries.push(await dispatchHomeworkAssignedEmail(admin, {
        homeworkId: row.id,
        studentName: profile.full_name || "Öğrenci",
        studentEmail: profile.email,
        assignmentTitle: assignment.title,
        subjectOrLesson: lesson?.title || lesson?.subject || "Akademik Çalışma",
        dueDate: row.due_date || new Date().toISOString(),
        contentType: (row.content_type || assignment.content_type || "homework") as "homework" | "lesson_note" | "worksheet" | "resource" | "mock_exam",
        description: assignment.description,
        locale: profile.preferred_language === "en" ? "en" : "tr",
      }));
    }
    return buildJsonResponse({ success: true, deliveries }, 200, req);
  }

  if (action === "reviewed" || action === "revision_requested") {
    const homeworkId = String(body.homeworkId || "");
    if (!UUID.test(homeworkId)) return buildJsonResponse({ error_code: "INVALID_HOMEWORK_ID" }, 400, req);
    const { data: row, error } = await admin.from("student_homework")
      .select("id, due_date, teacher_feedback, student_user_id, assignment_id").eq("id", homeworkId).single();
    if (error || !row) return buildJsonResponse({ error_code: "HOMEWORK_NOT_FOUND" }, 404, req);
    const [{ data: assignment }, { data: profile }] = await Promise.all([
      admin.from("homework_assignments").select("title, description, lesson_id").eq("id", row.assignment_id).single(),
      admin.from("student_profiles").select("full_name, email, preferred_language").eq("id", row.student_user_id).single(),
    ]);
    if (!assignment || !profile?.email) return buildJsonResponse({ error_code: "STUDENT_NOT_FOUND" }, 404, req);
    const { data: lesson } = assignment.lesson_id
      ? await admin.from("student_lessons").select("title, subject").eq("id", assignment.lesson_id).maybeSingle()
      : { data: null };

    const emailPayload = {
      homeworkId: row.id,
      studentName: profile.full_name || "Öğrenci",
      studentEmail: profile.email,
      assignmentTitle: assignment.title,
      subjectOrLesson: lesson?.title || lesson?.subject || "Akademik Çalışma",
      dueDate: row.due_date || new Date().toISOString(),
      description: assignment.description,
      teacherFeedback: row.teacher_feedback,
      locale: (profile.preferred_language === "en" ? "en" : "tr") as "en" | "tr",
    };

    const delivery = action === "revision_requested"
      ? await dispatchHomeworkRevisionRequestedEmail(admin, emailPayload)
      : await dispatchHomeworkReviewedEmail(admin, emailPayload);

    return buildJsonResponse({ success: true, delivery }, 200, req);
  }

  return buildJsonResponse({ error_code: "INVALID_ACTION" }, 400, req);
});
