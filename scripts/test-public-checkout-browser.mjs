// Doğrudan paket ödemesi (sepet yok): /tr/odeme/?package=<id>.
// Tüm Supabase ve PayTR çağrıları taklit edilir; gerçek ödeme, e-posta ve OTP yok.
// Çalıştırma: statik çıktı (out/) yerelde sunulurken QA_BASE_URL ile.
import fs from "node:fs";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:62175";
const shots = "test-results/direct-checkout";
const env = fs.readFileSync(".env.local", "utf8");
const supabaseUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "") || "";
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const holderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const learnerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const now = Math.floor(Date.now() / 1000);
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const user = { id: holderId, aud: "authenticated", role: "authenticated", email: "holder@example.test", email_confirmed_at: new Date().toISOString(), app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: new Date().toISOString() };
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ aud: "authenticated", exp: now + 3600, sub: holderId, role: "authenticated" })}.qa`;
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "qa-refresh", user };
const pkg = (id, lessons, total, order) => ({ id, name_tr: `${lessons} Derslik Paket`, name_en: `${lessons}-Lesson Package`, price_amount: total, current_total: total, old_total: null, discount_percentage: 0, price_eur: null, currency: "TRY", lesson_count: lessons, unit_price: total / lessons, purchase_mode: "purchasable", active: true, featured: false, display_order: order, badge_tr: null, badge_en: null });
const packages = [
  pkg("single", 1, 3200, 1), pkg("package5", 5, 15000, 2), pkg("package10", 10, 27000, 3),
  pkg("package20", 20, 51000, 4), pkg("package30", 30, 72000, 5), pkg("package40", 40, 100000, 6),
  { ...pkg("custom", 1, 0, 999), lesson_count: null, purchase_mode: "consultation_only" },
];
const guardian = { user_id: holderId, full_name: "QA Account Holder", email: user.email, phone: null, preferred_language: "tr", email_verified_at: new Date().toISOString(), active: true };
const learner = { id: learnerId, full_name: "QA Learner", email: "learner@example.test", active: true, preferred_language: "tr" };
const relation = { guardian_user_id: holderId, student_id: learnerId, relationship_role: "parent", is_primary: true, active: true };
const validCoupon = { valid: true, coupon_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", code: "QA10", name: "QA", discount_type: "percentage", discount_value: 10, maximum_discount_amount: 2500, minimum_order_amount: null, eligible_package_ids: ["package40"], currency: "TRY" };
const json = (route, body, status = 200, object = false) => route.fulfill({ status, headers: { "content-type": object ? "application/vnd.pgrst.object+json" : "application/json" }, body: JSON.stringify(body) });

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function fixture(browser, width) {
  const state = { tokenBodies: [], quoteCalls: [], cartEvents: [], paytrRequests: [], blocked: [] };
  const context = await browser.newContext({ viewport: { width, height: width < 800 ? 860 : 1000 } });
  await context.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    sessionStorage.setItem("oriens-loader-seen", "1");
  }, { key: `sb-${projectRef}-auth-token`, value: session });
  const page = await context.newPage();
  // Önce her şeyi engelle; ardından kaydedilen özel rotalar önceliklidir.
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    state.blocked.push(url);
    return route.abort();
  });
  await page.route(/https:\/\/(?:www\.)?paytr\.com\/.*/, (route) => {
    const url = new URL(route.request().url());
    state.paytrRequests.push(url.pathname);
    if (url.pathname.endsWith(".js")) return route.fulfill({ status: 200, headers: { "content-type": "application/javascript" }, body: "/* paytr mock */" });
    return route.fulfill({ status: 200, headers: { "content-type": "text/html" }, body: "<!doctype html><title>PayTR mock</title><p>PAYTR MOCK FORM</p>" });
  });
  await page.route("**/auth/v1/**", (route) => json(route, route.request().url().includes("/user") ? user : session, 200, true));
  await page.route("**/functions/v1/**", (route) => json(route, { success: false, error_code: "QA_UNEXPECTED_FUNCTION" }, 400));
  await page.route("**/functions/v1/paytr-create-token", (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    state.tokenBodies.push(body);
    return json(route, { success: true, iframe_token: "QA_IFRAME_TOKEN", merchant_oid: "ORIQAMOCK", reference: "QA-REF", statusToken: "qa-status", final_amount: 97500 });
  });
  await page.route("**/rest/v1/**", (route) => {
    const url = route.request().url();
    const object = (route.request().headers().accept || "").includes("vnd.pgrst.object");
    if (url.includes("/rpc/record_cart_event")) {
      state.cartEvents.push(JSON.parse(route.request().postData() || "{}").p_kind);
      return json(route, true);
    }
    if (url.includes("/rpc/quote_checkout_coupon")) {
      const body = JSON.parse(route.request().postData() || "{}");
      state.quoteCalls.push(body);
      return json(route, body.p_code === "QA10" ? validCoupon : { valid: false, error_code: "COUPON_NOT_FOUND" });
    }
    if (url.includes("/rpc/confirm_payment_agreements")) return json(route, true);
    if (url.includes("guardian_accounts")) return json(route, object ? guardian : [guardian], 200, object);
    if (url.includes("guardian_students")) return json(route, [relation]);
    if (url.includes("student_profiles")) {
      if (object && url.includes(encodeURIComponent(holderId))) return json(route, null, 200, true);
      return json(route, object ? learner : [learner], 200, object);
    }
    if (url.includes("pricing_packages")) return json(route, object ? packages[0] : packages, 200, object);
    if (url.includes("site_settings")) return json(route, []);
    return json(route, object ? null : [], 200, object);
  });
  return { context, page, state };
}

const amount = (page) => page.locator("[data-amount]").innerText();
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true });
const summary = { widths: {} };
try {
  for (const width of [390, 820, 1280, 1440]) {
    const { context, page, state } = await fixture(browser, width);
    await page.goto(`${base}/tr/odeme/?package=package40`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-summary-package='package40']").waitFor({ timeout: 20_000 });
    check((await page.locator("[data-summary-package='package40']").innerText()).includes("40 Derslik Paket"), "package40 not in summary");
    check((await amount(page)).replace(/\s/g, " ") === "100.000 TL", `unexpected total ${await amount(page)}`);
    // Sepet ve taksit bilgi tablosu yok; PayTR yalnız ödeme butonundan sonra açılır.
    check(await page.locator('a[href*="/sepet"], a[href*="/cart"]').count() === 0, "cart link rendered");
    check(await page.getByText(/Taksit Seçenekleri|Taksit tablosu/i).count() === 0, "installment info table rendered");
    check(state.paytrRequests.length === 0, "PayTR contacted before pay click");
    check(!(await page.locator("[data-pay-button]").isEnabled()), "pay enabled without phone");
    check(await page.getByText("Güvenli ödeme · 3D Secure").count() === 1, "secure pill missing");
    check(!(await overflow(page)), `horizontal overflow at ${width}px`);
    await page.screenshot({ path: `${shots}/tr-${width}.png`, fullPage: true });
    summary.widths[width] = { total: await amount(page), cartEvents: [...state.cartEvents] };
    check(state.cartEvents.includes("checkout_opened"), "checkout_opened audit event missing");
    await context.close();
  }

  // Telefon, indirim kodu ve PayTR (taklit) akışı.
  const { context, page, state } = await fixture(browser, 390);
  await page.goto(`${base}/tr/odeme/?package=package40`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-summary-package='package40']").waitFor({ timeout: 20_000 });
  const phone = page.locator("#payment-phone");
  await phone.fill("432");
  await phone.blur();
  await page.getByText("Lütfen 5 ile başlayan 10 haneli cep telefonu numaranızı girin.").waitFor();
  await phone.fill("05321234567");
  check(await phone.inputValue() === "532 123 45 67", `phone mask: ${await phone.inputValue()}`);
  check(await page.locator("[data-pay-button]").isEnabled(), "pay disabled with valid phone");

  // Mobil ödeme çubuğu: sayfa başında asıl buton görünmezken gösterilir.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const paybarVisible = await page.locator("[class*='mobilePaybar']").evaluate((el) => getComputedStyle(el).visibility !== "hidden" && el.getAttribute("aria-hidden") !== "true");
  summary.mobilePaybar = paybarVisible;

  await page.getByRole("button", { name: "İndirim kodunuz mu var?" }).click();
  const couponInput = page.locator("#pay-coupon-input");
  await couponInput.fill("NOPE");
  await couponInput.press("Enter");
  await page.locator("#pay-coupon-input[aria-invalid='true']").waitFor();
  check((await amount(page)).replace(/\s/g, " ") === "100.000 TL", "invalid code changed total");
  await couponInput.fill("qa10");
  await couponInput.press("Enter");
  await page.locator("[data-coupon-chip]").waitFor();
  check((await amount(page)).replace(/\s/g, " ") === "97.500 TL", `max discount total: ${await amount(page)}`);
  check((await page.locator("#pay-coupon-msg").innerText()).includes("tasarruf ettiniz"), "coupon success message missing");
  await page.locator("[data-coupon-chip] button").click();
  await page.getByText("İndirim kodu kaldırıldı.").waitFor();
  check((await amount(page)).replace(/\s/g, " ") === "100.000 TL", "removed coupon still discounted");
  await couponInput.fill("QA10");
  await couponInput.press("Enter");
  await page.locator("[data-coupon-chip]").waitFor();
  const shownTotal = (await amount(page)).replace(/\s/g, " ");
  const payLabel = (await page.locator("[data-pay-button]").innerText()).replace(/\s/g, " ").trim();
  check(payLabel === `${shownTotal} öde`, `pay label ${payLabel} vs total ${shownTotal}`);
  await page.locator("[data-pay-button]").click();
  await page.locator("#paytriframe").waitFor();
  const token = state.tokenBodies[0];
  check(state.tokenBodies.length === 1, `token requests: ${state.tokenBodies.length}`);
  check(JSON.stringify(token.packageIds) === JSON.stringify(["package40"]), `token packages ${JSON.stringify(token.packageIds)}`);
  check(token.couponCode === "QA10", `token coupon ${token.couponCode}`);
  check(String(token.paymentPhone).endsWith("5321234567"), "token phone");
  check(!("amount" in token) && !("total" in token) && !("finalAmount" in token), "client must not send an amount");
  check((await page.locator("#paytriframe").getAttribute("src")) === "https://www.paytr.com/odeme/guvenli/QA_IFRAME_TOKEN", "iframe src");
  check(state.quoteCalls.every((call) => JSON.stringify(call.p_package_ids) === JSON.stringify(["package40"])), "coupon quoted for other packages");
  check(state.cartEvents.includes("checkout_started"), "checkout_started audit event missing");
  check(state.blocked.every((url) => /googletagmanager|google-analytics|cloudflareinsights|fonts\.g/.test(url)), `unexpected external request: ${state.blocked.join(", ")}`);
  await page.screenshot({ path: `${shots}/tr-390-iframe.png`, fullPage: true });
  await context.close();

  // Geçersiz paket kimliği: hiçbir paket kendiliğinden seçilmez, ödeme kapalı.
  const invalid = await fixture(browser, 1280);
  await invalid.page.goto(`${base}/tr/odeme/?package=nope`, { waitUntil: "domcontentloaded" });
  await invalid.page.locator("[data-pay-button]").waitFor({ timeout: 20_000 });
  check(await invalid.page.locator("[data-summary-package]").count() === 0, "invalid package auto-selected");
  check(!(await invalid.page.locator("[data-pay-button]").isEnabled()), "pay enabled without package");
  await invalid.context.close();

  console.log(JSON.stringify({ status: "PASS", ...summary, couponValid: true, couponInvalid: true, couponRemove: true, maxDiscount: "97.500 TL", tokenPackages: ["package40"], tokenCoupon: "QA10", paytr: "MOCKED", realPayments: 0, realEmails: 0 }));
} finally {
  await browser.close();
}
