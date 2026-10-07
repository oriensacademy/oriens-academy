import { foldTurkish } from "@/lib/format/turkish";

// Denetim merkezi: olay adları, insan okunur cümleler, etiketler ve maskeleme.
// Saf fonksiyonlar (Supabase yok) — node testinden doğrudan çağrılabilir.
// Kategori ve durum sunucuda (audit_feed_category / audit_feed_status) hesaplanır;
// buradaki katalog yalnız Türkçe başlıklar ve cümleler içindir.

export type AuditCategory = "auth" | "payment" | "mail" | "student" | "lesson" | "package" | "admin" | "system" | "security";
export type AuditStatus = "success" | "error" | "pending" | "warning" | "info";

export const AUDIT_CATEGORIES: AuditCategory[] = ["auth", "payment", "mail", "student", "lesson", "package", "admin", "system", "security"];

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  auth: "Auth",
  payment: "Ödeme",
  mail: "Mail",
  student: "Öğrenci",
  lesson: "Ders",
  package: "Paket",
  admin: "Admin",
  system: "Sistem",
  security: "Güvenlik",
};

export const AUDIT_STATUS_LABELS: Record<AuditStatus, string> = {
  success: "Başarılı",
  error: "Başarısız",
  pending: "Beklemede",
  warning: "Uyarı",
  info: "Bilgi",
};

export const AUDIT_ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  veli: "Veli",
  ogrenci: "Öğrenci",
  kullanici: "Kullanıcı",
  sistem: "Sistem",
};

// İşlem adları (liste "İŞLEM" sütunu ve çekmece başlığı).
const TITLES: Record<string, string> = {
  // Giriş / hesap
  "auth.login": "Giriş yapıldı",
  "auth.login_failed": "Giriş başarısız",
  "auth.logout": "Çıkış yapıldı",
  "auth.password_changed": "Şifre değiştirildi",
  "admin.password_change_completed": "Yönetici şifresi değiştirildi",
  "account.created": "Hesap oluşturuldu",
  "account.password_recovery_dispatched": "Şifre sıfırlama talep edildi",
  "student.password_reset_sent": "Şifre sıfırlama bağlantısı gönderildi",
  "account.email_change_requested": "E-posta değişikliği talep edildi",
  "account.email_change_verified": "E-posta değiştirildi",
  "purchase.email_verification_requested": "E-posta doğrulama kodu istendi",
  "purchase.email_verified": "E-posta doğrulandı",
  account_deleted: "Hesap silindi",
  "guardian.profile_updated": "Veli bilgileri güncellendi",
  // Sepet / ödeme
  cart_item_added: "Sepete paket eklendi",
  cart_item_removed: "Sepetten paket çıkarıldı",
  cart_cleared: "Sepet temizlendi",
  checkout_opened: "Ödeme ekranı açıldı",
  checkout_started: "Ödeme başlatıldı",
  payment_session_requested: "Ödeme oturumu oluşturuldu",
  paytr_token_created: "PayTR ödeme oturumu hazırlandı",
  paytr_token_creation_failed: "Ödeme oturumu hazırlanamadı",
  paytr_iframe_opened: "Ödeme formu açıldı",
  payment_status_pending: "Ödeme beklemede",
  payment_status_paid: "Ödeme başarılı",
  payment_completed: "Ödeme başarılı",
  payment_status_failed: "Ödeme başarısız",
  payment_failed: "Ödeme başarısız",
  payment_success_return_reached: "Ödeme sonrası başarı sayfasına dönüldü",
  payment_failure_return_reached: "Ödeme sonrası hata sayfasına dönüldü",
  payment_status_verification_error: "Ödeme durumu doğrulanamadı",
  paytr_callback_received: "PayTR bildirimi alındı",
  paytr_callback_hash_invalid: "PayTR bildirimi imza doğrulamasından geçmedi",
  paytr_callback_transaction_not_found: "PayTR bildirimi: işlem bulunamadı",
  paytr_callback_amount_mismatch: "Ödeme tutarı uyuşmadı",
  payment_session_superseded: "Ödeme oturumu yenilendi",
  "payment.refund_intent_created": "İade başlatıldı",
  "payment.refund_finalized": "İade tamamlandı",
  "payment.refunded": "İade yapıldı",
  "bank_transfer.approved": "Banka transferi onaylandı",
  "bank_transfer.rejected": "Banka transferi reddedildi",
  // Mail
  "email.queued": "Mail kuyruğa alındı",
  "email.sent": "Mail gönderildi",
  "email.failed": "Mail başarısız",
  "email.render_failed": "Mail şablonu oluşturulamadı",
  "email.retry_scheduled": "Mail yeniden denenecek",
  "email.skipped": "Mail gönderimi atlandı",
  "admin.contact.reply_sent": "İletişim talebi yanıtlandı",
  "notification.delivery_email_redacted": "Mail kaydındaki adres gizlendi",
  // Öğrenci
  "student.created": "Öğrenci oluşturuldu",
  "student.created_under_guardian": "Öğrenci oluşturuldu",
  "student.identity.updated": "Öğrenci güncellendi",
  "student.profile.updated": "Öğrenci güncellendi",
  "student.updated": "Öğrenci güncellendi",
  "student.guardian_identity_updated": "Veli bilgileri güncellendi",
  "student.note.created": "Öğrenciye not eklendi",
  "student.note.updated": "Öğrenci notu güncellendi",
  member_archived: "Hesap arşivlendi",
  member_restored: "Hesap geri getirildi",
  test_account_operational_reset: "Test hesabı sıfırlandı",
  // Ders
  "lesson.created": "Ders oluşturuldu",
  "lesson.created_past": "Ders oluşturuldu",
  "lesson.completed": "Ders tamamlandı",
  "lesson.updated": "Ders düzenlendi",
  "lesson.cancelled": "Ders iptal edildi",
  "lesson.package_changed": "Dersin paketi değiştirildi",
  "lesson.report_saved": "Ders raporu kaydedildi",
  "lesson.report_email_manually_sent": "Ders raporu gönderildi",
  "lesson.report_email_manually_resent": "Ders raporu yeniden gönderildi",
  "lesson.completion_email_manually_sent": "Ders bilgilendirmesi gönderildi",
  "lesson.topic_created": "Ders konusu eklendi",
  "instructor.created": "Eğitmen eklendi",
  "instructor.updated": "Eğitmen güncellendi",
  "instructor.reordered": "Eğitmen sırası değiştirildi",
  // Paket
  "package.assigned": "Paket tanımlandı",
  package_assigned: "Paket tanımlandı",
  package_assigned_manual: "Paket tanımlandı",
  "package.completed": "Paket tamamlandı",
  "package.extra_lessons_added": "Ders hakkı eklendi",
  "package.lessons_adjusted": "Ders hakları güncellendi",
  "package.adjusted": "Ders hakları güncellendi",
  "package.lesson_rights_adjusted": "Ders hakları güncellendi",
  lesson_rights_adjusted: "Ders hakları güncellendi",
  "package.package_assigned_email_manually_sent": "Paket bilgilendirme maili gönderildi",
  "package.lesson_rights_email_manually_sent": "Ders hakkı maili gönderildi",
  "package.rights_summary_requested": "Ders hakkı özeti gönderildi",
  // Admin / içerik
  "student.grade_option_created": "Sınıf seçeneği eklendi",
  "student.grade_option_updated": "Sınıf seçeneği güncellendi",
  "student.grade_option_reordered": "Sınıf seçenekleri sıralandı",
  "student.grade_option_deactivated": "Sınıf seçeneği pasifleştirildi",
  "student.grade_option_reactivated": "Sınıf seçeneği yeniden açıldı",
  "student.exam_option_created": "Sınav seçeneği eklendi",
  "student.exam_option_reordered": "Sınav seçenekleri sıralandı",
  "admin.blog.post_created": "Blog yazısı oluşturuldu",
  "admin.blog.post_updated": "Blog yazısı güncellendi",
  "admin.blog.post_published": "Blog yazısı yayınlandı",
  "admin.blog.post_archived": "Blog yazısı arşive taşındı",
  "admin.blog.post_restored": "Blog yazısı arşivden çıkarıldı",
  "admin.pricing.package_created": "Fiyat paketi eklendi",
  "admin.pricing.package_updated": "Fiyat güncellendi",
  "admin.pricing.package_deleted": "Fiyat paketi kaldırıldı",
  "admin.settings.updated": "Site ayarları güncellendi",
  "admin.contact.status_updated": "İletişim talebi durumu değişti",
  "contact.status_updated": "İletişim talebi durumu değişti",
  contact_request_archived: "İletişim talebi arşive taşındı",
  contact_request_restored: "İletişim talebi arşivden çıkarıldı",
  // Güvenlik / sistem
  "database.permission_denied": "Veritabanı izin hatası",
  "database.rls_denied": "Veritabanı erişim kuralı engelledi",
  "database.rpc_failed": "Veritabanı işlemi başarısız",
};

/** Kişinin kendi adımı: "Ayşe Yılmaz ödeme formunu açtı". */
const PERSON_VERBS: Record<string, string> = {
  "auth.login": "giriş yaptı",
  "auth.logout": "çıkış yaptı",
  "auth.password_changed": "şifresini değiştirdi",
  "account.created": "hesap oluşturdu",
  "account.password_recovery_dispatched": "şifre sıfırlama bağlantısı istedi",
  "account.email_change_requested": "e-posta adresini değiştirmek istedi",
  "account.email_change_verified": "e-posta adresini değiştirdi",
  "purchase.email_verification_requested": "e-posta doğrulama kodu istedi",
  "purchase.email_verified": "e-posta adresini doğruladı",
  account_deleted: "hesabını sildi",
  "guardian.profile_updated": "veli bilgilerini güncelledi",
  payment_session_requested: "ödeme oturumu oluşturdu",
  cart_item_added: "sepete paket ekledi",
  cart_item_removed: "sepetten paket çıkardı",
  cart_cleared: "sepeti temizledi",
  checkout_opened: "ödeme ekranını açtı",
  checkout_started: "ödeme başlattı",
  paytr_iframe_opened: "ödeme formunu açtı",
  payment_success_return_reached: "ödemeden sonra başarı sayfasına döndü",
  payment_failure_return_reached: "ödemeden sonra hata sayfasına döndü",
};

/** Yöneticinin işlemi: "Mert Ö. ders raporunu kaydetti". */
const ADMIN_VERBS: Record<string, string> = {
  "auth.login": "yönetim paneline giriş yaptı",
  "auth.logout": "çıkış yaptı",
  "auth.password_changed": "şifresini değiştirdi",
  "admin.password_change_completed": "şifresini değiştirdi",
  "account.created": "veli hesabı oluşturdu",
  "lesson.created": "ders oluşturdu",
  "lesson.created_past": "ders oluşturdu",
  "lesson.completed": "dersi tamamladı",
  "lesson.updated": "dersi düzenledi",
  "lesson.cancelled": "dersi iptal etti",
  "lesson.package_changed": "dersin paketini değiştirdi",
  "lesson.report_saved": "ders raporunu kaydetti",
  "lesson.report_email_manually_sent": "ders raporunu gönderdi",
  "lesson.report_email_manually_resent": "ders raporunu yeniden gönderdi",
  "lesson.completion_email_manually_sent": "ders bilgilendirmesini gönderdi",
  "package.assigned": "paket tanımladı",
  package_assigned: "paket tanımladı",
  package_assigned_manual: "paket tanımladı",
  "package.extra_lessons_added": "ders hakkı ekledi",
  "package.lessons_adjusted": "ders haklarını güncelledi",
  "package.adjusted": "ders haklarını güncelledi",
  "package.lesson_rights_adjusted": "ders haklarını güncelledi",
  lesson_rights_adjusted: "ders haklarını güncelledi",
  "package.package_assigned_email_manually_sent": "paket bilgilendirme maili gönderdi",
  "package.lesson_rights_email_manually_sent": "ders hakkı maili gönderdi",
  "package.rights_summary_requested": "ders hakkı özeti gönderdi",
  "student.created": "öğrenci oluşturdu",
  "student.created_under_guardian": "öğrenci oluşturdu",
  "student.identity.updated": "öğrenci bilgilerini güncelledi",
  "student.profile.updated": "öğrenci bilgilerini güncelledi",
  "student.updated": "öğrenci bilgilerini güncelledi",
  "student.guardian_identity_updated": "veli bilgilerini güncelledi",
  "guardian.profile_updated": "veli bilgilerini güncelledi",
  member_archived: "hesabı arşivledi",
  member_restored: "hesabı geri getirdi",
  "account.password_recovery_dispatched": "şifre sıfırlama bağlantısı gönderdi",
  "student.password_reset_sent": "şifre sıfırlama bağlantısı gönderdi",
  "admin.contact.reply_sent": "iletişim talebini yanıtladı",
  "admin.contact.status_updated": "iletişim talebinin durumunu değiştirdi",
  "admin.settings.updated": "site ayarlarını güncelledi",
  "payment.refund_intent_created": "iade başlattı",
  "bank_transfer.approved": "banka transferini onayladı",
  "bank_transfer.rejected": "banka transferini reddetti",
};

export function auditTitle(action: string, severity?: string | null): string {
  return TITLES[action] ?? (severity === "error" || severity === "critical" ? "Sistem hatası" : "Sistem olayı");
}

/** Arama kelimesi → eşleşen olay anahtarları ("giris" → auth.login, auth.login_failed). */
export function buildTermActions(query: string): Record<string, string[]> | null {
  const terms = foldTurkish(query.trim()).split(/\s+/).filter(Boolean).slice(0, 8);
  if (!terms.length) return null;
  const index = Object.entries(TITLES).map(([action, title]) => [action, foldTurkish(`${title} ${PERSON_VERBS[action] ?? ""} ${ADMIN_VERBS[action] ?? ""}`)] as const);
  const out: Record<string, string[]> = {};
  for (const term of terms) {
    if (term.length < 3) continue;
    const actions = index.filter(([, text]) => text.includes(term)).map(([action]) => action);
    if (actions.length) out[term] = actions;
  }
  return Object.keys(out).length ? out : null;
}

// ---------------------------------------------------------------------------
// Maskeleme / temizleme (sunucuyla aynı kurallar; istemcide ikinci savunma)
// ---------------------------------------------------------------------------

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone || !phone.trim()) return phone ?? null;
  if (phone.includes("*")) return phone; // zaten maskeli
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  if (digits.length === 12 && digits.startsWith("90")) return `+90 ${digits[2]}** *** **${digits.slice(-2)}`;
  if (digits.length === 11 && digits.startsWith("0")) return `0${digits[1]}** *** **${digits.slice(-2)}`;
  return `${"*".repeat(digits.length - 2)}${digits.slice(-2)}`;
}

const SECRET_KEY = /(pass(word|wd)?($|_)|otp|token|secret|authori[sz]ation|cookie|api[_-]?key|apikey|service[_-]?role|card|cvv|cvc|hash|signature|salt|merchant_key|private[_-]?key|credential|refresh|bearer|jwt|session[_-]?key)/i;
const SECRET_EXACT = new Set(["code", "verification_code", "pin", "payload", "iframe_token", "paytr_callback", "raw_body", "headers"]);
const SECRET_VALUE = /(^bearer\s+|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/i;
export const REDACTED = "[gizlendi]";

export function isSecretKey(key: string) {
  return SECRET_KEY.test(key) || SECRET_EXACT.has(key.toLowerCase());
}

/** Gizli anahtarlar gizlenir; telefon anahtarı altındaki tüm dizeler (iç içe {old,new} dahil) maskelenir. */
export function redactMetadata(value: unknown, depth = 0, phone = false): unknown {
  if (depth > 12) return REDACTED;
  if (Array.isArray(value)) return value.map((item) => redactMetadata(item, depth + 1, phone));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSecretKey(key) ? REDACTED : redactMetadata(item, depth + 1, phone || /phone/i.test(key));
    }
    return out;
  }
  if (typeof value === "string" && SECRET_VALUE.test(value)) return REDACTED;
  if (typeof value === "string" && phone) return maskPhone(value);
  return value;
}

// ---------------------------------------------------------------------------
// Etiketler
// ---------------------------------------------------------------------------

export const LOGIN_REASON_LABELS: Record<string, string> = {
  invalid_credentials: "Hatalı e-posta veya şifre",
  email_not_confirmed: "E-posta adresi doğrulanmamış",
  user_banned: "Hesap askıya alınmış / arşivlenmiş",
  rate_limited: "Çok fazla deneme (geçici olarak engellendi)",
  account_unavailable: "Hesap kullanılamıyor (arşivli veya pasif)",
  other: "Diğer hata",
};

export function loginReasonLabel(reason: string | null | undefined) {
  if (!reason) return null;
  return LOGIN_REASON_LABELS[reason] ?? LOGIN_REASON_LABELS.other;
}

export function mailKind(template: string | null | undefined, eventType: string | null | undefined, entityType?: string | null) {
  const key = `${template ?? ""} ${eventType ?? ""}`.toLowerCase();
  if (entityType === "purchase_verification" || key.includes("verification") || key.includes("otp")) return "E-posta doğrulama kodu";
  if (key.includes("welcome")) return "Hoş geldiniz maili";
  if (key.includes("report") || key.includes("lesson_completed")) return "Ders raporu maili";
  if (key.includes("payment") && key.includes("admin")) return "Ödeme bildirimi (yönetici)";
  if (key.includes("payment")) return "Ödeme onay maili";
  if (key.includes("package") || key.includes("rights")) return "Paket / ders hakkı maili";
  if (key.includes("contact")) return "İletişim maili";
  if (key.includes("email_change")) return "E-posta değişikliği kodu";
  if (entityType === "auth_user" || key.includes("recovery") || key.includes("password")) return "Şifre sıfırlama maili";
  if (entityType === "payment_transaction") return "Ödeme maili";
  if (entityType === "student_lesson") return "Ders maili";
  if (entityType === "student_package_purchase") return "Paket maili";
  return "Bilgilendirme maili";
}

const MAIL_ERROR_TEXT: Array<[RegExp, string]> = [
  [/render|template/i, "Mail şablonu oluşturulamadı"],
  [/recipient|address|invalid_email/i, "Alıcı adresi geçersiz"],
  [/quota|rate|429/i, "Gönderim limiti aşıldı"],
  [/auth|401|403|token/i, "Mail servisi yetkilendirme hatası"],
  [/timeout|network|fetch|5\d\d/i, "Mail servisine ulaşılamadı"],
];

export function mailErrorText(code: string | null | undefined) {
  if (!code) return null;
  for (const [re, label] of MAIL_ERROR_TEXT) if (re.test(code)) return label;
  return "Gönderim hatası";
}

export const MAIL_STATUS_LABELS: Record<string, string> = {
  pending: "Kuyrukta",
  queued: "Kuyrukta",
  processing: "Gönderiliyor",
  sent: "Gönderildi",
  failed: "Başarısız",
  retry: "Yeniden denenecek",
  skipped: "Atlandı",
  cancelled: "İptal edildi",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Beklemede",
  paid: "Ödendi",
  success: "Ödendi",
  failed: "Başarısız",
  cancelled: "İptal edildi",
  expired: "Süresi doldu",
  refunded: "İade edildi",
  partially_refunded: "Kısmi iade",
  superseded: "Yenilendi",
};

export const LESSON_STATUS_LABELS: Record<string, string> = {
  scheduled: "Planlandı",
  planned: "Planlandı",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
  canceled: "İptal edildi",
  no_show: "Katılım olmadı",
};

export const CHANGE_FIELD_LABELS: Record<string, string> = {
  full_name: "Ad soyad", phone: "Telefon", email: "E-posta", school: "Okul", target_country: "Hedef ülke",
  target_university: "Hedef üniversite", target_exam: "Hedef sınav", target_exams: "Hedef sınavlar",
  target_countries: "Hedef ülkeler", education_program: "Program", exams_taken: "Girilen sınavlar",
  grade_level: "Sınıf", contact_guardian_name: "Veli adı", preferred_language: "Dil", active: "Durum",
  archived_at: "Arşiv tarihi", contact_address: "Adres", email_verified_at: "E-posta doğrulama",
  title: "Başlık", subject: "Ders", exam_code: "Sınav", lesson_date: "Ders tarihi", duration_minutes: "Süre (dk)",
  status: "Durum", topic_id: "Konu", instructor_id: "Eğitmen", package_purchase_id: "Paket",
  lesson_timezone_label: "Saat dilimi", report_version: "Rapor sürümü", is_archived: "Arşivde",
  package_id: "Paket", custom_package_name: "Paket adı", lesson_count: "Ders hakkı", lessons_used: "Kullanılan ders",
  payment_status: "Ödeme durumu", end_date: "Bitiş tarihi", paid_at: "Ödeme zamanı", refund_status: "İade durumu",
  refunded_amount: "İade tutarı",
};

export const CHANGE_TABLE_LABELS: Record<string, string> = {
  student_profiles: "Öğrenci",
  guardian_accounts: "Veli hesabı",
  student_lessons: "Ders",
  student_package_purchases: "Paket",
  payment_transactions: "Ödeme",
};

// ---------------------------------------------------------------------------
// Biçimlendirme
// ---------------------------------------------------------------------------

export function formatMoney(amount: number | string | null | undefined, currency?: string | null) {
  const value = Number(amount);
  if (amount === null || amount === undefined || amount === "" || !Number.isFinite(value)) return null;
  try {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: currency || "TRY", maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toLocaleString("tr-TR")} ${currency || "TRY"}`;
  }
}

const TZ = "Europe/Istanbul";

/** "Salı, 7 Ekim 2026 · 14:32:08" */
export function formatAuditDateTime(iso: string | null | undefined, withSeconds = true) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const weekday = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, weekday: "long" }).format(date);
  const day = `${weekday}, ${new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(date)}`;
  const time = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", ...(withSeconds ? { second: "2-digit" } : {}) }).format(date);
  return `${day} · ${time}`;
}

/** Liste tarihi: { day: "Salı", date: "7 Eki 2026", time: "14:32" } */
export function formatAuditListDate(iso: string) {
  const date = new Date(iso);
  return {
    day: new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, weekday: "long" }).format(date),
    date: new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(date),
    time: new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(date),
  };
}

export function shortId(id: string | null | undefined, size = 8) {
  if (!id) return null;
  return id.length > size + 2 ? `${id.slice(0, size)}…` : id;
}

export function formatChangeValue(field: string, value: unknown, lookups: Record<string, string> = {}): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") {
    if (field === "active") return value ? "Aktif" : "Pasif";
    return value ? "Evet" : "Hayır";
  }
  if (Array.isArray(value)) return value.length ? value.map((item) => String(item)).join(", ") : "—";
  const text = String(value);
  if (lookups[text]) return lookups[text];
  if (/_at$|_date$/.test(field) || field === "lesson_date") return formatAuditDateTime(text, false) ?? text;
  if (field === "status") return LESSON_STATUS_LABELS[text] ?? PAYMENT_STATUS_LABELS[text] ?? text;
  if (field === "payment_status") return PAYMENT_STATUS_LABELS[text] ?? text;
  if (typeof value === "object") return JSON.stringify(value);
  return text;
}

/** "Chrome 140 · Windows · Masaüstü" (IP ve tam user-agent tutulmaz). */
export function summarizeUserAgent(userAgent: string, platformHint?: string | null): string {
  const ua = userAgent || "";
  const pick = (re: RegExp) => ua.match(re)?.[1]?.split(".")[0] ?? null;
  const browsers: Array<[RegExp, string, RegExp]> = [
    [/Edg(?:e|A|iOS)?\//, "Edge", /Edg(?:e|A|iOS)?\/([\d.]+)/],
    [/OPR\/|Opera/, "Opera", /OPR\/([\d.]+)/],
    [/SamsungBrowser/, "Samsung Internet", /SamsungBrowser\/([\d.]+)/],
    [/Firefox\/|FxiOS/, "Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/],
    [/Chrome\/|CriOS/, "Chrome", /(?:Chrome|CriOS)\/([\d.]+)/],
    [/Safari\//, "Safari", /Version\/([\d.]+)/],
  ];
  let browser = "Tarayıcı";
  for (const [test, name, version] of browsers) {
    if (test.test(ua)) {
      const major = pick(version);
      browser = major ? `${name} ${major}` : name;
      break;
    }
  }
  const os = platformHint
    ? platformHint
    : /iPhone/.test(ua) ? "iOS"
    : /iPad/.test(ua) ? "iPadOS"
    : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /CrOS/.test(ua) ? "ChromeOS"
    : /Linux/.test(ua) ? "Linux"
    : "";
  const device = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? "Tablet"
    : /Mobi|iPhone|Android/.test(ua) ? "Mobil"
    : "Masaüstü";
  return [browser, os, device].filter(Boolean).join(" · ").slice(0, 80);
}

// ---------------------------------------------------------------------------
// Cümle ve varlık etiketi
// ---------------------------------------------------------------------------

export interface AuditSentenceInput {
  action: string;
  severity?: string | null;
  feed_status?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;
  subject_name?: string | null;
  subject_email?: string | null;
  student_name?: string | null;
  package_name?: string | null;
  lesson_title?: string | null;
  mail_recipient?: string | null;
  mail_template?: string | null;
  mail_event_type?: string | null;
  login_reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

export const CART_ACTIONS = new Set(["cart_item_added", "cart_item_removed", "cart_cleared", "checkout_opened", "checkout_started"]);

/** Türkçe belirtme hâli eki: "5 Derslik Paket" → "5 Derslik Paket'i", "Deneme Dersi" → "Deneme Dersi'ni". */
export function turkishAccusative(name: string): string {
  const clean = name.trim();
  const vowels = clean.toLocaleLowerCase("tr-TR").match(/[aeıioöuü]/g);
  const last = vowels?.[vowels.length - 1] ?? "e";
  const suffix = "aı".includes(last) ? "ı" : "ei".includes(last) ? "i" : "ou".includes(last) ? "u" : "ü";
  const endsWithVowel = /[aeıioöuü]$/i.test(clean.toLocaleLowerCase("tr-TR"));
  return `${clean}'${endsWithVowel ? "n" : ""}${suffix}`;
}

function cartSentence(row: AuditSentenceInput, who: string | null): string {
  const meta = row.metadata ?? {};
  const name = who ?? "Kullanıcı";
  const pkgName = row.package_name || (typeof meta.package_name === "string" ? meta.package_name : null);
  const count = Number(meta.item_count);
  const total = formatMoney(meta.total as number | string | null | undefined, typeof meta.currency === "string" ? meta.currency : null);
  const forStudent = row.student_name && row.student_name !== who ? ` (öğrenci: ${row.student_name})` : "";
  const pkgList = pkgName ? (Number.isFinite(count) && count > 1 ? `${count} paket: ${pkgName}` : pkgName) : null;
  switch (row.action) {
    case "cart_item_added":
      return `${name}, ${pkgName ? turkishAccusative(pkgName) : "bir paketi"} sepete ekledi${forStudent}.`;
    case "cart_item_removed":
      return `${name}, ${pkgName ? turkishAccusative(pkgName) : "bir paketi"} sepetten çıkardı${forStudent}.`;
    case "cart_cleared":
      return `${name} sepeti temizledi${pkgList ? ` (${pkgList})` : ""}.`;
    case "checkout_opened":
      return `${name} ödeme ekranını açtı${pkgList ? ` — ${pkgList}${total ? ` · toplam ${total}` : ""}` : ""}${forStudent}.`;
    default: {
      if (meta.result === "session_failed") return `${name} ödeme başlatmak istedi ancak ödeme oturumu oluşturulamadı${pkgList ? ` (${pkgList})` : ""}.`;
      if (meta.result === "zero_payment") return `${name} ödemesiz (tam indirimli) siparişi tamamladı${pkgList ? ` — ${pkgList}` : ""}.`;
      return `${name} ödeme başlattı${pkgList ? ` — ${pkgList}${total ? ` · toplam ${total}` : ""}` : ""}${forStudent}.`;
    }
  }
}

/** İnsan okunur kısa cümle: "Ayşe Yılmaz için başlatılan ödeme başarıyla tamamlandı." */
export function auditSentence(row: AuditSentenceInput): string {
  const action = row.action;
  const who = row.subject_name || maskEmail(row.subject_email) || null;
  const forWhom = row.student_name && row.student_name !== who ? row.student_name : who;
  const meta = row.metadata ?? {};
  const pkg = row.package_name ? ` (${row.package_name})` : "";

  if (CART_ACTIONS.has(action)) return cartSentence(row, who);
  if (action === "auth.login") {
    return `${who ?? "Kullanıcı"} ${row.actor_role === "admin" ? "yönetim paneline " : ""}giriş yaptı.`;
  }
  if (action === "auth.login_failed") {
    const reason = loginReasonLabel(row.login_reason);
    return `${who ?? "Kullanıcı"} giriş yapamadı${reason ? `: ${reason.toLocaleLowerCase("tr-TR")}` : ""}.`;
  }
  if (action === "payment_completed" || action === "payment_status_paid") {
    return `${forWhom ? `${forWhom} için başlatılan ödeme` : "Ödeme"} başarıyla tamamlandı${pkg}.`;
  }
  if (action === "payment_status_failed" || action === "payment_failed") {
    return `${forWhom ? `${forWhom} için başlatılan ödeme` : "Ödeme"} başarısız oldu${pkg}.`;
  }
  if (action === "payment_status_pending") return `${forWhom ? `${forWhom} için ödeme` : "Ödeme"} onay bekliyor${pkg}.`;
  if (action === "paytr_callback_received") {
    const status = String(meta.provider_status ?? "");
    return `PayTR ödeme sonucunu bildirdi${status === "success" ? ": başarılı" : status === "failed" ? ": başarısız" : ""}${forWhom ? ` (${forWhom})` : ""}.`;
  }
  if (action.startsWith("email.")) {
    const kind = mailKind(row.mail_template, row.mail_event_type);
    const to = row.subject_name || maskEmail(row.mail_recipient) || "alıcı";
    if (action === "email.sent") return `${kind} ${to} adresine gönderildi.`;
    if (action === "email.queued") return `${kind} ${to} için kuyruğa alındı.`;
    if (action === "email.failed" || action === "email.render_failed") return `${kind} ${to} adresine gönderilemedi.`;
    if (action === "email.retry_scheduled") return `${kind} ${to} için yeniden denenecek.`;
  }
  if (row.actor_role === "admin" && row.actor_name && ADMIN_VERBS[action]) {
    const target = row.student_name || (row.subject_name && row.subject_name !== row.actor_name ? row.subject_name : null);
    return `${row.actor_name} ${ADMIN_VERBS[action]}${target ? ` — ${target}` : ""}.`;
  }
  if (who && PERSON_VERBS[action] && row.actor_role !== "admin") {
    return `${who} ${PERSON_VERBS[action]}${action.startsWith("payment") || action.startsWith("paytr") ? pkg : ""}.`;
  }
  const title = auditTitle(action, row.severity);
  return forWhom ? `${title} — ${forWhom}.` : `${title}.`;
}

export interface AuditEntityInput {
  action: string;
  feed_category?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  public_reference?: string | null;
  student_name?: string | null;
  package_name?: string | null;
  lesson_title?: string | null;
  mail_template?: string | null;
  mail_event_type?: string | null;
  login_device?: string | null;
}

/** "VARLIK" sütunu: "Ödeme ORI-ABC…", "Ders: Matematik", "Paket: 5 Derslik Paket". */
export function auditEntityLabel(row: AuditEntityInput): string | null {
  if (row.entity_type === "cart" || CART_ACTIONS.has(row.action)) {
    return row.public_reference ? `Ödeme ${row.public_reference}` : row.package_name ? `Sepet: ${row.package_name}` : "Sepet";
  }
  if (row.public_reference) return `Ödeme ${row.public_reference}`;
  if (row.feed_category === "mail" || row.action.startsWith("email.")) {
    return `Mail: ${mailKind(row.mail_template, row.mail_event_type, row.entity_type)}`;
  }
  if (row.lesson_title) return `Ders: ${row.lesson_title}`;
  if (row.package_name && (row.feed_category === "package" || row.feed_category === "lesson")) return `Paket: ${row.package_name}`;
  if (row.student_name && (row.feed_category === "student" || row.feed_category === "lesson")) return `Öğrenci: ${row.student_name}`;
  if (row.action.startsWith("auth.") && row.login_device) return row.login_device;
  if (row.entity_type === "blog_post") return "Blog yazısı";
  if (row.entity_type === "contact_request" || row.entity_type === "contact_reply") return "İletişim talebi";
  if (row.entity_type === "instructor") return "Eğitmen";
  if (row.entity_type === "topic") return "Ders konusu";
  if (row.entity_type === "auth_user" || row.entity_type === "guardian_account" || row.entity_type === "user") return "Hesap";
  if (row.student_name) return `Öğrenci: ${row.student_name}`;
  return null;
}

// ---------------------------------------------------------------------------
// Olay ayrıntıları (metadata → okunur satırlar; yalnız güvenli anahtarlar)
// ---------------------------------------------------------------------------

function metaText(meta: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim() && value !== REDACTED) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function clip(value: string | null, max = 160) {
  if (!value) return null;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function fieldLabel(field: string) {
  return CHANGE_FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}

export interface AuditHighlights {
  items: Array<[string, string]>;
  error: string | null;
}

/** Olay metadata'sından insan okunur ayrıntılar ve varsa hata açıklaması. */
export function auditHighlights(action: string, category: string, status: string, metadata: Record<string, unknown> | null): AuditHighlights {
  const meta = metadata ?? {};
  const items: Array<[string, string]> = [];
  let error: string | null = null;
  const push = (label: string, value: string | null | undefined) => { if (value) items.push([label, value]); };

  if (CART_ACTIONS.has(action)) {
    const currency = metaText(meta, "currency");
    const count = Number(meta.item_count);
    const single = !Number.isFinite(count) || count <= 1;
    push("Paket", clip(metaText(meta, "package_name"), 200));
    if (typeof meta.lesson_count === "number") push(single ? "Ders sayısı" : "Toplam ders", `${meta.lesson_count} ders`);
    if (single) push("Fiyat", formatMoney(meta.price as number | string | null | undefined, currency));
    if (typeof meta.quantity === "number") push("Adet", String(meta.quantity));
    if (!single) push("Paket sayısı", `${count} paket`);
    if (action !== "cart_item_added" && action !== "cart_item_removed") {
      push("Ara toplam", formatMoney(meta.subtotal as number | string | null | undefined, currency));
      push("Kupon", clip(metaText(meta, "coupon_code"), 40));
      push("İndirim", formatMoney(meta.discount as number | string | null | undefined, currency));
      push(action === "checkout_started" ? "Ödenecek tutar" : "Sepet toplamı", formatMoney(meta.total as number | string | null | undefined, currency));
    }
    const result = metaText(meta, "result");
    if (action === "checkout_started") {
      push("Sonuç", result === "session_created" ? "Ödeme oturumu oluşturuldu" : result === "zero_payment" ? "Ödemesiz sipariş (tam indirim)" : result === "session_failed" ? "Ödeme oturumu oluşturulamadı" : result);
      if (result === "session_failed") {
        const code = metaText(meta, "error_code");
        error = `Ödeme başlatılamadı${code ? ` (kod ${clip(code, 48)})` : ""}`;
      }
    }
    const source = metaText(meta, "source");
    push("Ekran", source === "pricing" ? "Paketler sayfası" : source === "cart" ? "Sepet" : source === "payment" ? "Ödeme ekranı" : source === "guest_cart" ? "Girişten önceki sepet" : source === "payment_result" ? "Ödeme sonucu" : source);
    push("Sepet ID", shortId(metaText(meta, "cart_id"), 13));
    return { items, error };
  }

  if (category === "payment") {
    if (action === "paytr_callback_received") {
      const provider = metaText(meta, "provider_status");
      push("PayTR sonucu", provider === "success" ? "Başarılı" : provider === "failed" ? "Başarısız" : provider);
    }
    if (meta.coupon_used === true || meta.coupon_applied === true) push("Kupon", "Kullanıldı");
    const kurus = Number(meta.amount_kurus ?? meta.total_amount);
    if (Number.isFinite(kurus) && kurus > 0) push("Tutar (olay anı)", formatMoney(kurus / 100, metaText(meta, "currency")));
    if (action === "paytr_callback_amount_mismatch") {
      const expected = Number(meta.expected_amount_kurus);
      const received = Number(meta.received_amount_kurus);
      if (Number.isFinite(expected) && Number.isFinite(received)) {
        error = `Beklenen ${formatMoney(expected / 100)}, gelen ${formatMoney(received / 100)}`;
      }
    }
    const reason = clip(metaText(meta, "failed_reason_msg", "failure_reason", "safe_error_message", "reason"), 140);
    const code = metaText(meta, "failed_reason_code", "failure_code", "error_code", "safe_error_code");
    if (!error && (status === "error" || action === "payment_session_superseded") && (reason || code)) {
      error = reason ? `${reason}${code ? ` (kod ${clip(code, 24)})` : ""}` : `Hata kodu: ${clip(code, 40)}`;
    }
  } else if (category === "mail") {
    const attempt = Number(meta.attempt_number);
    if (Number.isFinite(attempt) && attempt > 0) push("Deneme", `${attempt}. deneme`);
    if (status === "error" || action === "email.retry_scheduled") {
      const code = metaText(meta, "safe_error_code", "error_code");
      error = mailErrorText(code);
      if (error && code) error = `${error} (${clip(code, 40)})`;
    }
    if (action === "admin.contact.reply_sent") push("Alıcı", maskEmail(metaText(meta, "recipient_email")));
  } else if (category === "lesson" || category === "package") {
    const count = meta.lesson_count ?? meta.new_lesson_count;
    if (action.includes("assigned") && typeof count === "number") push("Ders hakkı", `+${count} ders`);
    if (typeof meta.price_amount === "number" && meta.price_amount > 0) push("Paket tutarı", formatMoney(meta.price_amount, metaText(meta, "currency")));
    const oldRemaining = meta.old_remaining ?? meta.previous_remaining;
    const newRemaining = meta.new_remaining ?? meta.remaining_after ?? meta.remaining ?? meta.remaining_lessons ?? meta.total_remaining_lessons;
    if (typeof oldRemaining === "number" && typeof newRemaining === "number") push("Kalan hak", `${oldRemaining} → ${newRemaining}`);
    else if (typeof newRemaining === "number") push("Kalan hak", String(newRemaining));
    const delta = meta.delta ?? meta.lesson_delta ?? meta.added_lessons;
    if (typeof delta === "number" && delta !== 0) push("Değişim", `${delta > 0 ? "+" : ""}${delta} ders`);
    push("Neden", clip(metaText(meta, "reason", "note"), 140));
  } else if (category === "student" && action === "member_archived") {
    push("Arşiv nedeni", clip(metaText(meta, "archive_reason"), 140));
  } else if (category === "auth") {
    if (action === "account.password_recovery_dispatched") {
      push("Başlatan", meta.is_admin_assisted === true ? "Yönetici" : "Kullanıcının kendisi");
    }
    push("Adres", metaText(meta, "candidate_email_masked"));
    push("Eski adres", metaText(meta, "old_email_masked"));
    push("Yeni adres", metaText(meta, "new_email_masked"));
    push("Cihaz", metaText(meta, "device"));
  } else if (category === "admin" && action.includes("contact")) {
    push("Yeni durum", metaText(meta, "status", "new_status"));
  }

  const fields = Array.isArray(meta.changed_fields) ? meta.changed_fields : Array.isArray(meta.fields) ? meta.fields : metaText(meta, "field") ? [meta.field] : [];
  if (fields.length) {
    const labels = Array.from(new Set(fields.filter((field) => typeof field === "string" && !isSecretKey(field)).map((field) => fieldLabel(String(field)))));
    if (labels.length) push("Değişen alanlar", labels.join(", "));
  }

  if (!error && status === "error") {
    error = clip(metaText(meta, "safe_error_message", "safe_error_code", "error_code", "message"), 160);
  }
  return { items, error };
}
