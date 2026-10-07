/**
 * Generates the canonical production email catalog.
 *
 * Every row is explicit and source-derived. Never replace these values with
 * generated placeholder names or renderers: omissions here can silently erase
 * valid production mail types from the workbook.
 */
import XLSX from "xlsx";

const FILE = "C:/Users/merto/Desktop/mail-v5.xlsx";
const SHEET = "TÜM MAİLLER";
const ADMIN_BCC = "admin@oriens-academy.com";
const FROM_GENERAL = "Oriens Academy <info@oriens-academy.com>";
const FROM_SUPPORT = "Oriens Academy <info@oriens-academy.com>";
const FROM_PAYMENTS = FROM_GENERAL;
const AUTO = "OTOMATİK";
const AUTO_AUTH = "OTOMATİK (AUTH FLOW)";
const AUTO_TRIGGER = "OTOMATİK (DB TRIGGER)";
const AUTO_PAYMENT = "OTOMATİK (ÖDEME CALLBACK)";
const MANUAL = "MANUEL (ADMIN)";
const INACTIVE = "DECOMMISSIONED / INACTIVE";

const row = (id, type, mode, trigger, subject, from, to, producer, renderer, button = "—", notes = "—", bccIsPrimary = false) => ({
  id, type, mode, trigger, subject, from, to, producer, renderer, button, notes, bccIsPrimary,
});

const ROWS = [
  row("MAIL-001", "Kayıt Sonrası E-posta Doğrulama Kodu (OTP)", AUTO_AUTH,
    "Doğrulanmamış kullanıcı ilk girişte kayıt doğrulama ekranını açtığında otomatik tetiklenir.",
    "{OTP} — E-posta doğrulama kodunuz", FROM_GENERAL, "Doğrulanmamış hesap sahibi",
    "EmailOtpGate (mode=signup) → Edge Function: request-purchase-email-verification",
    "renderPurchaseEmailVerificationOtpEmail", "—",
    "Yalnızca 6 haneli kod gönderilir; bağlantı yoktur. MAIL-006 ile aynı üretici ve şablonu, farklı giriş noktasını kullanır."),
  row("MAIL-002", "Şifre Sıfırlama Bağlantısı (Kullanıcı Talepli)", AUTO,
    "Kullanıcı giriş ekranındaki Şifremi Unuttum formunu gönderdiğinde tetiklenir.",
    "Oriens Academy — Şifre Sıfırlama Bağlantısı", FROM_GENERAL, "Şifre sıfırlama talep eden hesap sahibi",
    "Edge Function: request-password-recovery", "renderPasswordResetActionEmail", "—",
    "Turnstile ve rate-limit korumalıdır; düz metin parola içermez, tek kullanımlık bağlantı gönderir."),
  row("MAIL-003", "Şifre Sıfırlama Bağlantısı (Admin Panelinden Tetiklenen)", MANUAL,
    "Admin öğrenci kartındaki şifre sıfırlama e-postası aksiyonunu çalıştırdığında gönderilir.",
    "Oriens Academy — Şifre Sıfırlama Bağlantısı", FROM_GENERAL, "Hesap sahibi",
    "Admin UI → sendStudentPasswordReset() → Edge Function: request-password-recovery",
    "renderPasswordResetActionEmail", "Şifre Sıfırlama E-postası Gönder",
    "MAIL-002 ile aynı kanonik akışı kullanır; deprecated admin-password-reset işlevi çağrılmaz."),
  row("MAIL-005", "Hoş Geldiniz E-postası", AUTO_TRIGGER,
    "guardian_accounts.email_verified_at ilk kez dolduğunda DB trigger outbox kaydı oluşturur.",
    "Oriens Academy hesabınız hazır", FROM_SUPPORT, "Yeni ve doğrulanmış hesap sahibi",
    "DB trigger → notification_deliveries → process-notification-outbox",
    "process-notification-outbox / guardian_welcome", "—",
    "Canlı üretici DB trigger ve dayanıklı outbox'tır; send-welcome-email uygulamadan çağrılmaz."),
  row("MAIL-006", "Ödeme Öncesi E-posta Doğrulama Kodu (OTP)", AUTO_AUTH,
    "Doğrulanmamış hesap sahibi PayTR ödeme akışına girdiğinde otomatik tetiklenir.",
    "{OTP} — E-posta doğrulama kodunuz", FROM_GENERAL,
    "Doğrulanmamış hesap sahibi / ödeme yapan kullanıcı",
    "HostedCardPanel → Edge Function: request-purchase-email-verification",
    "renderPurchaseEmailVerificationOtpEmail", "—",
    "MAIL-001 ile aynı üretici ve şablonu kullanır; doğrulama atomik verify_purchase_email_otp RPC'siyle yapılır."),
  row("MAIL-007", "Yeni E-posta Adresi Doğrulama Kodu (OTP)", AUTO_AUTH,
    "Kullanıcı profilinden e-posta adresini değiştirmek istediğinde yalnızca yeni adrese gönderilir.",
    "Yeni E-posta Adresinizi Doğrulayın", FROM_SUPPORT, "Aday yeni e-posta adresi",
    "Edge Function: request-email-change", "renderEmailChangeOtpEmail", "—",
    "Altı haneli kod 10 dakika geçerlidir; doğrulama verify_email_change_otp RPC'siyle atomik yapılır."),
  row("MAIL-009", "Ödeme Alındı ve Ders Hakları Tanımlandı", AUTO_PAYMENT,
    "PayTR callback başarılı olduğunda DB trigger outbox kaydı oluşturur.",
    "Ödemeniz Alındı ve Ders Haklarınız Tanımlandı", FROM_PAYMENTS,
    "Ödemeyi yapan hesap sahibi",
    "payment callback → outbox (payment_success_guardian) → process-notification-outbox",
    "process-notification-outbox / payment_success_guardian", "—",
    "Ödeme kaydına bağlı dedupe anahtarı callback tekrarında ikinci maili önler."),
  row("MAIL-010", "Yeni Ödeme Bildirimi (Yönetim)", INACTIVE,
    "—", "[ORIENS] Payment success — {referans}", "—", "—",
    "Decommissioned; yeni üretici yoktur",
    "process-notification-outbox / payment_success_admin (historical renderer support only)", "—",
    "MAIL-009 içindeki merkezi admin BCC kopyasıyla değiştirildi; geçmiş kayıtlar korunur."),
  row("MAIL-014", "İade Bildirimi (Tam veya Kısmi)", MANUAL,
    "Admin Ödemeler ekranında iade işlemini onayladığında outbox kaydı oluşturulur.",
    "İadeniz Tamamlandı / Kısmi İadeniz Tamamlandı", FROM_PAYMENTS,
    "İadesi yapılan doğrulanmış hesap sahibi",
    "PaymentRefundDialog → iade RPC → outbox (payment_refunded_account_holder)",
    "process-notification-outbox / payment_refunded_account_holder", "İade onay / geri ödeme aksiyonu",
    "İade edilen ve kalan aktif ders hakları bildirimde yer alır."),
  row("MAIL-019", "Görüşme Talebi Alındı (Kullanıcı)", AUTO,
    "Web sitesindeki randevu / görüşme formu başarıyla gönderildiğinde tetiklenir.",
    "Görüşme Talebiniz Alındı", FROM_GENERAL, "Görüşme talebini oluşturan kullanıcı",
    "Edge Function: create-booking → dispatchBookingEmails", "renderStudentBookingEmail", "—",
    "Kullanıcıya talebinin alındığını bildirir."),
  row("MAIL-020", "Yeni Görüşme Talebi Bildirimi (Yönetim)", AUTO,
    "MAIL-019 ile aynı form gönderiminde yönetim bildirimi olarak üretilir.",
    "Yeni Görüşme Talebi — {sınav}", FROM_GENERAL,
    "site_settings.notification.booking_email (varsayılan info@oriens-academy.com)",
    "Edge Function: create-booking → dispatchBookingEmails", "renderAdminBookingEmail", "—",
    "Yönetim alıcısı özel site ayarından çözülür."),
  row("MAIL-021", "Randevu Onay Bilgilendirmesi (Hesap Sahibi)", MANUAL,
    "Randevu işlemi mail göndermez; admin açık bilgilendirme aksiyonuna bastığında gönderilir.",
    "Ders Randevunuz Onaylandı: {başlık}", FROM_SUPPORT, "Hesap sahibi",
    "Admin UI → send-student-appointment (action=confirm) → dispatchAppointmentConfirmedEmails",
    "renderStudentAppointmentConfirmedEmail",
    "Bilgilendirme E-postası Gönder / Bilgilendirme E-postasını Tekrar Gönder",
    "Altmış saniyelik atomik idempotency penceresi çift tıklamayı bastırır; bilinçli tekrar gönderim desteklenir."),
  row("MAIL-022", "Randevu Onaylandı Bildirimi (Yönetim)", MANUAL,
    "MAIL-021 ile aynı açık admin onay/bilgilendirme aksiyonunda yönetim alıcısına gönderilir.",
    "Yeni Ders Randevusu: {öğrenci} — {başlık}", FROM_SUPPORT,
    "site_settings.notification.support_email (varsayılan info@oriens-academy.com)",
    "Admin UI → send-student-appointment (action=confirm) → dispatchAppointmentConfirmedEmails",
    "renderAdminAppointmentCreatedEmail", "Bilgilendirme E-postası Gönder (MAIL-021 ile aynı aksiyon)",
    "Öğrenci onayıyla aynı dispatcher içinde ayrı yönetim bildirimi olarak gönderilir."),
  row("MAIL-023", "Randevu Tarih Değişikliği Bilgilendirmesi", MANUAL,
    "Randevu ertelenmesi otomatik mail üretmez; admin ilgili butona bastığında gönderilir.",
    "Ders / Görüşme Bilgileriniz Güncellendi: {başlık}", FROM_SUPPORT, "Hesap sahibi",
    "Admin UI → send-student-appointment (action=update) → dispatchAppointmentUpdatedEmail",
    "renderStudentAppointmentUpdatedEmail",
    "Tarih Değişikliği E-postası Gönder / Tarih Değişikliği E-postasını Tekrar Gönder",
    "Açık admin aksiyonudur; randevu veri değişikliğinin otomatik yan etkisi değildir."),
  row("MAIL-024", "Randevu İptal Bilgilendirmesi", MANUAL,
    "Randevu iptali otomatik mail üretmez; admin ilgili butona bastığında gönderilir.",
    "Ders Randevusu İptali: {başlık}", FROM_SUPPORT, "Hesap sahibi",
    "Admin UI → send-student-appointment (action=cancel) → dispatchAppointmentCancelledEmail",
    "renderStudentAppointmentCancelledEmail",
    "İptal E-postası Gönder / İptal E-postasını Tekrar Gönder", "Açık admin aksiyonudur."),
  row("MAIL-025", "Randevu Hatırlatma E-postası", MANUAL,
    "Otomatik hatırlatma cron'u yoktur; yalnızca admin butonuna basıldığında gönderilir.",
    "Hatırlatma: Yarınki Dersiniz — {başlık}", FROM_SUPPORT, "Hesap sahibi",
    "Admin UI → send-student-appointment (action=remind) → dispatchAppointmentReminderEmail",
    "renderStudentAppointmentReminderEmail",
    "Hatırlatma E-postası Gönder / Hatırlatma E-postasını Tekrar Gönder", "Açık admin aksiyonudur."),
  row("MAIL-026", "Canlı Ders Toplantı Bağlantısı", MANUAL,
    "Ders veya toplantı bağlantısı değişikliği mail üretmez; admin gönderim butonuna bastığında gönderilir.",
    "Canlı Dersiniz Planlandı / Canlı Ders Bilgileriniz Güncellendi: {başlık}",
    FROM_SUPPORT, "Öğrenci / hesap sahibi",
    "Admin UI → send-live-lesson-email (action=send_link) → dispatchLiveLessonLinkEmail",
    "renderStudentLiveLessonLinkEmail",
    "Linki Öğrenciye E-posta İle Gönder / Linki Öğrenciye Tekrar Gönder",
    "Yeni ve güncellenmiş canlı ders bilgisini aynı kanonik renderer üzerinden yollar."),
  row("MAIL-027", "Ders Sonu Raporu ve Güncel Ders Bakiyesi", MANUAL,
    "Completed lesson card → Raporu Kaydet ve Bildirimi Gönder",
    "Ders Sonu Raporunuz ve Güncel Ders Bakiyeniz", FROM_GENERAL,
    "Doğrulanmış veli / hesap sahibi (guardian_accounts.email_verified_at zorunlu)",
    "Admin UI → admin_save_and_send_lesson_report() → outbox",
    "lesson_completed_account_holder",
    "Raporu Kaydet ve Bildirimi Gönder / Güncellenmiş Raporu Tekrar Gönder",
    "Veli ve öğrenci adı sunucuda kanonik ilişkiden ayrı çözülür. Tarih/saat dersin IANA saat diliminde gösterilir. Rapor zorunludur; bakiye gönderim anında hesaplanır. Ders tamamlama mail üretmez."),
  row("MAIL-028", "İletişim Formu Teyit E-postası (Kullanıcı)", AUTO,
    "İletişim veya hızlı iletişim formu başarıyla gönderildiğinde otomatik tetiklenir.",
    "Mesajınız Bize Ulaştı", FROM_GENERAL, "Mesajı gönderen kullanıcı",
    "Edge Function: create-contact → dispatchContactEmails", "renderStudentContactEmail", "—",
    "Kullanıcıya iletişim talebinin alındığını bildirir."),
  row("MAIL-029", "Yeni İletişim Talebi Bildirimi (Yönetim)", AUTO,
    "MAIL-028 ile aynı form gönderiminde yönetim bildirimi olarak üretilir.",
    "Yeni İletişim Talebi", FROM_GENERAL,
    "site_settings.notification.contact_email (varsayılan info@oriens-academy.com)",
    "Edge Function: create-contact → dispatchContactEmails", "renderAdminContactEmail", "—",
    "Yönetim alıcısı özel site ayarından çözülür."),
  row("MAIL-030", "İletişim Mesajına Yönetici Yanıtı", MANUAL,
    "Admin iletişim talebine yanıt yazıp gönderdiğinde iletilir.",
    "Re: {özgün konu}; konu yoksa İletişim Talebiniz Hakkında", FROM_GENERAL,
    "Yanıt verilen kullanıcı", "Admin UI → Edge Function: send-contact-reply",
    "renderContactReplyEmail", "Yanıt E-postası Gönder",
    "Yanıt geçmişi contact_replies tablosunda idempotency anahtarıyla saklanır."),
  row("MAIL-039", "E-posta Adresi Değişikliği Güvenlik Bildirimi (Eski Adrese)", AUTO,
    "Yeni e-posta adresi OTP ile doğrulandığında eski adrese güvenlik bildirimi gönderilir.",
    "E-posta Adresiniz Değiştirildi", FROM_SUPPORT, "Mevcut / eski e-posta adresi",
    "Edge Function: verify-email-change", "renderEmailChangeSecurityNoticeEmail", "—",
    "Hesap ele geçirme durumunda eski adres sahibini bilgilendiren zorunlu güvenlik bildirimidir."),
  row("MAIL-040", "Ders Sonrası Kalan Ders Hakkı Bildirimi", INACTIVE, "—",
    "Dersiniz Tamamlandı | Kalan Ders Hakkınız: {n}", "—", "—",
    "Decommissioned; migration yalnızca gönderilmemiş eski outbox satırlarını iptal eder",
    "lesson_remaining_rights_account_holder (retired)", "—",
    "MAIL-027 içine birleştirildi. Yeni üretim yoktur; sent/failed geçmiş kayıtları korunur."),
  row("MAIL-041", "Paket Bilgilendirme", MANUAL,
    "Admin paket kartındaki butona bastığında veya paket tanımlama formundaki varsayılan-kapalı bildirim kutusunu seçtiğinde gönderilir.",
    "Ders Paketiniz Tanımlandı", FROM_GENERAL,
    "Öğrencinin doğrulanmış veli / hesap sahibi (guardian_accounts.email_verified_at zorunlu)",
    "Admin UI → sendPackageNotificationEmail(kind=package_assigned) → admin_send_package_notification() → outbox",
    "process-notification-outbox / package_assigned_manual",
    "Paket Bilgilendirme E-postası Gönder / Paket Bilgilendirme E-postasını Tekrar Gönder",
    "Veli/öğrenci kimlikleri ayrıdır. Yinelenen paket toplamı kaldırılmış, Güncel Ders Bakiyesi ve yerelleştirilmiş başlangıç tarihi üç sütunlu sunum tablosunda gösterilir."),
  row("MAIL-042", "Ders Hakkı Güncelleme", MANUAL,
    "Admin paket kartındaki butona bastığında veya hak düzenleme formundaki bildirim kutusunu seçtiğinde gönderilir.",
    "Ders Hakkınız Güncellendi", FROM_GENERAL,
    "Öğrencinin doğrulanmış veli / hesap sahibi (guardian_accounts.email_verified_at zorunlu)",
    "Admin UI → sendPackageNotificationEmail(kind=lesson_rights) → admin_send_package_notification() → outbox",
    "process-notification-outbox / lesson_rights_manual",
    "Ders Hakkı Güncelleme E-postası Gönder / Ders Hakkı Güncelleme E-postasını Tekrar Gönder",
    "Hak değişikliği mail üretmez; yalnız açık admin seçimi üretir. Toplam güncel hak gövdedeki üç sütunlu tabloda gösterilir."),
  row("MAIL-043", "Güncel Ders Hakları Özeti", MANUAL,
    "Admin öğrenci paket görünümündeki güncel haklar bildirimini açıkça gönderdiğinde oluşturulur.",
    "Güncel Ders Haklarınız", FROM_SUPPORT,
    "Öğrencinin doğrulanmış veli / hesap sahibi (guardian_accounts.email_verified_at zorunlu)",
    "Admin UI → admin_send_package_rights_notification() → outbox",
    "process-notification-outbox / package_rights_summary", "Güncel Hakları E-posta İle Gönder",
    "Etiket, iki nokta ve değer hizalı tabloda yerelleştirilmiş tarih ve toplam kalan hak gösterilir; paket kullanım satırı yoktur."),
  row("MAIL-044", "Geçmiş Ders Kaydı Onayı", MANUAL,
    "Geçmiş ders formundaki varsayılan-kapalı E-posta gönder seçeneği işaretlenirse aynı transaction içinde kuyruğa alınır.",
    "Geçmiş Ders Kaydınız Oluşturuldu", FROM_SUPPORT,
    "Öğrencinin doğrulanmış veli / hesap sahibi (guardian_accounts.email_verified_at zorunlu)",
    "Admin UI → admin_record_completed_lesson(p_send_email=true) → outbox",
    "process-notification-outbox / past_lesson_confirmation_manual", "E-posta gönder",
    "Ders ID tabanlı kalıcı dedupe anahtarı kullanır. MAIL-027 ve emekli MAIL-040 akışlarını tetiklemez."),
];

const HEADERS = [
  "No", "Mail ID", "Mail Tipi", "Gönderim Şekli", "Ne Tetikliyor?", "Mail Başlığı",
  "Kim Gönderiyor?", "Kime Gidiyor?", "BCC (Arşiv Kopyası)", "Üretici (Producer)",
  "Şablon / Renderer", "Admin UI Butonu", "Notlar",
];
const isActiveMode = (mode) => !/\b(?:DECOMMISSIONED|INACTIVE)\b/i.test(String(mode));

ROWS.sort((a, b) => a.id.localeCompare(b.id));
const sheetRows = ROWS.map((item, index) => [
  index + 1, item.id, item.type, item.mode, item.trigger, item.subject, item.from, item.to,
  item.bccIsPrimary
    ? `${ADMIN_BCC} (zaten birincil alıcı — çift kopya gönderilmez)`
    : (isActiveMode(item.mode) ? ADMIN_BCC : "—"),
  item.producer, item.renderer, item.button, item.notes,
]);

const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...sheetRows]);
ws["!autofilter"] = { ref: `A1:M${sheetRows.length + 1}` };
ws["!cols"] = [6, 12, 42, 24, 62, 52, 46, 48, 36, 62, 52, 58, 72].map((wch) => ({ wch }));
ws["!rows"] = [{ hpt: 34 }, ...sheetRows.map(() => ({ hpt: 92 }))];
for (let r = 0; r <= sheetRows.length; r += 1) {
  for (let c = 0; c < HEADERS.length; c += 1) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (!cell) continue;
    cell.s = r === 0
      ? { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "173F2D" } }, alignment: { vertical: "center", wrapText: true } }
      : { alignment: { vertical: "top", wrapText: true }, fill: ROWS[r - 1].mode === INACTIVE ? { fgColor: { rgb: "E5E7EB" } } : undefined };
  }
}

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, SHEET);
XLSX.writeFile(wb, FILE, { cellStyles: true, compression: true });

const activeCount = ROWS.filter((item) => isActiveMode(item.mode)).length;
console.log(`Wrote ${FILE}`);
console.log(`ACTIVE_MAIL_COUNT = ${activeCount}`);
console.log(`INACTIVE_MAIL_COUNT = ${ROWS.length - activeCount}`);
console.log(`TOTAL_MAIL_COUNT = ${ROWS.length}`);
