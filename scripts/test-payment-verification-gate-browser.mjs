import fs from "node:fs";
import { chromium } from "playwright";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:62175";
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
const packages = [
  { id: "package10", name_tr: "10 Derslik Paket", name_en: "10-Lesson Package", price_amount: 27000, current_total: 27000, currency: "TRY", lesson_count: 10, unit_price: 2700, purchase_mode: "purchasable", active: true, featured: false, display_order: 1, billing_basis: "package" },
  { id: "package5", name_tr: "5 Derslik Paket", name_en: "5-Lesson Package", price_amount: 15000, current_total: 15000, currency: "TRY", lesson_count: 5, unit_price: 3000, purchase_mode: "purchasable", active: true, featured: false, display_order: 2, billing_basis: "package" },
];
const learner = { id: learnerId, full_name: "QA Learner", email: "learner@example.test", active: true, preferred_language: "tr" };
const relation = { guardian_user_id: holderId, student_id: learnerId, relationship_role: "parent", is_primary: true, active: true };
const coupon = { valid: true, coupon_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", code: "QA10", name: "QA", discount_type: "percentage", discount_value: 10, maximum_discount_amount: null, minimum_order_amount: null, eligible_package_ids: ["package10", "package5"], currency: "TRY" };
const json = (route, body, status = 200, object = false) => route.fulfill({ status, headers: { "content-type": object ? "application/vnd.pgrst.object+json" : "application/json" }, body: JSON.stringify(body) });

// EmailOtpGate: 6 ayrı hane kutusu.
async function enterOtp(page, code) {
  const boxes = page.locator('form input[inputmode="numeric"]');
  for (let index = 0; index < 6; index += 1) await boxes.nth(index).fill(code[index]);
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

// Sepet kaldırıldı: tüm senaryolar doğrudan paket ödemesi (?package=) ile çalışır.
async function createFixture(browser, { verified = false, width = 1280 } = {}) {
  const state = { verified, otpRequests: 0, otpVerifications: 0, pricingRequests: 0, checkoutOpened: 0, paytrRequests: 0, installmentRequests: 0, blockedExternalUrls: [] };
  const context = await browser.newContext({ viewport: { width, height: 950 } });
  await context.addInitScript(({ authKey, authValue }) => {
    localStorage.setItem(authKey, JSON.stringify(authValue));
  }, { authKey: `sb-${projectRef}-auth-token`, authValue: session });
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    if (route.request().url().startsWith(base)) return route.continue();
    state.blockedExternalUrls.push(route.request().url());
    return route.abort();
  });
  await page.route("**/auth/v1/user*", (route) => json(route, user, 200, true));
  await page.route("**/functions/v1/request-purchase-email-verification", (route) => {
    state.otpRequests += 1;
    return json(route, { success: true, candidate_email: user.email, resend_available_at: new Date(Date.now() + 60_000).toISOString(), expires_at: new Date(Date.now() + 600_000).toISOString() });
  });
  await page.route("**/functions/v1/verify-purchase-email-verification", (route) => {
    state.otpVerifications += 1;
    const code = JSON.parse(route.request().postData() || "{}").code;
    if (code === "222222") return json(route, { success: false, error_code: "OTP_EXPIRED", message: "Expired code" }, 400);
    if (code !== "111111") return json(route, { success: false, error_code: "INVALID_OTP", message: "Invalid code" }, 400);
    state.verified = true;
    return json(route, { success: true, email: user.email, verified_at: new Date().toISOString() });
  });
  await page.route("**/functions/v1/paytr-create-token", (route) => {
    state.paytrRequests += 1;
    return json(route, { success: false, error_code: "QA_BLOCKED" }, 400);
  });
  await page.route("**/rest/v1/**", (route) => {
    const url = route.request().url();
    const object = (route.request().headers().accept || "").includes("vnd.pgrst.object");
    const guardian = { user_id: holderId, full_name: "QA Account Holder", email: user.email, phone: "+905551112233", preferred_language: "tr", email_verified_at: state.verified ? new Date().toISOString() : null, active: true };
    if (url.includes("/rpc/record_cart_event")) {
      const body = JSON.parse(route.request().postData() || "{}");
      if (body.p_kind === "checkout_opened") state.checkoutOpened += 1;
      return json(route, true);
    }
    if (url.includes("/rpc/quote_checkout_coupon")) return json(route, coupon);
    if (url.includes("guardian_accounts")) return json(route, object ? guardian : [guardian], 200, object);
    if (url.includes("guardian_students")) return json(route, [relation]);
    if (url.includes("student_profiles")) {
      if (object && url.includes(encodeURIComponent(holderId))) return json(route, null, 200, true);
      return json(route, object ? learner : [learner], 200, object);
    }
    if (url.includes("pricing_packages")) {
      state.pricingRequests += 1;
      return json(route, object ? packages[0] : packages, 200, object);
    }
    if (url.includes("site_settings")) return json(route, []);
    return json(route, object ? null : [], 200, object);
  });
  await page.route(/https:\/\/(?:www\.)?paytr\.com\/.*/, (route) => {
    state.installmentRequests += 1;
    return route.abort();
  });
  return { context, page, state };
}

const browser = await chromium.launch({ headless: true });
try {
  const gateFixture = await createFixture(browser);
  const { context, page, state } = gateFixture;
  const checkoutUrl = `${base}/tr/odeme/?package=package10&campaign=qa-preserve`;
  await page.goto(checkoutUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "E-postanızı doğrulayın" }).waitFor();
  check(state.pricingRequests === 0, "Unverified checkout fetched pricing packages");
  check(state.checkoutOpened === 0, "Unverified checkout emitted checkout_opened");
  check(state.paytrRequests === 0 && state.installmentRequests === 0, "Unverified checkout contacted PayTR");
  check(await page.getByRole("heading", { name: "Sipariş Özeti" }).count() === 0, "Unverified checkout rendered order summary");
  check(await page.locator("#payment-phone").count() === 0, "Unverified checkout rendered payment phone");
  check(await page.locator("[data-single-payment]").count() === 0, "Unverified checkout rendered installment UI");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "E-postanızı doğrulayın" }).waitFor();
  check(state.pricingRequests === 0 && state.checkoutOpened === 0, "Refresh bypassed the unverified gate");
  check(page.url() === checkoutUrl, "Refresh changed checkout intent URL");

  await enterOtp(page, "000000");
  await page.locator('form button[type="submit"]').click();
  await page.locator('p[role="alert"]').waitFor();
  check(await page.getByRole("heading", { name: "E-postanızı doğrulayın" }).count() === 1, "Failed OTP left the gate");
  check(state.pricingRequests === 0 && state.checkoutOpened === 0 && state.paytrRequests === 0, "Failed OTP initialized checkout");

  await enterOtp(page, "222222");
  await page.locator('form button[type="submit"]').click();
  await page.locator('p[role="alert"]').waitFor();
  check(await page.getByRole("heading", { name: "E-postanızı doğrulayın" }).count() === 1, "Expired OTP left the gate");
  check(state.pricingRequests === 0 && state.checkoutOpened === 0 && state.paytrRequests === 0, "Expired OTP initialized checkout");

  await enterOtp(page, "111111");
  await page.locator('form button[type="submit"]').click();
  await page.getByRole("heading", { name: "Sipariş Özeti" }).waitFor();
  await page.getByText("10 Derslik Paket", { exact: true }).first().waitFor();
  // Doğrulamadan sonra kayıtlı telefonla PayTR formu otomatik istenir (taklit 400 döner → görünür hata).
  await page.locator("[data-paytr-error]").waitFor();
  check(page.url() === checkoutUrl, "OTP success changed checkout route or query intent");
  check(state.checkoutOpened === 1, `Expected one checkout_opened after reveal, got ${state.checkoutOpened}`);
  check(state.paytrRequests === 1, `Expected exactly one PayTR session request after reveal, got ${state.paytrRequests}`);
  check(state.installmentRequests === 0, "Failed session still loaded PayTR");
  check(state.otpRequests === 1, `Refresh sent another OTP request (${state.otpRequests})`);
  check(state.blockedExternalUrls.every((url) => ["www.googletagmanager.com", "static.cloudflareinsights.com"].includes(new URL(url).hostname)), `Unexpected external request: ${state.blockedExternalUrls.join(", ")}`);
  await context.close();

  for (const width of [390, 1280, 1440]) {
    const fixture = await createFixture(browser, { width });
    await fixture.page.goto(`${base}/tr/odeme/?package=package10`, { waitUntil: "domcontentloaded" });
    await fixture.page.getByRole("heading", { name: "E-postanızı doğrulayın" }).waitFor();
    const overflow = await fixture.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check(!overflow, `Verification gate overflowed at ${width}px`);
    check(fixture.state.pricingRequests === 0 && fixture.state.checkoutOpened === 0 && fixture.state.paytrRequests === 0 && fixture.state.installmentRequests === 0, `Unverified network/audit leak at ${width}px`);
    await fixture.context.close();
  }

  const direct = await createFixture(browser);
  const directUrl = `${base}/tr/odeme/?package=package10&campaign=direct-qa`;
  await direct.page.goto(directUrl, { waitUntil: "domcontentloaded" });
  await direct.page.getByRole("heading", { name: "E-postanızı doğrulayın" }).waitFor();
  await enterOtp(direct.page, "111111");
  await direct.page.locator('form button[type="submit"]').click();
  await direct.page.getByText("10 Derslik Paket", { exact: true }).first().waitFor();
  await direct.page.locator("[data-paytr-error]").waitFor();
  check(direct.page.url() === directUrl, "Direct-package intent was not preserved");
  check(direct.state.checkoutOpened === 1 && direct.state.paytrRequests === 1, "Direct-package reveal audit/payment behavior is wrong");
  await direct.context.close();

  const verified = await createFixture(browser, { verified: true });
  await verified.page.goto(`${base}/tr/odeme/?package=package10`, { waitUntil: "domcontentloaded" });
  await verified.page.getByRole("heading", { name: "Sipariş Özeti" }).waitFor();
  await verified.page.waitForTimeout(200);
  check(await verified.page.getByRole("heading", { name: "E-postanızı doğrulayın" }).count() === 0, "Verified account saw OTP gate");
  check(verified.state.checkoutOpened === 1 && verified.state.otpRequests === 0, "Verified checkout audit/OTP behavior is wrong");
  await verified.context.close();

  console.log(JSON.stringify({ status: "PASS", emailSends: 0, realNetworkCalls: 0, paytrTokenRequestsBeforeVerification: 0, paytrTokenRequestsAfterVerification: 1, unverifiedCheckoutOpened: 0, verifiedCheckoutOpened: 1, viewports: [390, 1280, 1440] }));
} finally {
  await browser.close();
}
