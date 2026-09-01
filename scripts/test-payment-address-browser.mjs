import fs from "node:fs";
import { chromium } from "playwright";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:62174";
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
let savedAddress = "Bağdat Caddesi 100 Kadıköy İstanbul";
let capturedPayload = null;

const learner = { id: learnerId, full_name: "QA Learner", email: "learner@example.test", active: true, preferred_language: "tr", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
const packageRow = { id: "package10", name_tr: "10 Derslik Paket", name_en: "10-Lesson Package", description_tr: "", description_en: "", price_amount: 27000, current_total: 27000, currency: "TRY", lesson_count: 10, unit_price: 2700, purchase_mode: "purchasable", active: true, featured: false, display_order: 1, billing_basis: "package", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
const json = (route, body, object = false) => route.fulfill({ status: 200, headers: { "content-type": object ? "application/vnd.pgrst.object+json" : "application/json" }, body: JSON.stringify(body) });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: `sb-${projectRef}-auth-token`, value: session });
  const page = await context.newPage();
  await page.route("**/auth/v1/user*", (route) => json(route, user, true));
  await page.route("**/rest/v1/**", (route) => {
    const url = route.request().url();
    const object = (route.request().headers().accept || "").includes("vnd.pgrst.object");
    if (url.includes("guardian_accounts")) {
      const holder = { user_id: holderId, full_name: "QA Account Holder", email: "holder@example.test", phone: "+905551112233", contact_address: savedAddress, preferred_language: "tr", email_verified_at: new Date().toISOString(), active: true, migration_source: "qa", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      return json(route, object ? holder : [holder], object);
    }
    if (url.includes("guardian_students")) return json(route, [{ guardian_user_id: holderId, student_id: learnerId, relationship_role: "parent", is_primary: true, active: true, source: "qa", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
    if (url.includes("student_profiles")) return json(route, object ? learner : [learner], object);
    if (url.includes("pricing_packages")) return json(route, object ? packageRow : [packageRow], object);
    if (url.includes("site_settings")) return json(route, []);
    return json(route, object ? null : [], object);
  });
  await page.route("**/functions/v1/paytr-create-token", async (route) => {
    capturedPayload = route.request().postDataJSON();
    savedAddress = capturedPayload.payerAddress;
    return json(route, { success: true, iframe_token: "safe_mock_token", merchant_oid: "QA_ONLY", reference: "QA_ONLY", statusToken: "QA_ONLY", final_amount: 27000, currency: "TRY" });
  });

  const results = [];
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 800 ? 900 : 1000 });
    const response = await page.goto(`${base}/tr/odeme?package=package10`, { waitUntil: "networkidle" });
    if (!response?.ok()) throw new Error(`checkout returned ${response?.status()} at ${width}px`);
    const field = page.getByLabel("Fatura / Ödeme Adresi");
    await field.waitFor();
    if ((await field.inputValue()) !== savedAddress) throw new Error(`saved address did not prefill at ${width}px`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflow) throw new Error(`checkout overflows at ${width}px`);
    results.push({ width, overflow: false, addressPrefilled: true });
  }

  const field = page.getByLabel("Fatura / Ödeme Adresi");
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  await field.fill("short");
  await page.getByRole("button", { name: "Ödemeye Geç" }).click();
  await page.getByText("Fatura / ödeme adresi 10–300 karakter olmalıdır.", { exact: true }).waitFor();
  const editedAddress = "Yeni Mahalle Uzun Sokak 25 Beşiktaş İstanbul";
  await field.fill(editedAddress);
  await page.getByRole("button", { name: "Ödemeye Geç" }).click();
  await page.waitForTimeout(600);
  if (!capturedPayload) throw new Error("token request was not captured");
  if (capturedPayload.payerAddress !== editedAddress) throw new Error("edited address did not reach token request");
  if (capturedPayload.guardianUserId) throw new Error("customer checkout supplied an admin guardian override");
  if ("cardNumber" in capturedPayload || "cvv" in capturedPayload || "pan" in capturedPayload) throw new Error("card secrets appeared in Oriens payload");

  await page.reload({ waitUntil: "networkidle" });
  if ((await page.getByLabel("Fatura / Ödeme Adresi").inputValue()) !== editedAddress) throw new Error("edited address did not prefill on next checkout");
  console.log(JSON.stringify({ status: "PASS", results, requestCapture: { payerAddress: capturedPayload.payerAddress, learnerId: capturedPayload.learnerId, packageId: capturedPayload.packageId, hasCardSecrets: false }, simulatedProviderCalls: 0, charges: 0, refunds: 0 }));
  await context.close();
} finally {
  await browser.close();
}
