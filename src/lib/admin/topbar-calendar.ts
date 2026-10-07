import { getSupabaseClient } from "@/lib/supabase/client";
import { ADMIN_PAYMENT_VISIBILITY_FILTER } from "@/lib/admin/payments";
import { packageDisplayName } from "@/lib/packages/display";

// Üst çubuk takvimi — referans: oriens-admin.js "Üst çubuk takvimi".
// Ders = gönderilmiş ders raporu (report_email_sent_at), ödeme = panelde
// görünen ödeme kaydı (created_at). Yalnız okuma; hiçbir kayıt değişmez.

export interface AdminCalendarEvent {
  /** ISO zaman damgası */
  t: string;
  /** Kalın satır: öğrenci (ödemede öğrenci yoksa ödeyen) */
  a: string;
  /** Alt satır: ders konusu veya "Paket · ₺tutar" */
  b: string;
}

export interface AdminCalendarMonth {
  lessons: AdminCalendarEvent[];
  payments: AdminCalendarEvent[];
}

const formatTl = (value: number) => `₺${value.toLocaleString("tr-TR")}`;

export async function listAdminCalendarMonth(year: number, month: number): Promise<AdminCalendarMonth> {
  const supabase = getSupabaseClient();
  // Görünen ızgara önceki/sonraki ayın birkaç gününü de içerir.
  const from = new Date(year, month - 1, 20).toISOString();
  const to = new Date(year, month + 1, 12).toISOString();

  const [lessonsRes, paymentsRes] = await Promise.all([
    supabase
      .from("student_lessons")
      .select("student_user_id,title,subject,report_email_sent_at")
      .eq("is_archived", false)
      .gte("report_email_sent_at", from)
      .lt("report_email_sent_at", to)
      .order("report_email_sent_at", { ascending: true })
      .limit(1000),
    supabase
      .from("payment_transactions")
      .select("package_id,payer_name,payer_email,amount,package_owner_student_id,student_user_id,metadata,created_at")
      .eq("is_archived", false)
      .or(ADMIN_PAYMENT_VISIBILITY_FILTER)
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", { ascending: true })
      .limit(1000),
  ]);

  if (lessonsRes.error) throw new Error(lessonsRes.error.message);
  if (paymentsRes.error) throw new Error(paymentsRes.error.message);

  const lessons = lessonsRes.data ?? [];
  const payments = paymentsRes.data ?? [];

  // Öğrenci adları tek sorguda (N+1 yok).
  const ids = new Set<string>();
  for (const row of lessons) if (row.student_user_id) ids.add(row.student_user_id);
  for (const row of payments) {
    const owner = row.package_owner_student_id ?? row.student_user_id;
    if (owner) ids.add(owner);
  }
  const names = new Map<string, string>();
  if (ids.size) {
    const { data, error } = await supabase.from("student_profiles").select("id,full_name").in("id", [...ids]);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) if (row.full_name) names.set(row.id, row.full_name);
  }

  return {
    lessons: lessons.map((row) => ({
      t: row.report_email_sent_at as string,
      a: names.get(row.student_user_id) ?? "Öğrenci",
      b: row.subject?.trim() || row.title?.trim() || "Ders",
    })),
    payments: payments.map((row) => {
      const owner = row.package_owner_student_id ?? row.student_user_id;
      const amount = Number(row.amount) || 0;
      const pkg = packageDisplayName({ package_id: row.package_id, metadata: row.metadata });
      return {
        t: row.created_at,
        a: (owner && names.get(owner)) || row.payer_name?.trim() || row.payer_email || "Ödeme",
        b: `${pkg} · ${amount > 0 ? formatTl(amount) : "Ücretsiz"}`,
      };
    }),
  };
}
