import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert } from "@/types/database.types";

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
  "id" | "public_reference" | "package_id" | "amount" | "currency" | "payment_method" | "status" | "created_at"
>;

export type PackageAdjustment = {
  id: string;
  student_user_id: string;
  package_purchase_id: string;
  adjustment_type: "extra_lessons" | "manual_adjustment" | "package_assigned" | "package_reactivated";
  lesson_delta: number;
  price_amount: number | null;
  currency: string;
  payment_status: "pending" | "paid" | "waived" | "refunded";
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export async function listStudentLearning(userId: string) {
  const supabase = getSupabaseClient();
  const [lessons, homework, purchases, payments, notes, packages, adjustments] = await Promise.all([
    supabase.from("student_lessons").select("*").eq("student_user_id", userId).order("lesson_date", { ascending: false }),
    supabase.from("student_homework").select("*").eq("student_user_id", userId).order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("student_package_purchases").select("*,pricing_packages(name_tr,name_en)").eq("student_user_id", userId).order("created_at", { ascending: false }),
    supabase.from("payment_transactions").select("id,public_reference,package_id,amount,currency,payment_method,status,created_at").eq("student_user_id", userId).order("created_at", { ascending: false }),
    supabase.from("student_admin_notes").select("*").eq("student_user_id", userId).order("created_at", { ascending: false }),
    supabase.from("pricing_packages").select("id,name_tr,name_en,lesson_count,current_total,price_amount,currency,active").eq("active", true).order("display_order"),
    supabase.from("student_package_adjustments" as "student_admin_notes").select("*").eq("student_user_id", userId).order("created_at", { ascending: false }),
  ]);
  const error = lessons.error || homework.error || purchases.error || payments.error || notes.error || packages.error;
  const purchaseRows = (purchases.data || []) as unknown as PackagePurchase[];
  const adjustmentRows = (adjustments.data || []) as unknown as PackageAdjustment[];

  return {
    lessons: lessons.data || [],
    homework: homework.data || [],
    purchases: purchaseRows,
    payments: (payments.data || []) as StudentPayment[],
    notes: notes.data || [],
    packages: (packages.data || []) as PackageOption[],
    adjustments: adjustmentRows,
    activePurchaseId: purchaseRows.find((p) => p.status === "active")?.id || null,
    error: error?.message || null,
  };
}

export async function updateAdminStudentProfile(
  userId: string,
  input: {
    fullName: string;
    phone: string;
    school: string;
    targetExam: string;
    targetUniversity: string;
    targetCountry: string;
    preferredLanguage: string;
    active: boolean;
  }
) {
  const { data, error } = await getSupabaseClient().rpc("admin_update_student_profile", {
    p_student_id: userId,
    p_full_name: input.fullName,
    p_phone: input.phone,
    p_school: input.school,
    p_target_exam: input.targetExam,
    p_target_university: input.targetUniversity,
    p_target_country: input.targetCountry,
    p_preferred_language: input.preferredLanguage,
    p_active: input.active,
  });
  return rpcResult(data, error);
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
  durationMinutes: number;
  liveMeetingUrl?: string | null;
  teacherNote?: string | null;
  status?: "scheduled" | "completed" | "cancelled" | "no_show";
}) {
  const { data, error } = await getSupabaseClient().rpc("admin_upsert_student_lesson" as unknown as "admin_update_student_profile", {
    p_student_id: input.studentId,
    p_lesson_id: input.lessonId || null,
    p_package_purchase_id: input.packagePurchaseId || null,
    p_title: input.title,
    p_subject: input.subject,
    p_exam_code: input.examCode || null,
    p_lesson_date: input.lessonDate,
    p_duration_minutes: input.durationMinutes,
    p_live_meeting_url: input.liveMeetingUrl || null,
    p_teacher_note: input.teacherNote || null,
    p_status: input.status || "scheduled",
  } as unknown as { p_student_id: string; p_full_name: string; p_phone: string; p_school: string; p_target_exam: string; p_target_university: string; p_target_country: string; p_preferred_language: string; p_active: boolean });
  return rpcResult(data, error);
}

export async function completeStudentLesson(input: {
  lessonId: string;
  packagePurchaseId?: string | null;
  teacherNote?: string | null;
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
          teacherNote: input.teacherNote || null,
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

  const { data, error } = await supabase.rpc("admin_complete_student_lesson" as unknown as "admin_update_student_profile", {
    p_lesson_id: input.lessonId,
    p_package_purchase_id: input.packagePurchaseId || null,
    p_teacher_note: input.teacherNote || null,
  } as unknown as { p_student_id: string; p_full_name: string; p_phone: string; p_school: string; p_target_exam: string; p_target_university: string; p_target_country: string; p_preferred_language: string; p_active: boolean });
  return rpcResult(data, error);
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
  return rpcResult(data, error);
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
  return rpcResult(data, error);
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
  const { data, error } = await (supabase.rpc as unknown as (name: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>)(
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

  const res = rpcResult(data, error);
  const purchaseId = (data as { purchase_id?: string })?.purchase_id;

  if (res.success && input.sendNotification && purchaseId) {
    void dispatchPackageNotification({
      action: "package_assigned",
      studentId: input.studentId,
      purchaseId,
    });
  }

  return res;
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
}) {
  const supabase = getSupabaseClient();
  const { data, error } = await (supabase.rpc as unknown as (name: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>)(
    "admin_add_extra_lessons",
    {
      p_purchase_id: input.purchaseId,
      p_lesson_delta: input.lessonDelta,
      p_price_amount: input.priceAmount ?? null,
      p_currency: input.currency || "TRY",
      p_payment_status: input.paymentStatus || "waived",
      p_notes: input.notes || null,
    }
  );

  const res = rpcResult(data, error);

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

export async function addStudentPrivateNote(studentUserId: string, note: string) {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: new Error("Oturum bulunamadı.") };
  return supabase.from("student_admin_notes").insert({ student_user_id: studentUserId, note: note.trim(), created_by: userData.user.id }).select().single();
}

function rpcResult(data: unknown, error: { message: string } | null) {
  if (error) return { success: false, error: error.message };
  const value = data as { success?: boolean; error_code?: string; already_completed?: boolean } | null;
  return {
    success: Boolean(value?.success),
    error: value?.success ? null : (value?.error_code || "İşlem tamamlanamadı."),
    alreadyCompleted: Boolean(value?.already_completed),
  };
}
