import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = (process.env.QA_BASE_URL || "http://127.0.0.1:57500").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });

try {
  for (const width of [375, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const response = await page.goto(`${base}/tr/`, { waitUntil: "domcontentloaded" });
    assert.ok(response?.ok(), `home did not load at ${width}px`);
    await page.locator('[data-study-destination-section] [role="group"]').waitFor();
    const result = await page.evaluate(() => {
      const section = document.querySelector("[data-study-destination-section]");
      const group = section?.querySelector('[role="group"]');
      const selectorWrapper = group?.parentElement;
      const contentGrid = selectorWrapper?.nextElementSibling;
      if (!section || !group || !selectorWrapper || !contentGrid) return null;
      const groupRect = group.getBoundingClientRect();
      const wrapperRect = selectorWrapper.getBoundingClientRect();
      const gridRect = contentGrid.getBoundingClientRect();
      const buttons = [...group.querySelectorAll("button")].map((button) => button.getBoundingClientRect());
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        aligned: Math.abs(wrapperRect.left - gridRect.left) <= 1 && Math.abs(wrapperRect.right - gridRect.right) <= 1,
        contained: buttons.every((rect) => rect.left >= groupRect.left - 1 && rect.right <= groupRect.right + 1),
        count: buttons.length,
      };
    });
    assert.ok(result, `selector DOM missing at ${width}px`);
    assert.ok(result.overflow <= 1, `${result.overflow}px horizontal overflow at ${width}px`);
    assert.equal(result.aligned, true, `selector/content bounds differ at ${width}px`);
    assert.equal(result.contained, true, `a country chip escapes the row at ${width}px`);
    assert.equal(result.count, 8, `country count changed at ${width}px`);
    console.log(`COUNTRY ${width}px PASS`);
    await page.close();
  }
} finally {
  await browser.close();
}
