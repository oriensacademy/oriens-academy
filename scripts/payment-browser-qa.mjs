import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:3010";
const env = readFileSync(".env.local", "utf8");
const supabaseUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "") || "";
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const userId = "22222222-2222-4222-8222-222222222222";
const now = Math.floor(Date.now() / 1000);
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ aud: "authenticated", exp: now + 3600, sub: userId, role: "authenticated", app_metadata: { provider: "email", providers: ["email"] } })}.qa`;
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "payment.qa@example.test",
  email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Payment QA" },
  identities: [],
  created_at: new Date().toISOString(),
};
const session = {
  access_token: jwt,
  token_type: "bearer",
  expires_in: 3600,
  expires_at: now + 3600,
  refresh_token: "qa-refresh-token",
  user,
};
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addInitScript(
  ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
  { key: `sb-${projectRef}-auth-token`, value: session },
);
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
const page = await context.newPage();
const issues = [];
const results = [];

const check = (condition, message) => { if (!condition) issues.push(message); };

page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  const value = message.text();
  const sourceUrl = message.location().url || "";
  const isTurnstileDiagnostic = sourceUrl.startsWith("https://challenges.cloudflare.com/");
  if (message.type() === "error" && !value.includes("Turnstile") && !value.includes("challenges.cloudflare.com") && !isTurnstileDiagnostic) issues.push(`console: ${value}`);
});

await page.route("**/auth/v1/user*", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(user),
}));
await page.route("**/rest/v1/student_profiles*", (route) => route.fulfill({
  status: 200,
  headers: { "content-type": "application/vnd.pgrst.object+json" },
  body: JSON.stringify({
    id: userId,
    full_name: "Payment QA",
    email: user.email,
    phone: "+90 555 000 00 00",
    preferred_language: "tr",
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
}));

await page.route("**/rest/v1/pricing_packages*", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify([{ id: "qa_package", price_amount: 1200, current_total: 1000, currency: "TRY", active: true, featured: false, display_order: 1, name_tr: "QA Paketi", name_en: "QA Package", description_tr: null, description_en: null, lesson_count: 8, discount_percentage: null, unit_price: null, old_total: 1200, badge_tr: null, badge_en: null, purchase_mode: "purchasable" }]),
}));
await page.route("**/rest/v1/site_settings*", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify([
    { key: "payment.bank_account_holder", value: { value: "Oriens Danışmanlık ve Eğitim Ltd. Şti." } },
    { key: "payment.bank_name", value: { value: "Garanti BBVA" } },
    { key: "payment.iban", value: { value: "TR120006200000000000000000" } },
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

  // Check Card Payment Form
  await page.waitForTimeout(800);
  await page.getByRole("radio", { name: locale === "tr" ? "Kart ile Ödeme" : "Pay by Card" }).click();
  
  // Verify that the old placeholder warning is GONE
  const legacyWarning = locale === "tr" ? "Virtual POS bilgileri" : "Virtual POS documentation";
  check((await page.getByText(legacyWarning, { exact: false }).count()) === 0, `${locale} still shows legacy placeholder warning`);

  // Verify real card inputs are visible and accessible
  const ccNumber = page.locator('input[autoComplete="cc-number"], input[name="cardnumber"]');
  const ccName = page.locator('input[autoComplete="cc-name"], input[name="ccname"]');
  const ccExp = page.locator('input[autoComplete="cc-exp"], input[name="ccexp"]');
  const ccCsc = page.locator('input[autoComplete="cc-csc"], input[name="cvv"]');

  check((await ccNumber.count()) === 1, `${locale} card number input is missing`);
  check((await ccName.count()) === 1, `${locale} cardholder name input is missing`);
  check((await ccExp.count()) === 1, `${locale} expiry input is missing`);
  check((await ccCsc.count()) === 1, `${locale} CVV input is missing`);

  // Verify Security & 3D Secure notices and Visa/Mastercard logos
  const securityNotice = locale === "tr" ? "3D Secure" : "3D Secure";
  check((await page.getByText(securityNotice, { exact: false }).count()) > 0, `${locale} 3D Secure security notice is missing`);
  check((await page.locator('img[src*="payment-methods"]').count()) > 0, `${locale} Visa/Mastercard mark is missing`);

  // Check Bank Transfer
  await page.getByRole("radio", { name: locale === "tr" ? "Banka Havalesi / EFT" : "Bank Transfer" }).click();
  check((await page.getByText("TR120006200000000000000000", { exact: true }).count()) === 1, `${locale} configured IBAN is not shown`);
  const copyButton = page.getByRole("button", { name: locale === "tr" ? "IBAN'ı Kopyala" : "Copy IBAN" });
  await copyButton.click();
  await page.waitForTimeout(100);
  check((await page.getByText(locale === "tr" ? "IBAN kopyalandı." : "IBAN copied.", { exact: true }).count()) > 0, `${locale} copy confirmation is missing`);
}

// Security Check: Verify that no card data is ever written to localStorage
const hasCardInStorage = await page.evaluate(() => {
  return Object.keys(localStorage).some((k) => /card|cvv|pan/i.test(k) || /card|cvv|pan/i.test(localStorage.getItem(k) || ""));
});
check(!hasCardInStorage, "Sensitive card data detected in localStorage");

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
