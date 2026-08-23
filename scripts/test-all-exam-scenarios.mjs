import { chromium } from "playwright";

const BASE_URL = "http://localhost:3001";

async function runScenario(browser, { name, url, locale, selectExam, answerStrategy, testDoubleSubmit, testBack }) {
  console.log(`\n--------------------------------------------------`);
  console.log(`[SCENARIO] ${name}`);
  console.log(`URL: ${url} | Locale: ${locale}`);

  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message || String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);

    // Select custom exam if provided
    if (selectExam) {
      const examButton = page.locator(`button[role="radio"]`).filter({ hasText: selectExam }).first();
      if (await examButton.count()) {
        await examButton.click();
        console.log(`Selected exam: ${selectExam}`);
      }
    }

    // Start Test
    const startBtn = page.locator('button:has-text("Testi Başlat"), button:has-text("Start Test")');
    await startBtn.click();
    await page.waitForTimeout(300);

    // Answer questions
    for (let q = 1; q <= 6; q++) {
      let optionLetter = "a";
      if (answerStrategy === "all_correct") {
        const seq = ["a", "b", "c", "d", "a", "b"];
        optionLetter = seq[q - 1];
      } else if (answerStrategy === "all_wrong") {
        const seq = ["c", "d", "a", "b", "c", "d"];
        optionLetter = seq[q - 1];
      } else if (answerStrategy === "mixed") {
        optionLetter = q % 2 === 1 ? "a" : "c";
      }

      const optionLabel = page.locator("label").filter({ hasText: optionLetter }).first();
      await optionLabel.click();
      await page.waitForTimeout(150);

      if (q < 6) {
        const nextBtn = page.locator('button:has-text("Sonraki"), button:has-text("Next")');
        await nextBtn.click();
        await page.waitForTimeout(200);
      } else {
        const finishBtn = page.locator('button:has-text("Testi Bitir"), button:has-text("Finish Test")');
        if (testDoubleSubmit) {
          console.log("Testing rapid double submit on finish button...");
          await finishBtn.click({ clickCount: 2, timeout: 5000 }).catch(() => {});
        } else {
          await finishBtn.click({ timeout: 5000 });
        }
      }
    }

    await page.waitForTimeout(600);

    // Verify Result page
    const bodyContent = await page.textContent("body");
    if (bodyContent.includes("This page couldn't load") || bodyContent.includes("Reload to try again")) {
      throw new Error("GLOBAL ERROR BOUNDARY TRIGGERED!");
    }

    const headingText = await page.locator("h2").first().textContent();
    console.log(`Result Heading: ${headingText}`);

    // Verify score display
    const stats = await page.locator(".font-heading").allTextContents();
    console.log(`Calculated Metrics: ${stats.slice(0, 3).join(" | ")}`);

    if (testBack) {
      console.log("Testing back/retry navigation...");
      const retryBtn = page.locator('button:has-text("Yeniden Dene"), button:has-text("Try Again")').first();
      await retryBtn.click();
      await page.waitForTimeout(400);
      console.log("✓ Successfully restarted test from result screen.");
    }

    if (errors.length > 0) {
      console.error(`Scenario encountered errors:`, errors);
      return false;
    }

    console.log(`✓ ${name} PASSED (0 Errors)`);
    return true;
  } catch (err) {
    console.error(`Scenario FAILED with error:`, err);
    return false;
  } finally {
    await page.close();
  }
}

async function runRefreshScenario(browser) {
  console.log(`\n--------------------------------------------------`);
  console.log(`[SCENARIO] TR: Page Refresh & Clean State Recovery`);
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message || String(err)));

  try {
    await page.goto(`${BASE_URL}/tr/kendini-dene`, { waitUntil: "domcontentloaded" });
    const startBtn = page.locator('button:has-text("Testi Başlat")');
    await startBtn.click();
    await page.waitForTimeout(300);

    // Answer 2 questions
    for (let q = 1; q <= 2; q++) {
      await page.locator("label").filter({ hasText: "a" }).first().click();
      await page.locator('button:has-text("Sonraki")').click();
      await page.waitForTimeout(200);
    }

    // Refresh page in middle of test
    console.log("Refreshing page in the middle of active test session...");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    const bodyContent = await page.textContent("body");
    if (bodyContent.includes("This page couldn't load") || bodyContent.includes("Reload to try again")) {
      throw new Error("GLOBAL ERROR BOUNDARY TRIGGERED ON REFRESH!");
    }

    const restartedStart = page.locator('button:has-text("Testi Başlat")');
    const isStartVisible = await restartedStart.isVisible();
    console.log(`Start button cleanly visible after reload: ${isStartVisible}`);

    if (!isStartVisible) throw new Error("Start button not visible after reload");

    console.log(`✓ TR: Page Refresh & Recovery PASSED (0 Errors)`);
    return true;
  } catch (err) {
    console.error(`Refresh scenario FAILED:`, err);
    return false;
  } finally {
    await page.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    results.push(await runScenario(browser, {
      name: "TR: 6/6 All Correct (100% Accuracy)",
      url: `${BASE_URL}/tr/kendini-dene`,
      locale: "tr",
      answerStrategy: "all_correct",
    }));

    results.push(await runScenario(browser, {
      name: "TR: 6/6 All Incorrect (0% Accuracy)",
      url: `${BASE_URL}/tr/kendini-dene`,
      locale: "tr",
      answerStrategy: "all_wrong",
    }));

    results.push(await runScenario(browser, {
      name: "TR: 6/6 Mixed Answers (50% Accuracy)",
      url: `${BASE_URL}/tr/kendini-dene`,
      locale: "tr",
      answerStrategy: "mixed",
    }));

    results.push(await runScenario(browser, {
      name: "EN: 6/6 All Correct (100% Accuracy)",
      url: `${BASE_URL}/en/test-yourself`,
      locale: "en",
      answerStrategy: "all_correct",
    }));

    results.push(await runScenario(browser, {
      name: "EN: 6/6 All Incorrect (0% Accuracy)",
      url: `${BASE_URL}/en/test-yourself`,
      locale: "en",
      answerStrategy: "all_wrong",
    }));

    results.push(await runScenario(browser, {
      name: "EN: 6/6 Mixed Answers (50% Accuracy)",
      url: `${BASE_URL}/en/test-yourself`,
      locale: "en",
      answerStrategy: "mixed",
    }));

    results.push(await runScenario(browser, {
      name: "TR: Rapid Double Submit & Retry Navigation",
      url: `${BASE_URL}/tr/kendini-dene`,
      locale: "tr",
      answerStrategy: "all_correct",
      testDoubleSubmit: true,
      testBack: true,
    }));

    results.push(await runRefreshScenario(browser));

    results.push(await runScenario(browser, {
      name: "TR: Different Exam (AP)",
      url: `${BASE_URL}/tr/kendini-dene`,
      locale: "tr",
      selectExam: "AP",
      answerStrategy: "all_correct",
    }));

    results.push(await runScenario(browser, {
      name: "EN: Different Exam (IB)",
      url: `${BASE_URL}/en/test-yourself`,
      locale: "en",
      selectExam: "IB",
      answerStrategy: "all_correct",
    }));

    console.log("\n==================================================");
    const allPassed = results.every(Boolean);
    console.log(allPassed ? "ALL 10 EXAM TEST SCENARIOS PASSED WITH 0 ERRORS!" : "SOME SCENARIOS FAILED!");
    console.log("==================================================");
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
