import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert } from "@/types/database.types";
import { reportAdminFailure } from "@/lib/admin/audit";

export type PackagePurchase = Tables<"student_package_purchases"> & {
  pricing_packages: { name_tr: string | null; name_en: string | null } | null;
  custom_package_name?: string | null;
  admin_notes?: string | null;
};

export type PackageOption = Pick<
  Tables<"pricing_packages">,
  "id" | "name_tr" | "name_en" | "lesson_count" | "current_total" | "price_amount" | "currency" | "active"
>;

export type StudentPayment = Pick<
  Tables<"payment_transactions">,
  "id" | "public_reference" | "package_id" | "amount" | "currency" | "payment_method" | "status" | "created_at" | "paid_at" | "refunded_amount" | "refund_status" | "last_refunded_at"
>;

export type LessonNotificationState = {
  id: string;
  entity_id: string;
  event_type: string;
  status: "pending" | "processing" | "sent" | "failed" | "cancelled";
  sent_at: string | null;
  last_error_code: string | null;
  created_at: string;
  dedupe_key: string | null;
};
export type LessonReference = { id: string; label: string; active: boolean; sort_order: number };
export type InstructorReference = { id: string; name: string; active: boolean; sort_order: number };

export type PackageAdjustment = {
  id: string;
  student_user_id: string;
  package_purchase_id: string;
  adjustment_type: "extra_lessons" | "manual_adjustment" | "package_assigned" | "package_reactivated" | "lesson_completed" | "past_lesson_added";
  lesson_delta: number;
  price_amount: number | null;
  currency: string;
  payment_status: "pending" | "paid" | "waived" | "refunded";
  notes: string | null;
  reason?: string | null;
  created_by: string | null;
  created_at: string;
};

export async function listStudentLearning(userId: string) {
  const supabase = getSupabaseClient();
  const [lessons, homework, purchases, payments, notes, packages, adjustments, topics, instructors] = await Promise.all([
    supabase.from("student_lessons").select("*").eq("student_user_id", userId).eq("is_archived", false).order("lesson_date", { ascending: false }),
    supabase.from("student_homework").select("*").eq("student_user_id", userId).order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("student_package_purchases").select("*,pricing_packages(name_tr,name_en)").eq("student_user_id", userId).eq("is_archived", false).order("created_at", { ascending: false }),
    supabase.from("payment_transactions").select("id,public_reference,package_id,amount,currency,payment_method,status,created_at,paid_at,refunded_amount,refund_status,last_refunded_at").or(`student_user_id.eq.${userId},package_owner_student_id.eq.${userId},purchaser_guardian_user_id.eq.${userId}`).eq("is_archived", false).order("created_at", { ascending: false }),
    supabase.from("student_admin_notes").select("*").eq("student_user_id", userId).eq("is_archived", false).order("created_at", { ascending: false }),
    supabase.from("pricing_packages").select("id,name_tr,name_en,lesson_count,current_total,price_amount,currency,active").eq("active", true).order("display_order"),
    supabase.from("student_package_adjustments" as "student_admin_notes").select("*").eq("student_user_id", userId).eq("is_archived", false).order("created_at", { ascending: false }),
    // Generated types follow the additive reference-table migration.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("lesson_topics").select("id,label,active,sort_order").order("sort_order").order("id"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("instructors").select("id,name,active,sort_order").order("sort_order").order("id"),
  ]);
  const purchaseRows = (purchases.data || []) as unknown as PackagePurchase[];
  const adjustmentRows = (adjustments.data || []) as unknown as PackageAdjustment[];
  const lessonIds = (lessons.data || []).map((lesson) => lesson.id);
  const deliveryResult = lessonIds.length
    // Generated database types lag the deployed dedupe_key column.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (supabase as any)
        .from("notification_deliveries")
        .select("id,entity_id,event_type,status,sent_at,last_error_code,created_at,dedupe_key")
        .eq("entity_type", "student_lesson")
        .in("entity_id", lessonIds)
        .in("event_type", ["lesson.report_email", "lesson.scheduled.student", "lesson.details_updated.student"])
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  const rightsDeliveryResult = await supabase
    .from("notification_deliveries")
    .select("id,entity_id,event_type,status,sent_at,last_error_code,created_at")
    .eq("entity_type", "student")
    .eq("entity_id", userId)
    .eq("event_type", "package.rights_summary")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lessonNotifications = (deliveryResult.data || []) as LessonNotificationState[];

  // Hatalar tablo bazında raporlanıyor. Önceden tek bir `error` alanı vardı ve
  // StudentLearningManager onu görünce TÜM bölümü bir hata kutusuyla
  // değiştiriyordu: ödemeler tablosundaki geçici bir hata, Notlar sekmesini de
  // boşaltıyordu. Artık her sekme yalnızca kendi tablolarının hatasına bakıyor.
  const errors = {
    lessons: lessons.error?.message || null,
    homework: homework.error?.message || null,
    purchases: purchases.error?.message || null,
    payments: payments.error?.message || null,
    notes: notes.error?.message || null,
    packages: packages.error?.message || null,
    adjustments: adjustments.error?.message || null,
    notifications: deliveryResult.error?.message || rightsDeliveryResult.error?.message || null,
    references: topics.error?.message || instructors.error?.message || null,
  };
  for (const [operation, message] of Object.entries(errors)) {
    if (message) void reportAdminFailure({ action: "admin.data_load_failed", category: "admin", operation: `student_learning.${operation}`, error: { message }, entityType: "student_profile", entityId: userId });
  }

  return {
    lessons: lessons.data || [],
    homework: homework.data || [],
    purchases: purchaseRows,
    payments: (payments.data || []) as StudentPayment[],
    notes: notes.data || [],
    packages: (packages.data || []) as PackageOption[],
    adjustments: adjustmentRows,
    lessonNotifications,
    rightsNotification: (rightsDeliveryResult.data || null) as LessonNotificationState | null,
    topics: (topics.data || []) as LessonReference[],
    instructors: (instructors.data || []) as InstructorReference[],
    activePurchaseId: purchaseRows.find((p) => p.status === "active")?.id || null,
    errors,
    /** Geriye dönük uyumluluk: eskiden tek hata alanı vardı. */
    error: null as string | null,
  };
}

export async function createStudentHomework(
  input: {
    student_user_id: string;
    title: string;
    description: string;
    due_date?: string | null;
    lesson_id?: string | null;
    assignment_file_url?: string | null;
    attachment_path?: string | null;
    attachment_name?: string | null;
    attachment_size?: number | null;
    attachment_mime?: string | null;
  }
) {
  const supabase = getSupabaseClient();
  const insertPayload = {
    student_user_id: input.student_user_id,
    title: input.title,
    description: input.description,
    due_date: input.due_date || null,
    lesson_id: input.lesson_id || null,
    assignment_file_url: input.assignment_file_url || null,
    attachment_path: input.attachment_path || null,
    attachment_name: input.attachment_name || null,
    attachment_size: input.attachment_size || null,
    attachment_mime: input.attachment_mime || null,
    status: "assigned",
  };
  return supabase.from("student_homework").insert(insertPayload as unknown as TablesInsert<"student_homework">).select().single();
}

export async function reviewStudentHomework(id: string, status: "reviewed" | "completed", teacherFeedback: string) {
  return getSupabaseClient().from("student_homework").update({ status, teacher_feedback: teacherFeedback.trim() || null }).eq("id", id).select().single();
}

export async function upsertStudentLesson(input: {
  studentId: string;
  lessonId?: string | null;
  packagePurchaseId?: string | null;
  title: string;
  subject: string;
  examCode?: string | null;
  lessonDate: string;
  lessonTimezone: string;
  lessonTimezoneLabel: string;
  durationMinutes: number;
  liveMeetingUrl?: string | null;
  teacherNote?: string | null;
  status?: "scheduled" | "completed" | "cancelled" | "no_show";
  topicId?: string | null;
  instructorId?: string | null;
}) {
  // Gelecek ders validation: must not be in the past
  if ((!input.status || input.status === "scheduled") && !input.lessonId) {
    const lessonTime = new Date(input.lessonDate).getTime();
    const now = Date.now();
    if (lessonTime < now - 15 * 60_000) {
      return {
        success: false,
        error: "Gelecek ders için geçmiş bir tarih veya saat seçilemez. Lütfen ileri bir tarih giriniz veya 'Geçmiş Ders' seçeneğini kullanınız.",
        lessonId: null,
      };
    }
  }

  const { data, error } = await getSupabaseClient().rpc("admin_upsert_student_lesson" as unknown as "admin_update_student_profile", {
    p_student_id: input.studentId,
    p_lesson_id: input.lessonId || null,
    p_package_purchase_id: input.packagePurchaseId || null,
    p_title: input.title,
    p_subject: input.subject,
    p_exam_code: input.examCode || null,
    p_lesson_date: input.lessonDate,
    p_lesson_timezone: input.lessonTimezone,
    p_lesson_timezone_label: input.lessonTimezoneLabel,
    p_duration_minutes: input.durationMinutes,
    p_live_meeting_url: input.liveMeetingUrl || null,
    p_teacher_note: input.teacherNote || null,
    p_status: input.status || "scheduled",
    p_topic_id: input.topicId || null,
    p_instructor_id: input.instructorId || null,
  } as unknown as { p_student_id: string; p_full_name: string; p_phone: string; p_school: string; p_target_exam: string; p_target_university: string; p_target_country: string; p_preferred_language: string; p_active: boolean });
  const result=rpcResult(data,error);
  if(!result.success) void reportAdminFailure({action:input.lessonId?"lesson.update_failed":"lesson.create_failed",category:"lesson",operation:"admin_upsert_student_lesson",error:error||{message:result.error},entityType:"student_lesson",entityId:input.lessonId||undefined});
  return result;
}

/**
 * Dersi tamamlar. Tamamlama artık hiçbir koşulda MAIL-027 göndermez: ders
 * bilgilendirme e-postası ayrı ve açık bir rapor aksiyonudur
 * (saveAndSendLessonReport). Kanonik RPC'de p_send_email parametresi yoktur.
 * Kalan ders hakkı bildirimi de dahil olmak üzere hiçbir e-posta bu RPC'nin
 * yan etkisi değildir. MAIL-027 yalnızca rapor kaydedildikten sonra gönderilir.
 */
export async function completeStudentLesson(input: {
  lessonId: string;
  packagePurchaseId?: string | null;
}) {
  const supabase = getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (token) {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-live-lesson-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "complete_lesson",
          lessonId: input.lessonId,
          packagePurchaseId: input.packagePurchaseId || null,
        }),
      });
      const json = await response.json();
      if (json.success) {
        return { success: true, error: null, alreadyCompleted: Boolean(json.already_completed) };
      }
    } catch {
      // Fallback to direct RPC
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("admin_complete_student_lesson", {
    p_lesson_id: input.lessonId,
    p_package_purchase_id: input.packagePurchaseId || null,
    // Preserve historical notes; completing a scheduled lesson no longer
    // authors or replaces teacher_note.
    p_teacher_note: null,
  });
  const res = rpcResult(data, error);
  return { success: res.success, error: res.error, alreadyCompleted: res.alreadyCompleted };
}

export async function recordCompletedLesson(input: {
  studentId: string;
  lessonDate: string;
  lessonTimezone: string;
  lessonTimezoneLabel: string;
  durationMinutes: number;
  title: string;
  subject: string;
  teacherNote?: string | null;
  packagePurchaseId?: string | null;
  idempotencyKey: string;
  topicId?: string | null;
  instructorId?: string | null;
  completionReport?: string | null;
  sendReportEmail?: boolean;
}) {
  // Geçmiş ders validation: must not be in the future
  const lessonTime = new Date(input.lessonDate).getTime();
  const now = Date.now();
  if (lessonTime > now + 5 * 60_000) {
    return {
      success: false,
      error: "Geçmiş ders için gelecekteki bir tarih veya saat seçilemez. Lütfen geçmiş bir tarih giriniz veya 'Gelecek Ders' seçeneğini kullanınız.",
      lessonId: null,
    };
  }

  const supabase = getSupabaseClient();
  // Generated RPC types follow when the migration is applied to the remote project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("admin_record_completed_lesson", {
    p_student_id: input.studentId,
    p_lesson_date: input.lessonDate,
    p_lesson_timezone: input.lessonTimezone,
    p_lesson_timezone_label: input.lessonTimezoneLabel,
    p_duration_minutes: input.durationMinutes,
    p_title: input.title.trim(),
    p_subject: input.subject.trim(),
    p_teacher_note: input.teacherNote?.trim() || null,
    p_package_purchase_id: input.packagePurchaseId || null,
    p_existing_lesson_id: null,
    p_completion_source: "past",
    p_idempotency_key: input.idempotencyKey,
    p_topic_id: input.topicId || null,
    p_instructor_id: input.instructorId || null,
    // Retained by the database signature for compatibility, but the integrated
    // flow never emits the legacy past-lesson confirmation (MAIL-044).
    p_send_email: false,
    p_completion_report: input.completionReport?.trim() || null,
    p_send_report_email: Boolean(input.sendReportEmail),
  });
  const result=rpcResult(data,error);
  if(!result.success) void reportAdminFailure({action:"lesson.create_failed",category:"lesson",operation:"admin_record_completed_lesson",error:error||{message:result.error},entityType:"student_profile",entityId:input.studentId,correlationId:input.idempotencyKey});
  return result;
}

export async function manageLessonReference(input: { kind: "topic" | "instructor"; action: "create" | "rename" | "activate" | "deactivate" | "reorder"; id?: string; label?: string; sortOrder?: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseClient() as any).rpc("admin_manage_lesson_reference", { p_kind: input.kind, p_action: input.action, p_id: input.id || null, p_label: input.label || null, p_sort_order: input.sortOrder ?? null });
  return rpcResult(data,error);
}

export async function updateCompletedLesson(input: { lessonId: string; topicId?: string | null; title: string; subject: string; lessonDate: string; lessonTimezone: string; lessonTimezoneLabel: string; durationMinutes: number; instructorId?: string | null; packagePurchaseId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseClient() as any).rpc("admin_update_completed_lesson_v2", { p_lesson_id: input.lessonId, p_topic_id: input.topicId || null, p_title: input.title, p_subject: input.subject, p_lesson_date: input.lessonDate, p_lesson_timezone: input.lessonTimezone, p_lesson_timezone_label: input.lessonTimezoneLabel, p_duration_minutes: input.durationMinutes, p_instructor_id: input.instructorId || null, p_package_purchase_id: input.packagePurchaseId });
  const result=rpcResult(data,error);
  if(!result.success) void reportAdminFailure({action:"lesson.package_change_failed",category:"lesson",operation:"admin_update_completed_lesson",error:error||{message:result.error},entityType:"student_lesson",entityId:input.lessonId});
  return result;
}

type LessonReportRpcResult = {
  success?: boolean;
  error_code?: string;
  report_saved?: boolean;
  report_version?: number;
  notification_delivery_id?: string;
  suppressed?: boolean;
};

const lessonReportError = (code?: string) => ({
  REPORT_REQUIRED: "Ders sonu raporu en az 5 karakter olmalıdır.",
  REPORT_TOO_LONG: "Ders sonu raporu 10.000 karakteri aşamaz.",
  LESSON_NOT_FOUND: "Ders kaydı bulunamadı.",
  LESSON_NOT_COMPLETED: "Rapor yalnızca tamamlanmış dersler için kaydedilebilir.",
  NO_VERIFIED_ACCOUNT_HOLDER: "Bu öğrenciye bağlı doğrulanmış bir hesap sahibi e-postası yok.",
  EMAIL_ENQUEUE_FAILED: "Rapor kaydedildi ancak e-posta gönderilemedi. Lütfen tekrar deneyin.",
}[code || ""] || "Ders sonu raporu kaydedilemedi.");

export async function saveLessonCompletionReport(lessonId: string, report: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseClient() as any).rpc("admin_save_lesson_completion_report", {
    p_lesson_id: lessonId,
    p_report: report,
  });
  const result = data as LessonReportRpcResult | null;
  if (error || !result?.success) void reportAdminFailure({ action: "lesson.report_failed", category: "lesson", operation: "admin_save_lesson_completion_report", error: error || { message: result?.error_code || "Report not saved" }, entityType: "student_lesson", entityId: lessonId });
  return error || !result?.success
    ? { success: false, error: error?.message || lessonReportError(result?.error_code), reportVersion: null }
    : { success: true, error: null, reportVersion: result.report_version ?? null };
}

export async function saveAndSendLessonReport(lessonId: string, report: string, resend: boolean) {
  // This is intentionally called after saveLessonCompletionReport. If enqueueing
  // fails, the first RPC has already committed the report.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseClient() as any).rpc("admin_save_and_send_lesson_report", {
    p_lesson_id: lessonId,
    p_report: report,
    p_resend: resend,
  });
  const result = data as LessonReportRpcResult | null;
  if (error || !result?.success) void reportAdminFailure({ action: "lesson.report_failed", category: "lesson", operation: "admin_save_and_send_lesson_report", error: error || { message: result?.error_code || "Report delivery not confirmed" }, entityType: "student_lesson", entityId: lessonId });
  return error || !result?.success
    ? {
        success: false,
        error: result?.report_saved
          ? "Rapor kaydedildi ancak e-posta gönderilemedi. Lütfen tekrar deneyin."
          : error?.message || lessonReportError(result?.error_code),
        reportSaved: Boolean(result?.report_saved),
      }
    : {
        success: true,
        error: null,
        reportSaved: true,
        reportVersion: result.report_version ?? null,
        deliveryId: result.notification_delivery_id,
        suppressed: Boolean(result.suppressed),
      };
}

/**
 * Paket / ders hakkı bilgilendirme e-postasını AÇIK admin aksiyonu olarak
 * gönderir. Paket tanımlama ve ders hakkı artırma/azaltma işlemleri kendi
 * başlarına e-posta göndermez -- veri değişikliği bildirim demek değildir.
 *
 * Çift tıklama ve ağ tekrarı sunucu tarafında 60 saniyelik pencerede bastırılır
 * (admin_send_package_notification); bilinçli tekrar gönderim ise yeni bir
 * kayıt üretir.
 */
export async function sendPackageNotificationEmail(
  purchaseId: string,
  kind: "package_assigned" | "lesson_rights"
): Promise<{ success: boolean; error: string | null; suppressed?: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseClient() as any).rpc("admin_send_package_notification", {
    p_purchase_id: purchaseId,
    p_kind: kind,
  });
  if (error) {
    // Ham veritabanı hatası admin ekranına basılmaz.
    console.error("[admin/package-notification] RPC error:", error.message);
    return { success: false, error: "Bilgilendirme e-postası gönderilemedi. Lütfen tekrar deneyin." };
  }
  const result = data as { success?: boolean; error_code?: string; suppressed?: boolean } | null;
  if (!result?.success) {
    const messages: Record<string, string> = {
      PACKAGE_NOT_FOUND: "Paket kaydı bulunamadı.",
      NO_VERIFIED_ACCOUNT_HOLDER: "Bu öğrenciye bağlı doğrulanmış bir hesap sahibi e-postası yok.",
      INVALID_KIND: "Geçersiz bildirim türü.",
    };
    return { success: false, error: messages[result?.error_code || ""] || "Bilgilendirme e-postası gönderilemedi." };
  }
  return { success: true, error: null, suppressed: Boolean(result.suppressed) };
}

export type PackageRightsNotificationContext = {
  success: boolean;
  recipient: string;
  account_holder_name: string;
  student_name: string;
  total_remaining_lessons: number;
  packages: Array<{ name: string; lesson_count: number; used: number; remaining: number }>;
  current_date: string;
};

export async function getPackageRightsNotificationContext(studentId: string) {
  // Generated RPC types follow after the migration is applied.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseClient() as any).rpc("admin_get_package_rights_notification_context", { p_student_id: studentId });
  const result = data as PackageRightsNotificationContext & { error_code?: string } | null;
  return error || !result?.success
    ? { data: null, error: error?.message || result?.error_code || "Hak bilgisi alınamadı." }
    : { data: result, error: null };
}

export async function sendPackageRightsNotification(studentId: string, idempotencyKey: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseClient() as any).rpc("admin_send_package_rights_notification", {
    p_student_id: studentId,
    p_idempotency_key: idempotencyKey,
  });
  const result = data as { success?: boolean; error_code?: string; status?: string; recipient?: string } | null;
  return error || !result?.success
    ? { success: false, error: error?.message || result?.error_code || "Hak bilgisi e-postası kuyruğa alınamadı." }
    : { success: true, error: null, status: result.status || "pending", recipient: result.recipient || "" };
}

export async function sendLessonMeetingLink(lessonId: string) {
  const supabase = getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { success: false, error: "Oturum bulunamadı." };

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-live-lesson-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "send_link", lessonId }),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      return { success: false, error: json.error_code || "E-posta gönderilemedi." };
    }
    return { success: true, error: null };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Bağlantı hatası." };
  }
}

export async function cancelStudentLesson(lessonId: string, reason?: string | null) {
  const { data, error } = await getSupabaseClient().rpc("admin_cancel_student_lesson" as unknown as "admin_update_student_profile", {
    p_lesson_id: lessonId,
    p_reason: reason || null,
  } as unknown as { p_student_id: string; p_full_name: string; p_phone: string; p_school: string; p_target_exam: string; p_target_university: string; p_target_country: string; p_preferred_language: string; p_active: boolean });
  const result = rpcResult(data, error);
  if (!result.success) void reportAdminFailure({ action: "lesson.update_failed", category: "lesson", operation: "admin_cancel_student_lesson", error: error || { message: result.error }, entityType: "student_lesson", entityId: lessonId });
  return result;
}

export async function completeStudentAppointment(input: {
  bookingId: string;
  packagePurchaseId: string | null;
  title: string;
  subject: string;
  examCode: string;
  durationMinutes: number;
  teacherNote: string;
}) {
  const { data, error } = await getSupabaseClient().rpc("admin_complete_student_appointment", {
    p_booking_id: input.bookingId,
    p_package_purchase_id: input.packagePurchaseId,
    p_title: input.title,
    p_subject: input.subject,
    p_exam_code: input.examCode,
    p_duration_minutes: input.durationMinutes,
    p_teacher_note: input.teacherNote,
  });
  const result = rpcResult(data, error);
  if (!result.success) void reportAdminFailure({ action: "lesson.create_failed", category: "lesson", operation: "admin_complete_student_appointment", error: error || { message: result.error }, entityType: "booking", entityId: input.bookingId });
  return result;
}

export async function assignStudentPackage(input: {
  studentId: string;
  packageId?: string | null;
  customPackageName?: string | null;
  startDate: string;
  endDate: string | null;
  lessonCount: number;
  priceAmount: number;
  currency: string;
  paymentStatus: "pending" | "paid" | "waived";
  adminNotes?: string | null;
  sendNotification?: boolean;
}) {
  const supabase = getSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    "admin_assign_student_package_v2",
    {
      p_student_id: input.studentId,
      p_package_id: input.packageId || null,
      p_custom_package_name: input.customPackageName || null,
      p_start_date: input.startDate,
      p_end_date: input.endDate || null,
      p_lesson_count: input.lessonCount,
      p_price_amount: input.priceAmount,
      p_currency: input.currency,
      p_payment_status: input.paymentStatus,
      p_admin_notes: input.adminNotes || null,
    }
  );

  const result = rpcResult(data, error);
  if (!result.success) void reportAdminFailure({ action: "package.assignment_failed", category: "package", operation: "admin_assign_student_package_v2", error: error || { message: result.error }, entityType: "student_profile", entityId: input.studentId });
  return result;
}

/**
 * Collapses rapid duplicate submissions (double-click, request retry) of the
 * same logical action into the same key, without permanently blocking a
 * deliberate later repeat of the same delta/reason -- see forensic audit
 * item 3. Callers may pass their own idempotencyKey (e.g. generated once
 * when a form/modal opens) for tighter control; this is just a safe default.
 */
function buildAdjustmentIdempotencyKey(prefix: string, parts: (string | number | null | undefined)[]): string {
  const bucket = Math.floor(Date.now() / 10_000); // 10-second collision window
  return [prefix, ...parts.map((p) => String(p ?? "")), bucket].join(":");
}

export async function addStudentExtraLessons(input: {
  purchaseId: string;
  studentId: string;
  lessonDelta: number;
  priceAmount?: number | null;
  currency?: string;
  paymentStatus?: "pending" | "paid" | "waived";
  notes?: string | null;
  sendNotification?: boolean;
  idempotencyKey?: string;
}) {
  const supabase = getSupabaseClient();
  const idempotencyKey = input.idempotencyKey
    || buildAdjustmentIdempotencyKey("extra", [input.purchaseId, input.lessonDelta, input.priceAmount, input.notes]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    "admin_add_extra_lessons",
    {
      p_purchase_id: input.purchaseId,
      p_lesson_delta: input.lessonDelta,
      p_price_amount: input.priceAmount ?? null,
      p_currency: input.currency || "TRY",
      p_payment_status: input.paymentStatus || "waived",
      p_notes: input.notes || null,
      p_idempotency_key: idempotencyKey,
    }
  );

  const res = rpcResult(data, error);
  if (!res.success) void reportAdminFailure({ action: "package.adjustment_failed", category: "package", operation: "admin_add_extra_lessons", error: error || { message: res.error }, entityType: "student_package_purchase", entityId: input.purchaseId, correlationId: idempotencyKey });

  if (res.success && input.sendNotification) {
    void dispatchPackageNotification({
      action: "extra_lessons",
      studentId: input.studentId,
      purchaseId: input.purchaseId,
      lessonDelta: input.lessonDelta,
    });
  }

  return res;
}

export interface LessonAdjustmentResult {
  success: boolean;
  error: string | null;
  purchaseId?: string;
  oldLessonCount?: number;
  newLessonCount?: number;
  lessonsUsed?: number;
  oldRemaining?: number;
  newRemaining?: number;
  adjustmentId?: string;
}

export async function adjustStudentPackageLessons(input: {
  purchaseId: string;
  lessonDelta: number;
  reason: string;
  notes?: string | null;
  idempotencyKey?: string;
}): Promise<LessonAdjustmentResult> {
  const supabase = getSupabaseClient();
  const idempotencyKey = input.idempotencyKey
    || buildAdjustmentIdempotencyKey("adjust", [input.purchaseId, input.lessonDelta, input.reason, input.notes]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("admin_adjust_package_lessons", {
    p_purchase_id: input.purchaseId,
    p_lesson_delta: input.lessonDelta,
    p_reason: input.reason,
    p_notes: input.notes || null,
    p_idempotency_key: idempotencyKey,
  });
  if (error) {
    void reportAdminFailure({ action: "package.adjustment_failed", category: "package", operation: "admin_adjust_package_lessons", error, entityType: "student_package_purchase", entityId: input.purchaseId, correlationId: idempotencyKey });
    return { success: false, error: error.message };
  }
  const value = data as Record<string, unknown> | null;
  if (!value?.success) {
    const errorCode = String(value?.error_code || "İşlem tamamlanamadı.");
    void reportAdminFailure({ action: "package.adjustment_failed", category: "package", operation: "admin_adjust_package_lessons", error: { message: errorCode }, entityType: "student_package_purchase", entityId: input.purchaseId, correlationId: idempotencyKey });
    return {
      success: false,
      error: errorCode === "INSUFFICIENT_UNUSED_LESSONS"
        ? "Kalan ders hakkından daha fazla ders azaltılamaz."
        : errorCode === "ADJUSTMENT_REASON_REQUIRED"
          ? "En az 3 karakterlik bir gerekçe girin."
          : errorCode,
    };
  }
  if (value?.success && input.lessonDelta < 0) {
    void kickNotificationOutbox(String(value.purchase_id));
  }

  return {
    success: true,
    error: null,
    purchaseId: String(value.purchase_id),
    oldLessonCount: Number(value.old_lesson_count),
    newLessonCount: Number(value.new_lesson_count),
    lessonsUsed: Number(value.lessons_used),
    oldRemaining: Number(value.old_remaining),
    newRemaining: Number(value.new_remaining),
    adjustmentId: String(value.adjustment_id),
  };
}

async function dispatchPackageNotification(payload: {
  action: "package_assigned" | "extra_lessons";
  studentId: string;
  purchaseId: string;
  lessonDelta?: number;
}) {
  try {
    const supabase = getSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-live-lesson-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("Failed to dispatch package notification email:", err);
  }
}

async function kickNotificationOutbox(purchaseId: string) {
  try {
    const supabase = getSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    await supabase.functions.invoke("process-notification-outbox", {
      body: { source: "admin_package_assignment", purchaseId },
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.warn("Notification outbox kick failed; scheduled retry remains active:", err);
  }
}

import { writeAdminAuditLog } from "./audit";

export async function addStudentPrivateNote(studentUserId: string, note: string) {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { data: null, error: new Error("Oturum bulunamadı.") };
  const trimmed = note.trim();
  const res = await supabase
    .from("student_admin_notes")
    .insert({ student_user_id: studentUserId, note: trimmed, created_by: userData.user.id })
    .select()
    .single();

  if (res.data) {
    void writeAdminAuditLog({
      action: "student.note.created",
      entityType: "student_admin_note",
      entityId: res.data.id,
      metadata: { student_user_id: studentUserId, snippet: trimmed.slice(0, 100) },
    });
  }
  return res;
}

export async function updateStudentPrivateNote(noteId: string, note: string, studentUserId: string) {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { data: null, error: new Error("Oturum bulunamadı.") };
  const trimmed = note.trim();
  const res = await supabase
    .from("student_admin_notes")
    .update({ note: trimmed, updated_at: new Date().toISOString() })
    .eq("id", noteId)
    .select()
    .single();

  if (res.data) {
    void writeAdminAuditLog({
      action: "student.note.updated",
      entityType: "student_admin_note",
      entityId: noteId,
      metadata: { student_user_id: studentUserId, snippet: trimmed.slice(0, 100) },
    });
  }
  return res;
}

export async function deleteStudentPrivateNote(noteId: string, studentUserId: string) {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: new Error("Oturum bulunamadı.") };

  // The RPC performs the reversible archive and writes the canonical audit row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("admin_archive_student_note", { p_note_id: noteId });
  const result = data as { success?: boolean } | null;
  return { data: result, error: error || (result?.success ? null : new Error("Not arşivlenemedi.")) };
}

function rpcResult(data: unknown, error: { message: string } | null) {
  if (error) return { success: false, error: error.message };
  const value = data as { success?: boolean; error_code?: string; already_completed?: boolean; lesson_id?: string; id?: string; purchase_id?: string } | null;
  return {
    success: Boolean(value?.success),
    error: value?.success ? null : (value?.error_code || "İşlem tamamlanamadı."),
    alreadyCompleted: Boolean(value?.already_completed),
    lessonId: value?.lesson_id || value?.id || null,
    purchaseId: value?.purchase_id || null,
  };
}
