#!/usr/bin/env node

import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.SEARCH_QA_BASE_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });
const viewports = [375, 768, 1024, 1440, 1920];
const results = [];

try {
  for (const width of viewports) {
    const page = await browser.newPage({ viewport: { width, height: width <= 768 ? 812 : 1000 } });
    await page.goto(`${baseUrl}/tr`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const input = page.getByRole("combobox").first();
    await input.fill("lse");
    await page.getByText("London School of Economics and Political Science", { exact: true }).first().waitFor({ timeout: 8_000 });
    const geometry = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      listbox: (() => {
        const element = document.querySelector('[role="listbox"]');
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, width: box.width };
      })(),
    }));
    assert.ok(geometry.scrollWidth <= geometry.viewport + 1, `${width}px horizontal overflow`);
    assert.ok(geometry.listbox && geometry.listbox.left >= -1 && geometry.listbox.right <= width + 1, `${width}px dropdown bounds`);
    const inputTargetHeight = await input.evaluate((element) => element.parentElement?.getBoundingClientRect().height || 0);
    assert.ok(inputTargetHeight >= 44, `${width}px input touch target`);
    await input.press("ArrowDown");
    assert.ok(await input.getAttribute("aria-activedescendant"), `${width}px keyboard active option`);
    await page.close();
    results.push({ width, overflow: false, dropdown: geometry.listbox });
  }

  const statePage = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  await statePage.route("**/rest/v1/rpc/search_autocomplete_entities_v2", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: "[]",
  }));
  await statePage.goto(`${baseUrl}/tr`, { waitUntil: "domcontentloaded" });
  const stateInput = statePage.getByRole("combobox").first();
  await stateInput.fill("zzzzzzzz-no-university");
  await statePage.getByText("Sonuç bulunamadı.", { exact: true }).waitFor({ timeout: 8_000 });
  await statePage.close();

  const errorPage = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  await errorPage.route("**/rest/v1/rpc/search_autocomplete_entities_v2", (route) => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ code: "QA_UNAVAILABLE" }),
  }));
  await errorPage.goto(`${baseUrl}/tr`, { waitUntil: "domcontentloaded" });
  await errorPage.getByRole("combobox").first().fill("bristol-service-error");
  await errorPage.getByText("Üniversite araması şu anda kullanılamıyor. Lütfen yeniden deneyin.", { exact: true })
    .waitFor({ timeout: 8_000 });
  await errorPage.close();

  const stalePage = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  const rpcQueries = [];
  await stalePage.route("**/rest/v1/rpc/search_autocomplete_entities_v2", async (route) => {
    const query = JSON.parse(route.request().postData() || "{}").p_query;
    rpcQueries.push(query);
    if (query === "bristol") await new Promise((resolve) => setTimeout(resolve, 900));
    const isOxford = query === "oxford";
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{
      entity_id: isOxford ? "qa-oxford" : "qa-bristol", entity_type: "UNIVERSITY",
      title: isOxford ? "University of Oxford" : "University of Bristol", subtitle: "QA",
      slug: isOxford ? "university-of-oxford" : "university-of-bristol", match_layer: 1,
      score: 2000, country_iso2: "GB", country_name: "United Kingdom", badge: null, official_url: null,
    }]) });
  });
  await stalePage.goto(`${baseUrl}/tr`, { waitUntil: "domcontentloaded" });
  const staleInput = stalePage.getByRole("combobox").first();
  await staleInput.fill("bristol");
  await stalePage.waitForTimeout(350);
  await staleInput.fill("oxford");
  await stalePage.getByText("University of Oxford", { exact: true }).waitFor({ timeout: 4_000 });
  await stalePage.waitForTimeout(1_000);
  assert.equal(await stalePage.getByText("University of Bristol", { exact: true }).count(), 0, "stale result overwrote current query");
  assert.deepEqual(rpcQueries, ["bristol", "oxford"], "one RPC per debounced query");
  await stalePage.close();

  console.log(JSON.stringify({ status: "PASS", baseUrl, viewports: results, states: ["loading", "results", "no-results", "service-error", "stale-abort"] }, null, 2));
} finally {
  await browser.close();
}
