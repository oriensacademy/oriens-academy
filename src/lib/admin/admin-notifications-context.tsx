"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { humanizeNotificationSubject, humanizeEventType } from "./notifications";

export interface AdminActionNotification {
  id: string;
  type: "contact" | "support" | "payment" | "delivery" | "homework";
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
}

interface AdminNotificationsContextValue {
  notifications: AdminActionNotification[];
  counts: AdminNotificationCounts;
  loading: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
}

const AdminNotificationsContext = createContext<AdminNotificationsContextValue | null>(null);

export function AdminNotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AdminActionNotification[]>([]);
  const [counts, setCounts] = useState<AdminNotificationCounts>({
    totalUnread: 0,
    communicationSupport: 0,
    payments: 0,
    notifications: 0,
    homework: 0,
  });
  const [loading, setLoading] = useState(false);

  const fetchActionableNotifications = useCallback(async () => {
    const supabase = getSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anySupabase = supabase as any;
    try {
      setLoading(true);

      const [
        contactsRes,
        supportRes,
        paymentsRes,
        deliveriesRes,
        homeworkRes,
      ] = await Promise.all([
        // 1. New contact requests
        anySupabase
          .from("contact_requests")
          .select("id, full_name, email, subject, created_at, status")
          .eq("status", "new")
          .order("created_at", { ascending: false })
          .limit(10),

        // 2. Open / waiting support threads
        anySupabase
          .from("support_threads")
          .select("id, title, status, last_message_at, student_user_id, student_profiles:student_user_id(full_name)")
          .in("status", ["open", "waiting_support"])
          .order("last_message_at", { ascending: false })
          .limit(10),

        // 3. Pending payments (e.g. bank transfer pending)
        anySupabase
          .from("payment_transactions")
          .select("id, amount, currency, payment_method, payer_email, created_at, status")
          .in("status", ["pending", "requires_action"])
          .order("created_at", { ascending: false })
          .limit(10),

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
          link: `/admin/iletisim-destek?view=web&id=${c.id}`,
          severity: "normal",
        });
      });

      // Transform support
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const support = (supportRes.data || []) as any[];
      support.forEach((s) => {
        const studentProfile = s.student_profiles as unknown as { full_name?: string } | null;
        const name = studentProfile?.full_name || "Öğrenci";
        items.push({
          id: `support-${s.id}`,
          type: "support",
          title: s.title || "Destek Talebi",
          subtitle: `${name} · Yanıt Bekliyor`,
          timestamp: s.last_message_at || new Date().toISOString(),
          isRead: false,
          link: `/admin/iletisim-destek?view=support&id=${s.id}`,
          severity: "urgent",
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
          title: "Onay Bekleyen Ödeme",
          subtitle: `${p.payer_email || "Öğrenci"} · ${p.amount} ${p.currency} (${method})`,
          timestamp: p.created_at,
          isRead: false,
          link: `/admin/odemeler?search=${encodeURIComponent(p.id)}`,
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
          link: `/admin/bildirimler?status=failed`,
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
          link: `/admin/odevler`,
          severity: "normal",
        });
      });

      // Sort by timestamp desc
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const communicationCount = contacts.length + support.length;
      const paymentsCount = payments.length;
      const notificationsCount = deliveries.length;
      const homeworkCount = homework.length;
      const totalUnread = communicationCount + paymentsCount + notificationsCount + homeworkCount;

      setNotifications(items);
      setCounts({
        totalUnread,
        communicationSupport: communicationCount,
        payments: paymentsCount,
        notifications: notificationsCount,
        homework: homeworkCount,
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

  useEffect(() => {
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
  }, [fetchActionableNotifications]);

  const value = useMemo(
    () => ({
      notifications,
      counts,
      loading,
      refresh: fetchActionableNotifications,
      markAllRead,
    }),
    [notifications, counts, loading, fetchActionableNotifications, markAllRead]
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
      counts: { totalUnread: 0, communicationSupport: 0, payments: 0, notifications: 0, homework: 0 },
      loading: false,
      refresh: async () => {},
      markAllRead: async () => {},
    };
  }
  return context;
}
