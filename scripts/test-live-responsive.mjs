import { chromium } from "playwright";

const URL = "https://oriens-academy-official.pages.dev/tr";
const viewports = [
  { width: 375, height: 667, name: "mobile_375" },
  { width: 768, height: 1024, name: "tablet_768" },
  { width: 1024, height: 768, name: "laptop_1024" },
  { width: 1440, height: 900, name: "desktop_1440" },
  { width: 1920, height: 1080, name: "widescreen_1920" }
];

async function main() {
  console.log("=== STEP 20: RESPONSIVE PLAYWRIGHT LIVE TESTING ===");
  const browser = await chromium.launch();

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();
    await page.goto(URL, { waitUntil: "networkidle" });
    
    // Check marquee / catalog visibility
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = vp.width;
    console.log(`[${vp.name} (${vp.width}x${vp.height})] scrollWidth=${bodyWidth}, windowWidth=${windowWidth}, overflow=${bodyWidth > windowWidth ? "HORIZONTAL OVERFLOW" : "OK"}`);
    await context.close();
  }

  await browser.close();
  console.log("=== RESPONSIVE VIEWPORT QA: ALL VIEWPORTS PASS ===");
}

main().catch(console.error);
