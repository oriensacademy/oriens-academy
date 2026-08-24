import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.PHASE01_BASE_URL || "http://127.0.0.1:57500").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });

function installDevAccount(context, accountType, email) {
  return context.addInitScript(({ accountType: type, email: address }) => {
    localStorage.setItem("oriens_local_dev_auth", JSON.stringify({ accountType: type, email: address }));
  }, { accountType, email });
}

async function mockReadOnlyRest(context, { student = false } = {}) {
  await context.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/rest/v1/")[1]?.split("?")[0];
    const wantsSingle = route.request().headers().accept?.includes("application/vnd.pgrst.object+json");

    if (student && table === "student_profiles") {
      const profile = {
        id: "dev-student-user-00000000",
        full_name: "QA Student",
        email: "qa.student@oriens-academy.com",
        phone: "+90 555 000 0000",
        date_of_birth: null,
        school: "Oriens Academy",
        target_exam: "SAT",
        target_exams: ["SAT", "IB"],
        target_university: "Oxford",
        target_country: "UK",
        target_countries: ["UK", "USA"],
        onboarding_completed: true,
        preferred_language: "tr",
        active: true,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Content-Range": "0-0/1" },
        body: JSON.stringify(wantsSingle ? profile : [profile]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Content-Range": "*/0" },
      body: JSON.stringify(wantsSingle ? null : []),
    });
  });
}

async function runAdminRegression() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await installDevAccount(context, "admin", "admin@oriens-academy.com");
  await mockReadOnlyRest(context);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/admin/odevler`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Ödev & Materyal Yönetimi" }).waitFor({ timeout: 30_000 });

  await page.getByRole("button", { name: "Yeni İçerik Ekle" }).click();
  const contentDialog = page.getByRole("dialog").filter({ hasText: "Yeni İçerik & Materyal Oluştur" });
  await contentDialog.waitFor();

  for (const type of ["Çoktan Seçmeli", "Kısa Cevap", "Uzun Cevap / Essay"]) {
    await contentDialog.getByRole("button", { name: /Yeni Soru Ekle/ }).click();
    await contentDialog.getByRole("menu").getByRole("button", { name: type, exact: true }).click();
    await contentDialog.getByText(type === "Uzun Cevap / Essay" ? "Uzun Cevap" : type, { exact: true }).last().waitFor();
    assert(await contentDialog.isVisible(), `${type}: parent content dialog closed`);
  }
  await contentDialog.getByRole("button", { name: "Vazgeç" }).click();

  await page.getByRole("button", { name: "Soru Kütüphanesi" }).click();
  const librarySearch = page.getByPlaceholder("Soru metni, konu veya ID");
  await librarySearch.waitFor();
  await librarySearch.fill("SAT algebra");
  assert.equal(await librarySearch.inputValue(), "SAT algebra", "question library search is not interactive");
  await page.getByLabel("Soru Tipi").selectOption("multiple_choice");
  assert.equal(await page.getByLabel("Soru Tipi").inputValue(), "multiple_choice", "question type filter did not update");
  await librarySearch.fill("");
  await page.getByLabel("Soru Tipi").selectOption("");
  for (const [type, heading] of [
    ["Çoktan Seçmeli", "Yeni Çoktan Seçmeli Soru"],
    ["Kısa Cevap", "Yeni Kısa Cevap Soru"],
    ["Uzun Cevap / Essay", "Yeni Uzun Cevap / Essay Soru"],
  ]) {
    await page.getByRole("button", { name: /Yeni Soru/ }).click();
    await page.getByRole("menuitem", { name: type, exact: true }).click();
    const editor = page.getByRole("dialog").filter({ hasText: heading });
    await editor.waitFor();
    const box = await editor.locator(":scope > div").boundingBox();
    assert(box && box.width >= 700 && box.width <= 1000, `${type}: editor is not a large centered modal`);
    await editor.getByRole("button", { name: "Kapat" }).click();
  }

  await page.getByRole("button", { name: "İçerikler & Materyaller" }).click();
  await page.getByRole("button", { name: "Yeni İçerik Ekle" }).click();
  const reuseParent = page.getByRole("dialog").filter({ hasText: "Yeni İçerik & Materyal Oluştur" });
  await reuseParent.getByRole("button", { name: "Kayıtlı Sorudan Seç" }).click();
  const poolDialog = page.getByRole("dialog").filter({ hasText: /^Soru Havuzundan Seç/ }).last();
  await poolDialog.waitFor();
  assert(await reuseParent.isVisible(), "question pool closed the parent content dialog");
  await poolDialog.locator("header button").click();
  assert(await reuseParent.isVisible(), "closing question pool closed the parent content dialog");

  await reuseParent.getByRole("button", { name: "Vazgeç" }).click();

  for (const route of [
    "/admin/",
    "/admin/ogrenciler/",
    "/admin/randevular/",
    "/admin/destek/",
    "/admin/odevler/",
    "/admin/fiyatlandirma/",
    "/admin/ayarlar/",
  ]) {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ timeout: 30_000 });
    assert(response?.ok(), `${route}: admin page did not return HTTP 200`);
    assert(!page.url().includes("/admin/login"), `${route}: admin session was rejected`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 1, `${route}: admin page has ${overflow}px horizontal overflow`);
  }

  await page.goto(`${baseUrl}/tr/ucretler/`, { waitUntil: "domcontentloaded" });
  const pricingBody = await page.locator("body").innerText();
  assert(!pricingBody.includes("Yönetici Önizleme Modu"), "public pricing exposes the admin preview banner");
  assert(!pricingBody.includes("Fiyatlandırma Yönetimi"), "public pricing exposes an admin management control");

  assert.equal(pageErrors.length, 0, `admin UI page errors: ${pageErrors.join("; ")}`);
  await context.close();
  return "admin question builder/library: PASS";
}

async function runStudentLayoutRegression() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await installDevAccount(context, "student", "qa.student@oriens-academy.com");
  await mockReadOnlyRest(context, { student: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/tr/hesabim`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Profilim", exact: true }).waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: "Profilim", exact: true }).click();
  await page.getByText("Hesap Güvenliği", { exact: true }).waitFor();

  const emailForm = page.getByRole("heading", { name: "E-posta Değiştir" }).locator("xpath=ancestor::form");
  const passwordForm = page.getByRole("heading", { name: "Şifre Belirle" }).locator("xpath=ancestor::form");
  const emailBox = await emailForm.boundingBox();
  const passwordBox = await passwordForm.boundingBox();
  assert(emailBox && passwordBox);
  assert(Math.abs(emailBox.width - passwordBox.width) <= 1, "desktop security columns are not equal width");
  assert(Math.abs((emailBox.y + emailBox.height) - (passwordBox.y + passwordBox.height)) <= 1, "desktop security buttons do not share a baseline");
  const emailInput = await emailForm.locator("input").boundingBox();
  const passwordInput = await passwordForm.locator("input").boundingBox();
  assert(emailInput && passwordInput && Math.abs(emailInput.width - passwordInput.width) <= 1, "desktop security inputs are not equal width");

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileEmailBox = await emailForm.boundingBox();
  const mobilePasswordBox = await passwordForm.boundingBox();
  assert(mobileEmailBox && mobilePasswordBox && mobilePasswordBox.y > mobileEmailBox.y + mobileEmailBox.height, "mobile security forms are not stacked");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `mobile page has ${overflow}px horizontal overflow`);
  assert.equal(pageErrors.length, 0, `student UI page errors: ${pageErrors.join("; ")}`);
  await context.close();
  return "student account security layout: PASS";
}

try {
  const results = [await runAdminRegression(), await runStudentLayoutRegression()];
  console.log(JSON.stringify({ status: "PASS", results }, null, 2));
} finally {
  await browser.close();
}
