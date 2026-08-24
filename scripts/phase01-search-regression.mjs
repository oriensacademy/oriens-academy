import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.SEARCH_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const examCases = [
  ["sat", "sat"], ["SAT", "sat"], ["ib", "ib"], ["ap", "ap"],
  ["esat", "esat"], ["tmua", "tmua"], ["imat", "imat"], ["ucat", "ukcat"],
  ["ompt", "ompt"], ["gre", "gre"], ["gmat", "gmat"],
];

const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const locale of ["tr", "en"]) {
    for (const [query, slug] of examCases) {
      console.log(`[search] ${locale}:${query}`);
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${baseUrl}/${locale}/`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => {
        const input = document.querySelector('input[aria-controls="academic-search-results"]');
        return Boolean(input && Object.keys(input).some((key) => key.startsWith("__reactProps")));
      }, { timeout: 30_000 });
      await page.locator('input[aria-controls="academic-search-results"]').fill(query);
      const group = page.locator("#academic-search-results");
      await group.waitFor({ timeout: 30_000 });
      const titlePattern = query === "ucat" ? /UCAT|UKCAT/i : new RegExp(`\\b${query}\\b`, "i");
      const option = group.getByRole("option").filter({ hasText: titlePattern }).first();
      await option.waitFor({ timeout: 30_000 });
      await option.click();
      const hub = locale === "tr" ? "sinavlar" : "exams";
      await page.waitForURL(new RegExp(`/${locale}/${hub}/${slug}/?$`), { timeout: 15_000 });
      await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 15_000 });
      const body = await page.locator("body").innerText();
      assert(!body.includes("This page couldn't load") && !body.includes("Reload to try again"));
      assert.equal(errors.length, 0, `${locale}/${query}: ${errors.join("; ")}`);
      results.push(`${locale}:${query}->${new URL(page.url()).pathname}`);
      await page.close();
    }
  }

  for (const [query, expectedHost] of [["oxford", "ox.ac.uk"], ["harvard", "harvard.edu"]]) {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/en/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const input = document.querySelector('input[aria-controls="academic-search-results"]');
      return Boolean(input && Object.keys(input).some((key) => key.startsWith("__reactProps")));
    }, { timeout: 30_000 });
    await page.locator('input[aria-controls="academic-search-results"]').fill(query);
    const option = page.locator("#academic-search-results").getByRole("option").filter({ hasText: new RegExp(query, "i") }).first();
    await option.waitFor({ timeout: 15_000 });
    const popupPromise = page.waitForEvent("popup");
    await option.click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded").catch(() => {});
    const hostname = new URL(popup.url()).hostname;
    assert(hostname.endsWith(expectedHost), `${query}: unexpected official host ${hostname}`);
    results.push(`${query}->${hostname}`);
    await popup.close();
    await page.close();
  }

  console.log(JSON.stringify({ status: "PASS", results }, null, 2));
} finally {
  await browser.close();
}
