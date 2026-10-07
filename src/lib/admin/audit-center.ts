import { getSupabaseClient } from "@/lib/supabase/client";
import { buildTermActions, redactMetadata, type AuditCategory, type AuditStatus } from "@/lib/admin/audit-catalog";

// Denetim merkezi veri katmanı: yalnız okuma. Tüm birleştirme (kişi, ödeme, mail,
// ders, paket çözümleme) sunucuda tek sorguda yapılır — istemcide N+1 yok.
// RPC'ler is_admin() kontrolü yapar ve hassas alanları hiç döndürmez.

export interface AuditFeedRow {
  event_id: string;
  source: "audit" | "login";
  created_at: string;
  action: string;
  raw_category: string;
  severity: string;
  feed_category: AuditCategory;
  feed_status: AuditStatus;
  correlation_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_role: "admin" | "veli" | "kullanici" | "sistem";
  actor_email: string | null;
  subject_user_id: string | null;
  subject_name: string | null;
  subject_email: string | null;
  subject_role: "admin" | "veli" | "ogrenci" | null;
  student_id: string | null;
  student_name: string | null;
  payment_id: string | null;
  public_reference: string | null;
  provider_transaction_id: string | null;
  amount: number | null;
  currency: string | null;
  payment_status: string | null;
  purchase_id: string | null;
  package_name: string | null;
  lesson_id: string | null;
  lesson_title: string | null;
  delivery_id: string | null;
  mail_recipient: string | null;
  mail_template: string | null;
  mail_event_type: string | null;
  mail_status: string | null;
  mail_error_code: string | null;
  login_device: string | null;
  login_reason: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AuditFeedParams {
  search?: string;
  category?: AuditCategory | "";
  status?: AuditStatus | "";
  from?: string | null;
  to?: string | null;
  person?: string | null;
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  since: string;
  total: number;
  failed: number;
  payments_paid: number;
  payment_events: number;
  logins: number;
  login_failures: number;
  mails_sent: number;
  mails_failed: number;
}

export interface AuditMailSummary {
  id: string;
  event_type: string | null;
  template: string | null;
  recipient: string | null;
  status: string | null;
  attempt_count: number | null;
  created_at: string;
  sent_at: string | null;
  last_error_code: string | null;
}

export interface AuditPaymentDetail {
  id: string;
  public_reference: string | null;
  provider: string | null;
  provider_transaction_id: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  payment_method: string | null;
  installment_count: number | null;
  payer_name: string | null;
  payer_email: string | null;
  created_at: string;
  paid_at: string | null;
  refunded_amount: number | null;
  refund_status: string | null;
  last_refunded_at: string | null;
  last_refund_reason: string | null;
  is_preload: boolean | null;
  is_archived: boolean | null;
  coupon_code: string | null;
  discount_kurus: number | null;
  subtotal_kurus: number | null;
  final_total_kurus: number | null;
  learner_name: string | null;
  failed_reason_code: string | null;
  failed_reason_msg: string | null;
  test_mode: boolean | string | number | null;
  package_name: string | null;
  callback: { at: string; provider_status: string | null; event_id: string } | null;
  purchases: Array<{ id: string; lesson_count: number | null; lessons_used: number | null; status: string | null; payment_status: string | null; package_name: string | null; created_at: string }>;
  mails: AuditMailSummary[];
  /** Ödeme kaydındaki sepet kalemleri (paket, ders sayısı, fiyat, indirim, son tutar). */
  items?: AuditPaymentItem[];
}

export interface AuditPaymentItem {
  package_id: string | null;
  package_name: string | null;
  lesson_count: number | null;
  price: number | string | null;
  discount: number | string | null;
  final: number | string | null;
}

export interface AuditDeliveryDetail {
  id: string;
  channel: string | null;
  event_type: string | null;
  template: string | null;
  recipient: string | null;
  subject: string | null;
  status: string | null;
  provider: string | null;
  provider_message_id: string | null;
  attempt_count: number | null;
  max_attempts: number;
  created_at: string;
  sent_at: string | null;
  next_attempt_at: string | null;
  last_error_code: string | null;
  last_error: string | null;
  dedupe_key: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_archived: boolean | null;
}

export interface AuditLessonDetail {
  id: string;
  title: string | null;
  subject: string | null;
  exam_code: string | null;
  lesson_date: string | null;
  duration_minutes: number | null;
  timezone_label: string | null;
  status: string | null;
  completed_at: string | null;
  instructor: string | null;
  topic: string | null;
  student_id: string | null;
  student_name: string | null;
  package_name: string | null;
  package_lesson_count: number | null;
  package_lessons_used: number | null;
  previous_remaining: number | null;
  has_report: boolean;
  report_updated_at: string | null;
  report_email_sent_at: string | null;
  report_version: number | null;
  is_archived: boolean | null;
}

export interface AuditPurchaseDetail {
  id: string;
  package_name: string | null;
  lesson_count: number | null;
  lessons_used: number | null;
  remaining: number | null;
  status: string | null;
  payment_status: string | null;
  assignment_source: string | null;
  price_amount: number | null;
  currency: string | null;
  created_at: string;
  is_archived: boolean | null;
}

export interface AuditPerson {
  user_id: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
}

export interface AuditSubject extends AuditPerson {
  email_verified_at: string | null;
  active: boolean | null;
  archived_at: string | null;
  created_at: string | null;
  students: Array<{ id: string; name: string | null; primary: boolean | null }>;
}

export interface AuditChange {
  table: string;
  row_id: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  created_at: string;
}

export interface AuditTimelineItem {
  event_id: string;
  created_at: string;
  action: string;
  feed_category: AuditCategory;
  feed_status: AuditStatus;
  actor_name: string | null;
  actor_role: string | null;
  subject_name: string | null;
  mail_recipient: string | null;
  mail_template: string | null;
  mail_event_type: string | null;
  is_current: boolean;
}

export interface AuditDetail {
  event: AuditFeedRow;
  actor: AuditPerson | null;
  subject: AuditSubject | null;
  payment: AuditPaymentDetail | null;
  delivery: AuditDeliveryDetail | null;
  lesson: AuditLessonDetail | null;
  purchase: AuditPurchaseDetail | null;
  changes: AuditChange[];
  lookups: Record<string, string>;
  timeline: AuditTimelineItem[];
  /** Olay bir sepet akışına bağlıysa sepet kimliği (sepet olayları ↔ ödeme köprüsü). */
  cart_id?: string | null;
}

export const AUDIT_PAGE_SIZE = 50;

// Yeni RPC'ler tip üretiminden önce eklendi; tipler bu modülde tanımlı.
function rpc(name: string, args?: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabaseClient() as any).rpc(name, args) as Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
}

function errorText(error: { message: string; code?: string } | null) {
  if (!error) return null;
  if (error.code === "42501" || /ADMIN_REQUIRED/.test(error.message)) return "Bu kayıtları yalnız yöneticiler görebilir.";
  if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) return "Denetim merkezi henüz etkin değil (veritabanı güncellemesi bekleniyor).";
  return "Kayıtlar yüklenemedi. Lütfen tekrar deneyin.";
}

export async function fetchAuditFeed(params: AuditFeedParams): Promise<{ rows: AuditFeedRow[]; total: number; error: string | null }> {
  const search = (params.search ?? "").trim().slice(0, 200);
  const { data, error } = await rpc("admin_audit_feed", {
    p_search: search || null,
    p_term_actions: search ? buildTermActions(search) : null,
    p_category: params.category || null,
    p_status: params.status || null,
    p_from: params.from || null,
    p_to: params.to || null,
    p_person: params.person || null,
    p_limit: params.limit ?? AUDIT_PAGE_SIZE,
    p_offset: params.offset ?? 0,
  });
  if (error) return { rows: [], total: 0, error: errorText(error) };
  const list = (Array.isArray(data) ? data : []) as Array<AuditFeedRow & { total_count: number | string }>;
  const total = list.length ? Number(list[0].total_count) || 0 : 0;
  const rows = list.map((item) => {
    const row: Omit<typeof item, "total_count"> & { total_count?: unknown } = { ...item };
    delete row.total_count;
    return row;
  }).map((row) => ({
    ...row,
    amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
    metadata: redactMetadata(row.metadata ?? {}) as Record<string, unknown>,
  }));
  return { rows, total, error: null };
}

export async function fetchAuditStats(): Promise<{ data: AuditStats | null; error: string | null }> {
  const { data, error } = await rpc("admin_audit_stats");
  if (error) return { data: null, error: errorText(error) };
  return { data: (data as AuditStats | null) ?? null, error: null };
}

export async function fetchAuditDetail(eventId: string): Promise<{ data: AuditDetail | null; error: string | null }> {
  if (!/^[al][0-9]{1,18}$/.test(eventId)) return { data: null, error: "Kayıt bulunamadı." };
  const { data, error } = await rpc("admin_audit_detail", { p_event_id: eventId });
  if (error) return { data: null, error: errorText(error) };
  if (!data) return { data: null, error: "Kayıt bulunamadı veya silinmiş." };
  const detail = data as AuditDetail;
  return {
    data: {
      ...detail,
      event: { ...detail.event, metadata: redactMetadata(detail.event?.metadata ?? {}) as Record<string, unknown> },
      changes: (redactMetadata(detail.changes ?? []) as AuditChange[]),
      lookups: detail.lookups ?? {},
      timeline: detail.timeline ?? [],
    },
    error: null,
  };
}
