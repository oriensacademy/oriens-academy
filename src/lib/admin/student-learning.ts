import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

export type PackagePurchase = Tables<"student_package_purchases"> & { pricing_packages: { name_tr: string | null; name_en: string | null } | null };
export type PackageOption = Pick<Tables<"pricing_packages">, "id"|"name_tr"|"name_en"|"lesson_count"|"current_total"|"price_amount"|"currency"|"active">;
export type StudentPayment = Pick<Tables<"payment_transactions">,"id"|"public_reference"|"package_id"|"amount"|"currency"|"payment_method"|"status"|"created_at">;

export async function listStudentLearning(userId: string) {
  const supabase = getSupabaseClient();
  const [lessons, homework, purchases, payments, notes, packages] = await Promise.all([
    supabase.from("student_lessons").select("*").eq("student_user_id", userId).order("lesson_date", { ascending: false }),
    supabase.from("student_homework").select("*").eq("student_user_id", userId).order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("student_package_purchases").select("*,pricing_packages(name_tr,name_en)").eq("student_user_id", userId).order("created_at", { ascending: false }),
    supabase.from("payment_transactions").select("id,public_reference,package_id,amount,currency,payment_method,status,created_at").eq("student_user_id", userId).order("created_at", { ascending: false }),
    supabase.from("student_admin_notes").select("*").eq("student_user_id", userId).order("created_at", { ascending: false }),
    supabase.from("pricing_packages").select("id,name_tr,name_en,lesson_count,current_total,price_amount,currency,active").eq("active", true).order("display_order"),
  ]);
  const error = lessons.error || homework.error || purchases.error || payments.error || notes.error || packages.error;
  const purchaseRows = (purchases.data || []) as unknown as PackagePurchase[];
  return { lessons: lessons.data || [], homework: homework.data || [], purchases: purchaseRows, payments: (payments.data || []) as StudentPayment[], notes: notes.data || [], packages: (packages.data || []) as PackageOption[], activePurchaseId: purchaseRows.find((p)=>p.status==="active")?.id || null, error: error?.message || null };
}

export async function updateAdminStudentProfile(userId:string,input:{fullName:string;phone:string;school:string;targetExam:string;targetUniversity:string;targetCountry:string;preferredLanguage:string;active:boolean}) {
  const { data,error } = await getSupabaseClient().rpc("admin_update_student_profile",{p_student_id:userId,p_full_name:input.fullName,p_phone:input.phone,p_school:input.school,p_target_exam:input.targetExam,p_target_university:input.targetUniversity,p_target_country:input.targetCountry,p_preferred_language:input.preferredLanguage,p_active:input.active});
  return rpcResult(data,error);
}

export async function createStudentHomework(input: Pick<Tables<"student_homework">, "student_user_id"|"title"|"description"|"due_date"> & {lesson_id?:string|null;assignment_file_url?:string|null}) {
  return getSupabaseClient().from("student_homework").insert({ ...input, status: "assigned" }).select().single();
}
export async function reviewStudentHomework(id:string,status:"reviewed"|"completed",teacherFeedback:string) {
  return getSupabaseClient().from("student_homework").update({status,teacher_feedback:teacherFeedback.trim()||null}).eq("id",id).select().single();
}
export async function completeStudentAppointment(input:{bookingId:string;packagePurchaseId:string|null;title:string;subject:string;examCode:string;durationMinutes:number;teacherNote:string}) {
  const {data,error}=await getSupabaseClient().rpc("admin_complete_student_appointment",{p_booking_id:input.bookingId,p_package_purchase_id:input.packagePurchaseId,p_title:input.title,p_subject:input.subject,p_exam_code:input.examCode,p_duration_minutes:input.durationMinutes,p_teacher_note:input.teacherNote});
  return rpcResult(data,error);
}
export async function assignStudentPackage(input:{studentId:string;packageId:string;startDate:string;endDate:string|null;lessonCount:number;priceAmount:number;currency:string;paymentStatus:"pending"|"waived"}) {
  const {data,error}=await getSupabaseClient().rpc("admin_assign_student_package",{p_student_id:input.studentId,p_package_id:input.packageId,p_start_date:input.startDate,p_end_date:input.endDate,p_lesson_count:input.lessonCount,p_price_amount:input.priceAmount,p_currency:input.currency,p_payment_status:input.paymentStatus,p_payment_transaction_id:null});
  return rpcResult(data,error);
}
export async function addStudentPrivateNote(studentUserId:string,note:string) {
  const supabase=getSupabaseClient(); const {data:userData}=await supabase.auth.getUser();
  if(!userData.user) return {error:new Error("Oturum bulunamadı.")};
  return supabase.from("student_admin_notes").insert({student_user_id:studentUserId,note:note.trim(),created_by:userData.user.id}).select().single();
}
function rpcResult(data:unknown,error:{message:string}|null){if(error)return{success:false,error:error.message};const value=data as {success?:boolean;error_code?:string;already_completed?:boolean}|null;return{success:Boolean(value?.success),error:value?.success?null:(value?.error_code||"İşlem tamamlanamadı."),alreadyCompleted:Boolean(value?.already_completed)}}
