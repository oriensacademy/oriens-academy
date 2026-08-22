import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

export interface DashboardMetrics {
  unresolvedContacts: number;
  confirmedBookings: number;
  pendingBookings: number;
  activeSlots: number;
  failedDeliveries: number;
  activePricingPackages: number;
  activeTestimonials: number;
  activeStudents: number;
  weekAppointments: number;
  todayLessons: number;
  pendingHomework: number;
  activeStudentPackages: number;
  awaitingPayments: number;
  completedStudentPackages: number;
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
      contactsRes,
      confirmedBookingsRes,
      pendingBookingsRes,
      slotsRes,
      failedDeliveriesRes,
      pricingRes,
      testimonialsRes,
      activeStudentsRes,
      weekAppointmentsRes,
      todayLessonsRes,
      pendingHomeworkRes,
      activeStudentPackagesRes,
      awaitingPaymentsRes,
      completedStudentPackagesRes,
    ] = await Promise.all([
      supabase
        .from("contact_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["new", "in_progress"]),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed"),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("availability_slots")
        .select("id", { count: "exact", head: true })
        .gte("starts_at", new Date().toISOString()),
      supabase
        .from("notification_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
      supabase
        .from("pricing_packages")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
      supabase
        .from("testimonials")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
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
      supabase.from("student_homework").select("id", { count: "exact", head: true }).in("status", ["assigned", "submitted", "late"]),
      supabase.from("student_package_purchases").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("payment_transactions").select("id", { count: "exact", head: true }).in("status", ["pending", "requires_action", "processing"]),
      supabase.from("student_package_purchases").select("id", { count: "exact", head: true }).eq("status", "completed"),
    ]);

    const metrics: DashboardMetrics = {
      unresolvedContacts: contactsRes.count || 0,
      confirmedBookings: confirmedBookingsRes.count || 0,
      pendingBookings: pendingBookingsRes.count || 0,
      activeSlots: slotsRes.count || 0,
      failedDeliveries: failedDeliveriesRes.count || 0,
      activePricingPackages: pricingRes.count || 5,
      activeTestimonials: testimonialsRes.count || 0,
      activeStudents: activeStudentsRes.count || 0,
      weekAppointments: weekAppointmentsRes.count || 0,
      todayLessons: todayLessonsRes.count || 0,
      pendingHomework: pendingHomeworkRes.count || 0,
      activeStudentPackages: activeStudentPackagesRes.count || 0,
      awaitingPayments: awaitingPaymentsRes.count || 0,
      completedStudentPackages: completedStudentPackagesRes.count || 0,
    };

    return { metrics, error: null };
  } catch {
    return {
      metrics: {
        unresolvedContacts: 0,
        confirmedBookings: 0,
        pendingBookings: 0,
        activeSlots: 0,
        failedDeliveries: 0,
        activePricingPackages: 5,
        activeTestimonials: 0,
        activeStudents: 0,
        weekAppointments: 0,
        todayLessons: 0,
        pendingHomework: 0,
        activeStudentPackages: 0,
        awaitingPayments: 0,
        completedStudentPackages: 0,
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
