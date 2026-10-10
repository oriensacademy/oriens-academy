// Final müşteri revizyonları (Edit.pdf + oriens-odeme_8.html): kaynak düzeyinde
// regresyon kontrolleri. Ağ, veritabanı ve ödeme sağlayıcısı kullanılmaz.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const rel = `${dir}/${entry.name}`;
  if (entry.isDirectory()) return walk(rel);
  return /\.(tsx?|css)$/.test(entry.name) ? [rel] : [];
});
const sources = walk("src").map((file) => [file, read(file)]);
let count = 0;
const test = (name, fn) => {
  fn();
  count += 1;
  console.log(`PASS  ${name}`);
};

test("CART REMOVED: no cart page, context, icon or route", () => {
  for (const file of ["src/components/cart/CartPage.tsx", "src/lib/cart/cart-context.tsx", "src/components/ui/oriens-creative-pricing.tsx"]) {
    assert.equal(exists(file), false, `${file} must be removed`);
  }
  for (const [file, text] of sources) {
    assert.doesNotMatch(text, /useCart\b|CartProvider|cart-context|ShoppingBag|Sepete Ekle|Sepetim/, `cart UI leftover in ${file}`);
  }
  const routes = read("src/lib/routes.ts");
  assert.doesNotMatch(routes, /cartSegment|cartPath|cart: \{/);
  const hub = read("src/app/[lang]/[examHub]/page.tsx");
  assert.doesNotMatch(hub, /isCart|CartPage|cartSegment/);
});

test("CART AUDIT PLUMBING KEPT (historical rows + checkout events)", () => {
  assert.equal(exists("src/lib/cart/cart-audit.ts"), true);
  assert.match(read("src/components/payment/PaymentPage.tsx"), /recordCartEvent\(/);
});

test("CART REDIRECTS: /tr/sepet → /tr/ucretler, /en/cart → /en/pricing (301)", () => {
  const lines = read("public/_redirects").split(/\r?\n/).map((line) => line.trim().split(/\s+/).join(" "));
  for (const rule of ["/tr/sepet/ /tr/ucretler/ 301", "/tr/sepet /tr/ucretler/ 301", "/en/cart/ /en/pricing/ 301", "/en/cart /en/pricing/ 301"]) {
    assert.ok(lines.includes(rule), `missing redirect: ${rule}`);
  }
});

test("DIRECT CHECKOUT: every purchase link is /<lang>/odeme/?package=<id>", () => {
  for (const file of ["src/components/reference/ReferencePricingPage.tsx", "src/components/pricing/PricingPage.tsx", "src/components/student/hesabim/HesabimView.tsx"]) {
    assert.match(read(file), /localizedPath\("payment", [\w."]+\)\}\?package=\$\{encodeURIComponent\(/, `${file} must link straight to checkout`);
  }
  const payment = read("src/components/payment/PaymentPage.tsx");
  assert.doesNotMatch(payment, /source=cart|isCartCheckout|PaytrInstallmentTable/);
  assert.match(payment, /selectPurchasablePackages\(/, "checkout uses the dynamic package list");
});

test("DYNAMIC PACKAGES: package40 and any purchasable package is listed", () => {
  const pricing = read("src/lib/admin/pricing.ts");
  assert.match(pricing, /export function selectPurchasablePackages/);
  assert.match(pricing, /lesson_count/);
});

test("EMAIL VERIFICATION GATE still guards direct checkout", () => {
  const payment = read("src/components/payment/PaymentPage.tsx");
  assert.match(payment, /email_verified_at/);
  assert.match(payment, /const contextReady = Boolean\([^)]*emailVerified/);
});

test("INSTALLMENT INFO TABLE REMOVED, PAYTR INSTALLMENTS PRESERVED", () => {
  for (const file of ["src/components/payment/PaytrInstallmentTable.tsx", "src/lib/payments/paytr-installment-table.ts", "scripts/test-paytr-installment-table-browser.mjs"]) {
    assert.equal(exists(file), false, `${file} must be removed`);
  }
  for (const [file, text] of sources) {
    assert.doesNotMatch(text, /PAYTR_INSTALLMENT_TOKEN|taksit_tablosu|installment-table/i, `installment table leftover in ${file}`);
  }
  // PayTR'nin kendi iframe formu (taksit seçenekleri dahil) ve sunucu akışı yerinde.
  const panel = read("src/components/payment/HostedCardPanel.tsx");
  assert.match(panel, /https:\/\/www\.paytr\.com\/odeme\/guvenli\/\$\{prepared\.token\}/);
  assert.match(panel, /createPaytrToken\(/);
  const edge = read("supabase/functions/paytr-create-token/index.ts");
  assert.match(edge, /max_installment/);
  assert.match(edge, /no_installment/);
});

test("COUPON on payment page goes through quote_checkout_coupon and the token", () => {
  const payment = read("src/components/payment/PaymentPage.tsx");
  assert.match(payment, /İndirim kodunuz mu var\?/);
  assert.match(payment, /useCheckoutCoupon\(/);
  assert.match(payment, /couponCode=\{checkoutCouponCode\}|couponCode: checkoutCouponCode|checkoutCouponCode/);
  assert.match(read("src/lib/coupons/client.ts"), /rpc\("quote_checkout_coupon"/);
});

test("PAYMENT PAGE matches reference structure", () => {
  const payment = read("src/components/payment/PaymentPage.tsx");
  for (const marker of ["Güvenli ödeme · 3D Secure", "İletişim bilgileri", "Kart ile ödeme", "Sipariş özeti", "Ödenecek tutar", "mobilePaybar", 'id="payment-phone"']) {
    assert.ok(payment.includes(marker), `payment page missing ${marker}`);
  }
  const panel = read("src/components/payment/HostedCardPanel.tsx");
  for (const marker of ["3D Secure doğrulama", "256-bit SSL şifreleme", "Kart bilgileriniz sunucularımızda saklanmaz", "data-paytr-iframe", "data-legal-consent"]) {
    assert.ok(panel.includes(marker), `card panel missing ${marker}`);
  }
  assert.doesNotMatch(payment + panel, /DEMO|demo kod|ORIENS10/i, "no demo coupon code");
});

test("REAL PAYTR FORM ONLY: no Oriens card fields, auto-open, retry, stale-token guard", () => {
  const panel = read("src/components/payment/HostedCardPanel.tsx");
  const payment = read("src/components/payment/PaymentPage.tsx");
  const css = read("src/components/payment/payment.module.css");
  // Kart verisi Oriens DOM/state'ine girmez: sahte iskelet ve özel "X TL öde" butonu yok.
  assert.doesNotMatch(panel, /Kart numarası|AA \/ YY|skeleton|skField|data-pay-button|payLabel/);
  assert.doesNotMatch(payment, /payLabel|payButtonRef|setPayButton/);
  assert.doesNotMatch(css, /\.skeleton|\.skField|\.payBtn/);
  for (const [file, text] of sources) {
    assert.doesNotMatch(text, /autoComplete="cc-|cardNumber|card_number|cvc:|cvv:/i, `card data handling in ${file}`);
  }
  assert.match(panel, /Ödeme formu yüklenemedi\. Tekrar deneyin\./);
  assert.match(panel, /data-paytr-retry/);
  assert.match(panel, /clientRequestId: newClientRequestId\(\)/);
  assert.match(panel, /tokenKurus !== expectedAmountKurus/);
  assert.match(panel, /confirmPaymentAgreements\(/);
  assert.match(payment, /expectedAmountKurus = Math\.round\(finalPrice \* 100\)/);
  // Kayıtlı telefon önerilir; kullanıcı yazınca kendi girdisi geçerlidir.
  assert.match(payment, /const paymentPhone = phoneInput \?\? savedPhone;/);
  const edge = read("supabase/functions/paytr-create-token/index.ts");
  assert.match(edge, /meta\.client_request_id !== clientRequestId/);
  assert.match(edge, /client_request_id: clientRequestId/);
});

test("CANONICAL PUBLIC HEADER: one Navbar for every public route, none on admin", () => {
  const layout = read("src/app/[lang]/layout.tsx");
  assert.match(layout, /<Navbar \/>\s*<PublicPageTransition>/, "Navbar must render unconditionally");
  assert.doesNotMatch(layout, /<HideOnReferenceRoute>\s*<Navbar/);
  assert.doesNotMatch(read("src/app/admin/layout.tsx"), /sections\/Navbar/);
  for (const page of ["ReferenceLoginPage", "ReferencePricingPage", "ReferenceAboutPage"]) {
    const text = read(`src/components/reference/${page}.tsx`);
    assert.doesNotMatch(text, /_HEADER_HTML|useReferenceHeader|LOGIN_MENU_HTML/, `${page} still renders its own header`);
    assert.match(text, /<NavbarSpacer \/>/, `${page} must reserve the canonical header height`);
  }
  assert.doesNotMatch(read("src/components/reference/generated/markup.ts"), /HEADER/);
  for (const name of ["about", "login", "pricing"]) {
    assert.doesNotMatch(read(`src/components/reference/generated/reference-${name}.css`), /\.oh-|\.oh|\.hw|\.hb|\[data-oh\]/, `header CSS left in reference-${name}.css`);
  }
  assert.equal(exists("src/components/reference/reference-login-menu.css"), false);
  assert.doesNotMatch(read("src/components/sections/Navbar.tsx"), /ShoppingBag|ShoppingCart|sepet|cart/i, "cart must not return to the header");
});

test("THEME SELECTOR REMOVED (PDF-25)", () => {
  assert.equal(exists("src/components/theme/ThemeSelector.tsx"), false);
  assert.doesNotMatch(read("src/components/sections/Footer.tsx"), /ThemeSelector/);
  assert.doesNotMatch(read("src/app/layout.tsx"), /dataset\.theme\s*=/);
});

test("GUARDIAN PHONE: migration, RPC payloads, types, WhatsApp fallback", () => {
  const sql = read("supabase/migrations/20261010120000_student_guardian_phone.sql");
  assert.match(sql, /add column if not exists contact_guardian_phone text/);
  assert.match(sql, /p_guardian_phone text default null/);
  assert.match(sql, /not public\.is_admin\(\)/);
  assert.match(sql, /revoke all on function public\.admin_create_student\(uuid,text,text,text,text,text\[\],text,text,text,text\) from public, anon/);
  assert.match(sql, /revoke all on function public\.admin_update_student_form_profile\(uuid,jsonb\) from public, anon/);
  assert.doesNotMatch(sql, /\bdelete from\b|\btruncate\b|drop table/i, "schema-only migration");
  const students = read("src/lib/admin/students.ts");
  assert.match(students, /p_guardian_phone: studentPhonePayload\(input\.guardianPhone\)/);
  assert.match(students, /changes\.contact_guardian_phone = studentPhonePayload\(input\.guardianPhone\)/);
  assert.match(read("src/types/database.types.ts"), /contact_guardian_phone/);
  assert.match(read("src/components/admin/StudentDetailSheet.tsx"), /const waPhone = student\.phone \|\| student\.guardianPhone;/);
});

test("ADMIN: blog route, refund icon, no Kopyala", () => {
  assert.match(read("src/app/admin/page.tsx"), /router\.push\("\/admin\/blog\/"\)/);
  const payments = read("src/app/admin/odemeler/page.tsx");
  assert.match(payments, /data-tip="İade et"/);
  assert.doesNotMatch(payments, />Kopyala</);
});

test("STUDENT DETAIL: payment history and completed lessons", () => {
  const manager = read("src/components/admin/StudentLearningManager.tsx");
  assert.match(manager, /RefCompletedLessonList/);
  assert.match(manager, /paymentMethodLabel\(payment\.payment_method\)/);
  assert.match(manager, /Ödeme şekli:/);
});

test("STUDENT DETAIL: section and package headings use the serif display font", () => {
  const css = read("src/components/admin/student-detail.module.css");
  // `.admin-shell hN` (sans) Tailwind `.font-heading`'i ezer; kapsamlı kural serif'i geri getirir.
  assert.match(css, /\.scope :is\(h1, h2, h3, h4, h5, h6\):global\(\.font-heading\) \{ font-family: var\(--font-newsreader\)/);
  const manager = read("src/components/admin/StudentLearningManager.tsx");
  for (const heading of ["Eğitim Paketleri & Ders Hakları", "Aktif Paketler", "Ödeme Geçmişi", "Ders Yönetimi", "Yapılan Dersler", "Özel Yönetici Notu", "Kayıtlı Notlar"]) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&");
    assert.match(manager, new RegExp(`<h[2-4] className=\\{?[\`"]font-heading[^>]*>\\s*(?:\\{[^}]*\\}\\s*)?${escaped}`), `${heading} must be a font-heading heading`);
  }
});

console.log(`\nFINAL CUSTOMER REVISIONS: ${count}/${count} passed`);
