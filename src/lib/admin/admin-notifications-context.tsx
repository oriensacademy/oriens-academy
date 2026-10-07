"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { humanizeNotificationSubject, humanizeEventType } from "./notifications";
import { ADMIN_PAYMENT_VISIBILITY_FILTER } from "./payments";
import { ensureTrailingSlash } from "@/lib/routes";
import { useAccount } from "@/lib/auth/account-context";

export interface AdminActionNotification {
  id: string;
  type: "contact" | "payment" | "delivery" | "homework";
  title: string;
  subtitle: string;
  timestamp: string;
  isRead: boolean;
  link: string;
  severity: "normal" | "urgent" | "warning";
}

export interface AdminNotificationCounts {
  totalUnread: number;
  communicationSupport: number;
  payments: number;
  notifications: number;
  homework: number;
  /** Onay bekleyen ödemeler (havale/EFT: pending, requires_action). Sol menü rozeti. */
  pendingPayments: number;
}

interface AdminNotificationsContextValue {
  notifications: AdminActionNotification[];
  counts: AdminNotificationCounts;
  loading: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  /** Clears the Ödemeler badge; called when the payments page is opened. */
  markPaymentsSeen: () => Promise<void>;
}

const AdminNotificationsContext = createContext<AdminNotificationsContextValue | null>(null);

export function AdminNotificationsProvider({ children }: { children: React.ReactNode }) {
  // Admin RPC'leri (admin_payments_seen_at vb.) yalnızca sunucuda doğrulanmış
  // bir admin oturumundan sonra çağrılır; anonim ziyaretçi /admin/ açtığında
  // giriş sayfasına yönlenirken arka planda hiçbir admin isteği gitmez.
  const { accountType, isInitializing } = useAccount();
  const isVerifiedAdmin = !isInitializing && accountType === "admin";
  const [notifications, setNotifications] = useState<AdminActionNotification[]>([]);
  const [counts, setCounts] = useState<AdminNotificationCounts>({
    totalUnread: 0,
    communicationSupport: 0,
    payments: 0,
    notifications: 0,
    homework: 0,
    pendingPayments: 0,
  });
  const [loading, setLoading] = useState(false);
  /**
   * A 45s poll, manual refreshes and "mark seen" all write the same state. A
   * request that started before a state change must not land after it, or the
   * badge the admin just cleared comes straight back.
   */
  const requestSeqRef = useRef(0);

  const fetchActionableNotifications = useCallback(async () => {
    const supabase = getSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anySupabase = supabase as any;
    const seq = (requestSeqRef.current += 1);
    try {
      setLoading(true);

      // Payments are "unread" until the admin opens /admin/odemeler. Without
      // this the badge showed every visible transaction and never cleared.
      let paymentsSeenAt: string | null = null;
      try {
        const seen = await anySupabase.rpc("admin_payments_seen_at");
        paymentsSeenAt = (seen?.data as string | null) ?? null;
      } catch {
        paymentsSeenAt = null;
      }

      let paymentsQuery = anySupabase
        .from("payment_transactions")
        .select("id, amount, currency, payment_method, payer_email, created_at, status", { count: "exact" })
        .eq("is_archived", false)
        .or(ADMIN_PAYMENT_VISIBILITY_FILTER);
      if (paymentsSeenAt) paymentsQuery = paymentsQuery.gt("created_at", paymentsSeenAt);
      paymentsQuery = paymentsQuery.order("created_at", { ascending: false }).limit(10);

      const [
        contactsRes,
        paymentsRes,
        deliveriesRes,
        homeworkRes,
        pendingPaymentsRes,
      ] = await Promise.all([
        // 1. New contact requests
        anySupabase
          .from("contact_requests")
          .select("id, full_name, email, subject, created_at, status")
          .eq("status", "new")
          .order("created_at", { ascending: false })
          .limit(10),

        // 3. Payments the admin has not seen yet
        paymentsQuery,

        // 4. Failed notification deliveries
        anySupabase
          .from("notification_deliveries")
          .select("id, recipient, event_type, payload, status, created_at, is_read")
          .eq("status", "failed")
          .order("created_at", { ascending: false })
          .limit(10),

        // 5. Submitted homework waiting review
        anySupabase
          .from("student_homework")
          .select("id, title, student_user_id, created_at, status, student_profiles:student_user_id(full_name)")
          .eq("status", "submitted")
          .order("created_at", { ascending: false })
          .limit(10),

        // 6. Payments waiting for approval (sidebar badge, read-only count)
        anySupabase
          .from("payment_transactions")
          .select("id", { count: "exact", head: true })
          .eq("is_archived", false)
          .eq("payment_method", "bank_transfer")
          .in("status", ["pending", "requires_action"]),
      ]);

      const items: AdminActionNotification[] = [];

      // Transform contacts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contacts = (contactsRes.data || []) as any[];
      contacts.forEach((c) => {
        items.push({
          id: `contact-${c.id}`,
          type: "contact",
          title: c.subject || "Yeni İletişim / Danışmanlık Talebi",
          subtitle: `${c.full_name || c.email} · Yeni Talep`,
          timestamp: c.created_at,
          isRead: false,
          link: ensureTrailingSlash(`/admin/iletisim-destek?id=${c.id}`),
          severity: "normal",
        });
      });

      // Transform payments
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payments = (paymentsRes.data || []) as any[];
      payments.forEach((p) => {
        const method = p.payment_method === "bank_transfer" ? "Havale / EFT" : p.payment_method;
        items.push({
          id: `payment-${p.id}`,
          type: "payment",
          title: p.status === "paid" ? "Başarılı Ödeme" : p.status === "refunded" ? "İade Edilen Ödeme" : "Onay Bekleyen Ödeme",
          subtitle: `${p.payer_email || "Öğrenci"} · ${p.amount} ${p.currency} (${method})`,
          timestamp: p.created_at,
          isRead: false,
          link: ensureTrailingSlash(`/admin/odemeler?search=${encodeURIComponent(p.id)}`),
          severity: "warning",
        });
      });

      // Transform deliveries
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deliveries = (deliveriesRes.data || []) as any[];
      deliveries.forEach((d) => {
        const subject = humanizeNotificationSubject(d, "tr");
        const eventLabel = humanizeEventType(d.event_type, "tr");
        items.push({
          id: `delivery-${d.id}`,
          type: "delivery",
          title: `Başarısız Bildirim: ${eventLabel}`,
          subtitle: `${d.recipient} · ${subject}`,
          timestamp: d.created_at,
          isRead: Boolean(d.is_read),
          link: ensureTrailingSlash(`/admin/bildirimler?status=failed`),
          severity: "warning",
        });
      });

      // Transform homework
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const homework = (homeworkRes.data || []) as any[];
      homework.forEach((h) => {
        const studentProfile = h.student_profiles as unknown as { full_name?: string } | null;
        const name = studentProfile?.full_name || "Öğrenci";
        items.push({
          id: `homework-${h.id}`,
          type: "homework",
          title: "Değerlendirme Bekleyen Ödev",
          subtitle: `${name} · ${h.title}`,
          timestamp: h.created_at,
          isRead: false,
          link: h.student_user_id ? `${ensureTrailingSlash("/admin/ogrenciler/detay")}?student=${encodeURIComponent(h.student_user_id)}` : ensureTrailingSlash("/admin/ogrenciler"),
          severity: "normal",
        });
      });

      // Sort by timestamp desc
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const communicationCount = contacts.length;
      const paymentsCount = paymentsRes.count ?? payments.length;
      const notificationsCount = deliveries.length;
      const homeworkCount = homework.length;
      const totalUnread = communicationCount + paymentsCount + notificationsCount + homeworkCount;

      if (seq !== requestSeqRef.current) return; // superseded while awaiting
      setNotifications(items);
      setCounts({
        totalUnread,
        communicationSupport: communicationCount,
        payments: paymentsCount,
        notifications: notificationsCount,
        homework: homeworkCount,
        pendingPayments: pendingPaymentsRes?.count ?? 0,
      });
    } catch (err) {
      console.warn("[AdminNotificationsContext] Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    // Optimistic local clear
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setCounts((prev) => ({ ...prev, totalUnread: 0, notifications: 0 }));

    const supabase = getSupabaseClient();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc("admin_mark_notifications_read", {
        p_mark_all: true,
      });
    } catch (err) {
      console.warn("[AdminNotificationsContext] Error marking all read:", err);
    }
  }, []);

  const markPaymentsSeen = useCallback(async () => {
    // Optimistic: the page the admin just opened should not keep its own badge.
    // Bumping the sequence discards any fetch that started before this point.
    requestSeqRef.current += 1;
    setNotifications((prev) => prev.filter((item) => item.type !== "payment"));
    setCounts((prev) => ({
      ...prev,
      payments: 0,
      totalUnread: Math.max(0, prev.totalUnread - prev.payments),
    }));

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (getSupabaseClient() as any).rpc("admin_mark_payments_seen");
      if (error) throw error;
      // Recount against the stamp we just wrote, so anything that arrived in
      // the meantime is still reported as unread.
      void fetchActionableNotifications();
    } catch (err) {
      console.warn("[AdminNotificationsContext] Error marking payments seen:", err);
      // Put the real numbers back so the badge never lies about unread work.
      void fetchActionableNotifications();
    }
  }, [fetchActionableNotifications]);

  useEffect(() => {
    if (!isVerifiedAdmin) return;
    const timer = window.setTimeout(() => {
      void fetchActionableNotifications();
    }, 0);
    const interval = window.setInterval(() => {
      void fetchActionableNotifications();
    }, 45000); // 45 second soft poll
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [fetchActionableNotifications, isVerifiedAdmin]);

  const value = useMemo(
    () => ({
      notifications,
      counts,
      loading,
      refresh: fetchActionableNotifications,
      markAllRead,
      markPaymentsSeen,
    }),
    [notifications, counts, loading, fetchActionableNotifications, markAllRead, markPaymentsSeen]
  );

  return (
    <AdminNotificationsContext.Provider value={value}>
      {children}
    </AdminNotificationsContext.Provider>
  );
}

export function useAdminNotifications() {
  const context = useContext(AdminNotificationsContext);
  if (!context) {
    return {
      notifications: [],
      counts: { totalUnread: 0, communicationSupport: 0, payments: 0, notifications: 0, homework: 0, pendingPayments: 0 },
      loading: false,
      refresh: async () => {},
      markAllRead: async () => {},
      markPaymentsSeen: async () => {},
    };
  }
  return context;
}
