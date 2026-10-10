import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.PRICING_QA_BASE_URL || "http://127.0.0.1:3010";
const outputDirectory = "test-results/pricing-reference";
const viewports = [390, 820, 1280, 1440];
// Paketler dinamiktir (PDF-07): admin panelde satın alınabilir olan her paket
// (ör. package40) listelenir. Beklenen sıra kaynak satırlardan türetilir.
const baselineIds = ["single", "package5", "package10", "package20", "package30", "package40"];
let expectedIds = baselineIds;
let sourceRows = [];
const browser = await chromium.launch({ headless: true });
const issues = [];
const results = [];
let sourceIds = [];

await mkdir(outputDirectory, { recursive: true });

for (const width of viewports) {
  const page = await browser.newPage({ viewport: { width, height: width <= 820 ? 900 : 1000 } });
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) issues.push(`${width}:console:${message.type()}:${message.text()}`);
  });
  page.on("pageerror", (error) => issues.push(`${width}:pageerror:${error.message}`));
  await page.addInitScript(() => sessionStorage.setItem("oriens-loader-seen", "1"));
  page.on("response", async (response) => {
    if (sourceIds.length || !response.url().includes("/rest/v1/pricing_packages?")) return;
    try {
      const rows = await response.json();
      sourceRows = Array.isArray(rows) ? rows : [];
      sourceIds = sourceRows.map((row) => row.id);
    } catch {
      // The UI fallback is tested separately; network capture is diagnostic only.
    }
  });
  await page.goto(`${baseUrl}/tr/ucretler/`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-package-id="package40"]');
  if (sourceRows.length) {
    expectedIds = sourceRows
      .filter((row) => row.active !== false && row.purchase_mode === "purchasable" && Number(row.lesson_count) > 0)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || Number(a.lesson_count) - Number(b.lesson_count) || String(a.id).localeCompare(String(b.id)))
      .map((row) => row.id);
  }
  const inspection = await page.evaluate((ids) => {
    const rows = [...document.querySelectorAll("[data-package-id]")];
    const visibleIds = rows.map((row) => row.getAttribute("data-package-id"));
    const links = Object.fromEntries(rows.map((row) => [row.getAttribute("data-package-id"), row.querySelector('[data-pricing-action="purchase"]')?.getAttribute("href")]));
    const badges = Object.fromEntries(rows.map((row) => [row.getAttribute("data-package-id"), row.querySelector("[data-pricing-badge], .pr-badge")?.textContent?.trim() || null]));
    const firstFaq = document.querySelector("details");
    return {
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      visibleIds,
      packages: rows.map((row) => ({
        id: row.getAttribute("data-package-id"),
        lessonCount: Number(row.getAttribute("data-lesson-count")),
        currentPrice: row.getAttribute("data-current-price"),
        unitPrice: row.getAttribute("data-unit-price"),
        badge: row.querySelector("[data-pricing-badge]")?.textContent?.trim() || null,
        checkoutTarget: row.querySelector('[data-pricing-action="purchase"]')?.getAttribute("href") || null,
      })),
      orderMatches: JSON.stringify(visibleIds) === JSON.stringify(ids),
      links,
      badges,
      faqCount: document.querySelectorAll("details").length,
      firstFaqOpen: firstFaq?.hasAttribute("open") || false,
      whatsappHref: document.querySelector('a[href^="https://wa.me/"]')?.getAttribute("href") || null,
      hero: document.querySelector("h1")?.textContent?.trim() || "",
      benefitCount: document.querySelectorAll("[data-pricing-benefits] li, ul.fe > li").length,
    };
  }, expectedIds);
  await page.screenshot({ path: `${outputDirectory}/tr-${width}.png`, fullPage: true });
  results.push(inspection);
  await page.close();
}

const enPage = await browser.newPage({ viewport: { width: 390, height: 900 } });
await enPage.addInitScript(() => sessionStorage.setItem("oriens-loader-seen", "1"));
await enPage.goto(`${baseUrl}/en/pricing/`, { waitUntil: "networkidle" });
await enPage.waitForSelector('[data-package-id="package40"]');
const english = await enPage.evaluate(() => ({
  hero: document.querySelector("h1")?.textContent?.trim() || "",
  ids: [...document.querySelectorAll("[data-package-id]")].map((row) => row.getAttribute("data-package-id")),
  turkishLeak: document.body.innerText.includes("Satın Al") || document.body.innerText.includes("Ders başı"),
  checkoutTargets: [...document.querySelectorAll('[data-pricing-action="purchase"]')].map((link) => link.getAttribute("href")),
}));
await enPage.close();
await browser.close();

const report = { baseUrl, sourceIds, results, english, issues };
await writeFile(`${outputDirectory}/report.json`, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));

const directCheckout = (links) => Object.entries(links).every(([id, href]) => href === `/tr/odeme/?package=${encodeURIComponent(id)}`);
const failed = !expectedIds.includes("package40")
  || results.some((result) => !directCheckout(result.links))
  || english.checkoutTargets.some((href) => !/^\/en\/payment\/\?package=[\w-]+$/.test(href || ""))
  || results.some((result) => result.scrollWidth !== result.width || !result.orderMatches || result.faqCount !== 5 || !result.firstFaqOpen || result.benefitCount !== 4 || result.badges.package10 !== "En popüler" || result.badges.package30 !== "En avantajlı")
  || english.turkishLeak
  || JSON.stringify(english.ids) !== JSON.stringify(expectedIds)
  || issues.length > 0;
if (failed) process.exitCode = 1;
