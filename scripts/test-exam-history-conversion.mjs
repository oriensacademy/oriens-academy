import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = (process.env.EXAM_TEST_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

async function runTests() {
  console.log("Starting Exam History & Post-Exam Conversion Browser Test Suite...");
  const browser = await chromium.launch({ headless: true });

  try {
    // Scenario 1: TR Anonymous Test Completion -> Email Modal -> Conversion Flow -> Registration Prefill
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      console.log("Scenario 1: Testing TR Anonymous Email Flow & Registration Redirect...");

      await page.goto(`${BASE_URL}/tr/kendini-dene/`, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Testi Başlat", exact: true }).click();
      await page.locator('input[type="radio"][value="a"]').waitFor();

      // Answer 6 questions
      const answers = ["a", "b", "c", "d", "a", "b"];
      for (let i = 0; i < answers.length; i++) {
        await page.locator(`input[type="radio"][value="${answers[i]}"]`).check();
        if (i < answers.length - 1) {
          await page.getByRole("button", { name: "Sonraki", exact: true }).click();
        } else {
          await page.getByRole("button", { name: "Testi Bitir", exact: true }).click();
        }
      }

      // Check results rendered
      await page.getByTestId("exam-result").waitFor();
      console.log("✓ TR Result rendered successfully");

      // Click "Detaylı Analizi E-postama Gönder"
      const emailCtaBtn = page.getByRole("button", { name: "Detaylı Analizi E-postama Gönder" });
      await emailCtaBtn.waitFor();
      await emailCtaBtn.click();

      // Email modal check
      await page.getByRole("heading", { name: "Detaylı Sınav Analizini E-postanıza Alın" }).waitFor();
      console.log("✓ Email modal opened");

      // Type email and name
      await page.locator('input[placeholder="ornek@email.com"]').fill("test-student-flow@oriens-academy.com");
      await page.locator('input[placeholder="Adınız Soyadınız"]').fill("Test Öğrenci");

      // Mock the Edge Function network response to verify conversion UI in test sandbox
      await page.route("**/functions/v1/send-exam-result-email", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, claimToken: "test-claim-uuid-1234" }),
        });
      });

      await page.getByRole("button", { name: "Raporu Gönder" }).click();

      // Check Post-Email Conversion Card
      await page.getByText("Sonuçlarınızı hesabınızda saklamak ister misiniz?").waitFor();
      console.log("✓ Post-email conversion card displayed");

      // Click "Hesabımı Oluştur"
      const createAccountBtn = page.getByRole("button", { name: "Hesabımı Oluştur" });
      await createAccountBtn.waitFor();
      await createAccountBtn.click();

      // Verify redirect to registration page
      await page.waitForURL(/\/tr\/giris\/?\?mode=register/);
      console.log("✓ Redirected to /tr/giris?mode=register");

      // Verify email prefill in signup form
      const emailInput = page.locator('#register-email');
      await emailInput.waitFor();
      const prefilledValue = await emailInput.inputValue();
      assert.equal(prefilledValue, "test-student-flow@oriens-academy.com", "Email must be prefilled in registration form");
      console.log("✓ Email accurately prefilled in registration form");

      await context.close();
    }

    // Scenario 2: EN Anonymous Test Completion -> Email Modal -> Conversion Flow -> Registration Prefill
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      console.log("Scenario 2: Testing EN Anonymous Email Flow & Registration Redirect...");

      await page.goto(`${BASE_URL}/en/test-yourself/`, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Start Diagnostic", exact: true }).click();
      await page.locator('input[type="radio"][value="a"]').waitFor();

      // Answer 6 questions
      const answers = ["a", "b", "c", "d", "a", "b"];
      for (let i = 0; i < answers.length; i++) {
        await page.locator(`input[type="radio"][value="${answers[i]}"]`).check();
        if (i < answers.length - 1) {
          await page.getByRole("button", { name: "Next", exact: true }).click();
        } else {
          await page.getByRole("button", { name: "Finish Test", exact: true }).click();
        }
      }

      // Check results rendered
      await page.getByTestId("exam-result").waitFor();
      console.log("✓ EN Result rendered successfully");

      // Click "Email My Detailed Analysis"
      const emailCtaBtn = page.getByRole("button", { name: "Email My Detailed Analysis" });
      await emailCtaBtn.waitFor();
      await emailCtaBtn.click();

      // Email modal check
      await page.getByRole("heading", { name: "Receive Your Detailed Exam Analysis by Email" }).waitFor();
      console.log("✓ EN Email modal opened");

      // Type email
      await page.locator('input[placeholder="ornek@email.com"]').fill("en-student@oriens-academy.com");

      // Mock the Edge Function network response
      await page.route("**/functions/v1/send-exam-result-email", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, claimToken: "en-claim-uuid-5678" }),
        });
      });

      await page.getByRole("button", { name: "Send Report" }).click();

      // Check Post-Email Conversion Card
      await page.getByText("Would you like to save your results in your account?").waitFor();
      console.log("✓ EN Post-email conversion card displayed");

      // Click "Create My Account"
      const createAccountBtn = page.getByRole("button", { name: "Create My Account" });
      await createAccountBtn.waitFor();
      await createAccountBtn.click();

      // Verify redirect to registration page
      await page.waitForURL(/\/en\/login\/?\?mode=register/);
      console.log("✓ Redirected to /en/login?mode=register");

      // Verify email prefill
      const emailInput = page.locator('#register-email');
      await emailInput.waitFor();
      const prefilledValue = await emailInput.inputValue();
      assert.equal(prefilledValue, "en-student@oriens-academy.com", "EN Email must be prefilled");
      console.log("✓ EN Email accurately prefilled in registration form");

      await context.close();
    }

    console.log("\n=======================================================");
    console.log("ALL EXAM HISTORY & CONVERSION TESTS PASSED (100% GREEN)");
    console.log("=======================================================\n");
  } finally {
    await browser.close();
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
