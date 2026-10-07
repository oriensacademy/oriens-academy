import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseTcmbEurForexSelling, TCMB_DAILY_RATES_URL, TCMB_EUR_RATE_TYPE } from "../supabase/functions/_shared/tcmb-parser.mjs";
import { getTcmbEurRecommendation, EUR_PRICE_RECOMMENDATION_TOLERANCE_PERCENT } from "../src/lib/pricing/tcmb.ts";
import { getLocalizedPackageDisplayPrice } from "../src/lib/pricing/package-display.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${passed}: ${name}`);
}

const migration = read("supabase/migrations/20260913130000_manual_eur_package_prices.sql");
const edge = read("supabase/functions/tcmb-eur-rate/index.ts");
const adminModal = read("src/components/admin/PricingModal.tsx");
const languageSwitch = read("src/components/sections/LanguageSwitch.tsx");
const rootPage = read("src/app/page.tsx");
const rootLayout = read("src/app/layout.tsx");
const cart = read("src/components/cart/CartPage.tsx");
const payment = read("src/components/payment/PaymentPage.tsx");
const pricing = read("src/components/pricing/PricingPage.tsx");
const paytr = read("supabase/functions/paytr-create-token/index.ts");

test("price_eur schema is nullable numeric(12,2) with a positive bound", () => {
  assert.match(migration, /add column if not exists price_eur numeric\(12, 2\)/i);
  assert.match(migration, /price_eur is null or \(price_eur > 0 and price_eur <= 1000000\)/i);
});

test("all five initial manual EUR prices are present", () => {
  for (const [id, value] of Object.entries({ single: "59.99", package5: "269.99", package10: "499.99", package20: "899.99", package30: "1299.99" })) {
    assert.match(migration, new RegExp(`when '${id}' then ${value.replace(".", "\\.")}`, "i"));
  }
});

const fixture = `<?xml version="1.0" encoding="UTF-8"?><Tarih_Date Tarih="12.09.2026"><Currency Kod="EUR" CurrencyCode="EUR"><Unit>1</Unit><ForexBuying>53.90</ForexBuying><ForexSelling>54.00</ForexSelling><BanknoteSelling>54.10</BanknoteSelling></Currency></Tarih_Date>`;

test("official TCMB XML parser selects EUR ForexSelling and source date", () => {
  assert.equal(TCMB_DAILY_RATES_URL, "https://www.tcmb.gov.tr/kurlar/today.xml");
  assert.equal(TCMB_EUR_RATE_TYPE, "ForexSelling");
  assert.deepEqual(parseTcmbEurForexSelling(fixture), { rate: 54, rateType: "ForexSelling", sourceDate: "12.09.2026" });
});

test("parser rejects missing, non-positive, and implausible rates", () => {
  assert.throws(() => parseTcmbEurForexSelling(fixture.replace("54.00", "0")));
  assert.throws(() => parseTcmbEurForexSelling(fixture.replace("54.00", "NaN")));
  assert.throws(() => parseTcmbEurForexSelling(fixture.replace("54.00", "1001")));
  assert.throws(() => parseTcmbEurForexSelling(fixture.replace(' Kod="EUR" CurrencyCode="EUR"', ' Kod="USD" CurrencyCode="USD"')));
});

test("server layer has timeout, 45-minute cache, and last-valid fallback", () => {
  assert.match(edge, /45 \* 60 \* 1000/);
  assert.match(edge, /AbortController/);
  assert.match(edge, /if \(lastValid\)/);
  assert.match(edge, /stale: true/);
});

test("54 TRY/EUR recommends €500 and marks €499.99 suitable", () => {
  const result = getTcmbEurRecommendation({ tryAmount: 27000, manualEur: 499.99, eurTryRate: 54 });
  assert.equal(result.suggestedEur, 500);
  assert.equal(result.status, "suitable");
  assert.ok((result.differencePercent ?? 1) < 0.01);
});

test("60 TRY/EUR recommends €450 and flags €499.99 for review", () => {
  const result = getTcmbEurRecommendation({ tryAmount: 27000, manualEur: 499.99, eurTryRate: 60 });
  assert.equal(result.suggestedEur, 450);
  assert.equal(result.status, "review");
  assert.ok((result.differencePercent ?? 0) > EUR_PRICE_RECOMMENDATION_TOLERANCE_PERCENT);
});

test("exact 5% boundary is green and over 5% is red", () => {
  assert.equal(getTcmbEurRecommendation({ tryAmount: 5400, manualEur: 105, eurTryRate: 54 }).status, "suitable");
  assert.equal(getTcmbEurRecommendation({ tryAmount: 5400, manualEur: 105.01, eurTryRate: 54 }).status, "review");
});

test("recommendation is pure and never writes the manual EUR input", () => {
  const input = Object.freeze({ tryAmount: 27000, manualEur: 499.99, eurTryRate: 60 });
  getTcmbEurRecommendation(input);
  assert.equal(input.manualEur, 499.99);
  assert.doesNotMatch(migration, /price_eur\s*=\s*(?:current_total|price_amount)\s*\//i);
});

test("TCMB failure is optional and cannot disable package save", () => {
  assert.match(adminModal, /Güncel kur bilgisi alınamadı/);
  assert.match(adminModal, /disabled=\{submitting \|\| \(!editingPackage && !id\)\}/);
});

test("TR display uses canonical TRY", () => {
  assert.equal(getLocalizedPackageDisplayPrice({ locale: "tr", tryAmount: 27000, eurAmount: 499.99 }).formatted, "27.000 TL");
});

test("EN display uses only the saved manual EUR value", () => {
  assert.equal(getLocalizedPackageDisplayPrice({ locale: "en", tryAmount: 27000, eurAmount: 499.99 }).formatted, "€499.99");
});

test("missing EN EUR falls back to explicitly labeled TRY", () => {
  const result = getLocalizedPackageDisplayPrice({ locale: "en", tryAmount: 27000, eurAmount: null });
  assert.equal(result.formatted, "27,000 TRY");
  assert.equal(result.usesTryFallback, true);
});

test("customer components use package display helper and never TCMB", () => {
  for (const source of [pricing, cart, payment]) {
    assert.match(source, /getLocalizedPackageDisplayPrice/);
    assert.doesNotMatch(source, /getTcmbEurRecommendation|tcmb-eur-rate|today\.xml/i);
  }
});

test("explicit TR/EN selection persists one canonical locale cookie", () => {
  assert.match(languageSwitch, /persistLocalePreference\(target\)/);
  assert.match(rootLayout, /oriens_locale=\(tr\|en\)/);
  assert.match(rootLayout, /navigator\.language/);
  assert.match(rootPage, /url=\/tr\//);
});

test("checkout UI distinguishes EUR display from the actual TRY charge", () => {
  assert.match(payment, /Displayed package prices are in EUR/);
  assert.match(payment, /Your payment will be processed in TRY/);
  assert.match(payment, /Payment amount \(TRY\)/);
});

test("PayTR remains server-authoritative TRY and never consumes price_eur", () => {
  assert.match(paytr, /current_total\?\?row\.price_amount|current_total \?\? row\.price_amount/);
  assert.doesNotMatch(paytr, /price_eur/);
  assert.doesNotMatch(paytr, /currency\s*:\s*["']EUR["']/);
});

console.log(`\n${passed}/${passed} focused checks passed.`);
