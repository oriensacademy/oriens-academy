import { chromium } from "playwright";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:3010";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
const page = await context.newPage();
const issues = [];
const results = [];

const check = (condition, message) => { if (!condition) issues.push(message); };

page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  const value = message.text();
  if (message.type() === "error" && !value.includes("Turnstile") && !value.includes("challenges.cloudflare.com")) issues.push(`console: ${value}`);
});

await page.route("**/rest/v1/pricing_packages*", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify([{ id: "qa_package", price_amount: 1200, current_total: 1000, currency: "EUR", active: true, featured: false, display_order: 1, name_tr: "QA Paketi", name_en: "QA Package", description_tr: null, description_en: null, lesson_count: 8, discount_percentage: null, unit_price: null, old_total: 1200, badge_tr: null, badge_en: null, purchase_mode: "purchasable" }]),
}));
await page.route("**/rest/v1/site_settings*", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify([
    { key: "payment.bank_account_holder", value: { value: "Oriens Academy QA" } },
    { key: "payment.bank_name", value: { value: "QA Bank" } },
    { key: "payment.iban", value: { value: "TR000000000000000000000000" } },
  ]),
}));

for (const locale of ["tr", "en"]) {
  const route = locale === "tr" ? "/tr/odeme/" : "/en/payment/";
  for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
    const response = await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(350);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    results.push({ route, width, status: response?.status(), overflow });
    check(response?.ok(), `${route} returned ${response?.status()} at ${width}px`);
    check(!overflow, `${route} has horizontal overflow at ${width}px`);
  }

  const pendingText = locale === "tr" ? "Kartlı ödeme, resmî banka" : "Card payments will be enabled";
  check((await page.getByText(pendingText, { exact: false }).count()) > 0, `${locale} pending bank credential notice is missing`);
  check(await page.getByRole("button", { name: locale === "tr" ? "Ödemeye Devam Et" : "Continue to Payment" }).isDisabled(), `${locale} card submit is not disabled while credentials are pending`);
  check((await page.locator('input[autocomplete="cc-number"], input[autocomplete="cc-csc"], input[name*="card" i], input[name*="cvv" i]').count()) === 0, `${locale} page contains a raw card input`);
  check((await page.locator('img[src*="supported-card-networks"]').count()) === 0, `${locale} page claims unconfirmed card-network support`);

  await page.getByRole("radio", { name: locale === "tr" ? "Banka Havalesi / EFT" : "Bank Transfer" }).click();
  check((await page.getByText("TR000000000000000000000000", { exact: true }).count()) === 1, `${locale} configured IBAN is not shown`);
  const copyButton = page.getByRole("button", { name: locale === "tr" ? "IBAN'ı Kopyala" : "Copy IBAN" });
  await copyButton.click();
  await page.waitForTimeout(100);
  check((await page.getByText(locale === "tr" ? "IBAN kopyalandı." : "IBAN copied.", { exact: true }).count()) > 0, `${locale} copy confirmation is missing`);
  check((await page.getByText("Ünalan", { exact: false }).count()) > 0, `${locale} footer business address is missing`);
}

await page.route("**/functions/v1/payment-status", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: false, error_code: "PAYMENT_NOT_FOUND" }) }));
for (const [route, failureText, forbiddenSuccess] of [
  ["/tr/odeme/sonuc/?reference=OA-FAKE-ABCDEF&token=" + "a".repeat(64), "URL bilgileri tek başına", "Ödeme Başarılı"],
  ["/en/payment/result/?reference=OA-FAKE-ABCDEF&token=" + "a".repeat(64), "URL values alone", "Payment Successful"],
]) {
  await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
  await page.getByText(failureText, { exact: false }).waitFor();
  check((await page.getByText(forbiddenSuccess, { exact: true }).count()) === 0, `${route} trusted spoofed URL success state`);
}

await browser.close();
console.log(JSON.stringify({ result: issues.length ? "FAIL" : "PASS", results, issues }, null, 2));
if (issues.length) process.exitCode = 1;
