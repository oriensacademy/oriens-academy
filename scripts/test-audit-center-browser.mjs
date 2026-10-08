// Denetim merkezi tarayıcı testi: `out/` statik derlemesi + tamamen sahte Supabase.
// Gerçek ağ isteği / mutasyon yok. Önce `npm run build`, sonra: npm run test:audit:browser
// Canlı statik dosyalarla (Supabase yine sahte): AUDIT_QA_BASE_URL=https://oriens-academy.com
import assert from "node:assert/strict";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const OUT = join(process.cwd(), "out");
const REMOTE_BASE = (process.env.AUDIT_QA_BASE_URL || "").replace(/\/$/, "");
if (!REMOTE_BASE && !existsSync(join(OUT, "admin", "denetim", "index.html"))) {
  console.error("out/admin/denetim/index.html yok — önce `npm run build` çalıştırın.");
  process.exit(1);
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon" };
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://x").pathname);
  let file = normalize(join(OUT, pathname));
  if (!file.startsWith(OUT)) { response.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
  if (!existsSync(file)) { response.writeHead(404, { "Content-Type": "text/html" }); createReadStream(join(OUT, "404.html")).pipe(response); return; }
  response.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = REMOTE_BASE || `http://127.0.0.1:${server.address().port}`;
const allowedOrigin = new URL(baseUrl).origin;

const supabaseUrl = readFileSync(".env.local", "utf8").match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "") || "";
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const adminId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const nowSec = Math.floor(Date.now() / 1000);
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const adminUser = { id: adminId, aud: "authenticated", role: "authenticated", email: "admin@oriens-academy.com", email_confirmed_at: new Date().toISOString(), app_metadata: { role: "admin", provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: new Date().toISOString() };
const adminSession = { access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ aud: "authenticated", exp: nowSec + 3600, sub: adminId, role: "authenticated" })}.qa`, token_type: "bearer", expires_in: 3600, expires_at: nowSec + 3600, refresh_token: "qa-refresh", user: adminUser };
const adminProfile = { user_id: adminId, display_name: "QA Yönetici", role: "admin", active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };

// ---- Sahte veri -------------------------------------------------------------
const PARENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STUDENT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PAYMENT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CORR = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const SECRET_MARKERS = ["hunter2", "SHOULD_NOT_APPEAR", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJxYSJ9.c2ln", "4111111111111111"];
const base = Date.parse("2026-10-07T09:00:00Z");

function row(index, overrides = {}) {
  const kinds = [
    { action: "payment_completed", feed_category: "payment", feed_status: "success", entity_type: "payment", public_reference: "ORI-QA0001", amount: 2500, currency: "TRY", package_name: "5 Derslik Paket" },
    { action: "auth.login", feed_category: "auth", feed_status: "success", source: "login", login_device: "Chrome 140 · Windows · Masaüstü" },
    { action: "email.sent", feed_category: "mail", feed_status: "success", entity_type: "notification_delivery", mail_template: "welcome", mail_recipient: "ayse.yilmaz@example.com", mail_status: "sent" },
    { action: "auth.login_failed", feed_category: "auth", feed_status: "error", source: "login", login_reason: "invalid_credentials" },
    { action: "lesson.completed", feed_category: "lesson", feed_status: "success", lesson_title: "Matematik", lesson_id: "ffffffff-ffff-4fff-8fff-ffffffffffff" },
  ];
  const kind = kinds[index % kinds.length];
  const source = kind.source ?? "audit";
  return {
    event_id: `${source === "login" ? "l" : "a"}${index + 1}`,
    source,
    created_at: new Date(base - index * 60_000).toISOString(),
    action: kind.action,
    raw_category: kind.feed_category,
    severity: kind.feed_status === "error" ? "error" : "info",
    feed_category: kind.feed_category,
    feed_status: kind.feed_status,
    correlation_id: kind.feed_category === "payment" || kind.feed_category === "mail" ? CORR : null,
    entity_type: kind.entity_type ?? null,
    entity_id: kind.entity_type === "payment" ? "ORI-QA0001" : null,
    actor_user_id: PARENT,
    actor_name: "Ayşe Yılmaz",
    actor_role: "veli",
    actor_email: "ayse.yilmaz@example.com",
    subject_user_id: PARENT,
    subject_name: "Ayşe Yılmaz",
    subject_email: "ayse.yilmaz@example.com",
    subject_role: "veli",
    student_id: STUDENT,
    student_name: "Can Yılmaz",
    payment_id: kind.feed_category === "payment" ? PAYMENT : null,
    public_reference: kind.public_reference ?? null,
    provider_transaction_id: kind.feed_category === "payment" ? "PTR-998877" : null,
    amount: kind.amount ?? null,
    currency: kind.currency ?? null,
    payment_status: kind.feed_category === "payment" ? "paid" : null,
    purchase_id: null,
    package_name: kind.package_name ?? null,
    lesson_id: kind.lesson_id ?? null,
    lesson_title: kind.lesson_title ?? null,
    delivery_id: kind.feed_category === "mail" ? "99999999-9999-4999-8999-999999999999" : null,
    mail_recipient: kind.mail_recipient ?? null,
    mail_template: kind.mail_template ?? null,
    mail_event_type: kind.mail_template ? "account.welcome" : null,
    mail_status: kind.mail_status ?? null,
    mail_error_code: null,
    login_device: kind.login_device ?? null,
    login_reason: kind.login_reason ?? null,
    metadata: { source: "qa" },
    ...overrides,
  };
}
const ALL_ROWS = Array.from({ length: 120 }, (_, index) => row(index));

// Sepet / ödeme başlangıcı olayları (yalnız aramada döner; mevcut sayım testleri değişmez).
const CART = "c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4";
const cartBase = { feed_category: "payment", raw_category: "payment", feed_status: "info", severity: "info", entity_type: "cart", entity_id: CART, correlation_id: CART, payment_id: null, public_reference: null, provider_transaction_id: null, amount: null, currency: null, payment_status: null };
const CART_ROWS = [
  row(0, { ...cartBase, event_id: "a901", action: "cart_item_added", created_at: new Date(base - 600_000).toISOString(), package_name: "5 Derslik Paket", subject_name: "Murat Küçükarslan", actor_name: "Murat Küçükarslan", subject_email: "murat.k@example.com", actor_email: "murat.k@example.com",
    metadata: { cart_id: CART, guardian_user_id: PARENT, student_id: STUDENT, package_id: "pkg5", package_name: "5 Derslik Paket", lesson_count: 5, price: 4500, currency: "TRY", quantity: 1, item_count: 1, total: 4500, source: "pricing", created_at: new Date(base - 600_000).toISOString() } }),
  row(0, { ...cartBase, event_id: "a902", action: "checkout_started", created_at: new Date(base - 300_000).toISOString(), payment_id: PAYMENT, public_reference: "ORI-QA0001", package_name: "5 Derslik Paket, 10 Derslik Paket", subject_name: "Murat Küçükarslan", actor_name: "Murat Küçükarslan", subject_email: "murat.k@example.com", actor_email: "murat.k@example.com",
    metadata: { cart_id: CART, guardian_user_id: PARENT, student_id: STUDENT, package_name: "5 Derslik Paket, 10 Derslik Paket", lesson_count: 15, currency: "TRY", item_count: 2, subtotal: 13000, discount: 1300, total: 11700, coupon_code: "EKIM10", transaction_id: PAYMENT, public_reference: "ORI-QA0001", result: "session_created", source: "payment", card_number: "4111111111111111", iframe_token: "SHOULD_NOT_APPEAR",
      items: [{ package_id: "pkg5", package_name: "5 Derslik Paket", lesson_count: 5, price: 4500, discount: 450, final: 4050, currency: "TRY", quantity: 1 }, { package_id: "pkg10", package_name: "10 Derslik Paket", lesson_count: 10, price: 8500, discount: 850, final: 7650, currency: "TRY", quantity: 1 }] } }),
];
const CART_CHAIN = ["cart_item_added", "checkout_opened", "checkout_started", "payment_session_requested", "paytr_callback_received", "payment_status_paid", "package.assigned", "email.queued", "email.sent"];
const cartTimeline = CART_CHAIN.map((action, index) => ({
  event_id: action === "cart_item_added" ? "a901" : action === "checkout_started" ? "a902" : action === "payment_status_paid" ? "a1" : `a${950 + index}`,
  created_at: new Date(base - 600_000 + index * 60_000).toISOString(), action,
  feed_category: action.startsWith("email") ? "mail" : action === "package.assigned" ? "package" : "payment",
  feed_status: action === "payment_status_paid" || action === "email.sent" ? "success" : "info",
  actor_name: "Murat Küçükarslan", actor_role: "veli", subject_name: "Murat Küçükarslan", package_name: index < 3 ? "5 Derslik Paket" : null,
  mail_recipient: null, mail_template: action.startsWith("email") ? "payment_success" : null, mail_event_type: null, metadata: {}, is_current: false,
}));

const timeline = [
  { id: "a1", action: "payment_completed", feed_category: "payment", feed_status: "success" },
  { id: "a3", action: "email.sent", feed_category: "mail", feed_status: "success" },
].map((item, index) => ({ event_id: item.id, created_at: new Date(base + index * 5000).toISOString(), action: item.action, feed_category: item.feed_category, feed_status: item.feed_status, actor_name: "Ayşe Yılmaz", actor_role: "veli", subject_name: "Ayşe Yılmaz", mail_recipient: item.id === "a3" ? "ayse.yilmaz@example.com" : null, mail_template: item.id === "a3" ? "welcome" : null, mail_event_type: null, is_current: false }));

const subject = { user_id: PARENT, name: "Ayşe Yılmaz", email: "ayse.yilmaz@example.com", role: "veli", email_verified_at: "2026-09-01T10:00:00Z", active: true, archived_at: null, created_at: "2026-09-01T09:00:00Z", students: [{ id: STUDENT, name: "Can Yılmaz", primary: true }] };

function detailFor(id) {
  const event = ALL_ROWS.find((item) => item.event_id === id) ?? CART_ROWS.find((item) => item.event_id === id);
  if (!event) return null;
  const detail = { event: { ...event }, actor: { user_id: PARENT, name: "Ayşe Yılmaz", email: "ayse.yilmaz@example.com", role: "veli" }, subject, payment: null, delivery: null, lesson: null, purchase: null, changes: [], lookups: {}, timeline: [] };
  if (event.entity_type === "cart") {
    const cartSubject = { ...subject, name: "Murat Küçükarslan", email: "murat.k@example.com" };
    const cartDetail = { ...detail, subject: cartSubject, actor: { user_id: PARENT, name: "Murat Küçükarslan", email: "murat.k@example.com", role: "veli" }, cart_id: CART, timeline: cartTimeline.map((item) => ({ ...item, is_current: item.event_id === id })) };
    if (event.action === "checkout_started") {
      cartDetail.payment = { ...detailFor("a1").payment, amount: 11700, coupon_code: "EKIM10", status: "pending", paid_at: null, callback: null, purchases: [], mails: [], package_name: "5 Derslik Paket",
        items: [{ package_id: "pkg5", package_name: "5 Derslik Paket", lesson_count: 5, price: 4500, discount: 450, final: 4050 }, { package_id: "pkg10", package_name: "10 Derslik Paket", lesson_count: 10, price: 8500, discount: 850, final: 7650 }] };
    }
    return cartDetail;
  }
  if (event.feed_category === "payment") {
    // Sunucu bunları zaten temizler; istemci ikinci savunma olarak yine temizlemeli.
    detail.event.metadata = { source: "paytr-callback", provider_status: "success", amount_kurus: 250000, password: "hunter2", paytr_token: "SHOULD_NOT_APPEAR", nested: { authorization: "Bearer SHOULD_NOT_APPEAR", card_number: "4111111111111111" }, note: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJxYSJ9.c2ln" };
    detail.payment = {
      id: PAYMENT, public_reference: "ORI-QA0001", provider: "paytr", provider_transaction_id: "PTR-998877", amount: 2500, currency: "TRY", status: "paid", payment_method: "card", installment_count: 1,
      payer_name: "Ayşe Yılmaz", payer_email: "ayse.yilmaz@example.com", created_at: "2026-10-07T08:58:00Z", paid_at: "2026-10-07T09:00:00Z", refunded_amount: null, refund_status: null, last_refunded_at: null, last_refund_reason: null,
      is_preload: false, is_archived: false, coupon_code: "EKIM10", discount_kurus: 27778, subtotal_kurus: 277778, final_total_kurus: 250000, learner_name: "Can Yılmaz", failed_reason_code: null, failed_reason_msg: null, test_mode: false,
      package_name: "5 Derslik Paket", callback: { at: "2026-10-07T08:59:58Z", provider_status: "success", event_id: "a1" },
      purchases: [{ id: "12121212-1212-4121-8121-121212121212", lesson_count: 5, lessons_used: 0, status: "active", payment_status: "paid", package_name: "5 Derslik Paket", created_at: "2026-10-07T09:00:01Z" }],
      mails: [{ id: "99999999-9999-4999-8999-999999999999", event_type: "payment.succeeded", template: "payment_success", recipient: "ayse.yilmaz@example.com", status: "sent", attempt_count: 1, created_at: "2026-10-07T09:00:02Z", sent_at: "2026-10-07T09:00:05Z", last_error_code: null }],
    };
    detail.timeline = timeline.map((item) => ({ ...item, is_current: item.event_id === id }));
  }
  if (event.feed_category === "mail") {
    detail.delivery = { id: "99999999-9999-4999-8999-999999999999", channel: "email", event_type: "account.welcome", template: "welcome", recipient: "ayse.yilmaz@example.com", subject: "Oriens Academy'ye hoş geldiniz", status: "sent", provider: "gmail", provider_message_id: "gmail-msg-qa-1", attempt_count: 1, max_attempts: 8, created_at: "2026-10-07T08:59:59Z", sent_at: "2026-10-07T09:00:04Z", next_attempt_at: null, last_error_code: null, last_error: null, dedupe_key: "welcome:qa", entity_type: "guardian_account", entity_id: PARENT, is_archived: false };
    detail.timeline = timeline.map((item) => ({ ...item, is_current: item.event_id === id }));
  }
  if (event.feed_category === "lesson") {
    detail.lesson = { id: event.lesson_id, title: "Matematik", subject: "Matematik", exam_code: "SAT", lesson_date: "2026-10-06T15:00:00Z", duration_minutes: 60, timezone_label: "Europe/Istanbul", status: "completed", completed_at: "2026-10-06T16:00:00Z", instructor: "Elif Hoca", topic: "Fonksiyonlar", student_id: STUDENT, student_name: "Can Yılmaz", package_name: "5 Derslik Paket", package_lesson_count: 5, package_lessons_used: 1, previous_remaining: 5, has_report: true, report_updated_at: "2026-10-06T16:30:00Z", report_email_sent_at: "2026-10-06T16:31:00Z", report_version: 1, is_archived: false };
    detail.changes = [{ table: "lessons", row_id: event.lesson_id, created_at: "2026-10-06T16:00:00Z", changes: { status: { old: "scheduled", new: "completed" }, parent_phone: { old: "+90 532 123 45 67", new: "+90 532 765 43 21" } } }];
  }
  return detail;
}

// ---- Tarayıcı ---------------------------------------------------------------
const feedCalls = [];
const detailCalls = [];
const otherRpc = [];
const writes = [];
let passed = 0;
const step = async (name, fn) => { await fn(); passed += 1; console.log(`  PASS ${name}`); };
const SHOTS = process.env.AUDIT_QA_SHOTS || ""; // isteğe bağlı: ekran görüntüsü klasörü
const shot = (target, name) => (SHOTS ? target.screenshot({ path: join(SHOTS, `${name}.png`) }) : Promise.resolve());

async function setup(context) {
  await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: `sb-${projectRef}-auth-token`, value: adminSession });
  // Dış dünya kapalı: yalnız sayfanın kendi kökeni (yerel sunucu veya canlı statik dosyalar).
  await context.route((url) => url.origin !== allowedOrigin, (route) => route.abort());
  await context.route(`${supabaseUrl}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/auth/v1/user")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(adminUser) });
    if (url.pathname.startsWith("/auth/v1/")) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const name = url.pathname.split("/rpc/")[1];
      const body = request.postDataJSON() ?? {};
      if (name === "admin_audit_feed") {
        feedCalls.push(body);
        let list = ALL_ROWS;
        if (body.p_category) list = list.filter((item) => item.feed_category === body.p_category);
        if (body.p_status) list = list.filter((item) => item.feed_status === body.p_status);
        if (body.p_search) {
          list = [...CART_ROWS, ...list];
          const actions = Object.values(body.p_term_actions ?? {}).flat();
          list = list.filter((item) => actions.includes(item.action) || JSON.stringify(item).toLocaleLowerCase("tr").includes(String(body.p_search).toLocaleLowerCase("tr")));
        }
        const total = list.length;
        const pageRows = list.slice(body.p_offset ?? 0, (body.p_offset ?? 0) + (body.p_limit ?? 50)).map((item) => ({ ...item, total_count: total }));
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageRows) });
      }
      if (name === "admin_audit_stats") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ since: new Date(base).toISOString(), total: 37, failed: 4, payments_paid: 3, payment_events: 9, logins: 12, login_failures: 2, mails_sent: 11, mails_failed: 1 }) });
      }
      if (name === "admin_audit_detail") {
        detailCalls.push(body.p_event_id);
        const detail = detailFor(body.p_event_id);
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(detail) });
      }
      otherRpc.push(name);
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.split("/rest/v1/")[1];
      if (request.method() !== "GET" && request.method() !== "HEAD") writes.push(`${request.method()} ${table}`);
      const wantsSingle = request.headers().accept?.includes("application/vnd.pgrst.object+json");
      const rows = table === "admin_profiles" ? [adminProfile] : [];
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "Content-Range": rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0" }, body: JSON.stringify(wantsSingle ? rows[0] ?? null : rows) });
    }
    if (url.pathname.startsWith("/functions/v1/")) {
      writes.push(`FUNCTION ${url.pathname}`);
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

const browser = await chromium.launch({ headless: true });
const pageErrors = [];
try {
  console.log("audit-center browser QA");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR", timezoneId: "Europe/Istanbul" });
  await setup(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  const rows = page.locator(".ak-rows > li");
  const drawer = page.locator("aside.ak-drawer");

  await page.goto(`${baseUrl}/admin/denetim/`);
  await rows.first().waitFor({ timeout: 30_000 });

  await step("AUDIT LIST: 50 satır, sunucu sayfalama", async () => {
    assert.equal(await rows.count(), 50);
    assert.equal(feedCalls.at(-1).p_limit, 50);
    assert.equal(feedCalls.at(-1).p_offset, 0);
    const first = await rows.first().innerText();
    assert.match(first, /Ayşe Yılmaz/);
    assert.match(first, /a\*\*\*@example\.com/, "listede e-posta maskeli olmalı");
    assert.doesNotMatch(first, /ayse\.yilmaz@example\.com/, "listede tam e-posta görünmemeli");
    assert.match(first, /Ödeme/);
    assert.match(first, /Başarılı/);
    assert.match(first, /ORI-QA0001/);
  });

  await step("STATS: veritabanı sayıları (demo değil)", async () => {
    const statsText = await page.locator('[aria-label="Bugünün özeti"]').innerText();
    for (const value of ["37", "4", "12"]) assert.ok(statsText.includes(value), `istatistik ${value} yok: ${statsText}`);
  });

  await page.waitForTimeout(1500);
  await rows.first().waitFor();
  await shot(page, "desktop-list");
  await step("PAGINATION: Sonraki → offset 50, Önceki → 0", async () => {
    await page.getByRole("button", { name: /Sonraki/ }).click();
    await page.locator(".ak-pager").getByText(/51–100 \/ 120/).waitFor();
    assert.equal(feedCalls.at(-1).p_offset, 50);
    await page.getByRole("button", { name: /Önceki/ }).click();
    await page.locator(".ak-pager").getByText(/1–50 \/ 120/).waitFor();
  });

  await step("FILTER: kategori çipi sunucuya gider, sayfa sıfırlanır", async () => {
    await page.getByRole("button", { name: /Sonraki/ }).click();
    await page.locator(".ak-pager").getByText(/51–100/).waitFor();
    await page.locator('[aria-label="Kategori"]').getByRole("button", { name: /^Ödeme/ }).click();
    await page.waitForFunction(() => document.querySelectorAll(".ak-rows > li").length === 24);
    const last = feedCalls.at(-1);
    assert.equal(last.p_category, "payment");
    assert.equal(last.p_offset, 0, "filtre değişince ilk sayfaya dönmeli");
    await page.locator('[aria-label="Kategori"]').getByRole("button", { name: /^Tümü/ }).click();
    await page.waitForFunction(() => document.querySelectorAll(".ak-rows > li").length === 50);
    await page.locator("#dn-durum").selectOption("error");
    await page.waitForFunction(() => document.querySelectorAll(".ak-rows > li").length === 24);
    assert.equal(feedCalls.at(-1).p_status, "error");
    await page.locator("#dn-durum").selectOption("");
    await page.waitForFunction(() => document.querySelectorAll(".ak-rows > li").length === 50);
  });

  await step("SEARCH: debounce + Türkçe terim → olay anahtarı", async () => {
    const before = feedCalls.length;
    await page.locator("#dn-q").pressSequentially("giriş", { delay: 40 });
    await page.waitForTimeout(900);
    const searchCalls = feedCalls.slice(before).filter((call) => call.p_search);
    assert.equal(searchCalls.length, 1, `yazarken her tuşta istek atılmamalı (${searchCalls.map((call) => call.p_search).join(",")})`);
    assert.equal(searchCalls[0].p_search, "giriş");
    assert.ok(Object.values(searchCalls[0].p_term_actions ?? {}).flat().includes("auth.login"));
    await page.locator("#dn-q").fill("");
    await page.waitForFunction(() => document.querySelectorAll(".ak-rows > li").length === 50);
  });

  await step("DETAIL DRAWER: ödeme satırı → ayrıntılı inceleme", async () => {
    await rows.first().locator("button").click();
    await drawer.waitFor();
    await drawer.getByRole("heading", { name: "Ödeme", level: 3 }).waitFor();
    assert.match(page.url(), /[?&]log=a1\b/);
    const text = await drawer.innerText();
    for (const expected of ["Ayşe Yılmaz", "ayse.yilmaz@example.com", "Can Yılmaz", "5 Derslik Paket", "ORI-QA0001", "PTR-998877", "EKIM10", "+5 ders", "İlgili Kullanıcı", "İlgili İşlem Akışı", "Teknik Detaylar"]) {
      assert.ok(text.includes(expected), `çekmecede "${expected}" yok`);
    }
    assert.match(text, /2\.500/, "tutar görünmeli");
    assert.match(text, /PayTR/i);
    assert.match(text, /:\d\d:\d\d/, "saniyeli zaman görünmeli");
    await drawer.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
    const box = await drawer.boundingBox();
    assert.ok(box.width >= 520 && box.width <= 640, `masaüstü genişlik 520–640 olmalı: ${box.width}`);
    await shot(page, "desktop-payment-drawer");
  });

  await step("SANITIZATION: gizli değerler hiçbir yerde yok", async () => {
    const tech = drawer.locator("details.ak-tech");
    assert.equal(await tech.evaluate((element) => element.open), false, "Teknik Detaylar varsayılan kapalı olmalı");
    await tech.locator("summary").click();
    const json = await drawer.locator(".ak-json").innerText();
    assert.match(json, /\[gizlendi\]/);
    const html = await page.content();
    for (const marker of SECRET_MARKERS) assert.ok(!html.includes(marker), `gizli değer sayfada: ${marker}`);
    assert.ok(!/cvv|kart numarası/i.test(await drawer.innerText()) || json.includes("[gizlendi]"));
  });

  await step("DEEP LINK: yenileme çekmeceyi yeniden açar, geri tuşu kapatır", async () => {
    await page.reload();
    await drawer.getByRole("heading", { name: "Ödeme", level: 3 }).waitFor({ timeout: 30_000 });
    await page.goto(`${baseUrl}/admin/denetim/`);
    await rows.first().waitFor();
    await rows.first().locator("button").click();
    await drawer.waitFor();
    await page.goBack();
    await drawer.waitFor({ state: "detached" });
    assert.doesNotMatch(page.url(), /log=/);
  });

  await step("TIMELINE: akıştaki mail adımı açılır", async () => {
    await rows.first().locator("button").click();
    await drawer.locator(".ak-tl").waitFor();
    await drawer.locator(".ak-tl li").nth(1).locator("button").click();
    await drawer.getByRole("heading", { name: "Mail", level: 3 }).waitFor();
    assert.match(page.url(), /log=a3\b/);
  });

  await step("MAIL DETAIL: tür, alıcı, sağlayıcı, deneme, konu", async () => {
    const text = await drawer.innerText();
    for (const expected of ["Hoş geldiniz", "ayse.yilmaz@example.com", "Gmail API", "1/8", "gmail-msg-qa-1", "Oriens Academy'ye hoş geldiniz"]) assert.ok(text.includes(expected), `mail ayrıntısında "${expected}" yok`);
    await page.keyboard.press("Escape");
    await drawer.waitFor({ state: "detached" });
  });

  await step("LOGIN DETAIL: kim, sonuç, cihaz, IP yok", async () => {
    await rows.nth(1).locator("button").click();
    await drawer.getByRole("heading", { name: "Giriş", level: 3 }).waitFor();
    const text = await drawer.innerText();
    for (const expected of ["Ayşe Yılmaz", "Chrome 140", "Kaydedilmiyor"]) assert.ok(text.includes(expected), `giriş ayrıntısında "${expected}" yok`);
    await page.keyboard.press("Escape");
    await rows.nth(3).locator("button").click();
    await drawer.getByRole("heading", { name: "Giriş", level: 3 }).waitFor();
    assert.match(await drawer.innerText(), /Hatalı e-posta veya şifre/);
    await page.keyboard.press("Escape");
  });

  await step("LESSON + BEFORE/AFTER: hak 5→4, telefon maskeli", async () => {
    await rows.nth(4).locator("button").click();
    await drawer.getByRole("heading", { name: "Ders", level: 3 }).waitFor();
    const text = await drawer.innerText();
    for (const expected of ["Elif Hoca", "Fonksiyonlar", "5 → 4", "Değişiklikler"]) assert.ok(text.includes(expected), `ders ayrıntısında "${expected}" yok`);
    assert.ok(!text.includes("123 45 67") && !text.includes("765 43 21"), "telefon maskelenmeli");
    await page.keyboard.press("Escape");
  });

  await step("CART SEARCH: paket adıyla sepet olayı bulunur", async () => {
    await page.locator("#dn-q").fill("5 derslik");
    await page.waitForFunction(() => [...document.querySelectorAll(".ak-rows > li")].some((item) => item.textContent.includes("Sepete paket eklendi")));
    assert.equal(feedCalls.at(-1).p_search, "5 derslik");
    const cartRow = rows.filter({ hasText: "Sepete paket eklendi" }).first();
    const text = await cartRow.innerText();
    assert.match(text, /Murat Küçükarslan/);
    assert.match(text, /Sepet: 5 Derslik Paket/);
    const before = feedCalls.length;
    await page.locator("#dn-q").fill("sepet");
    await page.waitForTimeout(900);
    const sepetCall = feedCalls.slice(before).find((call) => call.p_search === "sepet");
    assert.ok(Object.values(sepetCall?.p_term_actions ?? {}).flat().includes("cart_item_added"), "'sepet' araması sepet olaylarını kapsamalı");
  });

  await step("CART DRAWER: kullanıcı, paket, ders sayısı, fiyat, sepet ID, akış", async () => {
    await page.locator("#dn-q").fill("5 derslik");
    await page.waitForFunction(() => [...document.querySelectorAll(".ak-rows > li")].some((item) => item.textContent.includes("Sepete paket eklendi")));
    await rows.filter({ hasText: "Sepete paket eklendi" }).first().locator("button").click();
    await drawer.getByRole("heading", { name: "Sepet", level: 3 }).waitFor();
    const text = await drawer.innerText();
    for (const expected of ["Murat Küçükarslan, 5 Derslik Paket'i sepete ekledi.", "murat.k@example.com", "Veli", "Can Yılmaz", "Sepete ekleme", "5 Derslik Paket", "5 ders", "4.500", "Paketler sayfası", "Sepet / Correlation ID", "c4c4c4c4", "İlgili İşlem Akışı"]) {
      assert.ok(text.includes(expected), `sepet çekmecesinde "${expected}" yok`);
    }
    assert.match(text, /:\d\d:\d\d/, "saniyeli zaman görünmeli");
    const steps = await drawer.locator(".ak-tl li b").allInnerTexts();
    for (const title of ["Sepete paket eklendi", "Ödeme sayfası görüntülendi", "Ödeme başlatıldı", "PayTR bildirimi alındı", "Ödeme başarılı", "Paket tanımlandı", "Mail kuyruğa alındı", "Mail gönderildi"]) {
      assert.ok(steps.includes(title), `akışta "${title}" yok: ${steps.join(" | ")}`);
    }
    assert.ok(steps.indexOf("Sepete paket eklendi") < steps.indexOf("Ödeme başlatıldı") && steps.indexOf("Ödeme başlatıldı") < steps.indexOf("Ödeme başarılı") && steps.indexOf("Ödeme başarılı") < steps.indexOf("Mail gönderildi"), "akış sırası sepet → ödeme → mail olmalı");
    await shot(page, "desktop-cart-drawer");
  });

  await step("CHECKOUT DRAWER: çoklu paket listesi, fiyatlar, kupon, gizli değer yok", async () => {
    await drawer.locator(".ak-tl li").filter({ hasText: "Ödeme başlatıldı" }).locator("button").click();
    await page.waitForFunction(() => /[?&]log=a902\b/.test(location.search));
    await drawer.locator(".ak-items").first().waitFor();
    await drawer.getByRole("heading", { name: "Sepet", level: 3 }).waitFor();
    const text = await drawer.innerText();
    for (const expected of ["Ödeme başlatma", "10 Derslik Paket", "10 ders", "7.650", "4.050", "EKIM10", "11.700", "Ödeme oturumu oluşturuldu", "ORI-QA0001"]) {
      assert.ok(text.includes(expected), `ödeme başlatma çekmecesinde "${expected}" yok`);
    }
    const html = await page.content();
    for (const marker of SECRET_MARKERS) assert.ok(!html.includes(marker), `gizli değer sayfada: ${marker}`);
    await page.keyboard.press("Escape");
    await drawer.waitFor({ state: "detached" });
    await page.locator("#dn-q").fill("");
    await page.waitForFunction(() => document.querySelectorAll(".ak-rows > li").length === 50);
  });

  await step("ACTOR / SUBJECT: kişi filtresi", async () => {
    await rows.first().locator("button").click();
    await drawer.waitFor();
    await drawer.getByRole("button", { name: /tüm kayıtları/i }).click();
    await drawer.waitFor({ state: "detached" });
    await page.locator(".ak-person").waitFor();
    assert.ok(feedCalls.at(-1).p_person, "kişi filtresi sunucuya gitmeli");
  });
  await context.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "tr-TR", timezoneId: "Europe/Istanbul" });
  await setup(mobile);
  const phone = await mobile.newPage();
  phone.on("pageerror", (error) => pageErrors.push(String(error)));
  await step("MOBILE: kart liste, yatay kaydırma yok, tam ekran çekmece", async () => {
    await phone.goto(`${baseUrl}/admin/denetim/`);
    await phone.locator(".ak-rows > li").first().waitFor({ timeout: 30_000 });
    assert.equal(await phone.locator(".ak-th").isVisible(), false, "mobilde tablo başlığı gizli olmalı");
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `yatay kaydırma var: ${overflow}px`);
    await phone.waitForTimeout(1500);
    await phone.locator(".ak-rows > li").first().waitFor();
    await shot(phone, "mobile-list");
    await phone.locator(".ak-rows > li").first().locator("button").click();
    const sheet = phone.locator("aside.ak-drawer");
    await sheet.getByRole("heading", { name: "Ödeme", level: 3 }).waitFor();
    await sheet.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
    const box = await sheet.boundingBox();
    assert.ok(Math.abs(box.width - 390) <= 1 && box.x <= 1, `mobil çekmece tam ekran olmalı: ${JSON.stringify(box)}`);
    await shot(phone, "mobile-drawer");
  });
  await step("MOBILE CART DETAIL: sepet çekmecesi tam ekran, taşma yok", async () => {
    await phone.goto(`${baseUrl}/admin/denetim/?log=a902`);
    const sheet = phone.locator("aside.ak-drawer");
    await sheet.getByRole("heading", { name: "Sepet", level: 3 }).waitFor({ timeout: 30_000 });
    await sheet.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
    const box = await sheet.boundingBox();
    assert.ok(Math.abs(box.width - 390) <= 1 && box.x <= 1, `mobil sepet çekmecesi tam ekran olmalı: ${JSON.stringify(box)}`);
    const inner = await sheet.evaluate((element) => {
      const body = element.querySelector(".ak-dr-body");
      return { overflow: body.scrollWidth - body.clientWidth, items: element.querySelectorAll(".ak-items li").length };
    });
    assert.ok(inner.overflow <= 1, `sepet çekmecesinde yatay taşma: ${inner.overflow}px`);
    assert.ok(inner.items >= 2, "mobilde paket listesi görünmeli");
    assert.match(await sheet.innerText(), /10 Derslik Paket/);
    await shot(phone, "mobile-cart-drawer");
  });
  await mobile.close();

  await step("NO MUTATIONS: yazma / fonksiyon / kayıt RPC'si yok", async () => {
    assert.deepEqual(writes, [], `yazma isteği: ${writes.join(", ")}`);
    const risky = otherRpc.filter((name) => /^(record_|insert|update|delete|create|assign|send|archive|purge|reset)/i.test(name));
    assert.deepEqual(risky, [], `mutasyon RPC: ${risky.join(", ")}`);
  });

  await step("NO PAGE ERRORS", async () => {
    assert.deepEqual(pageErrors, []);
  });
  console.log(`audit-center browser: ${passed} PASS, 0 FAIL (feed RPC ${feedCalls.length}, detail RPC ${detailCalls.length})`);
} catch (error) {
  console.error(`audit-center browser: FAIL after ${passed} PASS`);
  console.error(error);
  if (pageErrors.length) console.error("page errors:", pageErrors);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
