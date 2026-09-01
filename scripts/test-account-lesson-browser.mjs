import fs from "node:fs";
import { chromium } from "playwright";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:62173";
const env = fs.readFileSync(".env.local", "utf8");
const supabaseUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "") || "";
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const studentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const now = Math.floor(Date.now() / 1000);
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const user = { id: studentId, aud: "authenticated", role: "authenticated", email: "holder@example.test", email_confirmed_at: new Date().toISOString(), app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: new Date().toISOString() };
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ aud: "authenticated", exp: now + 3600, sub: studentId, role: "authenticated" })}.qa`;
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "qa-refresh", user };
const profile = { id: studentId, full_name: "QA Learner", email: "learner@example.test", phone: null, date_of_birth: null, preferred_language: "tr", school: null, target_country: null, target_university: null, target_exam: null, target_exams: [], target_countries: [], onboarding_completed: false, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), migration_source: "qa", legacy_auth_user_id: null };
const purchase = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", student_user_id: studentId, package_id: "package10", payment_transaction_id: null, lesson_count: 10, lessons_used: 1, start_date: "2026-09-01", end_date: null, status: "active", created_at: new Date().toISOString(), price_amount: 100, currency: "TRY", payment_status: "paid", assignment_source: "qa", assigned_by: null, updated_at: new Date().toISOString(), custom_package_name: null, admin_notes: null, pricing_packages: { name_tr: "10 Derslik Paket", name_en: "10-Lesson Package" } };

const json = (route, body, object = false) => route.fulfill({ status: 200, headers: { "content-type": object ? "application/vnd.pgrst.object+json" : "application/json" }, body: JSON.stringify(body) });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  const guest = await browser.newPage();
  for (const width of [375, 768, 1024, 1440]) {
    await guest.setViewportSize({ width, height: width < 800 ? 900 : 1000 });
    for (const route of ["/tr", "/en", "/tr/giris", "/en/login", "/tr/ucretler", "/en/pricing"]) {
      const response = await guest.goto(`${base}${route}`, { waitUntil: "networkidle" });
      if (!response?.ok()) throw new Error(`${route} returned ${response?.status()}`);
      const overflow = await guest.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      if (overflow) throw new Error(`${route} overflows at ${width}px`);
    }
    results.push({ width, publicOverflow: false });
  }
  await guest.goto(`${base}/tr/giris`, { waitUntil: "networkidle" });
  if (!(await guest.getByRole("heading", { name: "Hesabınıza Giriş Yapın", exact: true }).isVisible())) throw new Error("TR login heading missing");
  await guest.getByRole("tab", { name: "Kayıt Ol" }).click();
  if (!(await guest.getByRole("heading", { name: "Hesap Oluştur", exact: true }).isVisible())) throw new Error("TR registration heading missing");
  if (/18 yaş altı|veli mi|öğrenci mi/i.test(await guest.locator("body").innerText())) throw new Error("Forbidden registration choice/note rendered");
  await guest.goto(`${base}/tr/ucretler`, { waitUntil: "networkidle" });
  if ((await guest.getByText("Şeffaf Fiyatlandırma", { exact: true }).count()) !== 1) throw new Error("Pricing transparency block is duplicated");
  await guest.close();

  const context = await browser.newContext({ viewport: { width: 375, height: 900 } });
  await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: `sb-${projectRef}-auth-token`, value: session });
  const page = await context.newPage();
  await page.route("**/auth/v1/user*", (route) => json(route, user, true));
  await page.route("**/auth/v1/logout*", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/rest/v1/**", (route) => {
    const url = route.request().url();
    const object = (route.request().headers().accept || "").includes("vnd.pgrst.object");
    if (url.includes("guardian_accounts")) return json(route, { user_id: studentId, full_name: "QA Holder", email: "holder@example.test", phone: "+905550000000", contact_address: "QA address text", preferred_language: "tr", email_verified_at: new Date().toISOString(), active: true, migration_source: "qa", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, true);
    if (url.includes("guardian_students")) return json(route, [{ guardian_user_id: studentId, student_id: studentId, relationship_role: "self", is_primary: true, active: true, source: "qa", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
    if (url.includes("student_profiles")) return json(route, object ? profile : [profile], object);
    if (url.includes("student_package_purchases")) return json(route, [purchase]);
    if (url.includes("site_settings") || url.includes("pricing_packages")) return json(route, []);
    return json(route, object ? null : [], object);
  });

  await page.goto(`${base}/tr/hesabim`, { waitUntil: "networkidle" });
  await page.getByText("10 Derslik Paket", { exact: true }).first().waitFor();
  const body = await page.locator("body").innerText();
  if (!body.includes("Toplam Kullanılan: 1 / 10") || !body.includes("Toplam Kalan: 9 Ders")) throw new Error("10/1/9 entitlement summary missing");
  if (body.includes("Öğrencilerim") || body.includes("Paketim")) throw new Error("Forbidden portal navigation rendered");

  const menuButton = page.getByRole("button", { name: /menü/i }).first();
  await menuButton.click();
  await page.getByRole("button", { name: "Çıkış Yap", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /çıkış yapmak/i });
  await dialog.waitFor();
  const bounds = await dialog.locator("xpath=..").boundingBox();
  if (!bounds || bounds.width < 374 || bounds.height < 899) throw new Error("Logout backdrop is not full viewport");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  if (!(await menuButton.evaluate((node) => node === document.activeElement))) throw new Error("Mobile logout did not return focus to menu trigger");
  results.push({ mobileLogoutPortal: true, focusReturn: true, entitlement: "10/1/9" });
  await context.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify({ status: "PASS", results }));
