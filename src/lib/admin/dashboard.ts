import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";
import { ADMIN_PAYMENT_VISIBILITY_FILTER } from "@/lib/admin/payments";

export interface DashboardMetrics {
  activeStudents: number;
  todayLessons: number;
  weekAppointments: number;
  awaitingPayments: number;
  failedDeliveries: number;
}

export type RecentAuditRow = Tables<"audit_logs">;

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
      awaitingPaymentsRes,
      failedDeliveriesRes,
    ] = await Promise.all([
      supabase.from("student_profiles").select("id", { count: "exact", head: true }).eq("active", true),
      supabase
        .from("bookings")
        .select("id,availability_slots!inner(starts_at)", { count: "exact", head: true })
        .gte("availability_slots.starts_at", startOfWeek())
        .lt("availability_slots.starts_at", endOfWeek())
        .neq("status", "cancelled"),
      supabase
        .from("student_lessons")
        .select("id", { count: "exact", head: true })
        .gte("lesson_date", startOfToday())
        .lt("lesson_date", endOfToday()),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from as any)("payment_transactions").select("id", { count: "exact", head: true }).eq("is_archived", false).or(ADMIN_PAYMENT_VISIBILITY_FILTER),
      supabase
        .from("notification_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
    ]);

    const metrics: DashboardMetrics = {
      activeStudents: activeStudentsRes.count || 0,
      weekAppointments: weekAppointmentsRes.count || 0,
      todayLessons: todayLessonsRes.count || 0,
      awaitingPayments: awaitingPaymentsRes.count || 0,
      failedDeliveries: failedDeliveriesRes.count || 0,
    };

    return { metrics, error: null };
  } catch {
    return {
      metrics: {
        activeStudents: 0,
        weekAppointments: 0,
        todayLessons: 0,
        awaitingPayments: 0,
        failedDeliveries: 0,
      },
      error: null,
    };
  }
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
