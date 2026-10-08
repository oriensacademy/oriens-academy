// Denetim merkezi saf fonksiyon testleri (ağ / veritabanı yok).
// Çalıştırma: npm run test:audit:logic
import { readFileSync } from "node:fs";
import {
  AUDIT_CATEGORIES,
  AUDIT_CATEGORY_LABELS,
  REDACTED,
  auditEntityLabel,
  auditHighlights,
  auditSentence,
  auditTitle,
  buildTermActions,
  formatAuditDateTime,
  formatAuditListDate,
  formatMoney,
  isSecretKey,
  loginReasonLabel,
  maskEmail,
  maskPhone,
  redactMetadata,
  shortId,
  summarizeUserAgent,
  turkishAccusative,
} from "../src/lib/admin/audit-catalog";
import { loginFailureReason } from "../src/lib/auth/login-events";

let passed = 0;
const failures: string[] = [];
function check(name: string, condition: unknown, detail?: unknown) {
  if (condition) passed += 1;
  else failures.push(`${name}${detail === undefined ? "" : ` → ${JSON.stringify(detail)}`}`);
}

// ---- SANITIZATION ----------------------------------------------------------
const secretKeys = [
  "password", "new_password", "password_hash", "otp", "otp_code", "reset_token", "access_token", "refresh_token",
  "authorization", "Authorization", "cookie", "set_cookie", "service_role_key", "client_secret", "merchant_key",
  "merchant_salt", "card_number", "cvv", "cvc", "paytr_token", "iframe_token", "code", "verification_code", "pin",
  "payload", "raw_body", "headers", "jwt", "bearer", "signature", "api_key", "apikey", "private_key", "credentials",
];
for (const key of secretKeys) check(`secret key ${key}`, isSecretKey(key));
for (const key of ["email", "amount", "public_reference", "lesson_count", "status", "device", "reason", "provider_status", "attempt_number"]) {
  check(`safe key ${key}`, !isSecretKey(key));
}

const dirty = {
  amount_kurus: 150000,
  password: "hunter2",
  nested: { access_token: "abc", list: [{ cvv: "123", ok: 1 }], parent_phone: "+90 532 123 45 67" },
  note: "Bearer abc.def.ghi",
  jwtish: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig",
  headers: { authorization: "x" },
};
const clean = redactMetadata(dirty) as Record<string, unknown>;
const cleanText = JSON.stringify(clean);
check("redact password", (clean as { password: string }).password === REDACTED);
check("redact nested token", ((clean.nested as Record<string, unknown>).access_token) === REDACTED);
check("redact array cvv", cleanText.includes('"cvv":"[gizlendi]"') && cleanText.includes('"ok":1'));
check("mask nested phone", !cleanText.includes("123 45 67") && cleanText.includes("**67"), cleanText);
check("redact bearer value", clean.note === REDACTED);
check("redact jwt value", clean.jwtish === REDACTED);
check("redact headers wholesale", clean.headers === REDACTED);
check("keep safe numbers", clean.amount_kurus === 150000);
const changeSet = JSON.stringify(redactMetadata([{ table: "guardian_accounts", changes: { phone: { old: "+90 532 123 45 67", new: "05329876543" }, full_name: { old: "A", new: "B" } } }]));
check("mask nested before/after phone", !changeSet.includes("123 45 67") && !changeSet.includes("9876543") && changeSet.includes('"new":"B"'), changeSet);
check("no secret survives", !/hunter2|"abc"|"123"/.test(cleanText), cleanText);
check("deep nesting capped", JSON.stringify(redactMetadata(JSON.parse("[".repeat(20) + "1" + "]".repeat(20)))).includes(REDACTED));

// SQL ile istemci aynı gizli anahtar kuralını kullanmalı (çift savunma tutarlılığı).
const migration = readFileSync(new URL("../supabase/migrations/20261007130000_admin_audit_center.sql", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../src/lib/admin/audit-catalog.ts", import.meta.url), "utf8");
const sqlPattern = migration.match(/p_key ~\* '([^']+)'/)?.[1];
const tsPattern = catalogSource.match(/const SECRET_KEY = \/(.+)\/i;/)?.[1];
check("SQL/TS secret regex parity", sqlPattern && sqlPattern === tsPattern, { sqlPattern, tsPattern });
const sqlExact = migration.match(/lower\(p_key\) in \(([^)]+)\)/)?.[1]?.split(",").map((part) => part.trim().replace(/'/g, "")).sort();
const tsExact = catalogSource.match(/SECRET_EXACT = new Set\(\[([^\]]+)\]\)/)?.[1]?.split(",").map((part) => part.trim().replace(/"/g, "")).sort();
check("SQL/TS exact secret list parity", JSON.stringify(sqlExact) === JSON.stringify(tsExact), { sqlExact, tsExact });

// ---- MASKING ---------------------------------------------------------------
check("maskEmail", maskEmail("mert@example.com") === "m***@example.com", maskEmail("mert@example.com"));
check("maskEmail null", maskEmail(null) === null);
check("maskEmail malformed", maskEmail("@x") === "***");
check("maskPhone +90", maskPhone("+90 532 123 45 67") === "+90 5** *** **67", maskPhone("+90 532 123 45 67"));
check("maskPhone 0", maskPhone("05321234567") === "05** *** **67", maskPhone("05321234567"));
check("maskPhone idempotent", maskPhone("+90 5** *** **67") === "+90 5** *** **67");
check("maskPhone short", maskPhone("12") === "***");

// ---- TITLES / SENTENCES ----------------------------------------------------
check("all category labels", AUDIT_CATEGORIES.every((category) => Boolean(AUDIT_CATEGORY_LABELS[category])));
check("title login", auditTitle("auth.login") !== "Sistem olayı", auditTitle("auth.login"));
check("title unknown error", auditTitle("x.unknown", "error") === "Sistem hatası");
check("title unknown", auditTitle("x.unknown") === "Sistem olayı");

const paid = auditSentence({ action: "payment_completed", subject_name: "Ayşe Yılmaz", student_name: "Can Yılmaz", package_name: "5 Derslik Paket" });
check("sentence payment", paid === "Can Yılmaz için başlatılan ödeme başarıyla tamamlandı (5 Derslik Paket).", paid);
const login = auditSentence({ action: "auth.login", subject_name: "Ayşe Yılmaz", actor_role: "veli" });
check("sentence login", login === "Ayşe Yılmaz giriş yaptı.", login);
const adminLogin = auditSentence({ action: "auth.login", subject_name: "Mert", actor_role: "admin" });
check("sentence admin login", adminLogin === "Mert yönetim paneline giriş yaptı.", adminLogin);
const failed = auditSentence({ action: "auth.login_failed", subject_email: "ayse@example.com", login_reason: "invalid_credentials" });
check("sentence login failed masks email", failed.startsWith("a***@example.com giriş yapamadı: hatalı"), failed);
const mail = auditSentence({ action: "email.sent", mail_recipient: "veli@example.com", mail_template: "welcome" });
check("sentence mail masked", mail === "Hoş geldiniz maili v***@example.com adresine gönderildi.", mail);
check("sentence never leaks full recipient", !mail.includes("veli@example.com"));

// ---- ENTITY LABEL ----------------------------------------------------------
check("entity payment", auditEntityLabel({ action: "payment_completed", public_reference: "ORI-ABC123" }) === "Ödeme ORI-ABC123");
check("entity mail", auditEntityLabel({ action: "email.sent", feed_category: "mail", mail_template: "welcome" }) === "Mail: Hoş geldiniz maili");
check("entity lesson", auditEntityLabel({ action: "lesson_completed", feed_category: "lesson", lesson_title: "Matematik" }) === "Ders: Matematik");
check("entity login device", auditEntityLabel({ action: "auth.login", login_device: "Chrome 140 · Windows · Masaüstü" }) === "Chrome 140 · Windows · Masaüstü");

// ---- SEARCH (terim → olay anahtarı) ----------------------------------------
const giris = buildTermActions("giriş");
check("search giriş → auth.login", Boolean(giris && Object.values(giris).flat().includes("auth.login")), giris);
const odeme = buildTermActions("ODEME");
check("search ODEME folds Turkish", Boolean(odeme && Object.values(odeme).flat().some((action) => action.startsWith("payment"))), odeme);
check("search short terms ignored", buildTermActions("ab") === null);
check("search empty", buildTermActions("   ") === null);

// ---- LOGIN DETAIL ----------------------------------------------------------
const chromeWin = summarizeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36");
check("UA chrome windows", chromeWin === "Chrome 140 · Windows · Masaüstü", chromeWin);
const iphone = summarizeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1");
check("UA safari iphone", iphone === "Safari 18 · iOS · Mobil", iphone);
const edge = summarizeUserAgent("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0.1");
check("UA edge", edge.startsWith("Edge 140"), edge);
const tablet = summarizeUserAgent("Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/139.0 Safari/537.36");
check("UA android tablet", tablet === "Chrome 139 · Android · Tablet", tablet);
check("UA empty", summarizeUserAgent("") === "Tarayıcı · Masaüstü");
check("UA max 80", summarizeUserAgent("x".repeat(400)).length <= 80);
check("login reason label", loginReasonLabel("rate_limited")?.includes("Çok fazla deneme"));
check("login reason unknown → other", loginReasonLabel("zzz") === "Diğer hata");
check("login reason null", loginReasonLabel(null) === null);
check("supabase code invalid_credentials", loginFailureReason("invalid_credentials") === "invalid_credentials");
check("supabase code rate limit", loginFailureReason("over_request_rate_limit") === "rate_limited");
check("supabase code ignored", loginFailureReason("unexpected_failure") === null && loginFailureReason(undefined) === null);

// ---- PAYMENT / MAIL / LESSON DETAIL (highlights) ---------------------------
const callback = auditHighlights("paytr_callback_received", "payment", "success", { provider_status: "success", amount_kurus: 250000, coupon_used: true, paytr_token: "x" });
check("payment callback result", callback.items.some(([label, value]) => label === "PayTR sonucu" && value === "Başarılı"), callback);
check("payment amount from kuruş", callback.items.some(([label, value]) => label === "Tutar (olay anı)" && value.includes("2.500")), callback);
check("payment coupon", callback.items.some(([label]) => label === "Kupon"));
check("payment highlights no token", !JSON.stringify(callback).includes("paytr_token"));
const mismatch = auditHighlights("paytr_callback_amount_mismatch", "payment", "error", { expected_amount_kurus: 100000, received_amount_kurus: 90000 });
check("payment mismatch error", Boolean(mismatch.error?.includes("Beklenen")), mismatch);
const payFail = auditHighlights("payment_status_failed", "payment", "error", { failed_reason_msg: "Yetersiz bakiye", failed_reason_code: "51" });
check("payment failure reason", payFail.error === "Yetersiz bakiye (kod 51)", payFail);
const mailFail = auditHighlights("email.failed", "mail", "error", { attempt_number: 3, safe_error_code: "gmail_quota" });
check("mail attempt", mailFail.items.some(([label, value]) => label === "Deneme" && value === "3. deneme"), mailFail);
check("mail error text", Boolean(mailFail.error), mailFail);
const lesson = auditHighlights("lesson_completed", "lesson", "success", { old_remaining: 5, new_remaining: 4 });
check("lesson rights 5→4", lesson.items.some(([label, value]) => label === "Kalan hak" && value === "5 → 4"), lesson);
const assigned = auditHighlights("package_assigned", "package", "success", { lesson_count: 8 });
check("package +8", assigned.items.some(([, value]) => value === "+8 ders"), assigned);

// ---- BEFORE / AFTER (changed_fields) ---------------------------------------
const changed = auditHighlights("guardian_updated", "student", "info", { changed_fields: ["full_name", "phone", "password_hash"] });
const changedValue = changed.items.find(([label]) => label === "Değişen alanlar")?.[1] ?? "";
check("changed fields listed", changedValue.length > 0 && !changedValue.includes("password"), changed);

// ---- CART / CHECKOUT ------------------------------------------------------
const cartMeta = { cart_id: "6f1c2a9e-0000-4000-8000-00000000ca01", package_id: "pkg5", package_name: "5 Derslik Paket", lesson_count: 5, price: 4500, currency: "TRY", quantity: 1, item_count: 1, total: 4500, source: "pricing" };
check("title cart add", auditTitle("cart_item_added") === "Sepete paket eklendi");
check("title cart remove", auditTitle("cart_item_removed") === "Sepetten paket çıkarıldı");
check("title cart clear", auditTitle("cart_cleared") === "Sepet temizlendi");
check("title checkout started", auditTitle("checkout_started") === "Ödeme başlatıldı");
check("title checkout opened", auditTitle("checkout_opened") === "Ödeme sayfası görüntülendi");
check("title session distinct from checkout", auditTitle("payment_session_requested") !== auditTitle("checkout_started"));
check("accusative Paket'i", turkishAccusative("5 Derslik Paket") === "5 Derslik Paket'i", turkishAccusative("5 Derslik Paket"));
check("accusative vowel end", turkishAccusative("Deneme Dersi") === "Deneme Dersi'ni", turkishAccusative("Deneme Dersi"));
const addSentence = auditSentence({ action: "cart_item_added", subject_name: "Murat Küçükarslan", package_name: "5 Derslik Paket", metadata: cartMeta });
check("sentence cart add (customer example)", addSentence === "Murat Küçükarslan, 5 Derslik Paket'i sepete ekledi.", addSentence);
const removeSentence = auditSentence({ action: "cart_item_removed", subject_name: "Murat Küçükarslan", package_name: "10 Derslik Paket", metadata: { ...cartMeta, package_name: "10 Derslik Paket" } });
check("sentence cart remove", removeSentence === "Murat Küçükarslan, 10 Derslik Paket'i sepetten çıkardı.", removeSentence);
const clearSentence = auditSentence({ action: "cart_cleared", subject_name: "Murat Küçükarslan", metadata: { package_name: "5 Derslik Paket, 10 Derslik Paket", item_count: 2, total: 13000, currency: "TRY" } });
check("sentence cart clear lists packages", clearSentence.includes("sepeti temizledi") && clearSentence.includes("2 paket: 5 Derslik Paket, 10 Derslik Paket"), clearSentence);
const startSentence = auditSentence({ action: "checkout_started", subject_name: "Murat Küçükarslan", student_name: "Can Küçükarslan", metadata: { package_name: "5 Derslik Paket", item_count: 1, total: 4050, currency: "TRY", result: "session_created" } });
check("sentence checkout started with total", startSentence.startsWith("Murat Küçükarslan ödeme başlattı — 5 Derslik Paket · toplam") && startSentence.includes("4.050") && startSentence.includes("Can Küçükarslan"), startSentence);
const failSentence = auditSentence({ action: "checkout_started", subject_name: "Murat Küçükarslan", metadata: { package_name: "5 Derslik Paket", result: "session_failed", error_code: "NETWORK_ERROR" } });
check("sentence checkout failed", failSentence.includes("oluşturulamadı"), failSentence);
const cartHighlights = auditHighlights("cart_item_added", "payment", "info", cartMeta);
const hl = Object.fromEntries(cartHighlights.items);
check("highlights cart add: package/lessons/price/qty/cart id", hl["Paket"] === "5 Derslik Paket" && hl["Ders sayısı"] === "5 ders" && hl["Fiyat"]?.includes("4.500") && hl["Adet"] === "1" && hl["Sepet ID"]?.startsWith("6f1c2a9e") && hl["Ekran"] === "Paketler sayfası", cartHighlights);
const startHl = auditHighlights("checkout_started", "payment", "info", { package_name: "5 Derslik Paket", lesson_count: 5, item_count: 1, price: 4500, subtotal: 4500, discount: 450, total: 4050, coupon_code: "YAZ10", currency: "TRY", result: "session_created" });
const shl = Object.fromEntries(startHl.items);
check("highlights checkout: coupon/discount/total/result", shl["Kupon"] === "YAZ10" && shl["İndirim"]?.includes("450") && shl["Ödenecek tutar"]?.includes("4.050") && shl["Sonuç"] === "Ödeme oturumu oluşturuldu" && !startHl.error, startHl);
const failHl = auditHighlights("checkout_started", "payment", "warning", { package_name: "5 Derslik Paket", result: "session_failed", error_code: "NETWORK_ERROR" });
check("highlights checkout failure error", failHl.error === "Ödeme başlatılamadı (kod NETWORK_ERROR)", failHl);
check("entity label cart", auditEntityLabel({ action: "cart_item_added", entity_type: "cart", package_name: "5 Derslik Paket", feed_category: "payment" }) === "Sepet: 5 Derslik Paket");
check("entity label checkout with payment", auditEntityLabel({ action: "checkout_started", entity_type: "cart", public_reference: "ORI-CART1", feed_category: "payment" }) === "Ödeme ORI-CART1");
const sepetTerms = buildTermActions("sepet");
check("term search 'sepet' → cart actions", Boolean(sepetTerms?.sepet?.includes("cart_item_added") && sepetTerms?.sepet?.includes("cart_item_removed") && sepetTerms?.sepet?.includes("cart_cleared")), sepetTerms);
const startTerms = buildTermActions("ödeme başlatıldı");
check("term search 'ödeme başlatıldı' → checkout_started", Boolean(startTerms && Object.values(startTerms).some((actions) => actions.includes("checkout_started"))), startTerms);
const cartRedacted = JSON.stringify(redactMetadata({ ...cartMeta, coupon_code: "YAZ10", error_code: "NETWORK_ERROR", items: [{ package_id: "pkg5", price: 4500 }], card_number: "4111", iframe_token: "x" }));
check("cart metadata keeps business fields, redacts secrets", cartRedacted.includes('"coupon_code":"YAZ10"') && cartRedacted.includes('"price":4500') && cartRedacted.includes('"cart_id"') && !cartRedacted.includes("4111") && !cartRedacted.includes('"x"'), cartRedacted);

// ---- FORMAT ----------------------------------------------------------------
const when = formatAuditDateTime("2026-10-07T11:32:08Z");
check("datetime Istanbul with seconds", when === "Çarşamba, 7 Ekim 2026 · 14:32:08", when);
const listDate = formatAuditListDate("2026-10-07T11:32:08Z");
check("list date parts", listDate.time === "14:32" && listDate.date.includes("Eki"), listDate);
check("money TRY", formatMoney(2500, "TRY")?.includes("2.500"), formatMoney(2500, "TRY"));
check("money null", formatMoney(null) === null || formatMoney(null) === "" || formatMoney(null) === "—", formatMoney(null));
check("shortId", shortId("12345678-aaaa-bbbb") === "12345678…" && shortId("abc") === "abc");

console.log(`audit-center ui logic: ${passed} PASS, ${failures.length} FAIL`);
for (const failure of failures) console.log(`  FAIL ${failure}`);
process.exit(failures.length ? 1 : 0);
