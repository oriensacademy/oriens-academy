import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import {
  dispatchLiveLessonLinkEmail,
  dispatchLessonCompletedEmail,
  sendTransactionalEmail,
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

  if (action === "package_assigned") {
    const studentId = String(body.studentId || "");
    const purchaseId = String(body.purchaseId || "");

    if (!UUID.test(studentId) || !UUID.test(purchaseId)) {
      return buildJsonResponse({ error_code: "INVALID_PARAMETERS" }, 400, req);
    }

    const [{ data: profile }, { data: purchase }] = await Promise.all([
      admin.from("student_profiles").select("full_name, email, preferred_language").eq("id", studentId).single(),
      admin.from("student_package_purchases").select("*, pricing_packages(name_tr, name_en)").eq("id", purchaseId).single(),
    ]);

    if (!profile || !profile.email || !purchase) {
      return buildJsonResponse({ error_code: "RESOURCES_NOT_FOUND" }, 404, req);
    }

    const locale = profile.preferred_language === "en" ? "en" : "tr";
    const isEn = locale === "en";
    const packageName = purchase.custom_package_name || (isEn ? purchase.pricing_packages?.name_en : purchase.pricing_packages?.name_tr) || purchase.package_id || "Birebir Eğitim Paketi";
    const portalUrl = isEn ? "https://oriens-academy.com/en/account" : "https://oriens-academy.com/tr/hesabim";

    const subject = isEn ? "Your Package Has Been Assigned | Oriens Academy" : "Paketiniz Tanımlandı | Oriens Academy";
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F9FA; margin: 0; padding: 30px 15px;">
  <div style="max-width: 560px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="margin-bottom: 24px;">
      <span style="font-size: 11px; font-weight: 700; color: #1E3A2B; letter-spacing: 0.15em; text-transform: uppercase;">ORIENS ACADEMY</span>
      <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 8px 0 0;">${isEn ? "Package Assigned" : "Paketiniz Tanımlandı"}</h1>
    </div>
    <p style="font-size: 14px; line-height: 1.6; color: #374151;">
      ${isEn ? `Hello ${profile.full_name},` : `Merhaba ${profile.full_name},`}
    </p>
    <p style="font-size: 14px; line-height: 1.6; color: #374151;">
      ${isEn ? "A new academic preparation package has been successfully configured for your account:" : "Oriens Academy hesabınıza yeni eğitim paketiniz başarıyla tanımlandı:"}
    </p>
    <div style="background-color: #F9FAF8; border: 1px solid #E2E8F0; border-radius: 8px; padding: 18px; margin: 20px 0;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #1E3A2B; font-weight: 600;">${isEn ? "Package:" : "Paket:"} <span style="color: #111827; font-weight: 700;">${packageName}</span></p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #1E3A2B; font-weight: 600;">${isEn ? "Total Lesson Entitlement:" : "Toplam Ders Hakkı:"} <span style="color: #111827; font-weight: 700;">${purchase.lesson_count} ${isEn ? "lessons" : "ders"}</span></p>
      <p style="margin: 0; font-size: 13px; color: #1E3A2B; font-weight: 600;">${isEn ? "Period:" : "Dönem:"} <span style="color: #111827;">${purchase.start_date} ${purchase.end_date ? `— ${purchase.end_date}` : ""}</span></p>
    </div>
    <div style="margin-top: 28px;">
      <a href="${portalUrl}" style="display: inline-block; background-color: #1E3A2B; color: #FFFFFF; font-size: 13px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px;">
        ${isEn ? "View My Package" : "Paketimi Görüntüle"}
      </a>
    </div>
    <p style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #F3F4F6; font-size: 11px; color: #9CA3AF; line-height: 1.5;">
      Oriens Academy · International Exam Preparation & Academic Consultancy
    </p>
  </div>
</body>
</html>
    `.trim();

    const text = `
ORIENS ACADEMY
${subject}

${isEn ? `Hello ${profile.full_name},` : `Merhaba ${profile.full_name},`}

${isEn ? `A new package (${packageName}) with ${purchase.lesson_count} lessons has been assigned to your account.` : `Hesabınıza ${packageName} (${purchase.lesson_count} ders) başarıyla tanımlandı.`}

${isEn ? "View your package:" : "Paketinizi görüntüleyin:"} ${portalUrl}
    `.trim();

    const delivery = await sendTransactionalEmail({
      supabaseAdmin: admin,
      to: profile.email,
      replyTo: "zoom@oriens-academy.com",
      channel: "zoom",
      subject,
      html,
      text,
      eventType: "package.assigned.student",
      entityType: "student_package_purchase",
      entityId: purchase.id,
      idempotencyKey: `pkg-assign-${purchase.id}-${Date.now()}`,
    });

    return buildJsonResponse({ success: true, delivery }, 200, req);
  }

  if (action === "extra_lessons") {
    const studentId = String(body.studentId || "");
    const purchaseId = String(body.purchaseId || "");
    const lessonDelta = Number(body.lessonDelta || 0);

    if (!UUID.test(studentId) || !UUID.test(purchaseId) || lessonDelta < 1) {
      return buildJsonResponse({ error_code: "INVALID_PARAMETERS" }, 400, req);
    }

    const [{ data: profile }, { data: purchase }] = await Promise.all([
      admin.from("student_profiles").select("full_name, email, preferred_language").eq("id", studentId).single(),
      admin.from("student_package_purchases").select("*, pricing_packages(name_tr, name_en)").eq("id", purchaseId).single(),
    ]);

    if (!profile || !profile.email || !purchase) {
      return buildJsonResponse({ error_code: "RESOURCES_NOT_FOUND" }, 404, req);
    }

    const locale = profile.preferred_language === "en" ? "en" : "tr";
    const isEn = locale === "en";
    const packageName = purchase.custom_package_name || (isEn ? purchase.pricing_packages?.name_en : purchase.pricing_packages?.name_tr) || purchase.package_id || "Birebir Eğitim Paketi";
    const portalUrl = isEn ? "https://oriens-academy.com/en/account" : "https://oriens-academy.com/tr/hesabim";
    const remaining = Math.max(0, purchase.lesson_count - purchase.lessons_used);

    const subject = isEn ? "Extra Lessons Added to Your Package | Oriens Academy" : "Paketinize Ek Ders Tanımlandı | Oriens Academy";
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F9FA; margin: 0; padding: 30px 15px;">
  <div style="max-width: 560px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="margin-bottom: 24px;">
      <span style="font-size: 11px; font-weight: 700; color: #1E3A2B; letter-spacing: 0.15em; text-transform: uppercase;">ORIENS ACADEMY</span>
      <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 8px 0 0;">${isEn ? "Extra Lessons Added" : "Ek Ders Tanımlandı"}</h1>
    </div>
    <p style="font-size: 14px; line-height: 1.6; color: #374151;">
      ${isEn ? `Hello ${profile.full_name},` : `Merhaba ${profile.full_name},`}
    </p>
    <p style="font-size: 14px; line-height: 1.6; color: #374151;">
      ${isEn ? `+${lessonDelta} extra lessons have been credited to your active package:` : `${packageName} paketiniz üzerine +${lessonDelta} ek ders tanımlandı:`}
    </p>
    <div style="background-color: #F9FAF8; border: 1px solid #E2E8F0; border-radius: 8px; padding: 18px; margin: 20px 0;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #1E3A2B; font-weight: 600;">${isEn ? "Package:" : "Paket:"} <span style="color: #111827; font-weight: 700;">${packageName}</span></p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #1E3A2B; font-weight: 600;">${isEn ? "Total Lesson Entitlement:" : "Güncel Toplam Ders:"} <span style="color: #111827; font-weight: 700;">${purchase.lesson_count} ${isEn ? "lessons" : "ders"}</span></p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #1E3A2B; font-weight: 600;">${isEn ? "Completed Lessons:" : "Tamamlanan Ders:"} <span style="color: #111827;">${purchase.lessons_used}</span></p>
      <p style="margin: 0; font-size: 13px; color: #1E3A2B; font-weight: 600;">${isEn ? "Remaining Lessons:" : "Kalan Ders:"} <span style="color: #1E3A2B; font-weight: 700;">${remaining}</span></p>
    </div>
    <div style="margin-top: 28px;">
      <a href="${portalUrl}" style="display: inline-block; background-color: #1E3A2B; color: #FFFFFF; font-size: 13px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px;">
        ${isEn ? "View My Package" : "Paketimi Görüntüle"}
      </a>
    </div>
    <p style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #F3F4F6; font-size: 11px; color: #9CA3AF; line-height: 1.5;">
      Oriens Academy · International Exam Preparation & Academic Consultancy
    </p>
  </div>
</body>
</html>
    `.trim();

    const text = `
ORIENS ACADEMY
${subject}

${isEn ? `Hello ${profile.full_name},` : `Merhaba ${profile.full_name},`}

${isEn ? `+${lessonDelta} extra lessons have been added to your ${packageName}. Total: ${purchase.lesson_count}, Completed: ${purchase.lessons_used}, Remaining: ${remaining}.` : `${packageName} paketiniz üzerine +${lessonDelta} ek ders tanımlandı. Toplam: ${purchase.lesson_count}, Tamamlanan: ${purchase.lessons_used}, Kalan: ${remaining}.`}

${isEn ? "View your package:" : "Paketinizi görüntüleyin:"} ${portalUrl}
    `.trim();

    const delivery = await sendTransactionalEmail({
      supabaseAdmin: admin,
      to: profile.email,
      replyTo: "zoom@oriens-academy.com",
      channel: "zoom",
      subject,
      html,
      text,
      eventType: "package.extra_lessons.student",
      entityType: "student_package_purchase",
      entityId: purchase.id,
      idempotencyKey: `pkg-extra-${purchase.id}-${Date.now()}`,
    });

    return buildJsonResponse({ success: true, delivery }, 200, req);
  }

  return buildJsonResponse({ error_code: "INVALID_ACTION" }, 400, req);
});
