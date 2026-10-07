import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

export interface DashboardMetrics {
  activeStudents: number;
  todayLessons: number;
  weekLessons: number;
  monthLessons: number;
  weekAppointments: number;
  awaitingPayments: number;
  failedDeliveries: number;
  activePackages: number;
  remainingLessonRights: number;
  revenueTrend: Array<{ month: string; label: string; amount: number; count: number }>;
  recentActivity: RecentAuditRow[];
}

export type RecentAuditRow = Tables<"audit_logs">;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fetches real operational counts for the Admin Dashboard.
 */
export async function getAdminDashboardMetrics(): Promise<{
  metrics: DashboardMetrics;
  error: string | null;
}> {
  const supabase = getSupabaseClient();

  try {
    const [
      activeStudentsRes,
      weekAppointmentsRes,
      todayLessonsRes,
      weekLessonsRes,
      monthLessonsRes,
      awaitingPaymentsRes,
      failedDeliveriesRes,
      activePackagesRes,
      revenueRes,
      recentActivityRes,
    ] = await Promise.all([
      supabase.from("student_profiles").select("id", { count: "exact", head: true }).eq("active", true).is("archived_at", null),
      supabase
        .from("bookings")
        .select("id,availability_slots!inner(starts_at)", { count: "exact", head: true })
        .gte("availability_slots.starts_at", startOfWeek())
        .lt("availability_slots.starts_at", endOfWeek())
        .neq("status", "cancelled"),
      supabase
        .from("student_lessons")
        .select("id", { count: "exact", head: true })
        .eq("is_archived", false)
        .eq("status", "completed")
        .gte("lesson_date", startOfToday())
        .lt("lesson_date", endOfToday()),
      supabase
        .from("student_lessons")
        .select("id", { count: "exact", head: true })
        .eq("is_archived", false)
        .eq("status", "completed")
        .gte("lesson_date", startOfWeek())
        .lt("lesson_date", endOfWeek()),
      supabase
        .from("student_lessons")
        .select("id", { count: "exact", head: true })
        .eq("is_archived", false)
        .eq("status", "completed")
        .gte("lesson_date", startOfMonth())
        .lt("lesson_date", endOfMonth()),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from as any)("payment_transactions")
        .select("id", { count: "exact", head: true })
        .eq("is_archived", false)
        .in("status", ["pending", "processing", "requires_action"]),
      supabase
        .from("notification_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("is_archived", false)
        .eq("status", "failed"),
      supabase
        .from("student_package_purchases")
        .select("lesson_count,lessons_used,status")
        .eq("is_archived", false)
        .eq("status", "active"),
      supabase
        .from("payment_transactions")
        .select("amount,currency,status,paid_at,created_at,refunded_amount,refund_status")
        .eq("is_archived", false)
        .in("status", ["paid", "refunded"])
        .gte("paid_at", startOfRevenueWindow()),
      supabase
        .from("audit_logs")
        .select("id,action,actor_user_id,category,correlation_id,created_at,entity_id,entity_type,metadata,severity")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const revenueTrend = buildRevenueTrend((revenueRes.data || []) as Array<{ amount: number; currency: string; status: string; paid_at: string | null; created_at: string; refunded_amount: number | null; refund_status: string | null }>);
    const activePackages = (activePackagesRes.data || []) as Array<{ lesson_count: number; lessons_used: number; status: string }>;
    const recentActivity = await enrichRecentActivity(
      supabase,
      (recentActivityRes.data || []) as RecentAuditRow[]
    );
    const metrics: DashboardMetrics = {
      activeStudents: activeStudentsRes.count || 0,
      weekAppointments: weekAppointmentsRes.count || 0,
      todayLessons: todayLessonsRes.count || 0,
      weekLessons: weekLessonsRes.count || 0,
      monthLessons: monthLessonsRes.count || 0,
      awaitingPayments: awaitingPaymentsRes.count || 0,
      failedDeliveries: failedDeliveriesRes.count || 0,
      activePackages: activePackages.length,
      remainingLessonRights: activePackages.reduce((sum, p) => sum + Math.max(0, p.lesson_count - p.lessons_used), 0),
      revenueTrend,
      recentActivity,
    };

    return { metrics, error: null };
  } catch {
    return {
      metrics: {
        activeStudents: 0,
        weekAppointments: 0,
        todayLessons: 0,
        weekLessons: 0,
        monthLessons: 0,
        awaitingPayments: 0,
        failedDeliveries: 0,
        activePackages: 0,
        remainingLessonRights: 0,
        revenueTrend: [],
        recentActivity: [],
      },
      error: null,
    };
  }
}

export async function enrichRecentActivity(
  supabase: ReturnType<typeof getSupabaseClient>,
  rows: RecentAuditRow[]
): Promise<RecentAuditRow[]> {
  if (rows.length === 0) return rows;

  const entityIds = (entityType: string) => [
    ...new Set(rows.filter((row) => row.entity_type === entityType && row.entity_id).map((row) => row.entity_id as string)),
  ];
  const metadataText = (row: RecentAuditRow, key: string) => {
    const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, unknown>
      : {};
    const value = metadata[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  // uuid kolonlarına uuid olmayan değer giderse PostgREST tüm sorguyu reddeder
  // (22P02) ve partideki her satırın bağlamı kaybolur. Ödeme kayıtlarının
  // entity_id'si çoğunlukla public_reference ("ORI…"), uuid değil.
  const uuidsOnly = (ids: string[]) => ids.filter((id) => UUID_PATTERN.test(id));
  const lessonIds = uuidsOnly(entityIds("student_lesson"));
  const purchaseIds = uuidsOnly(entityIds("student_package_purchase"));
  const paymentKeys = [
    ...new Set([
      ...entityIds("payment_transaction"),
      ...rows.map((row) => metadataText(row, "transaction_id")).filter((id): id is string => Boolean(id)),
    ]),
  ];
  const paymentIds = uuidsOnly(paymentKeys);
  const paymentReferences = paymentKeys.filter((key) => !UUID_PATTERN.test(key)).slice(0, 200);
  const actorIds = uuidsOnly([...new Set(rows.map((row) => row.actor_user_id).filter((id): id is string => Boolean(id)))]);

  const lessonToStudent = new Map<string, string>();
  const purchaseContext = new Map<string, { studentId: string | null; packageId: string; lessonCount: number }>();
  const paymentToStudent = new Map<string, string>();
  const empty = Promise.resolve({ data: null });

  // Bağımsız toplu okumalar paralel; satır sayısından bağımsız sabit sorgu sayısı.
  const [lessonsRes, purchasesRes, paymentsByIdRes, paymentsByRefRes, actorsRes] = await Promise.all([
    lessonIds.length > 0 ? supabase.from("student_lessons").select("id,student_user_id").in("id", lessonIds) : empty,
    purchaseIds.length > 0
      ? supabase.from("student_package_purchases").select("id,student_user_id,package_id,lesson_count").in("id", purchaseIds)
      : empty,
    paymentIds.length > 0
      ? supabase.from("payment_transactions").select("id,public_reference,student_user_id,package_owner_student_id").in("id", paymentIds)
      : empty,
    paymentReferences.length > 0
      ? supabase.from("payment_transactions").select("id,public_reference,student_user_id,package_owner_student_id").in("public_reference", paymentReferences)
      : empty,
    actorIds.length > 0 ? supabase.from("admin_profiles").select("user_id,display_name").in("user_id", actorIds) : empty,
  ]);

  for (const lesson of lessonsRes.data || []) lessonToStudent.set(lesson.id, lesson.student_user_id);
  for (const purchase of purchasesRes.data || []) {
    purchaseContext.set(purchase.id, {
      studentId: purchase.student_user_id,
      packageId: purchase.package_id,
      lessonCount: purchase.lesson_count,
    });
  }
  for (const payment of [...(paymentsByIdRes.data || []), ...(paymentsByRefRes.data || [])]) {
    const studentId = payment.package_owner_student_id || payment.student_user_id;
    if (!studentId) continue;
    paymentToStudent.set(payment.id, studentId);
    if (payment.public_reference) paymentToStudent.set(payment.public_reference, studentId);
  }

  const studentIds = new Set<string>();
  for (const row of rows) {
    const metadataStudentId = metadataText(row, "student_id") || metadataText(row, "student_user_id");
    if (metadataStudentId) studentIds.add(metadataStudentId);
    if (!row.entity_id) continue;
    const studentId =
      lessonToStudent.get(row.entity_id) ||
      purchaseContext.get(row.entity_id)?.studentId ||
      paymentToStudent.get(row.entity_id) ||
      (["student", "student_profile", "user", "member"].includes(row.entity_type) ? row.entity_id : null);
    if (studentId) studentIds.add(studentId);
  }

  const actorNames = new Map<string, string>();
  for (const actor of actorsRes.data || []) actorNames.set(actor.user_id, actor.display_name);

  const studentLookupIds = uuidsOnly([...studentIds]);
  const packageIds = [...new Set([...purchaseContext.values()].map((purchase) => purchase.packageId).filter(Boolean))];
  const [studentsRes, packagesRes] = await Promise.all([
    studentLookupIds.length > 0 ? supabase.from("student_profiles").select("id,full_name").in("id", studentLookupIds) : empty,
    packageIds.length > 0 ? supabase.from("pricing_packages").select("id,name_tr,name_en").in("id", packageIds) : empty,
  ]);

  const studentNames = new Map<string, string>();
  for (const student of studentsRes.data || []) studentNames.set(student.id, student.full_name);

  const packageNames = new Map<string, string>();
  for (const item of packagesRes.data || []) {
    const name = item.name_tr || item.name_en;
    if (name) packageNames.set(item.id, name);
  }

  return rows.map((row) => {
    const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? { ...row.metadata }
      : {};
    const entityId = row.entity_id || "";
    const purchase = purchaseContext.get(entityId);
    const metadataStudentId = typeof metadata.student_id === "string"
      ? metadata.student_id
      : typeof metadata.student_user_id === "string" ? metadata.student_user_id : null;
    const studentId =
      metadataStudentId ||
      lessonToStudent.get(entityId) ||
      purchase?.studentId ||
      paymentToStudent.get(entityId) ||
      (["student", "student_profile", "user", "member"].includes(row.entity_type) ? entityId : null);
    const studentName = studentId ? studentNames.get(studentId) : null;
    if (studentName) metadata.student_name = studentName;
    if (studentId) metadata.resolved_student_id = studentId;
    const actorName = row.actor_user_id ? actorNames.get(row.actor_user_id) : null;
    if (actorName) metadata.actor_name = actorName;
    if (purchase) {
      metadata.package_name = packageNames.get(purchase.packageId) || `${purchase.lessonCount} Derslik Paket`;
    }
    return { ...row, metadata };
  });
}

function buildRevenueTrend(rows: Array<{ amount: number; currency: string; status: string; paid_at: string | null; created_at: string; refunded_amount: number | null; refund_status: string | null }>) {
  const formatter = new Intl.DateTimeFormat("tr-TR", { month: "short" });
  return Array.from({ length: 6 }, (_, index) => {
    const monthStart = new Date();
    monthStart.setHours(0, 0, 0, 0);
    monthStart.setDate(1);
    monthStart.setMonth(monthStart.getMonth() - (5 - index));
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    const inMonth = rows.filter((row) => {
      const value = new Date(row.paid_at || row.created_at).getTime();
      return row.currency === "TRY" && value >= monthStart.getTime() && value < monthEnd.getTime();
    });
    return {
      month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
      label: formatter.format(monthStart),
      amount: inMonth.reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0) - Number(row.refunded_amount || 0)), 0),
      count: inMonth.length,
    };
  });
}

function startOfRevenueWindow() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  d.setMonth(d.getMonth() - 5);
  return d.toISOString();
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function endOfToday() {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.toISOString();
}
function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString();
}
function endOfWeek() {
  const d = new Date(startOfWeek());
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}
function startOfMonth() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.toISOString();
}
function endOfMonth() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() + 1, 1);
  return d.toISOString();
}

/**
 * Fetches recent audit log activity for the Admin Dashboard feed.
 */
export async function getRecentAuditActivity(
  limit: number = 6
): Promise<{ data: RecentAuditRow[]; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { data: [], error: error.message || null };
    }

    return { data: (data as RecentAuditRow[]) || [], error: null };
  } catch {
    return { data: [], error: null };
  }
}
