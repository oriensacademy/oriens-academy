import type { AuditLogRow } from "@/lib/admin/audit";

export const PAYMENT_ACTION_LABELS: Record<string, string> = {
  payment_session_requested: "Ödeme oturumu başlatıldı",
  paytr_token_created: "PayTR ödeme oturumu hazırlandı",
  paytr_token_creation_failed: "PayTR ödeme oturumu hazırlanamadı",
  paytr_iframe_opened: "PayTR ödeme formu açıldı",
  payment_success_return_reached: "Başarılı ödeme dönüş sayfasına ulaşıldı",
  payment_failure_return_reached: "Başarısız ödeme dönüş sayfasına ulaşıldı",
  payment_status_pending: "Ödeme durumu: Onay bekleniyor",
  payment_status_paid: "Ödeme durumu: Başarılı",
  payment_status_failed: "Ödeme durumu: Başarısız",
  payment_status_verification_error: "Ödeme durumu doğrulama hatası",
  paytr_callback_received: "PayTR bildirimi alındı",
  paytr_callback_hash_invalid: "PayTR imza doğrulaması başarısız",
  paytr_callback_transaction_not_found: "PayTR bildirimi: İşlem bulunamadı",
  paytr_callback_amount_mismatch: "Ödeme tutarı doğrulaması başarısız",
  payment_completed: "Ödeme tamamlandı",
  payment_failed: "Ödeme başarısız",
  payment_session_superseded: "Ödeme oturumu yenilendi",
};

export function asAuditMetadata(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function toAuditText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return null;
}

export function auditActionLabel(action: unknown): string {
  const normalized = toAuditText(action) ?? "Bilinmeyen işlem";
  return PAYMENT_ACTION_LABELS[normalized] ?? normalized;
}

export function auditEntityLabel(entityType: unknown): string {
  const normalized = toAuditText(entityType) ?? "Bilinmeyen varlık";
  return normalized === "payment_transaction" ? "Ödeme İşlemi" : normalized;
}

/** Human-facing dashboard copy. Internal action and entity identifiers never escape this formatter. */
export function dashboardActivityText(log: {
  action: unknown;
  category: string;
  entity_type: string;
  metadata: unknown;
}): string {
  const action = toAuditText(log.action) ?? "";
  const metadata = asAuditMetadata(log.metadata);
  const studentName = toAuditText(metadata.student_name);
  const actorName = toAuditText(metadata.actor_name);
  const packageName = toAuditText(metadata.package_name);
  const template = (toAuditText(metadata.mail_template) ?? "").toLocaleLowerCase("tr-TR");
  const studentObject = studentName ? `${studentName} öğrencisine` : "Bir öğrenci için";
  const studentPossessive = studentName ? `${studentName} öğrencisinin` : "Öğrenci kaydının";
  const actorDid = (active: string, passive: string) => actorName ? `${actorName}, ${active}` : passive;

  if (["lesson.created_past", "lesson.completed"].includes(action)) {
    return actorDid(`${studentObject} yapılan ders ekledi.`, `${studentObject} yapılan ders eklendi.`);
  }
  if (action === "lesson.updated") {
    return actorDid(`${studentPossessive} ders kaydını güncelledi.`, `${studentPossessive} ders kaydı güncellendi.`);
  }
  if (action === "lesson.package_changed") {
    return actorDid(`${studentPossessive} ders paketini değiştirdi.`, `${studentPossessive} ders paketi değiştirildi.`);
  }
  if (action === "lesson.report_saved") {
    return actorDid(`${studentPossessive} ders raporunu güncelledi.`, `${studentPossessive} ders raporu güncellendi.`);
  }
  if (action.startsWith("lesson.report_email_manually_")) {
    return actorDid(`${studentObject} ders raporu gönderdi.`, `${studentObject} ders raporu gönderildi.`);
  }
  if (action === "package.assigned" || action === "package_assigned") {
    return actorDid(`${studentObject} ${packageName ?? "ders paketi"} tanımladı.`, `${studentObject} ${packageName ?? "ders paketi"} tanımlandı.`);
  }
  if (["package.extra_lessons_added", "package.lessons_adjusted", "package.adjusted"].includes(action)) {
    return actorDid(`${studentPossessive} ders haklarını güncelledi.`, `${studentPossessive} ders hakları güncellendi.`);
  }
  if (action === "member_archived") {
    return actorDid(`${studentPossessive} kaydını arşivledi.`, `${studentPossessive} kaydı arşivlendi.`);
  }
  if (action === "member_restored") {
    return actorDid(`${studentPossessive} kaydını geri yükledi.`, `${studentPossessive} kaydı geri yüklendi.`);
  }
  if (action === "student.created_under_guardian" || action === "student.created") {
    return actorDid(`${studentName ? `${studentName} öğrencisini` : "Bir öğrenciyi"} oluşturdu.`, `${studentName ?? "Yeni öğrenci"} kaydı oluşturuldu.`);
  }
  if (["student.identity.updated", "student.profile.updated"].includes(action)) {
    return actorDid(`${studentPossessive} bilgilerini güncelledi.`, `${studentPossessive} bilgileri güncellendi.`);
  }
  if (["payment_completed", "payment_status_paid", "bank_transfer.approved"].includes(action)) {
    return studentName
      ? `${studentName} için ödeme başarıyla alındı.`
      : "Ödeme başarıyla alındı.";
  }
  if (["payment.refund_intent_created", "payment.refund_finalized"].includes(action)) {
    return actorDid("ödeme iadesi işlemini gerçekleştirdi.", "Ödeme iadesi işlemi gerçekleştirildi.");
  }
  if (log.category === "contact" || log.entity_type === "contact_request") {
    if (action.includes("reply")) return actorDid("iletişim talebini yanıtladı.", "İletişim talebi yanıtlandı.");
    if (action.includes("status") || action.includes("archive") || action.includes("restore")) {
      return actorDid("iletişim talebini işledi.", "İletişim talebi işlendi.");
    }
    return "Yeni iletişim talebi alındı.";
  }
  if (action.startsWith("email.")) {
    const isReport = template.includes("report") || template.includes("rapor");
    const description = isReport ? "ders raporu" : "ders bilgilendirme e-postası";
    if (action === "email.sent") return `${studentObject} ${description} gönderildi.`;
    if (action === "email.queued") return `${studentObject} ${description} gönderim için hazırlandı.`;
    if (action === "email.failed" || action === "email.render_failed") return `${studentObject} e-posta gönderilemedi.`;
    return "E-posta bildirimi güncellendi.";
  }

  if (action === "admin.blog.post_created") return actorDid("yeni blog yazısı oluşturdu.", "Yeni blog yazısı oluşturuldu.");
  if (action === "admin.blog.post_updated") return actorDid("blog yazısını güncelledi.", "Blog yazısı güncellendi.");
  if (action === "admin.blog.post_archived") return actorDid("blog yazısını arşivledi.", "Blog yazısı arşivlendi.");
  if (action === "admin.blog.post_restored") return actorDid("blog yazısını geri yükledi.", "Blog yazısı geri yüklendi.");
  if (action.startsWith("admin.pricing.")) return actorDid("fiyatlandırmayı güncelledi.", "Fiyatlandırma güncellendi.");
  if (action === "admin.settings.updated") return actorDid("site ayarlarını güncelledi.", "Site ayarları güncellendi.");
  if (action.startsWith("admin.content.testimonial_")) return actorDid("değerlendirme içeriğini güncelledi.", "Değerlendirme içeriği güncellendi.");
  if (action === "student.password_reset_sent") return actorDid(`${studentObject} şifre sıfırlama bağlantısı gönderdi.`, `${studentObject} şifre sıfırlama bağlantısı gönderildi.`);

  if (log.category === "lesson") return `${studentObject} ders işlemi gerçekleştirildi.`;
  if (log.category === "package") return `${studentObject} paket işlemi gerçekleştirildi.`;
  if (log.category === "payment") return "Ödeme işlemi güncellendi.";
  if (log.category === "student") return studentName ? `${studentName} öğrencisinin kaydında bir işlem gerçekleştirildi.` : "Öğrenci kaydında bir işlem gerçekleştirildi.";
  if (log.category === "blog") return "Web sitesi içeriği güncellendi.";
  if (log.category === "auth") return "Hesap güvenliği işlemi tamamlandı.";
  return "Bir yönetim işlemi gerçekleştirildi.";
}

export function isPaymentAuditLog(log: AuditLogRow | null | undefined): boolean {
  const action = toAuditText(log?.action) ?? "";
  return log?.entity_type === "payment_transaction" || action.startsWith("paytr_") || action.startsWith("payment_");
}

export function paymentCorrelationReference(log: AuditLogRow | null | undefined): string {
  if (!log) return "";
  const metadata = asAuditMetadata(log.metadata);
  return (
    toAuditText(metadata.public_reference) ??
    toAuditText(metadata.merchant_oid) ??
    toAuditText(log.entity_id) ??
    ""
  );
}

export function paymentTransactionId(log: AuditLogRow | null | undefined): string {
  if (!log) return "";
  const metadata = asAuditMetadata(log.metadata);
  return toAuditText(metadata.transaction_id) ?? "";
}

export function formatPaymentAmount(metadataValue: unknown): string | null {
  const metadata = asAuditMetadata(metadataValue);
  const rawKurus = metadata.amount_kurus ?? metadata.total_amount;
  const rawAmount = rawKurus ?? metadata.amount;
  if (typeof rawAmount !== "number" && typeof rawAmount !== "string") return null;
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount)) return null;
  const tryAmount = rawKurus === undefined ? amount : amount / 100;
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(tryAmount);
}

export function correlatePaymentTimeline(logs: AuditLogRow[], reference: string): AuditLogRow[] {
  if (!reference) return [];
  return logs
    .filter((item) => paymentCorrelationReference(item) === reference)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export function safeAuditJson(value: unknown, maxChars = 20_000): string {
  try {
    const serialized = JSON.stringify(value ?? {}, null, 2) ?? "{}";
    return serialized.length > maxChars
      ? `${serialized.slice(0, maxChars)}\n… (metadata kısaltıldı)`
      : serialized;
  } catch {
    return "{\n  \"error\": \"Metadata görüntülenemedi\"\n}";
  }
}
