import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:3010";
const env = readFileSync(".env.local", "utf8");
const supabaseUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "") || "";
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const now = Math.floor(Date.now() / 1000);
const checks = [];
const issues = [];
const check = (name, value) => {
  checks.push({ name, pass: Boolean(value) });
  if (!value) issues.push(name);
};
const pathOf = (url) => new URL(url).pathname.replace(/\/$/, "");
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const json = (route, body, object = false, status = 200) => route.fulfill({
  status,
  headers: { "content-type": object ? "application/vnd.pgrst.object+json" : "application/json" },
  body: body === null ? "null" : JSON.stringify(body),
});

function identity(role) {
  const id = role === "admin" ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" : role === "student" ? "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" : "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const app_metadata = role === "admin" ? { role: "admin", provider: "email", providers: ["email"] } : { provider: "email", providers: ["email"] };
  const user = { id, aud: "authenticated", role: "authenticated", email: `${role}@example.test`, email_confirmed_at: new Date().toISOString(), app_metadata, user_metadata: {}, identities: [], created_at: new Date().toISOString() };
  const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ aud: "authenticated", exp: now + 3600, sub: id, role: "authenticated", app_metadata, user_metadata: {} })}.qa`;
  return { user, session: { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: `qa-${role}-refresh`, user } };
}

const profiles = {
  admin: { user_id: identity("admin").user.id, display_name: "QA Admin", role: "admin", active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  student: { id: identity("student").user.id, full_name: "QA Student", email: "student@example.test", phone: null, date_of_birth: null, preferred_language: "tr", school: null, target_country: null, target_university: null, target_exam: null, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
};

async function configure(context, initialRole = null) {
  let role = initialRole;
  if (initialRole) {
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: `sb-${projectRef}-auth-token`, value: identity(initialRole).session });
  }
  const page = await context.newPage();
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    const source = message.location().url || "";
    if (message.type() === "error" && !source.startsWith("https://challenges.cloudflare.com/") && !message.text().includes("Turnstile")) issues.push(`console: ${message.text()}`);
  });
  await page.route("**/auth/v1/token?grant_type=password", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    role = String(body.email || "").split("@")[0];
    return json(route, identity(role).session);
  });
  await page.route("**/auth/v1/user*", (route) => role ? json(route, identity(role).user, true) : json(route, { message: "not authenticated" }, false, 401));
  await page.route("**/auth/v1/logout*", (route) => { role = null; return route.fulfill({ status: 204, body: "" }); });
  await page.route("**/rest/v1/**", (route) => {
    const url = route.request().url();
    if (url.includes("admin_profiles")) return json(route, role === "admin" ? profiles.admin : null, true);
    if (url.includes("student_profiles")) return json(route, role === "student" ? profiles.student : null, true);
    if (url.includes("site_settings")) return json(route, []);
    return json(route, []);
  });
  return page;
}

const browser = await chromium.launch({ headless: true });
try {
  const guestContext = await browser.newContext();
  const guest = await configure(guestContext);
  for (const [locale, path, label] of [["tr", "/tr/giris", "Oturum Aç"], ["en", "/en/login", "Sign In"]]) {
    for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
      await guest.setViewportSize({ width, height: 960 });
      const response = await guest.goto(`${base}${path}`, { waitUntil: "networkidle" });
      check(`${locale} login ${width}px loads`, response?.ok());
      check(`${locale} login ${width}px no overflow`, !(await guest.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
    }
    check(`${locale} neutral login label`, await guest.getByRole("heading", { name: label, exact: true }).isVisible());
    check(`${locale} public login has no role wording`, !/(admin|yönetici|öğrenci girişi|student login)/i.test(await guest.locator("body").innerText()));
  }
  await guest.goto(`${base}/tr`, { waitUntil: "networkidle" });
  check("TR header uses Oturum Aç", (await guest.getByRole("link", { name: "Oturum Aç", exact: true }).count()) > 0);
  await guest.goto(`${base}/en`, { waitUntil: "networkidle" });
  check("EN header uses Sign In", (await guest.getByRole("link", { name: "Sign In", exact: true }).count()) > 0);
  await guest.goto(`${base}/admin`, { waitUntil: "networkidle" });
  await guest.waitForTimeout(1_500);
  check(`guest admin route uses unified login with return [${guest.url()}]`, pathOf(guest.url()) === "/tr/giris" && (new URL(guest.url()).searchParams.get("next") || "").replace(/\/$/, "") === "/admin");
  for (const [legacy, expected] of [["/admin/login", "/tr/giris"], ["/admin/forgot-password", "/tr/sifremi-unuttum"], ["/tr/ogrenci/giris", "/tr/giris"], ["/en/student/login", "/en/login"]]) {
    await guest.goto(`${base}${legacy}`, { waitUntil: "domcontentloaded" });
    await guest.waitForURL((url) => url.pathname.replace(/\/$/, "") === expected);
    check(`legacy redirect ${legacy}`, pathOf(guest.url()) === expected);
  }
  for (const [forgot, heading] of [["/tr/sifremi-unuttum", "Şifremi Unuttum"], ["/en/forgot-password", "Forgot Password"]]) {
    await guest.goto(`${base}${forgot}`, { waitUntil: "networkidle" });
    check(`shared forgot-password route ${forgot}`, await guest.getByRole("heading", { name: heading, exact: true }).isVisible());
    check(`forgot-password route ${forgot} is neutral`, !/(admin|yönetici|öğrenci girişi|student login)/i.test(await guest.locator("body").innerText()));
  }
  await guestContext.close();

  const studentContext = await browser.newContext();
  const student = await configure(studentContext);
  await student.goto(`${base}/tr/giris`, { waitUntil: "networkidle" });
  await student.locator("#account-email").fill("student@example.test");
  await student.locator("#account-password").fill("Password1!");
  await student.getByRole("button", { name: "Oturum Aç", exact: true }).click();
  await student.waitForURL((url) => url.pathname.replace(/\/$/, "") === "/tr/hesabim");
  await student.getByText("Hoş geldiniz", { exact: false }).waitFor();
  check("student login routes to student account", pathOf(student.url()) === "/tr/hesabim");
  await student.reload({ waitUntil: "networkidle" });
  check("student refresh preserves session", pathOf(student.url()) === "/tr/hesabim");
  await student.goto(`${base}/admin`, { waitUntil: "networkidle" });
  await student.waitForURL((url) => url.pathname.replace(/\/$/, "") === "/tr/hesabim");
  check("student cannot enter admin", pathOf(student.url()) === "/tr/hesabim");
  await student.goto(`${base}/en/account`, { waitUntil: "networkidle" });
  await student.getByText("Welcome", { exact: false }).waitFor();
  check("student can use EN account", pathOf(student.url()) === "/en/account");
  await student.getByRole("button", { name: "Log out", exact: true }).click();
  await student.waitForURL((url) => url.pathname.replace(/\/$/, "") === "/en");
  check("logout returns to public site", pathOf(student.url()) === "/en");
  check("logout clears persisted session", await student.evaluate((key) => localStorage.getItem(key) === null, `sb-${projectRef}-auth-token`));
  await studentContext.close();

  const adminContext = await browser.newContext();
  const admin = await configure(adminContext);
  await admin.goto(`${base}/en/login?next=%2Fadmin%2Fayarlar`, { waitUntil: "networkidle" });
  await admin.locator("#account-email").fill("admin@example.test");
  await admin.locator("#account-password").fill("Password1!");
  await admin.getByRole("button", { name: "Sign In", exact: true }).click();
  await admin.waitForURL((url) => url.pathname.replace(/\/$/, "") === "/admin/ayarlar");
  check("admin safe return URL is preserved", pathOf(admin.url()) === "/admin/ayarlar");
  await admin.reload({ waitUntil: "networkidle" });
  check("admin refresh preserves session", pathOf(admin.url()) === "/admin/ayarlar");
  await admin.goto(`${base}/tr/hesabim`, { waitUntil: "networkidle" });
  await admin.waitForURL((url) => url.pathname.replace(/\/$/, "") === "/admin");
  check("admin entering student route returns to admin", pathOf(admin.url()) === "/admin");
  await adminContext.close();

  const unknownContext = await browser.newContext();
  const unknown = await configure(unknownContext);
  await unknown.goto(`${base}/tr/giris?next=%2Fadmin`, { waitUntil: "networkidle" });
  await unknown.locator("#account-email").fill("unknown@example.test");
  await unknown.locator("#account-password").fill("Password1!");
  await unknown.getByRole("button", { name: "Oturum Aç", exact: true }).click();
  const unknownAlert = unknown.locator('[role="alert"]').filter({ hasText: "aktif bir Oriens Academy profili" });
  await unknownAlert.waitFor();
  check("unknown account denied with safe error", await unknownAlert.isVisible());
  check("unknown account never reaches admin", pathOf(unknown.url()) === "/tr/giris");
  await unknownContext.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify({ result: issues.length ? "FAIL" : "PASS", checks, issues }, null, 2));
if (issues.length) process.exitCode = 1;
