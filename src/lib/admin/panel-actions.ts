import { getSupabaseClient } from "@/lib/supabase/client";
import { enrichRecentActivity, type RecentAuditRow } from "@/lib/admin/dashboard";
import { asAuditMetadata, dashboardActivityText, toAuditText } from "@/lib/admin/audit-presentation";
import { formatTrLira } from "@/lib/format/turkish";

// Denetim > Panel işlemleri: yöneticilerin panelde yaptığı değişiklikler (audit_logs).
// Yalnız okuma. Not içerikleri ve teknik ayrıntılar gösterilmez.

export type PanelActionKind = "ders" | "paket" | "fiyat" | "yorum" | "arsiv" | "diger";

export interface PanelAction {
  id: string;
  kind: PanelActionKind;
  title: string;
  detail: string;
  actor: string;
  at: string;
  studentId: string | null;
}

const ACTION_MAP: Record<string, { kind: PanelActionKind; title: string }> = {
  "lesson.created_past": { kind: "ders", title: "Ders kaydı eklendi" },
  "lesson.completed": { kind: "ders", title: "Ders kaydı eklendi" },
  "lesson.created": { kind: "ders", title: "Ders kaydı eklendi" },
  "lesson.updated": { kind: "ders", title: "Ders kaydı güncellendi" },
  "lesson.report_saved": { kind: "ders", title: "Ders raporu kaydedildi" },
  "lesson.package_changed": { kind: "paket", title: "Dersin paketi değiştirildi" },
  "lesson.report_email_manually_sent": { kind: "ders", title: "Ders raporu e-postası gönderildi" },
  "lesson.completion_email_manually_sent": { kind: "ders", title: "Ders bilgilendirmesi gönderildi" },
  "package.assigned": { kind: "paket", title: "Paket tanımlandı" },
  package_assigned: { kind: "paket", title: "Paket tanımlandı" },
  package_assigned_manual: { kind: "paket", title: "Paket tanımlandı" },
  "package.extra_lessons_added": { kind: "paket", title: "Ders hakkı eklendi" },
  "package.lessons_adjusted": { kind: "paket", title: "Ders hakları güncellendi" },
  "package.adjusted": { kind: "paket", title: "Ders hakları güncellendi" },
  lesson_rights_adjusted: { kind: "paket", title: "Ders hakları güncellendi" },
  "admin.pricing.package_created": { kind: "fiyat", title: "Fiyat paketi eklendi" },
  "admin.pricing.package_updated": { kind: "fiyat", title: "Fiyat güncellendi" },
  "admin.pricing.package_deleted": { kind: "fiyat", title: "Fiyat paketi kaldırıldı" },
  "admin.content.testimonial_created": { kind: "yorum", title: "Değerlendirme eklendi" },
  "admin.content.testimonial_updated": { kind: "yorum", title: "Değerlendirme güncellendi" },
  "admin.content.testimonial_archived": { kind: "arsiv", title: "Değerlendirme arşive taşındı" },
  member_archived: { kind: "arsiv", title: "Öğrenci arşive taşındı" },
  member_restored: { kind: "arsiv", title: "Öğrenci arşivden çıkarıldı" },
  "student.created_under_guardian": { kind: "diger", title: "Öğrenci eklendi" },
  "student.created": { kind: "diger", title: "Öğrenci eklendi" },
  "student.identity.updated": { kind: "diger", title: "Öğrenci bilgileri güncellendi" },
  "student.profile.updated": { kind: "diger", title: "Öğrenci bilgileri güncellendi" },
  "student.guardian_identity_updated": { kind: "diger", title: "Veli bilgileri güncellendi" },
  "student.note.created": { kind: "diger", title: "Öğrenciye not eklendi" },
  "student.note.updated": { kind: "diger", title: "Öğrenci notu güncellendi" },
  "student.password_reset_sent": { kind: "diger", title: "Şifre sıfırlama gönderildi" },
  "payment.refund_intent_created": { kind: "paket", title: "İade başlatıldı" },
  "payment.refund_finalized": { kind: "paket", title: "İade tamamlandı" },
  "payment.refunded": { kind: "paket", title: "İade yapıldı" },
  "bank_transfer.approved": { kind: "paket", title: "Banka transferi onaylandı" },
  "bank_transfer.rejected": { kind: "paket", title: "Banka transferi reddedildi" },
  "admin.blog.post_created": { kind: "diger", title: "Blog yazısı oluşturuldu" },
  "admin.blog.post_updated": { kind: "diger", title: "Blog yazısı güncellendi" },
  "admin.blog.post_published": { kind: "diger", title: "Blog yazısı yayınlandı" },
  "admin.blog.post_archived": { kind: "arsiv", title: "Blog yazısı arşive taşındı" },
  "admin.blog.post_restored": { kind: "arsiv", title: "Blog yazısı arşivden çıkarıldı" },
  "admin.settings.updated": { kind: "diger", title: "Site ayarları güncellendi" },
  "contact.status_updated": { kind: "diger", title: "İletişim talebi güncellendi" },
  contact_request_archived: { kind: "arsiv", title: "İletişim talebi arşive taşındı" },
  contact_request_restored: { kind: "arsiv", title: "İletişim talebi arşivden çıkarıldı" },
  "admin.password_change_completed": { kind: "diger", title: "Yönetici şifresi değiştirildi" },
};

const HIDDEN_CATEGORIES = new Set(["email", "system", "database", "edge", "auth"]);
const CHUNK = 100;

function eurText(value: unknown) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? `€${n.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}` : null;
}

function liraText(value: unknown) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? formatTrLira(n) : null;
}

export async function listAdminPanelActions(): Promise<{ data: PanelAction[]; error: string | null }> {
  const supabase = getSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const untyped = supabase as any;
  const admins = (await untyped.from("admin_profiles").select("user_id")) as { data: { user_id: string }[] | null; error: unknown };
  if (admins.error) return { data: [], error: "Panel işlemleri yüklenemedi." };
  const adminIds = (admins.data ?? []).map((row) => row.user_id).filter(Boolean);
  if (!adminIds.length) return { data: [], error: null };

  const since = new Date(Date.now() - 366 * 86_400_000).toISOString();
  const res = (await supabase
    .from("audit_logs")
    .select("id,action,actor_user_id,category,correlation_id,created_at,entity_id,entity_type,metadata,severity")
    .in("actor_user_id", adminIds)
    .in("action", Object.keys(ACTION_MAP))
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500)) as { data: RecentAuditRow[] | null; error: unknown };
  if (res.error) return { data: [], error: "Panel işlemleri yüklenemedi." };
  const rows = (res.data ?? []).filter((row) => !HIDDEN_CATEGORIES.has(String(row.category ?? "")) && !String(row.action).endsWith("_failed"));

  const enriched: RecentAuditRow[] = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    enriched.push(...(await enrichRecentActivity(supabase, rows.slice(i, i + CHUNK))));
  }

  // Fiyat paketi ve değerlendirme adları (metadata'da tutulmuyor).
  const idsOf = (entityType: string) => Array.from(new Set(enriched.filter((row) => row.entity_type === entityType && row.entity_id).map((row) => row.entity_id as string)));
  const pricingIds = idsOf("pricing_package");
  const testimonialIds = idsOf("testimonial");
  const pricingNames = new Map<string, string>();
  const testimonialNames = new Map<string, string>();
  const [pricing, testimonials] = await Promise.all([
    pricingIds.length ? untyped.from("pricing_packages").select("id,name_tr,name_en").in("id", pricingIds.slice(0, 200)) : Promise.resolve({ data: [] }),
    testimonialIds.length ? untyped.from("testimonials").select("id,name").in("id", testimonialIds.slice(0, 200)) : Promise.resolve({ data: [] }),
  ]) as [{ data: { id: string; name_tr: string | null; name_en: string | null }[] | null }, { data: { id: string; name: string | null }[] | null }];
  for (const item of pricing.data ?? []) {
    const name = item.name_tr || item.name_en;
    if (name) pricingNames.set(item.id, name);
  }
  for (const item of testimonials.data ?? []) if (item.name?.trim()) testimonialNames.set(item.id, item.name.trim());

  const data = enriched.map((row): PanelAction => {
    const action = String(row.action);
    const mapped = ACTION_MAP[action] ?? { kind: "diger" as const, title: "Panel işlemi" };
    const meta = asAuditMetadata(row.metadata);
    const student = toAuditText(meta.student_name);
    const pkg = toAuditText(meta.package_name);
    const entityId = row.entity_id ?? "";
    const parts: string[] = [];

    if (mapped.kind === "fiyat") {
      parts.push(pricingNames.get(entityId) ?? toAuditText(meta.name_tr) ?? "Fiyat paketi");
      const oldEur = eurText(meta.old_price_eur);
      const newEur = eurText(meta.new_price_eur ?? meta.price_eur);
      if (action === "admin.pricing.package_updated" && oldEur && newEur && oldEur !== newEur) parts.push(`${oldEur} → ${newEur}`);
      else if (action === "admin.pricing.package_created") {
        const price = liraText(meta.price_amount);
        if (price) parts.push(price);
      }
    } else if (entityId && row.entity_type === "testimonial") {
      parts.push(testimonialNames.get(entityId) ?? "Değerlendirme");
    } else {
      if (student) parts.push(student);
      if (pkg) parts.push(pkg);
      const extra = typeof meta.lesson_count === "number" ? meta.lesson_count : typeof meta.added_lessons === "number" ? meta.added_lessons : null;
      if (action === "package.extra_lessons_added" && extra) parts.push(`+${extra} ders`);
      const archiveReason = toAuditText(meta.archive_reason);
      if (action === "member_archived" && archiveReason) parts.push(`Neden: ${archiveReason}`);
    }

    let detail = parts.join(" · ");
    if (!detail) {
      // Not içerikleri yerine yalnız genel cümle.
      detail = action.startsWith("student.note.") ? "Öğrenci notu" : dashboardActivityText(row).replace(/\.$/, "");
    }

    return {
      id: String(row.id),
      kind: mapped.kind,
      title: mapped.title,
      detail,
      actor: toAuditText(meta.actor_name) ?? "Yönetici",
      at: row.created_at,
      studentId: toAuditText(meta.resolved_student_id),
    };
  });

  return { data, error: null };
}
