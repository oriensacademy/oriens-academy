import assert from "node:assert/strict";
import { createRequire } from "module";
const require = createRequire("C:/Users/merto/Desktop/oriens-academy.com/package.json");

const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");

dotenv.config({ path: "C:/Users/merto/Desktop/oriens-academy.com/.env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-contact`;

async function testHoneypotRejection() {
  console.log("\n1. Testing Honeypot Bot Trap...");
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Spam Bot",
      email: "spambot@example.com",
      phone: "+905551234567",
      message: "Buy cheap crypto here!",
      privacyConsent: true,
      company_website: "https://spam-bot-trap.com", // HONEYPOT FILLED
      source: "contact_form",
    }),
  });

  const json = await res.json();
  assert.equal(res.status, 200, "Should return 200 synthetic success to deceive bot");
  assert.equal(json.success, true);
  console.log("✓ Honeypot correctly returned synthetic success response");

  // Verify NOT inserted into database
  const { data: checkSpam } = await supabase
    .from("contact_requests")
    .select("id")
    .eq("email", "spambot@example.com");

  assert.equal(checkSpam.length, 0, "Spam submission with honeypot must NOT be stored in DB");
  console.log("✓ Verified 0 rows created in contact_requests for honeypot payload");
}

async function testValidContactSubmissionWithoutTurnstile() {
  console.log("\n2. Testing Valid Contact Submission without Turnstile...");
  const testEmail = `qa-contact-${Date.now()}@oriens-academy.com`;
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "QA Direct Submission Test",
      email: testEmail,
      phone: "+905551234567",
      subject: "SAT Hazırlık",
      message: "Test consultation message without turnstile captcha.",
      privacyConsent: true,
      locale: "tr",
      source: "contact_form",
    }),
  });

  const json = await res.json();
  assert.equal(res.status, 200, `Expected HTTP 200, got ${res.status}: ${JSON.stringify(json)}`);
  assert.equal(json.success, true);
  assert.ok(json.contactId, "Should return contactId");
  console.log("✓ Submission succeeded without Turnstile token, ID:", json.contactId);

  // Verify row was stored in DB
  const { data: row } = await supabase
    .from("contact_requests")
    .select("id, email, status, full_name")
    .eq("id", json.contactId)
    .single();

  assert.ok(row, "Row must exist in contact_requests");
  assert.equal(row.email, testEmail);
  console.log("✓ Verified stored contact request row in database");

  // Clean up test row
  await supabase.from("contact_requests").delete().eq("id", json.contactId);
  console.log("✓ Cleaned up test contact request row");
}

async function run() {
  await testHoneypotRejection();
  await testValidContactSubmissionWithoutTurnstile();
  console.log("\n=== ALL CONTACT ANTI-SPAM TESTS PASSED ===");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
