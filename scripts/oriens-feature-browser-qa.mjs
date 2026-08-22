import { chromium } from "playwright";

const base = process.env.QA_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const issues = [];
const results = [];

function check(condition, message) {
  if (!condition) issues.push(message);
}

const page = await browser.newPage();
await page.route("**/rest/v1/site_settings*", async (route) => route.fulfill({ status: 200, headers: { "content-type": "application/vnd.pgrst.object+json", "content-range": "0-0/1" }, body: JSON.stringify({ value: { visible: true } }) }));
page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("site_settings")) issues.push(`console: ${message.text()}`);
});

for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
  await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
  await page.goto(`${base}/tr`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  results.push({ route: "/tr", width, overflow });
  check(!overflow, `/tr has horizontal overflow at ${width}px`);
}

for (const route of ["/en", "/tr/sinavlar", "/en/exams", "/tr/sinavlar/sat", "/en/exams/sat", "/tr/ucretler", "/en/pricing", "/tr/kendini-dene", "/en/test-yourself"]) {
  await page.setViewportSize({ width: route.startsWith("/tr") ? 390 : 1440, height: 950 });
  const response = await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  results.push({ route, status: response?.status(), overflow });
  check(response?.ok(), `${route} did not return success`);
  check(!overflow, `${route} has horizontal overflow`);
}

await page.setViewportSize({ width: 390, height: 900 });
await page.goto(`${base}/tr/kendini-dene`, { waitUntil: "domcontentloaded" });
check((await page.getByRole("radio").count()) === 12, "TR assessment does not list all 12 exams");
await page.getByRole("button", { name: "Testi Başlat" }).click();
for (let index = 0; index < 8; index += 1) {
  await page.locator("fieldset input[type=radio]").first().check();
  if (index < 7) await page.getByRole("button", { name: "Sonraki" }).click();
  else await page.getByRole("button", { name: "Testi Bitir" }).click();
}
const trBody = await page.locator("body").innerText();
check(trBody.includes("2 / 8") && trBody.includes("25%"), "TR deterministic score is not 2/8 and 25%");
check(trBody.includes("Konu A") && trBody.includes("1 / 3") && trBody.includes("Konu C") && trBody.includes("0 / 2"), "TR topic aggregation is incorrect");
check(trBody.includes("Bu test yapısı örnek içerikle hazırlanmıştır."), "TR placeholder disclaimer is missing");

await page.goto(`${base}/en/test-yourself`, { waitUntil: "domcontentloaded" });
check((await page.getByRole("radio").count()) === 12, "EN assessment does not list all 12 exams");
check((await page.getByText("This assessment currently uses placeholder content.", { exact: false }).count()) > 0, "EN placeholder disclaimer is missing");

await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${base}/en`, { waitUntil: "domcontentloaded" });
const destinationSection = page.locator("[data-study-destination-section]");
await destinationSection.scrollIntoViewIfNeeded();
for (const name of ["United Kingdom", "Europe", "United States", "Canada"]) {
  const button = destinationSection.getByRole("button", { name });
  check((await button.count()) === 1, `${name} destination control is missing`);
  await button.click();
  const expected = name === "United Kingdom" ? "uk" : name === "United States" ? "us" : name.toLowerCase();
  check((await destinationSection.getAttribute("data-selected-destination")) === expected, `${name} chip did not update selection`);
  check((await page.locator("[data-study-globe]").getAttribute("data-selected-region")) === expected, `${name} did not synchronize the globe`);
}

const globe = page.locator("[data-study-globe]");
const canvas = globe.locator("canvas");
await page.waitForTimeout(1100);
const box = await canvas.boundingBox();
if (box) {
  const before = await globe.getAttribute("data-rotation");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(220);
  const cursor = await canvas.evaluate((node) => getComputedStyle(node).cursor);
  const hovered = await globe.getAttribute("data-hovered-region");
  check(cursor === "pointer" || hovered !== "none", "Interactive globe region does not communicate pointer hover");
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.55, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  const after = await globe.getAttribute("data-rotation");
  check(before !== after, "Manual globe dragging did not change rotation");
} else issues.push("Globe canvas has no bounding box");

const hiddenPricingPage = await browser.newPage();
let interceptedPricingSetting = false;
await hiddenPricingPage.route("**/rest/v1/site_settings*", async (route) => {
  interceptedPricingSetting = true;
  await route.fulfill({ status: 200, headers: { "content-type": "application/vnd.pgrst.object+json", "content-range": "0-0/1" }, body: JSON.stringify({ value: { visible: false } }) });
});
await hiddenPricingPage.goto(`${base}/en`, { waitUntil: "domcontentloaded" });
await hiddenPricingPage.waitForTimeout(1000);
check(interceptedPricingSetting, "Pricing setting request was not intercepted during OFF-state QA");
check((await hiddenPricingPage.locator("header").getByText("Pricing", { exact: true }).count()) === 0, "Pricing remains in the EN header when setting is false");
await hiddenPricingPage.goto(`${base}/tr/ucretler`, { waitUntil: "domcontentloaded" });
check((await hiddenPricingPage.locator("h1").count()) > 0, "Direct pricing URL is not preserved when navigation is hidden");
await hiddenPricingPage.close();

await browser.close();
console.log(JSON.stringify({ result: issues.length ? "FAIL" : "PASS", results, issues }, null, 2));
if (issues.length) process.exitCode = 1;
