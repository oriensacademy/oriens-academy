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
const guardian = { user_id: holderId, full_name: "QA Account Holder", email: user.email, phone: "+905551112233", preferred_language: "tr", email_verified_at: new Date().toISOString(), active: true };
const learner = { id: learnerId, full_name: "QA Learner", email: "learner@example.test", active: true, preferred_language: "tr" };
const relation = { guardian_user_id: holderId, student_id: learnerId, relationship_role: "parent", is_primary: true, active: true };
const json = (route, body, object = false) => route.fulfill({ status: 200, headers: { "content-type": object ? "application/vnd.pgrst.object+json" : "application/json" }, body: JSON.stringify(body) });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  await context.addInitScript(({ authKey, authValue, cartKey, cartValue }) => {
    localStorage.setItem(authKey, JSON.stringify(authValue));
    localStorage.setItem(cartKey, JSON.stringify(cartValue));
  }, { authKey: `sb-${projectRef}-auth-token`, authValue: session, cartKey: `oriens_cart_user_${holderId}`, cartValue: packages.map((pkg) => ({ packageId: pkg.id, quantity: 1 })) });
  const page = await context.newPage();
  await page.route("**/auth/v1/user*", (route) => json(route, user, true));
  await page.route("**/rest/v1/**", (route) => {
    const url = route.request().url();
    const object = (route.request().headers().accept || "").includes("vnd.pgrst.object");
    if (url.includes("guardian_accounts")) return json(route, object ? guardian : [guardian], object);
    if (url.includes("guardian_students")) return json(route, [relation]);
    if (url.includes("student_profiles")) return json(route, object ? learner : [learner], object);
    if (url.includes("pricing_packages")) return json(route, object ? packages[0] : packages, object);
    if (url.includes("site_settings")) return json(route, []);
    return json(route, object ? null : [], object);
  });

  const widths = [375, 768, 1024, 1440, 1920];
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 800 ? 900 : 1000 });
    const response = await page.goto(`${base}/tr/odeme/?source=cart`, { waitUntil: "networkidle" });
    if (!response?.ok()) throw new Error(`Checkout returned ${response?.status()} at ${width}px`);
    await page.getByText("10 Derslik Paket", { exact: true }).waitFor();
    if (await page.getByText("5 Derslik Paket", { exact: true }).count() !== 1) throw new Error(`Second cart package missing at ${width}px`);
    if (await page.locator("#checkout-billing-address").count()) throw new Error("Public address field is still visible");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflow) throw new Error(`Checkout horizontally overflows at ${width}px`);
  }

  const coupon = page.getByPlaceholder("Kupon kodu");
  await coupon.fill("TABSTATE");
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  const secondTab = await context.newPage();
  await secondTab.goto(`${base}/tr/`, { waitUntil: "domcontentloaded" });
  await page.bringToFront();
  if (await coupon.inputValue() !== "TABSTATE") throw new Error("Coupon state was lost after tab switch");
  if (!(await page.getByRole("checkbox").nth(0).isChecked()) || !(await page.getByRole("checkbox").nth(1).isChecked())) throw new Error("Agreement state was lost after tab switch");
  if (await page.getByText("Fatura / Ödeme Adresi", { exact: true }).count()) throw new Error("Address copy is visible");
  console.log(JSON.stringify({ status: "PASS", widths, packageCount: 2, total: 42000, tabStatePreserved: true, addressField: false, providerCalls: 0 }));
} finally {
  await browser.close();
}
