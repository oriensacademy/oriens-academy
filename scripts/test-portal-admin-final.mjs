import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(path.resolve(file), "utf8");

const portal = read("src/components/student/StudentPortal.tsx");
assert.match(portal, /<Panel title=\{isTr \? "Dersler" : "Lessons"\}>/);
assert.doesNotMatch(portal, /Yaklaşan Ders ve Görüşmeler|Geçmiş Ders ve Görüşmeler/);
for (const label of ["Yaklaşan", "Tamamlandı", "İptal Edildi", "Tanışma Görüşmesi"]) assert.ok(portal.includes(label));
assert.ok(portal.indexOf("const upcoming") < portal.indexOf("const history"));

const languageSwitch = read("src/components/sections/LanguageSwitch.tsx");
assert.match(languageSwitch, /target === "tr" \? "TR" : "ENG"/);
assert.doesNotMatch(languageSwitch, />Türkçe<|>English<|\bGB\b|🇬🇧/);
const navbar = read("src/components/sections/Navbar.tsx");
assert.match(navbar, /whitespace-nowrap/);
assert.match(navbar, /shrink-0/);

const testimonialQuery = read("src/lib/admin/content.ts");
assert.match(testimonialQuery, /\.rpc\("get_public_testimonials_v2"/);
assert.match(testimonialQuery, /p_limit: 16/);
const testimonialMigration = read("supabase/migrations/20260902120000_bounded_public_testimonial_selection.sql");
assert.match(testimonialMigration, /security definer/);
assert.match(testimonialMigration, /set search_path = ''/);
assert.match(testimonialMigration, /t\.active = true/);
assert.match(testimonialMigration, /t\.verified = true/);
assert.match(testimonialMigration, /t\.archived_at is null/);
assert.match(testimonialMigration, /limit least\(greatest\(coalesce\(p_limit, 16\), 1\), 16\)/);
assert.match(testimonialMigration, /grant execute[^\n]+to anon, authenticated/);
const marquee = read("src/components/ui/marquee-01.tsx");
assert.match(marquee, /index % 2 === 0/);
assert.match(marquee, /index % 2 === 1/);
assert.match(marquee, /line-clamp-6/);
assert.match(read("src/app/globals.css"), /prefers-reduced-motion:[\s\S]*\.oriens-marquee-track/);

const evaluations = read("src/app/admin/degerlendirmeler/page.tsx");
assert.match(evaluations, /TestimonialsManager/);
assert.doesNotMatch(evaluations, /AssignedHomeworkList|Değerlendirmeler \/ Evaluations|öğrenci çalışmalarını/);

const sidebar = read("src/components/admin/AdminSidebar.tsx");
for (const label of ["Gösterge Paneli", "Öğrenciler", "Ders & Randevular", "Değerlendirmeler", "İletişim & Destek", "Fiyatlandırma", "İndirim Kuponları", "Ödemeler", "Mali Akış", "Bildirimler", "Ayarlar"]) assert.ok(sidebar.includes(label));
assert.doesNotMatch(sidebar, /GENERAL|STUDENTS|FINANCE|NOTIFICATIONS|SYSTEM|labelEn/);

const detail = read("src/components/admin/StudentDetailSheet.tsx");
assert.doesNotMatch(detail, /id: "homework"|id: "exam_history"|İlişki Sınıflandırması|admin-relationship-select|Bekleyen Ödev/);
for (const action of ["Ders Hakkı Ekle", "Ders Hakkı Azalt", "Geçmiş Ders Ekle", "Ders Yapıldı"]) {
  assert.ok(read("src/components/admin/StudentLearningManager.tsx").includes(action), `${action} missing`);
}

const notifications = read("src/app/admin/bildirimler/page.tsx");
assert.doesNotMatch(notifications, /<th[^>]*>Kanal \/ Sağlayıcı<\/th>|Notifications Log|No Notification Logs|\(All\)|\(Sent\)|\(Failed\)|\(Pending\)/);
const notificationLabels = read("src/lib/admin/notifications.ts");
for (const label of ["Görüşme Talebi — Yönetici Bildirimi", "Görüşme Talebi — Kullanıcı Bilgilendirmesi", "Paket Tanımlandı", "Ders Hatırlatması"]) assert.ok(notificationLabels.includes(label));

const phoneCopy = [read("src/content/tr/about.ts"), read("src/content/en/about.ts"), read("src/config/legal.ts")].join("\n");
assert.doesNotMatch(phoneCopy, /kurumsal hattımız|corporate line/i);
assert.match(phoneCopy, /destek hattımız/);
assert.match(phoneCopy, /support line/);

console.log(JSON.stringify({ portalTimeline: "PASS", language: "PASS", testimonials: "PASS", adminTurkish: "PASS", notifications: "PASS", phoneCopy: "PASS" }));
