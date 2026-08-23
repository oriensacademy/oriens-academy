import { chromium } from "playwright";

async function testExamFlow(url, locale) {
  console.log(`\nTesting Exam Test flow on: ${url} (${locale})`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleLogs = [];
  const errors = [];
  page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => errors.push(err.stack || err.message));

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    console.log("Page loaded successfully.");

    // Check header
    const title = await page.textContent("h1");
    console.log(`Header H1: ${title}`);

    // Click "Testi Başlat" / "Start Test"
    const startButton = page.locator('button:has-text("Testi Başlat"), button:has-text("Start Test")');
    await startButton.click();
    console.log("Clicked Start Test button.");

    // Answer each question
    for (let q = 1; q <= 6; q++) {
      await page.waitForTimeout(400);
      console.log(`Question ${q}/6 visible...`);

      // Click option A label
      const optionA = page.locator('label').filter({ hasText: "a" }).first();
      await optionA.click();
      await page.waitForTimeout(300);

      if (q < 6) {
        const nextButton = page.locator('button:has-text("Sonraki"), button:has-text("Next")');
        await nextButton.click();
      } else {
        console.log("Submitting test on question 6...");
        const finishButton = page.locator('button:has-text("Testi Bitir"), button:has-text("Finish Test")');
        await finishButton.click();
      }
    }

    await page.waitForTimeout(1000);

    // Check if error boundary rendered
    const bodyText = await page.textContent("body");
    if (bodyText.includes("This page couldn't load") || bodyText.includes("Reload to try again")) {
      console.error("CRASH DETECTED! Global error boundary triggered!");
    } else {
      console.log("SUCCESS! Result page rendered.");
      const resultTitle = await page.locator("h2").textContent();
      console.log(`Result H2: ${resultTitle}`);
    }

    if (errors.length > 0) {
      console.error("Page Errors:", errors);
    }
  } catch (err) {
    console.error("Execution error during test:", err);
  } finally {
    await browser.close();
  }
}

async function run() {
  await testExamFlow("http://localhost:3001/tr/kendini-dene", "tr");
  await testExamFlow("http://localhost:3001/en/test-yourself", "en");
}

run().catch(console.error);
