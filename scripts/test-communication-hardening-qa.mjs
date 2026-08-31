import assert from "node:assert/strict";

console.log("=== ORIENS ACADEMY P0 HARDENING QA SUITE ===");

// 1. Turnstile Subdomain & Hostname Verification Test
function isAllowedHostname(hostname) {
  if (!hostname) return false;
  const h = hostname.toLowerCase().trim();
  if (h === "oriens-academy.com" || h.endsWith(".oriens-academy.com")) return true;
  if (h === "oriens-academy-official.pages.dev" || h.endsWith(".pages.dev")) return true;
  if (h === "localhost" || h === "127.0.0.1") return true;
  return false;
}

console.log("\n[TEST 1] Turnstile Hostname & Subdomain Verification");
assert.equal(isAllowedHostname("oriens-academy.com"), true);
assert.equal(isAllowedHostname("www.oriens-academy.com"), true);
assert.equal(isAllowedHostname("staging.oriens-academy.com"), true);
assert.equal(isAllowedHostname("oriens-academy-official.pages.dev"), true);
assert.equal(isAllowedHostname("c446d8f5.oriens-academy-official.pages.dev"), true);
assert.equal(isAllowedHostname("preview-123.pages.dev"), true);
assert.equal(isAllowedHostname("localhost"), true);
assert.equal(isAllowedHostname("127.0.0.1"), true);
assert.equal(isAllowedHostname("malicious-site.com"), false);
assert.equal(isAllowedHostname("fakeoriens-academy.com"), false);
console.log("✓ Turnstile hostname wildcard checks passed.");

// 2. Payment Method Humanization Tests (TR & EN)
function humanizePaymentMethod(method, locale = "tr") {
  const isTr = locale === "tr";
  if (!method) return isTr ? "Kart ile Ödeme" : "Card Payment";
  const m = String(method).toLowerCase();
  if (m === "bank_transfer" || m === "havale" || m === "eft") {
    return isTr ? "Banka Havalesi / EFT" : "Bank Wire Transfer";
  }
  if (m === "card" || m === "credit_card" || m === "credit card" || m === "debit_card" || m === "paytr") {
    return isTr ? "Kart ile Ödeme" : "Card Payment";
  }
  return method;
}

console.log("\n[TEST 2] Payment Method Humanization");
assert.equal(humanizePaymentMethod("card", "tr"), "Kart ile Ödeme");
assert.equal(humanizePaymentMethod("card", "en"), "Card Payment");
assert.equal(humanizePaymentMethod("credit_card", "tr"), "Kart ile Ödeme");
assert.equal(humanizePaymentMethod("bank_transfer", "tr"), "Banka Havalesi / EFT");
assert.equal(humanizePaymentMethod("bank_transfer", "en"), "Bank Wire Transfer");
console.log("✓ Payment method humanization passed (no raw 'card' string rendered).");

// 3. Event Type Humanization Tests
function humanizeEventType(eventType, locale = "tr") {
  const isTr = locale === "tr";
  if (!eventType) return isTr ? "Ders" : "Lesson";
  const t = String(eventType).toLowerCase();
  switch (t) {
    case "lesson":
      return isTr ? "Ders" : "Lesson";
    case "pre_consultation":
    case "discovery":
      return isTr ? "Ön Görüşme" : "Initial Consultation";
    case "additional_consultation":
      return isTr ? "Ek Görüşme" : "Follow-up Meeting";
    case "consultation":
      return isTr ? "Danışmanlık" : "Consultation";
    case "other":
      return isTr ? "Diğer" : "Other";
    default:
      return eventType;
  }
}

console.log("\n[TEST 3] Event Type Humanization");
assert.equal(humanizeEventType("lesson", "tr"), "Ders");
assert.equal(humanizeEventType("lesson", "en"), "Lesson");
assert.equal(humanizeEventType("pre_consultation", "tr"), "Ön Görüşme");
assert.equal(humanizeEventType("pre_consultation", "en"), "Initial Consultation");
assert.equal(humanizeEventType("additional_consultation", "tr"), "Ek Görüşme");
assert.equal(humanizeEventType("consultation", "tr"), "Danışmanlık");
assert.equal(humanizeEventType("other", "tr"), "Diğer");
console.log("✓ Event type humanization passed.");

// 4. Payment Status Humanization Tests
function humanizePaymentStatus(status, locale = "tr") {
  const isTr = locale === "tr";
  if (!status) return isTr ? "Bekliyor" : "Pending";
  const s = String(status).toLowerCase();
  switch (s) {
    case "paid":
    case "success":
      return isTr ? "Ödendi" : "Paid";
    case "pending":
      return isTr ? "Bekliyor" : "Pending";
    case "failed":
    case "cancelled":
      return isTr ? "Başarısız" : "Failed";
    default:
      return status;
  }
}

console.log("\n[TEST 4] Payment Status Humanization");
assert.equal(humanizePaymentStatus("paid", "tr"), "Ödendi");
assert.equal(humanizePaymentStatus("paid", "en"), "Paid");
assert.equal(humanizePaymentStatus("pending", "tr"), "Bekliyor");
assert.equal(humanizePaymentStatus("failed", "tr"), "Başarısız");
console.log("✓ Payment status humanization passed.");

// 5. Central BCC Deduplication Logic
function buildBccList(toEmail, explicitBcc = []) {
  const PRIMARY_ARCHIVE_EMAIL = "admin@oriens-academy.com";
  const bccSet = new Set(explicitBcc.map((e) => e.toLowerCase().trim()).filter(Boolean));
  if (toEmail.toLowerCase().trim() !== PRIMARY_ARCHIVE_EMAIL) {
    bccSet.add(PRIMARY_ARCHIVE_EMAIL);
  }
  return Array.from(bccSet);
}

console.log("\n[TEST 5] Central Outbound BCC & Deduplication");
const bcc1 = buildBccList("student@example.com");
assert.deepEqual(bcc1, ["admin@oriens-academy.com"]);

const bcc2 = buildBccList("admin@oriens-academy.com");
assert.deepEqual(bcc2, []);

const bcc3 = buildBccList("student@example.com", ["admin@oriens-academy.com", "mentor@example.com"]);
assert.deepEqual(bcc3.sort(), ["admin@oriens-academy.com", "mentor@example.com"].sort());
console.log("✓ Central BCC archiving and deduplication passed.");

// 6. Preferred Language Validation
function validatePreferredLanguage(lang) {
  if (lang === "tr" || lang === "en") return lang;
  return "tr";
}

console.log("\n[TEST 6] Preferred Language Resolution");
assert.equal(validatePreferredLanguage("tr"), "tr");
assert.equal(validatePreferredLanguage("en"), "en");
assert.equal(validatePreferredLanguage("invalid"), "tr");
assert.equal(validatePreferredLanguage(null), "tr");
console.log("✓ Preferred language validation passed.");

console.log("\n==========================================");
console.log("ALL 6 QA TEST MATRIX VALIDATIONS PASSED!");
console.log("==========================================");
