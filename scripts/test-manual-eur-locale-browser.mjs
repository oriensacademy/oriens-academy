import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.QA_BASE_URL || "http://localhost:3000";
const baseUrl = new URL(base);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

try {
  await context.addCookies([{ name: "oriens_locale", value: "en", domain: baseUrl.hostname, path: "/", sameSite: "Lax", secure: baseUrl.protocol === "https:" }]);
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/en\/$/);
  assert.match(page.url(), /\/en\/$/);

  await page.goto(`${base}/en/pricing/`, { waitUntil: "networkidle" });
  await page.locator("[data-pricing-current-price]").first().waitFor();
  const prices = await page.locator("[data-pricing-current-price]").allTextContents();
  assert.deepEqual(prices.map((value) => value.trim()), ["€59.99", "€269.99", "€499.99", "€899.99", "€1,299.99"]);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);

  for (const path of ["/en/", "/en/exams/", "/en/about/", "/en/contact/", "/en/cart/"]) {
    await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
    assert.match(page.url(), /\/en\//);
    assert.equal(await page.evaluate(() => document.documentElement.lang), "en");
  }

  await page.goto(`${base}/en/pricing/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "TR", exact: true }).first().click();
  await page.waitForURL(/\/tr\/ucretler\/$/);
  assert.match((await context.cookies()).find((cookie) => cookie.name === "oriens_locale")?.value || "", /^tr$/);
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.match(page.url(), /\/tr\/ucretler\/$/);

  await page.locator("[data-pricing-current-price]").first().waitFor();
  const trPrices = await page.locator("[data-pricing-current-price]").allTextContents();
  assert.deepEqual(trPrices.map((value) => value.trim()), ["3.200 TL", "15.000 TL", "27.000 TL", "51.000 TL", "72.000 TL"]);
  console.log("PASS: mobile EUR/TRY package display and persistent TR/EN navigation");
} finally {
  await browser.close();
}
