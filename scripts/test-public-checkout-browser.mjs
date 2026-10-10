// Doğrudan paket ödemesi (sepet yok): /tr/odeme/?package=<id>.
// Tüm Supabase ve PayTR çağrıları taklit edilir; gerçek ödeme, e-posta ve OTP yok.
// Kart alanı yalnız PayTR iframe'idir (otomatik açılır); Oriens kart inputu çizmez.
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
const learner = { id: learnerId, full_name: "QA Learner", email: "learner@example.test", active: true, preferred_language: "tr" };
const relation = { guardian_user_id: holderId, student_id: learnerId, relationship_role: "parent", is_primary: true, active: true };
const validCoupon = { valid: true, coupon_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", code: "QA10", name: "QA", discount_type: "percentage", discount_value: 10, maximum_discount_amount: 2500, minimum_order_amount: null, eligible_package_ids: ["package40"], currency: "TRY" };
const json = (route, body, status = 200, object = false) => route.fulfill({ status, headers: { "content-type": object ? "application/vnd.pgrst.object+json" : "application/json" }, body: JSON.stringify(body) });
const LOAD_ERROR = "Ödeme formu yüklenemedi. Tekrar deneyin.";

function check(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Sunucu taklidi: tutarı paket + kupondan hesaplar (gerçek edge function gibi).
 * `state.mode`: "ok" | "error" | "mismatch"; `state.delays`: sıradaki yanıtlar için gecikme (ms).
 */
async function fixture(browser, width, { guardianPhone = null } = {}) {
  const state = { mode: "ok", delays: [], tokenBodies: [], tokens: [], quoteCalls: [], cartEvents: [], paytrRequests: [], blocked: [] };
  const guardian = { user_id: holderId, full_name: "QA Account Holder", email: user.email, phone: guardianPhone, preferred_language: "tr", email_verified_at: new Date().toISOString(), active: true };
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
    return route.fulfill({ status: 200, headers: { "content-type": "text/html" }, body: `<!doctype html><title>PayTR mock</title><body style="margin:0;font:14px sans-serif"><p style="padding:16px">PAYTR MOCK FORM ${url.pathname.split("/").pop()}</p></body>` });
  });
  await page.route("**/auth/v1/**", (route) => json(route, route.request().url().includes("/user") ? user : session, 200, true));
  await page.route("**/functions/v1/**", (route) => json(route, { success: false, error_code: "QA_UNEXPECTED_FUNCTION" }, 400));
  await page.route("**/functions/v1/paytr-create-token", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    state.tokenBodies.push(body);
    const n = state.tokenBodies.length;
    const delay = state.delays.shift() || 0;
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (state.mode === "error") return json(route, { success: false, error_code: "TOKEN_ERROR", message: "PayTR token alınamadı." }, 502);
    const subtotal = packages.find((item) => item.id === body.packageIds?.[0])?.current_total ?? 0;
    const discount = body.couponCode === "QA10" ? Math.min(subtotal * 0.1, 2500) : 0;
    const finalAmount = state.mode === "mismatch" ? subtotal + 1 : subtotal - discount;
    const token = `QA_TOKEN_${n}`;
    state.tokens.push(token);
    return json(route, { success: true, iframe_token: token, merchant_oid: `ORIQA${n}`, reference: `QA-REF-${n}`, statusToken: `qa-status-${n}`, final_amount: finalAmount, currency: "TRY" });
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
    if (url.includes("/rpc/record_payment_client_event")) return json(route, true);
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

const amount = async (page) => (await page.locator("[data-amount]").innerText()).replace(/\s/g, " ");
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
const iframeSrc = (page) => page.locator("#paytriframe").getAttribute("src");
const tokenUrl = (token) => `https://www.paytr.com/odeme/guvenli/${token}`;
async function waitLoaded(page, token) {
  await page.locator(`#paytriframe[src="${tokenUrl(token)}"]`).waitFor({ timeout: 15_000 });
  await page.locator('[data-paytr-frame-state="loaded"]').waitFor({ timeout: 15_000 });
}
/** Kart alanı taklidi yok: Oriens DOM'unda kart numarası/SKT/CVC alanı veya özel "öde" butonu bulunmaz. */
async function assertNoOriensCardFields(page) {
  check(await page.locator("[data-pay-button]").count() === 0, "custom pay button rendered");
  check(await page.locator('input[autocomplete^="cc-"], input[name*="card" i], input[name*="cvc" i], input[name*="cvv" i]').count() === 0, "Oriens card input rendered");
  const cardSection = page.locator("[data-card-section]");
  const text = await cardSection.innerText();
  for (const fake of ["Kart numarası", "AA / YY", "•••• ••••", "CVC", "Son kullanma"]) check(!text.includes(fake), `fake card skeleton text: ${fake}`);
  check(!/\d[\d.]*\s*TL öde/.test(text), "duplicate custom 'X TL öde' submit rendered");
}
async function assertLayoutOrder(page) {
  const boxes = await page.evaluate(() => {
    const top = (selector) => document.querySelector(selector)?.getBoundingClientRect().top ?? null;
    return { title: top("#pay-s2"), frame: top("[data-paytr-frame-state]"), legal: top("[data-legal-consent]"), trust: top("[data-legal-consent] + div") };
  });
  check(boxes.title !== null && boxes.frame !== null && boxes.legal !== null && boxes.trust !== null, `layout parts missing ${JSON.stringify(boxes)}`);
  check(boxes.title < boxes.frame && boxes.frame < boxes.legal && boxes.legal < boxes.trust, `card → iframe → legal → trust order broken ${JSON.stringify(boxes)}`);
}

await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true });
const summary = { widths: {}, matrix: {} };
try {
  // Dört genişlik: telefon yokken bekleme durumu (token yok) → numara girilince form otomatik açılır.
  for (const width of [390, 820, 1280, 1440]) {
    const { context, page, state } = await fixture(browser, width);
    await page.goto(`${base}/tr/odeme/?package=package40`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-summary-package='package40']").waitFor({ timeout: 20_000 });
    check((await page.locator("[data-summary-package='package40']").innerText()).includes("40 Derslik Paket"), "package40 not in summary");
    check(await amount(page) === "100.000 TL", `unexpected total ${await amount(page)}`);
    check(await page.locator('a[href*="/sepet"], a[href*="/cart"]').count() === 0, "cart link rendered");
    check(await page.getByText(/Taksit Seçenekleri|Taksit tablosu/i).count() === 0, "installment info table rendered");
    check(await page.getByText("Güvenli ödeme · 3D Secure").count() === 1, "secure pill missing");
    await page.locator("[data-paytr-pending]").waitFor();
    await page.waitForTimeout(600);
    check(state.tokenBodies.length === 0 && state.paytrRequests.length === 0, "PayTR contacted without a phone");
    await assertNoOriensCardFields(page);
    check(!(await overflow(page)), `horizontal overflow at ${width}px`);
    await page.screenshot({ path: `${shots}/tr-${width}-pending.png`, fullPage: true });

    await page.locator("#payment-phone").fill("5321234567");
    await waitLoaded(page, "QA_TOKEN_1");
    check(state.tokenBodies.length === 1, `auto-open token requests at ${width}: ${state.tokenBodies.length}`);
    await assertNoOriensCardFields(page);
    await assertLayoutOrder(page);
    const frame = await page.locator("#paytriframe").boundingBox();
    const section = await page.locator("[data-card-section]").boundingBox();
    check(frame && section && frame.x >= section.x - 1 && frame.x + frame.width <= section.x + section.width + 1 && frame.width <= width, `iframe clipped at ${width}px`);
    check(frame.height >= 600, `iframe too short at ${width}px (${frame.height})`);
    check(!(await overflow(page)), `horizontal overflow with iframe at ${width}px`);
    await page.locator("#paytriframe").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const paybarShown = await page.locator("[class*='mobilePaybar']").evaluate((el) => el.getAttribute("aria-hidden") !== "true");
    check(!paybarShown, `mobile paybar overlaps the open PayTR form at ${width}px`);
    // Gerçek görünüm (fullPage yakalama viewport'u büyütüp sabit öğeleri sayfa ortasına taşır).
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${shots}/tr-${width}-iframe-viewport.png` });
    await page.screenshot({ path: `${shots}/tr-${width}-iframe.png`, fullPage: true });
    summary.widths[width] = { total: await amount(page), tokenRequests: state.tokenBodies.length };
    check(state.cartEvents.includes("checkout_opened"), "checkout_opened audit event missing");
    await context.close();
  }

  // D + A + B + C + O: geçersiz telefon, otomatik açılış, kupon, kupon kaldırma, bayat token yarışı.
  {
    const { context, page, state } = await fixture(browser, 390);
    await page.goto(`${base}/tr/odeme/?package=package40`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-summary-package='package40']").waitFor({ timeout: 20_000 });
    const phone = page.locator("#payment-phone");
    await phone.fill("432");
    await phone.blur();
    await page.getByText("Lütfen 5 ile başlayan 10 haneli cep telefonu numaranızı girin.").waitFor();
    await phone.fill("4321234567");
    await page.waitForTimeout(800);
    check(state.tokenBodies.length === 0, `D: invalid phone created ${state.tokenBodies.length} token requests`);
    summary.matrix.D = "0 token requests";

    await phone.fill("05321234567");
    check(await phone.inputValue() === "532 123 45 67", `phone mask: ${await phone.inputValue()}`);
    await waitLoaded(page, "QA_TOKEN_1");
    const first = state.tokenBodies[0];
    check(state.tokenBodies.length === 1, `A: token requests ${state.tokenBodies.length}`);
    check(JSON.stringify(first.packageIds) === JSON.stringify(["package40"]), `A: token packages ${JSON.stringify(first.packageIds)}`);
    check(!first.couponCode, "A: unexpected coupon");
    check(String(first.paymentPhone).endsWith("5321234567"), "A: token phone");
    check(first.termsAccepted === true && first.refundPolicyAccepted === true && first.legalVersions, "A: legal acceptance not sent");
    check(!("amount" in first) && !("total" in first) && !("finalAmount" in first), "client must not send an amount");
    summary.matrix.A = `opened ${await iframeSrc(page)}`;

    await page.getByRole("button", { name: "İndirim kodunuz mu var?" }).click();
    const couponInput = page.locator("#pay-coupon-input");
    await couponInput.fill("NOPE");
    await couponInput.press("Enter");
    await page.locator("#pay-coupon-input[aria-invalid='true']").waitFor();
    check(await amount(page) === "100.000 TL", "invalid code changed total");
    check(await iframeSrc(page) === tokenUrl("QA_TOKEN_1"), "invalid code replaced the form");

    await couponInput.fill("qa10");
    await couponInput.press("Enter");
    await page.locator("[data-coupon-chip]").waitFor();
    check(await amount(page) === "97.500 TL", `B: discounted total ${await amount(page)}`);
    check((await page.locator("#pay-coupon-msg").innerText()).includes("tasarruf ettiniz"), "coupon success message missing");
    await waitLoaded(page, "QA_TOKEN_2");
    check(state.tokenBodies[1].couponCode === "QA10", `B: token coupon ${state.tokenBodies[1].couponCode}`);
    check(await page.locator("#paytriframe").count() === 1, "B: more than one PayTR iframe");
    summary.matrix.B = `discounted ${await amount(page)} → ${await iframeSrc(page)}`;

    await page.locator("[data-coupon-chip] button").click();
    await page.getByText("İndirim kodu kaldırıldı.").waitFor();
    check(await amount(page) === "100.000 TL", "C: removed coupon still discounted");
    await waitLoaded(page, "QA_TOKEN_3");
    check(!state.tokenBodies[2].couponCode, "C: coupon sent after removal");
    check(await page.locator(`#paytriframe[src="${tokenUrl("QA_TOKEN_2")}"]`).count() === 0, "C: discounted token still shown");
    summary.matrix.C = `full price ${await amount(page)} → ${await iframeSrc(page)}`;

    // O/P: kuponlu istek yavaş dönerken kupon kaldırılır → geç gelen indirimli token gösterilmez.
    state.delays.push(2500);
    await couponInput.fill("QA10");
    await couponInput.press("Enter");
    await page.locator("[data-coupon-chip]").waitFor();
    await page.waitForTimeout(700);
    check(state.tokenBodies.length === 4 && state.tokenBodies[3].couponCode === "QA10", "O: discounted request not in flight");
    await page.locator("[data-coupon-chip] button").click();
    await waitLoaded(page, "QA_TOKEN_5");
    await page.waitForTimeout(2500);
    check(state.tokens.includes("QA_TOKEN_4"), "O: slow discounted response never arrived");
    check(await amount(page) === "100.000 TL", "O: total not restored after removal");
    check(!state.tokenBodies[4].couponCode, "O: last request still carries a coupon");
    check(await iframeSrc(page) === tokenUrl("QA_TOKEN_5"), `O: stale discounted token won the race (${await iframeSrc(page)})`);
    summary.matrix.O_P = `late discounted QA_TOKEN_4 ignored; showing QA_TOKEN_5 at ${await amount(page)}`;

    const ids = state.tokenBodies.map((body) => body.clientRequestId);
    check(ids.every((id) => /^[A-Za-z0-9-]{8,64}$/.test(id || "")) && new Set(ids).size === ids.length, `clientRequestId not unique: ${ids.join(",")}`);
    check(state.quoteCalls.every((call) => JSON.stringify(call.p_package_ids) === JSON.stringify(["package40"])), "coupon quoted for other packages");
    check(state.cartEvents.includes("checkout_started"), "checkout_started audit event missing");
    check(state.blocked.every((url) => /googletagmanager|google-analytics|cloudflareinsights|fonts\.g/.test(url)), `unexpected external request: ${state.blocked.join(", ")}`);
    await page.screenshot({ path: `${shots}/tr-390-coupon-flow.png`, fullPage: true });
    await context.close();
  }

  // E + F: uç nokta hatası → görünür hata + Tekrar dene; çift tık tek istek; yeniden deneme formu açar.
  {
    const { context, page, state } = await fixture(browser, 1280, { guardianPhone: "+905321234567" });
    state.mode = "error";
    await page.goto(`${base}/tr/odeme/?package=package40`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-paytr-error]").waitFor({ timeout: 20_000 });
    check((await page.locator("[data-paytr-error]").innerText()).includes(LOAD_ERROR), "E: error copy missing");
    check(await page.locator("#paytriframe").count() === 0, "E: iframe shown after failure");
    check(!(await page.locator("[data-paytr-error]").innerText()).includes("{"), "E: raw response dumped");
    const failedRequests = state.tokenBodies.length;
    check(failedRequests === 1, `E: requests after failure ${failedRequests}`);
    await page.screenshot({ path: `${shots}/tr-1280-error.png`, fullPage: true });
    summary.matrix.E = "visible error + retry";

    state.mode = "ok";
    await page.locator("[data-paytr-retry]").dblclick();
    await page.locator("#paytriframe").waitFor({ timeout: 15_000 });
    await page.locator('[data-paytr-frame-state="loaded"]').waitFor();
    check(state.tokenBodies.length === failedRequests + 1, `F: retry sent ${state.tokenBodies.length - failedRequests} requests`);
    const retryBody = state.tokenBodies.at(-1);
    check(String(retryBody.paymentPhone).endsWith("5321234567") && JSON.stringify(retryBody.packageIds) === '["package40"]', "F: retry changed inputs");
    summary.matrix.F = `retry opened ${await iframeSrc(page)}`;

    // Tutar uyuşmazlığı: sunucu farklı tutar dönerse form gösterilmez.
    state.mode = "mismatch";
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-paytr-error]").waitFor({ timeout: 20_000 });
    check(await page.locator("#paytriframe").count() === 0, "amount mismatch still showed the form");
    summary.matrix.amountMismatch = "form withheld";
    await context.close();
  }

  // Kayıtlı telefon önerisi + G (package40) + H (yenileme yeni token ile yeniden açar).
  {
    const { context, page, state } = await fixture(browser, 390, { guardianPhone: "+905551112233" });
    await page.goto(`${base}/tr/odeme/?package=package40`, { waitUntil: "domcontentloaded" });
    await waitLoaded(page, "QA_TOKEN_1");
    check(await page.locator("#payment-phone").inputValue() === "555 111 22 33", "saved phone not prefilled");
    check(await page.locator("[data-paytr-pending]").count() === 0, "prefilled phone stuck in pending state");
    summary.matrix.G = `package40 auto-open ${await amount(page)}`;
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitLoaded(page, "QA_TOKEN_2");
    check(state.tokenBodies.length === 2, `H: requests after refresh ${state.tokenBodies.length}`);
    check(state.tokenBodies[0].clientRequestId !== state.tokenBodies[1].clientRequestId, "H: refresh reused the request id");
    summary.matrix.H = `refresh reopened ${await iframeSrc(page)}`;
    await context.close();
  }

  // Başka paket: tutar paketten gelir.
  {
    const { context, page } = await fixture(browser, 1280, { guardianPhone: "+905551112233" });
    await page.goto(`${base}/tr/odeme/?package=package10`, { waitUntil: "domcontentloaded" });
    await waitLoaded(page, "QA_TOKEN_1");
    check(await amount(page) === "27.000 TL", `package10 total ${await amount(page)}`);
    await context.close();
  }

  // Geçersiz paket kimliği: hiçbir paket kendiliğinden seçilmez, token istenmez.
  {
    const invalid = await fixture(browser, 1280, { guardianPhone: "+905551112233" });
    await invalid.page.goto(`${base}/tr/odeme/?package=nope`, { waitUntil: "domcontentloaded" });
    await invalid.page.locator("[data-paytr-pending]").waitFor({ timeout: 20_000 });
    await invalid.page.waitForTimeout(600);
    check(await invalid.page.locator("[data-summary-package]").count() === 0, "invalid package auto-selected");
    check(invalid.state.tokenBodies.length === 0, "token requested without a package");
    await invalid.context.close();
  }

  console.log(JSON.stringify({ status: "PASS", ...summary, couponInvalid: true, maxDiscount: "97.500 TL", paytr: "MOCKED", realPayments: 0, realEmails: 0 }));
} finally {
  await browser.close();
}
