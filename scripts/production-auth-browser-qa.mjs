import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const projectRef = "mwbrlfmdpbkmdjroxhcc";
const projectUrl = `https://${projectRef}.supabase.co`;
const base = "https://oriens-academy.com";
const raw = execSync(`npx supabase projects api-keys --project-ref ${projectRef}`, { encoding: "utf8", windowsHide: true });
const keys = JSON.parse(raw.slice(raw.indexOf("{"))).keys;
const serviceKey = keys.find((key) => key.id === "service_role")?.api_key;
if (!serviceKey) throw new Error("Service credential is unavailable.");

const service = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `qa-student-a-${suffix}@example.test`;
const password = `Qa!${crypto.randomUUID()}aA1`;
const checks = [];
const issues = [];
const check = (name, condition) => {
  checks.push({ name, pass: Boolean(condition) });
  if (!condition) issues.push(name);
};

let browser;
try {
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "student" },
    user_metadata: { full_name: "Production QA Student", preferred_language: "tr" },
  });
  if (created.error || !created.data.user) throw created.error || new Error("QA user creation failed.");

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const backendResponses = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.hostname.endsWith(".supabase.co")) backendResponses.push({ path: url.pathname, status: response.status() });
  });
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    const sourceUrl = message.location().url || "";
    if (message.type() === "error" && !sourceUrl.startsWith("https://challenges.cloudflare.com/")) issues.push(`console: ${message.text()}`);
  });

  for (const locale of ["tr", "en"]) {
    const loginPath = locale === "tr" ? "/tr/ogrenci/giris/" : "/en/student/login/";
    const accountPath = locale === "tr" ? "/tr/hesabim/" : "/en/account/";
    await page.setViewportSize({ width: locale === "tr" ? 390 : 1440, height: 950 });
    const response = await page.goto(`${base}${loginPath}`, { waitUntil: "domcontentloaded" });
    check(`${locale} student login route`, response?.ok());
    await page.waitForLoadState("networkidle");
    await page.getByRole("textbox", { name: locale === "tr" ? "E-posta" : "Email", exact: true }).fill(email);
    await page.getByLabel(locale === "tr" ? "Şifre" : "Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: locale === "tr" ? "Giriş Yap" : "Log In", exact: true }).click();
    try {
      await page.waitForURL(`**${accountPath}`, { timeout: 20_000 });
    } catch (error) {
      console.log(JSON.stringify({ loginDebug: { locale, url: page.url(), alerts: await page.locator('[role="alert"]').allTextContents(), backendResponses } }));
      throw error;
    }
    await page.getByText(locale === "tr" ? "Hoş geldiniz" : "Welcome", { exact: false }).waitFor({ timeout: 20_000 });
    check(`${locale} real student authentication`, page.url().includes(accountPath));
    check(`${locale} student owns profile data`, (await page.getByText(locale === "tr" ? "Hoş geldiniz, Production" : "Welcome, Production", { exact: false }).count()) > 0);
    check(`${locale} portal no horizontal overflow`, !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)));
    for (const label of locale === "tr"
      ? ["Genel Bakış", "Profilim", "Randevularım", "Derslerim", "Ödevlerim", "Paketim", "Ödemelerim"]
      : ["Overview", "Profile", "Appointments", "Lessons", "Homework", "My Package", "Payments"]) {
      check(`${locale} portal section ${label}`, (await page.getByRole("button", { name: label, exact: true }).count()) > 0);
    }
    await page.getByRole("button", { name: locale === "tr" ? "Çıkış" : "Log out", exact: true }).click();
    await page.waitForURL(`**${loginPath}`, { timeout: 20_000 });
  }

  for (const path of ["/admin/login", "/admin", "/admin/ogrenciler", "/admin/randevular", "/admin/odemeler"]) {
    const response = await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
    check(`protected admin route ${path}`, response?.ok());
    if (path !== "/admin/login") {
      await page.waitForURL(/\/admin\/login\/?$/, { timeout: 20_000 });
      check(`unauthenticated admin redirect ${path}`, page.url().includes("/admin/login"));
    }
  }
} finally {
  await browser?.close();
  const cleanup = await service.rpc("cleanup_student_system_qa", { p_suffix: suffix });
  if (cleanup.error || cleanup.data?.success !== true) issues.push("QA cleanup failed");
  const listed = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const remains = listed.data.users.some((user) => user.email === email);
  check("QA auth cleanup", !remains);
}

console.log(JSON.stringify({ result: issues.length ? "FAIL" : "PASS", checks, issues }, null, 2));
if (issues.length) process.exitCode = 1;
