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
    ]);

    const metrics: DashboardMetrics = {
      unresolvedContacts: contactsRes.count || 0,
      confirmedBookings: confirmedBookingsRes.count || 0,
      pendingBookings: pendingBookingsRes.count || 0,
      activeSlots: slotsRes.count || 0,
      failedDeliveries: failedDeliveriesRes.count || 0,
      activePricingPackages: pricingRes.count || 0,
      activeTestimonials: testimonialsRes.count || 0,
    };

    return { metrics, error: null };
  } catch (err) {
    console.error("[Admin Dashboard] Error fetching metrics:", err);
    return {
      metrics: {
        unresolvedContacts: 0,
        confirmedBookings: 0,
        pendingBookings: 0,
        activeSlots: 0,
        failedDeliveries: 0,
        activePricingPackages: 0,
        activeTestimonials: 0,
      },
      error: "Gösterge paneli metrikleri yüklenemedi.",
    };
  }
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
      console.error("[Admin Dashboard] Error fetching recent activity:", error);
      return { data: [], error: error.message };
    }

    return { data: (data as RecentAuditRow[]) || [], error: null };
  } catch (err) {
    console.error("[Admin Dashboard] Unexpected error fetching activity:", err);
    return { data: [], error: "Son işlem dökümü yüklenemedi." };
  }
}
