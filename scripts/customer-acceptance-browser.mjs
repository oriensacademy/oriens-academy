import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = (process.env.QA_BASE_URL || "http://127.0.0.1:57500").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });
const checked = [];

async function enablePricing(page) {
  await page.route("**/rest/v1/site_settings*", (route) => route.fulfill({
    status: 200,
    headers: { "content-type": "application/vnd.pgrst.object+json", "content-range": "0-0/1" },
    body: JSON.stringify({ value: { visible: true } }),
  }));
}

async function assertNoOverflow(page, route, width) {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
  const response = await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
  assert.ok(response?.ok(), `${route} did not return 200 at ${width}px`);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `${route} has ${overflow}px horizontal overflow at ${width}px`);
  checked.push(`${route}@${width}`);
}

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await enablePricing(page);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (request.url().includes("search_autocomplete_entities")) console.log(`[search-request-failed] ${request.failure()?.errorText}`);
  });
  page.on("response", async (response) => {
    if (response.url().includes("search_autocomplete_entities") && !response.ok()) console.log(`[search-response] ${response.status()} ${await response.text().catch(() => "")}`);
  });

  for (const width of [375, 768, 1440]) {
    for (const route of ["/tr/", "/en/", "/tr/sinavlar/", "/tr/kendini-dene/", "/tr/ucretler/", "/tr/hakkimizda/"]) {
      await assertNoOverflow(page, route, width);
    }
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${base}/tr/kendini-dene/`, { waitUntil: "domcontentloaded" });
  const examOptions = page.getByRole("radio");
  assert.equal(await examOptions.count(), 18);
  assert.equal(await examOptions.filter({ hasText: "TARA" }).count(), 1);
  assert.equal(await examOptions.filter({ hasText: "UCAT" }).count(), 1);
  assert.equal(await examOptions.filter({ hasText: "UKCAT" }).count(), 0);
  assert.ok(await examOptions.evaluateAll((nodes) => nodes.every((node) => node.getBoundingClientRect().height >= 44)));
  await examOptions.filter({ hasText: "TARA" }).click();
  await page.getByRole("button", { name: "Testi Başlat" }).click();
  assert.match(await page.locator("body").innerText(), /Soru 1 \/ 6/);
  for (let index = 0; index < 6; index += 1) {
    await page.locator("fieldset input[type=radio]").first().check();
    if (index < 5) await page.getByRole("button", { name: "Sonraki" }).click();
    else await page.getByRole("button", { name: "Testi Bitir" }).click();
  }
  await page.getByText("Explanation & Solution", { exact: false }).first().waitFor();
  assert.doesNotMatch(await page.locator("body").innerText(), /Açıklama\s*&\s*Soru Çözümü/);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/tr/sinavlar/`, { waitUntil: "domcontentloaded" });
  const carousel = page.locator('[data-exam-carousel][data-exam-code="EXAMS"]');
  await carousel.waitFor();
  assert.match(await carousel.innerText(), /01 \/ 18/);
  const next = carousel.getByRole("button", { name: "Next exam" });
  const nextBox = await next.boundingBox();
  assert.ok(nextBox && nextBox.width >= 44 && nextBox.height >= 44);
  await next.click();
  await page.waitForFunction(() => document.querySelector('[data-exam-carousel][data-exam-code="EXAMS"]')?.getAttribute("data-active-card") === "2");
  assert.match(await carousel.innerText(), /02 \/ 18/);
  await carousel.getByRole("region").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector('[data-exam-carousel][data-exam-code="EXAMS"]')?.getAttribute("data-active-card") === "3");

  await page.goto(`${base}/tr/`, { waitUntil: "domcontentloaded" });
  const search = page.locator('input[aria-controls="academic-search-results"]');
  await search.waitFor();
  await page.waitForFunction(() => {
    const input = document.querySelector('input[aria-controls="academic-search-results"]');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith("__reactProps")));
  });
  for (const [query, expected] of [["IB", "International Baccalaureate"], ["UKCAT", "UCAT"], ["Tokyo", "The University of Tokyo"], ["Cape Town", "University of Cape Town"]]) {
    console.log(`[browser-search] ${query}`);
    await search.fill(query);
    const results = page.locator("#academic-search-results");
    await results.waitFor({ timeout: 15_000 });
    await results.getByText(expected, { exact: false }).first().waitFor({ timeout: 15_000 });
    const body = await results.innerText();
    assert.match(body, /SINAVLAR|ÜNİVERSİTELER/i);
  }
  await search.fill("zzzz-no-real-entity-98371");
  await page.getByText("Sonuç bulunamadı.", { exact: true }).waitFor({ timeout: 15_000 });

  const map = page.locator("[data-study-destination-section]");
  await map.scrollIntoViewIfNeeded();
  assert.equal(await map.getByRole("button", { name: "Europe", exact: true }).count(), 0);
  await map.getByRole("button", { name: "Amerika Birleşik Devletleri", exact: true }).click();
  await page.waitForFunction(() => ["success-with-data", "success-empty", "error"].includes(document.querySelector('[data-university-state]')?.getAttribute("data-university-state") || ""));
  const universityState = page.locator("[data-university-state]");
  assert.ok(await universityState.isVisible());
  const cards = universityState.locator("article");
  assert.ok((await cards.count()) <= 3);

  assert.equal(pageErrors.length, 0, `Browser page errors: ${pageErrors.join("; ")}`);
  await context.close();

  for (const mode of ["empty", "error"]) {
    const stateContext = await browser.newContext({ viewport: { width: 768, height: 1000 } });
    const statePage = await stateContext.newPage();
    await statePage.route("**/rest/v1/rpc/get_featured_universities_by_country*", (route) => mode === "empty"
      ? route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
      : route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"QA failure"}' }));
    await statePage.goto(`${base}/en/`, { waitUntil: "domcontentloaded" });
    const panel = statePage.locator("[data-university-state]");
    await panel.waitFor();
    await statePage.waitForFunction((expected) => document.querySelector('[data-university-state]')?.getAttribute("data-university-state") === expected, mode === "empty" ? "success-empty" : "error");
    assert.ok(await panel.isVisible());
    assert.match(await panel.innerText(), /Featured Universities/i);
    await stateContext.close();
  }

  console.log(JSON.stringify({ status: "PASS", viewports: [375, 768, 1440], checkedRoutes: checked.length, search: ["IB", "UKCAT", "Tokyo", "Cape Town"], mapStates: ["success", "empty", "error"], carousel: "keyboard/buttons/18", assessment: "18/6/review" }, null, 2));
} finally {
  await browser.close();
}
