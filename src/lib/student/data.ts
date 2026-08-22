import { getSupabaseClient } from "@/lib/supabase/client";
import { getPublicBankTransferDetails } from "@/lib/payments/client";
import type { Tables } from "@/types/database.types";

export type StudentProfileRow = Tables<"student_profiles">;
export type StudentLessonRow = Tables<"student_lessons">;
export type StudentHomeworkRow = Tables<"student_homework">;
export type StudentBooking = Pick<Tables<"bookings">, "id" | "status" | "exam_code" | "custom_exam" | "created_at"> & { availability_slots: { starts_at: string; ends_at: string } | null };
export type StudentPurchase = Tables<"student_package_purchases"> & { pricing_packages: { name_tr: string | null; name_en: string | null } | null };
export type StudentPayment = Pick<Tables<"payment_transactions">, "id" | "package_id" | "amount" | "currency" | "payment_method" | "status" | "created_at">;

export interface StudentPortalData {
  profile: StudentProfileRow; bookings: StudentBooking[]; lessons: StudentLessonRow[];
  homework: StudentHomeworkRow[]; purchases: StudentPurchase[]; payments: StudentPayment[];
  bankDetails: Awaited<ReturnType<typeof getPublicBankTransferDetails>>;
}

export async function getStudentPortalData(userId: string): Promise<{ data: StudentPortalData | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const [profile, bookings, lessons, homework, purchases, payments, bankDetails] = await Promise.all([
    supabase.from("student_profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("bookings").select("id,status,exam_code,custom_exam,created_at,availability_slots(starts_at,ends_at)").eq("student_user_id", userId).order("created_at", { ascending: false }),
    supabase.from("student_lessons").select("*").eq("student_user_id", userId).order("lesson_date", { ascending: false }),
    supabase.from("student_homework").select("*").eq("student_user_id", userId).order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("student_package_purchases").select("*,pricing_packages(name_tr,name_en)").eq("student_user_id", userId).order("created_at", { ascending: false }),
    supabase.from("payment_transactions").select("id,package_id,amount,currency,payment_method,status,created_at").eq("student_user_id", userId).order("created_at", { ascending: false }),
    getPublicBankTransferDetails(),
  ]);
  const firstError = profile.error || bookings.error || lessons.error || homework.error || purchases.error || payments.error;
  if (firstError || !profile.data) return { data: null, error: firstError?.message || "STUDENT_PROFILE_NOT_FOUND" };
  return { data: { profile: profile.data, bookings: (bookings.data || []) as unknown as StudentBooking[], lessons: lessons.data || [], homework: homework.data || [], purchases: (purchases.data || []) as unknown as StudentPurchase[], payments: payments.data || [], bankDetails }, error: null };
}

export type StudentProfileUpdate = Pick<StudentProfileRow, "full_name" | "phone" | "school" | "target_exam" | "target_university" | "target_country" | "preferred_language">;
export async function updateStudentProfile(userId: string, input: StudentProfileUpdate) {
  return getSupabaseClient().from("student_profiles").update(input).eq("id", userId).select().single();
}
export async function submitStudentHomework(id: string, submissionText: string) {
  return getSupabaseClient().from("student_homework").update({ submission_text: submissionText, status: "submitted", submitted_at: new Date().toISOString() }).eq("id", id).select().single();
}
