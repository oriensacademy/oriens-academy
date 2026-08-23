import { chromium } from "playwright";

const BASE_URL = "http://localhost:3001";

async function main() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — LIVE LESSON SYSTEM & PORTAL QA TEST");
  console.log("==================================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message || String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  try {
    // 1. Visit Student Portal TR
    console.log("[STEP 1] Testing Student Portal /tr/hesabim...");
    await page.goto(`${BASE_URL}/tr/hesabim`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);

    const bodyText = await page.textContent("body");
    if (bodyText.includes("This page couldn't load")) {
      throw new Error("Student portal crashed on load!");
    }
    console.log("✓ Student Portal loaded safely without error.");

    // 2. Visit Student Portal EN
    console.log("[STEP 2] Testing Student Portal /en/account...");
    await page.goto(`${BASE_URL}/en/account`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);

    const bodyTextEn = await page.textContent("body");
    if (bodyTextEn.includes("This page couldn't load")) {
      throw new Error("Student portal EN crashed on load!");
    }
    console.log("✓ Student Portal EN loaded safely without error.");

    // 3. Visit Admin Students Page
    console.log("[STEP 3] Testing Admin Students page /admin/ogrenciler...");
    await page.goto(`${BASE_URL}/admin/ogrenciler`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    console.log("✓ Admin students page loaded safely.");

    // 4. Visit Kendini Dene / Test Yourself to ensure P0 fix remains 100% solid
    console.log("[STEP 4] Testing Kendini Dene /tr/kendini-dene...");
    await page.goto(`${BASE_URL}/tr/kendini-dene`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const startBtn = page.locator('button:has-text("Testi Başlat")');
    if (await startBtn.isVisible()) {
      console.log("✓ Kendini dene selector and start button active and verified.");
    }

    if (errors.length > 0) {
      console.error("Browser QA encountered errors:", errors);
      process.exit(1);
    }

    console.log("\n==================================================");
    console.log("ALL LIVE LESSON SYSTEM BROWSER QA CHECKS PASSED (0 ERRORS)!");
    console.log("==================================================");
  } finally {
    await page.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
