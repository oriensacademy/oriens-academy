import { getSupabaseClient } from "@/lib/supabase/client";
import { listAdminStudents } from "@/lib/admin/students";
import { listAdminPaymentLedger, type AdminPaymentLedgerRow } from "@/lib/admin/payments";
import { listStudentPackageStandings } from "@/lib/admin/finance";
import { listGuardianLastSignIns } from "@/lib/admin/logins";
import { humanizeNotificationSubject, type NotificationDeliveryRow } from "@/lib/admin/notifications";
import { asAuditMetadata, toAuditText } from "@/lib/admin/audit-presentation";
import { packageDisplayName } from "@/lib/packages/display";
import { enrichRecentActivity, type RecentAuditRow } from "@/lib/admin/dashboard";

// Genel Bakış (referans #view-panel) için tek seferlik okuma. Yalnız okuma.

export interface OverviewStudent {
  id: string;
  name: string;
  program: string | null;
  lastLessonDate: string | null;
  packageLabel: string | null;
  remaining: number;
  lessonPrice: number;
  guardianUserId: string | null;
}

export type OverviewFeedKind = "pay" | "il" | "ders" | "pk" | "lock" | "mail";

export interface OverviewFeedItem {
  key: string;
  at: string;
  kind: OverviewFeedKind;
  tone: "g" | "b" | "y" | "r";
  title: string;
  who: string;
  /** Öğrenci detayına bağlantı için öğrenci kimliği. */
  studentId: string | null;
  /** Kişi adı yerine sayfa bağlantısı (iletişim, denetim, bildirimler). */
  href: string | null;
  detail: string;
  amount: number | null;
}

export interface AdminOverview {
  students: OverviewStudent[];
  ledger: AdminPaymentLedgerRow[];
  weekLessons: number;
  newContacts: number;
  failedEmails: number;
  guardiansNotSignedIn: number;
  feed: OverviewFeedItem[];
  errors: string[];
}

const CONTACT_FORM_LABEL: Record<string, string> = {
  contact_form: "İletişim formu",
  quick_contact: "Hızlı iletişim",
  consultation: "Danışmanlık formu",
};

const AUDIT_TITLE: Record<string, { title: string; kind: "ders" | "pk" }> = {
  "lesson.created_past": { title: "Ders kaydı eklendi", kind: "ders" },
  "lesson.completed": { title: "Ders kaydı eklendi", kind: "ders" },
  "lesson.updated": { title: "Ders kaydı güncellendi", kind: "ders" },
  "lesson.report_saved": { title: "Ders raporu kaydedildi", kind: "ders" },
  "lesson.package_changed": { title: "Ders paketi değiştirildi", kind: "pk" },
  "package.extra_lessons_added": { title: "Ders hakkı eklendi", kind: "pk" },
  "package.lessons_adjusted": { title: "Ders hakları güncellendi", kind: "pk" },
  "package.adjusted": { title: "Ders hakları güncellendi", kind: "pk" },
};

function startOfWeekIso(now: Date) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString();
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = getSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const untyped = supabase as any;
  const now = new Date();
  const [students, standings, ledger, signIns, weekLessons, contacts, newContacts, failed, failedCount, audits, failedLogins] = await Promise.all([
    listAdminStudents(),
    listStudentPackageStandings(),
    listAdminPaymentLedger((source) => packageDisplayName(source)),
    listGuardianLastSignIns(),
    supabase.from("student_lessons").select("id", { count: "exact", head: true }).eq("is_archived", false).eq("status", "completed").gte("lesson_date", startOfWeekIso(now)),
    supabase.from("contact_requests").select("id,full_name,email,subject,source,created_at").eq("is_archived", false).order("created_at", { ascending: false }).limit(10),
    supabase.from("contact_requests").select("id", { count: "exact", head: true }).eq("is_archived", false).eq("status", "new"),
    supabase.from("notification_deliveries").select("*").eq("is_archived", false).eq("status", "failed").order("created_at", { ascending: false }).limit(10),
    supabase.from("notification_deliveries").select("id", { count: "exact", head: true }).eq("is_archived", false).eq("status", "failed"),
    supabase.from("audit_logs").select("id,action,actor_user_id,category,correlation_id,created_at,entity_id,entity_type,metadata,severity").in("category", ["lesson", "package"]).order("created_at", { ascending: false }).limit(15),
    untyped.from("auth_login_events").select("id,email,user_id,device,created_at").eq("result", "fail").order("created_at", { ascending: false }).limit(10) as Promise<{ data: { id: number; email: string; user_id: string | null; device: string | null; created_at: string }[] | null; error: unknown }>,
  ]);

  const errors = [students.error, standings.error, ledger.error].filter((e): e is string => Boolean(e));
  const standingById = new Map(standings.data.map((s) => [s.studentId, s]));
  const list: OverviewStudent[] = students.data
    .filter((s) => s.userId && s.active && !s.archived)
    .map((s) => {
      const standing = standingById.get(s.userId as string);
      return {
        id: s.userId as string,
        name: s.fullName,
        program: s.educationProgram || s.gradeLevel || null,
        lastLessonDate: s.lastLessonDate,
        packageLabel: standing?.packageLabel ?? null,
        remaining: standing?.remaining ?? 0,
        lessonPrice: standing?.lessonPrice ?? 0,
        guardianUserId: s.guardianUserId,
      };
    });

  const nameByStudent = new Map(list.map((s) => [s.id, s.name]));
  const cutoff = now.getTime() - 14 * 86_400_000;
  const guardiansNotSignedIn = signIns.error ? 0 : list.filter((s) => {
    if (!s.guardianUserId || !signIns.data.has(s.guardianUserId)) return false;
    const last = signIns.data.get(s.guardianUserId);
    return !last || new Date(last).getTime() < cutoff;
  }).length;

  const feed: OverviewFeedItem[] = [];
  ledger.data.slice(0, 15).forEach((row) => {
    feed.push({
      key: row.key,
      at: row.at,
      kind: "pay",
      tone: "g",
      title: row.status === "iade" ? "İade" : row.status === "bekliyor" ? "Ödeme bekleniyor" : row.status === "basarisiz" ? "Ödeme başarısız" : row.source === "ucretsiz" ? "Paket tanımlandı" : "Ödeme alındı",
      who: row.studentName || row.payerName,
      studentId: row.studentId,
      href: null,
      detail: `${row.packageLabel} · ${row.source === "banka" ? "Banka Transferi" : row.source === "ucretsiz" ? "Ücretsiz" : "Kredi Kartı"}`,
      amount: row.source === "ucretsiz" ? null : row.netAmount,
    });
  });
  (contacts.data ?? []).forEach((row) => {
    feed.push({
      key: `il:${row.id}`, at: row.created_at, kind: "il", tone: "b", title: "Yeni iletişim talebi",
      who: row.full_name?.trim() || row.email, studentId: null, href: "/admin/iletisim",
      detail: `${row.subject?.trim() || "Konu belirtilmedi"} · ${CONTACT_FORM_LABEL[row.source] ?? "İletişim formu"}`, amount: null,
    });
  });
  const enrichedAudits = await enrichRecentActivity(supabase, ((audits.data ?? []) as RecentAuditRow[]).filter((row) => AUDIT_TITLE[String(row.action)]));
  enrichedAudits.forEach((row) => {
    const mapped = AUDIT_TITLE[String(row.action)];
    if (!mapped) return;
    const meta = asAuditMetadata(row.metadata);
    const studentId = toAuditText(meta.resolved_student_id);
    feed.push({
      key: `au:${row.id}`, at: row.created_at, kind: mapped.kind, tone: mapped.kind === "ders" ? "g" : "y", title: mapped.title,
      who: toAuditText(meta.student_name) ?? (studentId ? nameByStudent.get(studentId) ?? "Öğrenci" : "Öğrenci"),
      studentId: studentId && nameByStudent.has(studentId) ? studentId : null, href: null,
      detail: toAuditText(meta.package_name) ?? "", amount: null,
    });
  });
  (failedLogins.data ?? []).forEach((row) => {
    feed.push({
      key: `lg:${row.id}`, at: row.created_at, kind: "lock", tone: "r", title: "Hatalı giriş denemesi",
      who: row.email, studentId: null, href: "/admin/denetim", detail: row.device ?? "", amount: null,
    });
  });
  ((failed.data ?? []) as NotificationDeliveryRow[]).forEach((row) => {
    feed.push({
      key: `ml:${row.id}`, at: row.created_at, kind: "mail", tone: "r", title: "E-posta gönderilemedi",
      who: row.recipient, studentId: null, href: "/admin/bildirimler", detail: humanizeNotificationSubject(row), amount: null,
    });
  });
  feed.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return {
    students: list,
    ledger: ledger.data,
    weekLessons: weekLessons.count ?? 0,
    newContacts: newContacts.count ?? 0,
    failedEmails: failedCount.count ?? 0,
    guardiansNotSignedIn,
    feed: feed.slice(0, 7),
    errors,
  };
}
