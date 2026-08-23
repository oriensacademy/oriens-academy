import assert from "node:assert/strict";
import { chromium } from "playwright";

const QUESTION_COUNT = 6;
const BASE_URL = (process.env.EXAM_TEST_BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const SMOKE_ONLY = process.argv.includes("--smoke");
const correctAnswers = ["a", "b", "c", "d", "a", "b"];
const wrongAnswers = ["c", "d", "a", "b", "c", "d"];
const mixedAnswers = ["a", "d", "c", "b", "a", "d"];

function copy(locale) {
  return locale === "tr"
    ? { path: "/tr/kendini-dene/", start: "Testi Başlat", next: "Sonraki", finish: "Testi Bitir", result: "Sonuç Analizi", change: "Başka Sınav Seç" }
    : { path: "/en/test-yourself/", start: "Start Test", next: "Next", finish: "Finish Test", result: "Result Analysis", change: "Choose Another Exam" };
}

async function observedPage(browser) {
  const page = await browser.newPage();
  const errors = [];
  const origin = new URL(BASE_URL).origin;

  page.on("pageerror", (error) => errors.push(`pageerror: ${error.stack || error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText || "unknown";
    if (new URL(request.url()).origin === origin && errorText !== "net::ERR_ABORTED") errors.push(`requestfailed: ${request.method()} ${request.url()} ${errorText}`);
  });
  page.on("response", (response) => {
    if (new URL(response.url()).origin === origin && response.status() >= 400) errors.push(`response: ${response.status()} ${response.url()}`);
  });

  return { page, errors };
}

async function assertHealthy(page, errors, context) {
  const body = await page.locator("body").innerText();
  assert(!body.includes("This page couldn't load"), `${context}: global error boundary rendered`);
  assert(!body.includes("Reload to try again"), `${context}: reload error UI rendered`);
  assert.equal(errors.length, 0, `${context}: browser errors\n${errors.join("\n")}`);
}

async function openTest(page, locale) {
  const labels = copy(locale);
  const response = await page.goto(`${BASE_URL}${labels.path}`, { waitUntil: "domcontentloaded" });
  assert(response?.ok(), `${locale}: initial document failed with ${response?.status()}`);
  await page.getByRole("button", { name: labels.start, exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, labels.path);
  return labels;
}

async function startTest(page, labels, exam) {
  if (exam) await page.getByRole("radio", { name: new RegExp(`^${exam}\\b`) }).click();
  await page.getByRole("button", { name: labels.start, exact: true }).click();
  await page.locator('input[type="radio"][value="a"]').waitFor();
}

async function answerCurrent(page, answer) {
  await page.locator(`input[type="radio"][value="${answer}"]`).check();
}

async function completeTest(page, labels, answers, doubleSubmit = false) {
  assert.equal(answers.length, QUESTION_COUNT);
  const routeBeforeSubmit = new URL(page.url()).pathname;

  for (let index = 0; index < QUESTION_COUNT; index += 1) {
    await answerCurrent(page, answers[index]);
    if (index < QUESTION_COUNT - 1) {
      await page.getByRole("button", { name: labels.next, exact: true }).click();
    } else {
      const finish = page.getByRole("button", { name: labels.finish, exact: true });
      assert.equal(await finish.isEnabled(), true);
      if (doubleSubmit) {
        await finish.evaluate((button) => {
          button.click();
          button.click();
        });
      } else {
        await finish.click();
      }
    }
  }

  await page.getByRole("heading", { name: labels.result, exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, routeBeforeSubmit, "result must remain on the static test route");
}

async function assertResult(page, { correct, incorrect, accuracy }) {
  const result = page.getByTestId("exam-result");
  await result.waitFor();
  assert.equal((await page.getByTestId("exam-result-correct").innerText()).split("\n").at(-1), `${correct} / ${QUESTION_COUNT}`);
  assert.equal((await page.getByTestId("exam-result-incorrect").innerText()).split("\n").at(-1), `${incorrect} / ${QUESTION_COUNT}`);
  assert.equal((await page.getByTestId("exam-result-accuracy").innerText()).split("\n").at(-1), `${accuracy}%`);
  assert.equal(await result.locator("section").count() >= 4, true, "analysis and recommendation sections must render");
}

async function outcomeScenario(browser, name, locale, answers, expected, options = {}) {
  const { page, errors } = await observedPage(browser);
  try {
    const labels = await openTest(page, locale);
    await startTest(page, labels, options.exam);
    await completeTest(page, labels, answers, options.doubleSubmit);
    await assertResult(page, expected);
    await assertHealthy(page, errors, name);
    console.log(`PASS ${name}`);
  } finally {
    await page.close();
  }
}

async function partialScenario(browser) {
  const { page, errors } = await observedPage(browser);
  try {
    const labels = await openTest(page, "tr");
    await startTest(page, labels);
    assert.equal(await page.getByRole("button", { name: labels.next, exact: true }).isDisabled(), true, "0/6 must not advance");

    for (let index = 0; index < QUESTION_COUNT - 1; index += 1) {
      await answerCurrent(page, correctAnswers[index]);
      await page.getByRole("button", { name: labels.next, exact: true }).click();
    }
    assert.equal(await page.getByRole("button", { name: labels.finish, exact: true }).isDisabled(), true, "5/6 must not submit");
    await assertHealthy(page, errors, "partial answers");
    console.log("PASS 0/6 and 5/6 submission blocking");
  } finally {
    await page.close();
  }
}

async function refreshScenario(browser, afterResult) {
  const { page, errors } = await observedPage(browser);
  try {
    const labels = await openTest(page, "tr");
    await startTest(page, labels);
    if (afterResult) {
      await completeTest(page, labels, correctAnswers);
      await assertResult(page, { correct: 6, incorrect: 0, accuracy: 100 });
    } else {
      await answerCurrent(page, "a");
      await page.getByRole("button", { name: labels.next, exact: true }).click();
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: labels.start, exact: true }).waitFor();
    assert.equal(await page.getByTestId("exam-result").count(), 0, "reload must recover to a clean selection state");
    await assertHealthy(page, errors, afterResult ? "refresh after result" : "refresh before finish");
    console.log(`PASS refresh ${afterResult ? "after result" : "before finish"}`);
  } finally {
    await page.close();
  }
}

async function secondExamScenario(browser) {
  const { page, errors } = await observedPage(browser);
  try {
    const labels = await openTest(page, "tr");
    await startTest(page, labels);
    await completeTest(page, labels, correctAnswers);
    await page.getByRole("button", { name: labels.change, exact: true }).click();
    await startTest(page, labels, "AP");
    await completeTest(page, labels, wrongAnswers);
    await assertResult(page, { correct: 0, incorrect: 6, accuracy: 0 });
    await assertHealthy(page, errors, "second exam");
    console.log("PASS second exam");
  } finally {
    await page.close();
  }
}

async function navigationScenario(browser) {
  const { page, errors } = await observedPage(browser);
  try {
    await page.goto(`${BASE_URL}/tr/`, { waitUntil: "domcontentloaded" });
    const labels = await openTest(page, "tr");
    await startTest(page, labels);
    await completeTest(page, labels, mixedAnswers);
    await page.goBack({ waitUntil: "domcontentloaded" });
    assert.equal(new URL(page.url()).pathname, "/tr/");
    await page.goForward({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: labels.start, exact: true }).waitFor();
    await assertHealthy(page, errors, "back and return");
    console.log("PASS browser Back and return");
  } finally {
    await page.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    await outcomeScenario(browser, "TR 6/6 all correct", "tr", correctAnswers, { correct: 6, incorrect: 0, accuracy: 100 });
    if (SMOKE_ONLY) return;
    await outcomeScenario(browser, "EN 6/6 all correct", "en", correctAnswers, { correct: 6, incorrect: 0, accuracy: 100 });
    await outcomeScenario(browser, "all incorrect", "tr", wrongAnswers, { correct: 0, incorrect: 6, accuracy: 0 });
    await outcomeScenario(browser, "mixed answers", "en", mixedAnswers, { correct: 3, incorrect: 3, accuracy: 50 });
    await partialScenario(browser);
    await outcomeScenario(browser, "double submit", "tr", correctAnswers, { correct: 6, incorrect: 0, accuracy: 100 }, { doubleSubmit: true });
    await refreshScenario(browser, false);
    await refreshScenario(browser, true);
    await secondExamScenario(browser);
    await navigationScenario(browser);
    console.log("PASS all exam browser regression scenarios");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
