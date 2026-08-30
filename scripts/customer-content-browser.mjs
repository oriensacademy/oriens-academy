import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = (process.env.QA_BASE_URL || "http://127.0.0.1:57500").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", async (response) => {
    if (response.url().includes("pricing_packages") && !response.ok()) errors.push(`pricing ${response.status()}: ${await response.text().catch(() => "")}`);
  });
  await page.goto(`${base}/tr/ucretler/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.innerText.includes("Birim Ders Ücreti"), undefined, { timeout: 30_000 });
  const pricingText = await page.locator("body").innerText();
  assert.match(pricingText, /Şeffaf Fiyatlandırma/);
  assert.match(pricingText, /Her öğrenci için aynı standart ücretler/);
  assert.match(pricingText, /Birim Ders Ücreti/);
  assert.match(pricingText, /Düzenli çalışmaya başlamak/);
  assert.match(pricingText, /Sınav hazırlığını, konu takibini/);

  await page.goto(`${base}/tr/hakkimizda/`, { waitUntil: "domcontentloaded" });
  const aboutText = await page.locator("body").innerText();
  for (const school of ["Robert Kolej", "St. Joseph", "Liceo Italiano", "Üsküdar Amerikan Lisesi", "Galatasaray Lisesi", "Saint Benoit Fransız Lisesi", "Notre Dame de Sion", "İstanbul Alman Lisesi", "Avusturya Lisesi"]) assert.match(aboutText, new RegExp(school));
  assert.match(aboutText, /resmi iş birliği veya kurum onayı anlamına gelmez/);
  assert.equal(errors.length, 0, errors.join("; "));
  console.log(JSON.stringify({ status: "PASS", pricing: "runtime DB copy and labels", about: "founder/schools/disclaimer" }, null, 2));
} finally {
  await browser.close();
}
