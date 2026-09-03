import { chromium } from "playwright";

const baseUrl = process.env.ORIENS_QA_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
let documents = 0;
const txt404 = [];
page.on("request", (request) => { if (request.resourceType() === "document") documents += 1; });
page.on("response", (response) => { if (response.status() === 404 && response.url().includes(".txt")) txt404.push(response.url()); });

try {
  await page.goto(`${baseUrl}/tr/`);
  documents = 0;
  const routes = ["/tr/sinavlar/", "/tr/universite-destegi/", "/tr/blog/", "/tr/ucretler/", "/tr/hakkimizda/"];
  for (const route of routes) {
    const link = page.locator(`a[href="${route}"]`).first();
    if ((await link.count()) === 0) throw new Error(`Missing canonical link ${route}`);
    await Promise.all([page.waitForURL(`**${route}`), link.click()]);
    await page.waitForLoadState("networkidle");
    if (new URL(page.url()).pathname !== route) throw new Error(`Navigation did not reach ${route}: ${page.url()}`);
  }
  await Promise.all([page.waitForURL("**/en/about/"), page.locator('a[href="/en/about/"]').filter({ hasText: "EN" }).first().click()]);
  await page.getByText("EN", { exact: true }).first().waitFor({ state: "visible" });
  if (documents !== 0) throw new Error(`Unexpected document navigations: ${documents}`);
  if (txt404.length) throw new Error(`RSC .txt 404 responses: ${txt404.join(", ")}`);
  console.log(JSON.stringify({ topLevelDocuments: documents, rscTxt404: txt404.length, languageTransition: "PASS", finalPath: new URL(page.url()).pathname }));
} finally {
  await browser.close();
}
