import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:3010";
const browser = await chromium.launch({ headless: true });
const viewports = [375, 768, 1024, 1440, 1920];
const results = [];

try {
  for (const width of viewports) {
    const page = await browser.newPage({ viewport: { width, height: width < 700 ? 812 : 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/tr/`, { waitUntil: "networkidle" });

    const languageLabels = await page.locator('header [role="group"] a').allTextContents();
    assert.deepEqual(languageLabels.map((label) => label.trim()), ["TR", "ENG"]);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);

    if (width >= 640) {
      const signIn = page.getByRole("link", { name: "Giriş Yap" }).first();
      if (await signIn.isVisible()) {
        const layout = await signIn.evaluate((node) => ({
          whiteSpace: getComputedStyle(node).whiteSpace,
          textFits: node.scrollWidth <= node.clientWidth,
        }));
        assert.equal(layout.whiteSpace, "nowrap", `Giriş Yap is not nowrap at ${width}px`);
        assert.equal(layout.textFits, true, `Giriş Yap overflows at ${width}px`);
      }
    }

    const consultationLinks = page.locator('a[href*="#consultation-form"]');
    assert.ok(await consultationLinks.count(), `consultation CTA missing at ${width}px`);
    for (const href of await consultationLinks.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")))) {
      assert.match(href || "", /\/tr\/?(?:\?[^#]*)?#consultation-form$|^#consultation-form$/);
    }

    const marquee = page.locator('[data-testid="testimonial-marquee"]');
    assert.ok(await marquee.count(), "testimonial marquee missing");
    assert.equal(await marquee.locator('[data-marquee-row]').count(), 2);
    const cards = await marquee.locator("article:not([aria-hidden=true])").count();
    assert.ok(cards >= 12 && cards <= 16, `expected 12–16 real selected testimonials, got ${cards}`);
    assert.equal(errors.length, 0, `browser errors at ${width}px: ${errors.join("; ")}`);
    results.push({ width, languageLabels, testimonials: cards, overflow: false });
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  for (const route of ["/tr/ucretler/", "/tr/sinavlar/", "/tr/sinavlar/sat/", "/tr/universite-destegi/"]) {
    await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
    const links = await page.locator('a[href*="#consultation-form"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
    assert.ok(links.length, `consultation CTA missing on ${route}`);
    assert.ok(links.every((href) => /\/tr\/?(?:\?[^#]*)?#consultation-form$|^#consultation-form$/.test(href || "")), `invalid consultation CTA on ${route}`);
  }
  await page.goto(`${base}/en/`, { waitUntil: "networkidle" });
  assert.deepEqual((await page.locator('header [role="group"] a').allTextContents()).map((label) => label.trim()), ["TR", "ENG"]);
  console.log(JSON.stringify({ status: "PASS", results }));
} finally {
  await browser.close();
}
