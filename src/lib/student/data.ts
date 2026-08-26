import { getSupabaseClient } from "@/lib/supabase/client";
import { getPublicBankTransferDetails } from "@/lib/payments/client";
import type { Tables } from "@/types/database.types";

export type StudentProfileRow = Tables<"student_profiles">;
export type StudentLessonRow = Tables<"student_lessons">;
export type StudentHomeworkRow = Tables<"student_homework">;
export type StudentBooking = Pick<
  Tables<"bookings">,
  | "id"
  | "status"
  | "exam_code"
  | "custom_exam"
  | "created_at"
  | "appointment_subject"
  | "event_type"
  | "live_meeting_url"
> & { availability_slots: { starts_at: string; ends_at: string } | null };

export type StudentPurchase = Tables<"student_package_purchases"> & {
  pricing_packages: { name_tr: string | null; name_en: string | null } | null;
  custom_package_name?: string | null;
};

export type StudentPayment = Pick<
  Tables<"payment_transactions">,
  | "id"
  | "package_id"
  | "amount"
  | "currency"
  | "payment_method"
  | "status"
  | "created_at"
  | "public_reference"
  | "metadata"
>;

export type StudentAdjustment = {
  id: string;
  student_user_id: string;
  package_purchase_id: string;
  adjustment_type: "extra_lessons" | "manual_adjustment" | "package_assigned" | "package_reactivated";
  lesson_delta: number;
  price_amount: number | null;
  currency: string;
  payment_status: "pending" | "paid" | "waived" | "refunded";
  notes: string | null;
  created_at: string;
};

export interface StudentEntitlementSummary {
  totalGrantedLessons: number;
  totalUsedLessons: number;
  totalRemainingLessons: number;
  activePackages: StudentPurchase[];
  pastPackages: StudentPurchase[];
  primaryPackage: StudentPurchase | null;
}

export interface StudentPortalData {
  profile: StudentProfileRow;
  bookings: StudentBooking[];
  lessons: StudentLessonRow[];
  homework: StudentHomeworkRow[];
  purchases: StudentPurchase[];
  payments: StudentPayment[];
  adjustments: StudentAdjustment[];
  bankDetails: Awaited<ReturnType<typeof getPublicBankTransferDetails>>;
  currentPackage: StudentPurchase | null;
  entitlement: StudentEntitlementSummary;
}

/**
 * Calculates aggregated entitlement summary across all student packages.
 * Supports stacked package purchases and calculates total remaining lessons correctly.
 */
export function getStudentEntitlementSummary(purchases: StudentPurchase[]): StudentEntitlementSummary {
  if (!purchases || purchases.length === 0) {
    return {
      totalGrantedLessons: 0,
      totalUsedLessons: 0,
      totalRemainingLessons: 0,
      activePackages: [],
      pastPackages: [],
      primaryPackage: null,
    };
  }

  // Active packages with remaining lessons > 0 (FIFO ordering: oldest first)
  const sortedAsc = [...purchases].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  const activePackages = sortedAsc.filter(
    (p) => p.status === "active" && (p.lesson_count || 0) - (p.lessons_used || 0) > 0
  );

  // Past / exhausted / refunded packages
  const pastPackages = purchases.filter(
    (p) =>
      p.status === "completed" ||
      p.status === "expired" ||
      p.status === "cancelled" ||
      p.status === "refunded" ||
      (p.lesson_count || 0) - (p.lessons_used || 0) <= 0
  );

  const totalGrantedLessons = purchases.reduce((sum, p) => sum + (p.lesson_count || 0), 0);
  const totalUsedLessons = purchases.reduce((sum, p) => sum + (p.lessons_used || 0), 0);
  const totalRemainingLessons = activePackages.reduce(
    (sum, p) => sum + Math.max(0, (p.lesson_count || 0) - (p.lessons_used || 0)),
    0
  );

  const primaryPackage = activePackages[0] || purchases[0] || null;

  return {
    totalGrantedLessons,
    totalUsedLessons,
    totalRemainingLessons,
    activePackages,
    pastPackages,
    primaryPackage,
  };
}

/**
 * Backward compatibility resolver for legacy components.
 */
export function resolveCurrentStudentPackage(purchases: StudentPurchase[]): StudentPurchase | null {
  const summary = getStudentEntitlementSummary(purchases);
  return summary.primaryPackage;
}

/**
 * Filters out abandoned PayTR initialization attempts from customer-facing history
 * while keeping all database audit records intact.
 */
export function filterCustomerVisiblePayments(payments: StudentPayment[]): StudentPayment[] {
  if (!payments) return [];
  const twentyMinutesAgo = Date.now() - 20 * 60 * 1000;

  return payments.filter((p) => {
    if (["paid", "refunded", "waived", "failed", "processing", "requires_action"].includes(p.status)) {
      return true;
    }
    if (p.payment_method === "bank_transfer" && p.status === "pending") {
      return true;
    }
    const createdAtMs = new Date(p.created_at).getTime();
    if (p.status === "pending" && createdAtMs > twentyMinutesAgo) {
      return true;
    }
    return false;
  });
}

export async function getStudentPortalData(
  userId: string
): Promise<{ data: StudentPortalData | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const [profile, bookings, lessons, homework, purchases, payments, adjustments, bankDetails] =
    await Promise.all([
      supabase.from("student_profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("bookings")
        .select(
          "id,status,exam_code,custom_exam,created_at,appointment_subject,event_type,live_meeting_url,availability_slots(starts_at,ends_at)"
        )
        .eq("student_user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("student_lessons")
        .select("*")
        .eq("student_user_id", userId)
        .order("lesson_date", { ascending: false }),
      supabase
        .from("student_homework")
        .select("*")
        .eq("student_user_id", userId)
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("student_package_purchases")
        .select("*,pricing_packages(name_tr,name_en)")
        .eq("student_user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("payment_transactions")
        .select(
          "id,package_id,amount,currency,payment_method,status,created_at,public_reference,metadata"
        )
        .eq("student_user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("student_package_adjustments" as never)
        .select("*")
        .eq("student_user_id", userId)
        .order("created_at", { ascending: false }),
      getPublicBankTransferDetails(),
    ]);

  const firstError =
    profile.error ||
    bookings.error ||
    lessons.error ||
    homework.error ||
    purchases.error ||
    payments.error;
  if (firstError || !profile.data) {
    return { data: null, error: firstError?.message || "STUDENT_PROFILE_NOT_FOUND" };
  }

  const profileRecord = profile.data as unknown as Record<string, unknown>;
  const columnExams = Array.isArray(profileRecord.target_exams)
    ? (profileRecord.target_exams as string[])
    : [];
  const columnDests = Array.isArray(profileRecord.target_countries)
    ? (profileRecord.target_countries as string[])
    : [];

  const harmonizedProfile = {
    ...profile.data,
    target_exams:
      columnExams.length > 0
        ? columnExams
        : profile.data.target_exam
        ? [profile.data.target_exam]
        : [],
    target_countries:
      columnDests.length > 0
        ? columnDests
        : profile.data.target_country
        ? [profile.data.target_country]
        : [],
  };

  const purchaseList = (purchases.data || []) as unknown as StudentPurchase[];
  const entitlement = getStudentEntitlementSummary(purchaseList);
  const currentPackage = entitlement.primaryPackage;
  const rawPayments = (payments.data || []) as StudentPayment[];
  const visiblePayments = filterCustomerVisiblePayments(rawPayments);

  return {
    data: {
      profile: harmonizedProfile as StudentProfileRow,
      bookings: (bookings.data || []) as unknown as StudentBooking[],
      lessons: lessons.data || [],
      homework: homework.data || [],
      purchases: purchaseList,
      payments: visiblePayments,
      adjustments: (adjustments.data || []) as unknown as StudentAdjustment[],
      bankDetails,
      currentPackage,
      entitlement,
    },
    error: null,
  };
}

export type StudentProfileUpdate = Partial<StudentProfileRow> & {
  target_exams?: string[];
  target_countries?: string[];
  onboarding_completed?: boolean;
};

export async function updateStudentProfile(userId: string, input: StudentProfileUpdate) {
  const client = getSupabaseClient();
  return client.from("student_profiles").update(input).eq("id", userId).select().single();
}

export interface StudentHomeworkSubmissionInput {
  submissionText: string;
  attachmentPath?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  attachmentMime?: string | null;
}

export async function submitStudentHomework(
  id: string,
  input: string | StudentHomeworkSubmissionInput
) {
  const payload =
    typeof input === "string"
      ? {
          submission_text: input,
          submission_attachment_path: null,
          submission_attachment_name: null,
          submission_attachment_size: null,
          submission_attachment_mime: null,
        }
      : {
          submission_text: input.submissionText,
          submission_attachment_path: input.attachmentPath || null,
          submission_attachment_name: input.attachmentName || null,
          submission_attachment_size: input.attachmentSize || null,
          submission_attachment_mime: input.attachmentMime || null,
        };

  const client = getSupabaseClient();
  return client
    .from("student_homework")
    .update({
      ...payload,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    } as never)
    .eq("id", id)
    .select()
    .single();
}
