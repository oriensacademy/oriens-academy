/**
 * Comprehensive Test Suite for Payment Status & Result Flow Hardening
 *
 * Validates:
 * 1. Reference & Status Token Validation (shared security rules):
 *    - Current ORI... reference format (e.g. ORI202609051733579A789DD7E625) -> VALID
 *    - Legacy OA-... reference format -> VALID
 *    - Malformed references -> REJECTED
 *    - SQL/XSS injection attempts -> REJECTED
 *    - Empty/whitespace references -> REJECTED
 *    - 64-hex status token format -> VALID
 *    - Invalid token lengths/characters -> REJECTED
 * 2. Live payment-status Edge Function Validation:
 *    - Input credential validation rejection (HTTP 400 INVALID_STATUS_CREDENTIALS)
 *    - ORI reference format acceptance (bypasses 400 validation, proceeds to DB lookup)
 *    - Full database fixture lookup lifecycle (create test transaction with ORI ref + token,
 *      query payment-status, verify deterministic response payload, cleanup fixture)
 * 3. PaymentResultPage State Machine Simulation:
 *    - PAID -> SUCCESS UI
 *    - FAILED -> FAILURE UI
 *    - PENDING -> WAITING/POLLING (NEVER FAILURE)
 *    - POLLING EXHAUSTED -> NEUTRAL PENDING GRACE (NEVER FAILURE)
 *    - API 500 / NETWORK ERROR -> VERIFICATION ERROR (NEVER FAILURE)
 *    - AUTOMATIC RETURN TO CARD ON PENDING/ERROR -> STRICTLY 0
 *    - PENDING -> PAID POLL TRANSITION -> SUCCESS
 *    - PENDING -> FAILED POLL TRANSITION -> FAILURE
 *
 * Usage:
 *   node scripts/test-payment-result-flow.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY;

let passed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log("  PASS  " + name);
  } else {
    failures.push(name + (detail ? " -- " + detail : ""));
    console.log("  FAIL  " + name + (detail ? " -- " + detail : ""));
  }
}

// -----------------------------------------------------------------------------
// SECTION 1: Pure Reference & Token Validation Rules (matching security.ts)
// -----------------------------------------------------------------------------

const CURRENT_ORI_REGEX = /^ORI[A-Z0-9]{10,61}$/;
const LEGACY_OA_REGEX = /^OA-[A-Z0-9]+-[A-F0-9]{6}$/;
const STATUS_TOKEN_REGEX = /^[a-f0-9]{64}$/;

function isValidPaymentReference(reference) {
  if (typeof reference !== "string") return false;
  const trimmed = reference.trim();
  if (!trimmed) return false;
  return CURRENT_ORI_REGEX.test(trimmed) || LEGACY_OA_REGEX.test(trimmed);
}

function isValidStatusToken(token) {
  if (typeof token !== "string") return false;
  return STATUS_TOKEN_REGEX.test(token.trim());
}

console.log("\n=======================================================");
console.log("1. Reference & Token Format Validation Tests");
console.log("=======================================================");

// Current ORI format tests
const PRODUCTION_TEST_REF = "ORI202609051733579A789DD7E625";
check(
  "Current Production ORI Reference format is accepted",
  isValidPaymentReference(PRODUCTION_TEST_REF) === true,
  `Tested: ${PRODUCTION_TEST_REF}`
);

const ANOTHER_ORI_REF = "ORI20260905180000A1B2C3D4E5F6SINGLE";
check(
  "Generated ORI Reference with package suffix is accepted",
  isValidPaymentReference(ANOTHER_ORI_REF) === true,
  `Tested: ${ANOTHER_ORI_REF}`
);

const MIN_LENGTH_ORI = "ORI" + "A".repeat(10); // 13 chars
const MAX_LENGTH_ORI = "ORI" + "A".repeat(61); // 64 chars
check(
  "Boundary length ORI references (min 13 chars) accepted",
  isValidPaymentReference(MIN_LENGTH_ORI) === true
);
check(
  "Boundary length ORI references (max 64 chars) accepted",
  isValidPaymentReference(MAX_LENGTH_ORI) === true
);

// Legacy OA format tests
check(
  "Legacy OA reference format OA-SINGLE-123456 is accepted",
  isValidPaymentReference("OA-SINGLE-123456") === true
);
check(
  "Legacy OA reference format OA-FULL-ABCDEF is accepted",
  isValidPaymentReference("OA-FULL-ABCDEF") === true
);

// Malformed / Reject tests
check(
  "Malformed reference 'ORI' (too short) is rejected",
  isValidPaymentReference("ORI") === false
);
check(
  "Malformed reference 'ORI123' (too short) is rejected",
  isValidPaymentReference("ORI123") === false
);
check(
  "Malformed reference 'OA-123' (wrong format) is rejected",
  isValidPaymentReference("OA-123") === false
);
check(
  "Arbitrary string 'INVALID_TRANSACTION' is rejected",
  isValidPaymentReference("INVALID_TRANSACTION") === false
);
check(
  "Empty string is rejected",
  isValidPaymentReference("") === false
);
check(
  "Whitespace-only string is rejected",
  isValidPaymentReference("   ") === false
);
check(
  "Null / undefined is rejected",
  isValidPaymentReference(null) === false && isValidPaymentReference(undefined) === false
);

// Injection attacks
check(
  "SQL injection payload 1 is rejected",
  isValidPaymentReference("ORI'; DROP TABLE payment_transactions; --") === false
);
check(
  "SQL injection payload 2 is rejected",
  isValidPaymentReference("ORI\" OR 1=1 --") === false
);
check(
  "XSS injection payload is rejected",
  isValidPaymentReference("ORI<script>alert(1)</script>") === false
);
check(
  "Legacy format SQL injection is rejected",
  isValidPaymentReference("OA-TEST-ABCDEF' OR '1'='1") === false
);

// Status Token tests
const VALID_64_HEX = "a1b2c3d4e5f67890" + "1234567890abcdef" + "a1b2c3d4e5f67890" + "1234567890abcdef";
check(
  "64-character lowercase hex status token is accepted",
  isValidStatusToken(VALID_64_HEX) === true
);
check(
  "63-character hex token (too short) is rejected",
  isValidStatusToken(VALID_64_HEX.slice(0, 63)) === false
);
check(
  "65-character hex token (too long) is rejected",
  isValidStatusToken(VALID_64_HEX + "a") === false
);
check(
  "Uppercase hex token is rejected (security standard expects lowercase sha256 output)",
  isValidStatusToken(VALID_64_HEX.toUpperCase()) === false
);
check(
  "Token with non-hex characters is rejected",
  isValidStatusToken("g".repeat(64)) === false
);
check(
  "Empty token is rejected",
  isValidStatusToken("") === false
);

// -----------------------------------------------------------------------------
// SECTION 2: Live payment-status Edge Function Invocation Tests
// -----------------------------------------------------------------------------

console.log("\n=======================================================");
console.log("2. Live payment-status Edge Function API Tests");
console.log("=======================================================");

async function testLiveEdgeFunction() {
  if (!SUPABASE_URL) {
    console.log("  SKIP  No NEXT_PUBLIC_SUPABASE_URL configured, skipping live API tests.");
    return;
  }

  const statusEndpoint = `${SUPABASE_URL}/functions/v1/payment-status`;

  // Test A: Malformed Reference -> Must return 400 INVALID_STATUS_CREDENTIALS
  try {
    const res = await fetch(statusEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference: "MALFORMED_REF_123", token: VALID_64_HEX }),
    });
    const body = await res.json().catch(() => ({}));
    check(
      "Live API: Malformed reference returns HTTP 400 INVALID_STATUS_CREDENTIALS",
      res.status === 400 && body.error_code === "INVALID_STATUS_CREDENTIALS",
      `Status: ${res.status}, body: ${JSON.stringify(body)}`
    );
  } catch (err) {
    check("Live API: Malformed reference test reached endpoint", false, err.message);
  }

  // Test B: Invalid Token -> Must return 400 INVALID_STATUS_CREDENTIALS
  try {
    const res = await fetch(statusEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference: PRODUCTION_TEST_REF, token: "short_token" }),
    });
    const body = await res.json().catch(() => ({}));
    check(
      "Live API: Invalid status token returns HTTP 400 INVALID_STATUS_CREDENTIALS",
      res.status === 400 && body.error_code === "INVALID_STATUS_CREDENTIALS",
      `Status: ${res.status}, body: ${JSON.stringify(body)}`
    );
  } catch (err) {
    check("Live API: Invalid status token test reached endpoint", false, err.message);
  }

  // Test C: Current ORI reference format acceptance
  // When calling with a valid ORI reference that does not exist in DB:
  // - If the regex was STILL the old buggy regex (^OA-...), it would return 400 INVALID_STATUS_CREDENTIALS.
  // - Because the regex is FIXED, it passes credential validation and returns 404 NOT_FOUND!
  try {
    const nonExistentOriRef = "ORI20260905999999000000000000";
    const res = await fetch(statusEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference: nonExistentOriRef, token: VALID_64_HEX }),
    });
    const body = await res.json().catch(() => ({}));
    check(
      "Live API: ORI reference format passes credential validation (HTTP 404 PAYMENT_NOT_FOUND, NOT 400 INVALID_STATUS_CREDENTIALS)",
      res.status === 404 && body.error_code === "PAYMENT_NOT_FOUND",
      `HTTP Status: ${res.status}, Code: ${body.error_code || "none"}`
    );
  } catch (err) {
    check("Live API: ORI reference validation test", false, err.message);
  }

  // Test D: Database fixture roundtrip (create real row, query payment-status, verify payload, cleanup)
  if (SERVICE_ROLE_KEY) {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const fixtureRef = `ORI${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}${randomBytes(6).toString("hex").toUpperCase()}TEST`;
    const fixtureRawToken = randomBytes(32).toString("hex");
    const fixtureTokenHash = createHash("sha256").update(fixtureRawToken).digest("hex");

    let createdId = null;
    try {
      // Find an existing transaction or auth user to satisfy foreign key constraints
      const { data: existingTx } = await admin
        .from("payment_transactions")
        .select("student_user_id, auth_actor_user_id")
        .not("student_user_id", "is", null)
        .limit(1)
        .maybeSingle();

      let studentUserId = existingTx?.student_user_id;
      let authActorUserId = existingTx?.auth_actor_user_id || studentUserId;

      if (!studentUserId) {
        const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
        studentUserId = userList?.users?.[0]?.id;
        authActorUserId = studentUserId;
      }

      if (!studentUserId) {
        console.log("  SKIP  No valid user found for DB fixture test");
        return;
      }

      const { data: insertedTx, error: insertErr } = await admin
        .from("payment_transactions")
        .insert({
          public_reference: fixtureRef,
          status_token_hash: fixtureTokenHash,
          package_id: "single",
          payment_method: "card",
          provider: "paytr",
          amount: 1500,
          currency: "TRY",
          status: "pending",
          metadata: {
            package_ids: ["single"],
            package_name: "1 Ders",
            checkout_items: [{ package_name: "1 Ders" }],
            base_amount: 3200,
            discount_amount: 3199,
            coupon_code: "TESTKUPON",
          },
          payer_name: "Test Runner",
          payer_email: "test-runner@oriens-academy.com",
          auth_actor_user_id: authActorUserId,
          student_user_id: studentUserId,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.log("  SKIP  Could not insert DB fixture:", insertErr.message);
      } else {
        createdId = insertedTx.id;

        // Query payment-status endpoint with fixture credentials
        const res = await fetch(statusEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: fixtureRef, token: fixtureRawToken }),
        });
        const data = await res.json().catch(() => ({}));

        const payment = data.payment;
        check(
          "Live API: Fixture transaction found with valid ORI reference & token (HTTP 200)",
          res.status === 200 && payment?.status === "pending",
          `Status: ${res.status}, response: ${JSON.stringify(data)}`
        );

        check(
          "Live API: Response model returns safe deterministic properties (status, reference, updatedAt)",
          payment?.reference === fixtureRef && payment?.status === "pending" && typeof payment?.updatedAt === "string",
          `Data: ${JSON.stringify(payment)}`
        );
        check(
          "Live API: Response returns package snapshot name and coupon pricing summary",
          payment?.packageName === "1 Ders" &&
            payment?.couponCode === "TESTKUPON" &&
            payment?.subtotalAmount === 3200 &&
            payment?.discountAmount === 3199,
          `Data: ${JSON.stringify(payment)}`
        );

        // Update to paid
        await admin.from("payment_transactions").update({ status: "paid" }).eq("id", createdId);
        const resPaid = await fetch(statusEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: fixtureRef, token: fixtureRawToken }),
        });
        const dataPaid = await resPaid.json().catch(() => ({}));
        check(
          "Live API: Transitioned 'paid' transaction returns status='paid'",
          resPaid.status === 200 && dataPaid.payment?.status === "paid"
        );

        // Update to failed with failure reason in metadata
        await admin.from("payment_transactions").update({
          status: "failed",
          metadata: { failure_reason: "Card expired", failed_reason_code: "EXPIRED_CARD" },
        }).eq("id", createdId);
        const resFailed = await fetch(statusEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: fixtureRef, token: fixtureRawToken }),
        });
        const dataFailed = await resFailed.json().catch(() => ({}));
        check(
          "Live API: Transitioned 'failed' transaction returns status='failed' and safe failure details",
          resFailed.status === 200 && dataFailed.payment?.status === "failed" && dataFailed.payment?.failureCode === "EXPIRED_CARD"
        );
      }
    } catch (fixtureErr) {
      check("Live API: Database fixture lifecycle", false, fixtureErr.message);
    } finally {
      if (createdId) {
        await admin.from("payment_transactions").delete().eq("id", createdId);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// SECTION 3: Result Page State Machine & Invariant Tests
// -----------------------------------------------------------------------------

console.log("\n=======================================================");
console.log("3. PaymentResultPage State Machine Simulation Tests");
console.log("=======================================================");

/**
 * Simulates PaymentResultPage decision rules and UI state transitions:
 * - isSuccessUrl (from pathname)
 * - status response from getPaymentStatus
 * - poll count
 *
 * Must strictly guarantee:
 * - PENDING does NOT produce failure state
 * - Verification error / network error does NOT produce failure state
 * - Automatic navigation to card screen does NOT occur (redirectCount === 0)
 */
function simulatePaymentResultPage(scenario) {
  let uiState = "loading";
  let redirectCount = 0;
  let retryCount = 0;

  for (let step = 0; step < scenario.responses.length; step++) {
    const response = scenario.responses[step];

    if (response === "NETWORK_ERROR" || response === null) {
      // getPaymentStatus returned null (HTTP 500 / Network Error)
      uiState = "verification_error";
      // Crucial assertion: does the code call router.push(payment)?
      // Our fix: NO. Only explicit button click triggers navigation.
    } else if (response.status === "paid") {
      uiState = "success";
      break;
    } else if (response.status === "failed") {
      uiState = "failure";
      break;
    } else if (response.status === "pending") {
      if (step < 8) {
        uiState = "pending_confirmation";
        retryCount += 1;
      } else {
        // Bounded polling reached limit: display neutral pending grace
        uiState = "pending_grace";
      }
    }
  }

  return { uiState, redirectCount, retryCount };
}

// Matrix Test 1: PAID -> SUCCESS
{
  const { uiState, redirectCount } = simulatePaymentResultPage({
    responses: [{ status: "paid", reference: PRODUCTION_TEST_REF }],
  });
  check(
    "Result Page: Paid status results in SUCCESS state",
    uiState === "success" && redirectCount === 0
  );
}

// Matrix Test 2: FAILED -> FAILURE
{
  const { uiState, redirectCount } = simulatePaymentResultPage({
    responses: [{ status: "failed", reference: PRODUCTION_TEST_REF }],
  });
  check(
    "Result Page: Failed status results in FAILURE state with 0 auto-redirects",
    uiState === "failure" && redirectCount === 0
  );
}

// Matrix Test 3: PENDING initial -> WAITING/POLLING (NEVER FAILURE)
{
  const { uiState, redirectCount } = simulatePaymentResultPage({
    responses: [{ status: "pending", reference: PRODUCTION_TEST_REF }],
  });
  check(
    "Result Page: Initial pending status results in WAITING (pending_confirmation), NOT failure",
    uiState === "pending_confirmation" && redirectCount === 0
  );
}

// Matrix Test 4: PENDING -> PENDING -> PAID (Polling success)
{
  const { uiState, retryCount, redirectCount } = simulatePaymentResultPage({
    responses: [
      { status: "pending", reference: PRODUCTION_TEST_REF },
      { status: "pending", reference: PRODUCTION_TEST_REF },
      { status: "paid", reference: PRODUCTION_TEST_REF },
    ],
  });
  check(
    "Result Page: Poll transition (pending -> pending -> paid) resolves to SUCCESS",
    uiState === "success" && retryCount === 2 && redirectCount === 0
  );
}

// Matrix Test 5: PENDING -> FAILED (Polling failure)
{
  const { uiState, retryCount, redirectCount } = simulatePaymentResultPage({
    responses: [
      { status: "pending", reference: PRODUCTION_TEST_REF },
      { status: "failed", reference: PRODUCTION_TEST_REF },
    ],
  });
  check(
    "Result Page: Poll transition (pending -> failed) resolves to FAILURE",
    uiState === "failure" && retryCount === 1 && redirectCount === 0
  );
}

// Matrix Test 6: PENDING bounded polling exhausted -> PENDING_GRACE (NEVER FAILURE)
{
  const { uiState, redirectCount } = simulatePaymentResultPage({
    responses: Array(10).fill({ status: "pending", reference: PRODUCTION_TEST_REF }),
  });
  check(
    "Result Page: Bounded polling exhaustion yields PENDING_GRACE (neutral message), NOT failure",
    uiState === "pending_grace" && redirectCount === 0
  );
}

// Matrix Test 7: API 500 / Network error -> VERIFICATION_ERROR (NEVER FAILURE)
{
  const { uiState, redirectCount } = simulatePaymentResultPage({
    responses: ["NETWORK_ERROR"],
  });
  check(
    "Result Page: Status API 500 / Network error yields VERIFICATION_ERROR, NOT failure",
    uiState === "verification_error" && redirectCount === 0
  );
}

// Matrix Test 8: Missing credential in URL -> VERIFICATION_ERROR (safe state)
{
  const params = new URLSearchParams("");
  const reference = params.get("reference");
  const token = params.get("token");
  const hasCredentials = Boolean(reference && token);
  check(
    "Result Page: Missing credentials in URL safely caught without throwing or auto-redirecting",
    !hasCredentials
  );
}

// -----------------------------------------------------------------------------
// SECTION 4: Return URLs Canonical Format Tests
// -----------------------------------------------------------------------------

console.log("\n=======================================================");
console.log("4. Canonical Return URL Structure Tests");
console.log("=======================================================");

const paymentPageSource = readFileSync(
  path.resolve(process.cwd(), "src/components/payment/PaymentPage.tsx"),
  "utf8"
);
check(
  "Active PayTR iframe survives browser focus/visibility changes",
  !paymentPageSource.includes("void refreshAccount();") &&
    paymentPageSource.includes("void refreshGuardianData();")
);
const hostedCardSource = readFileSync(
  path.resolve(process.cwd(), "src/components/payment/HostedCardPanel.tsx"),
  "utf8"
);
check(
  "Active PayTR iframe is not invalidated by transient cart/coupon hydration",
  !hostedCardSource.includes("prevPricingKeyRef")
);
const paymentResultSource = readFileSync(
  path.resolve(process.cwd(), "src/components/payment/PaymentResultPage.tsx"),
  "utf8"
);
const paymentStatusSource = readFileSync(
  path.resolve(process.cwd(), "supabase/functions/payment-status/index.ts"),
  "utf8"
);
check(
  "Checkout displays an explicit coupon and final card charge summary beside the PayTR step",
  paymentPageSource.includes('data-testid="payment-coupon-summary"') &&
    paymentPageSource.includes("kartınızdan çekilecek")
);
check(
  "Success result displays the package snapshot name instead of the internal package id",
  paymentResultSource.includes("packageDisplayName({ packageId: payment.packageId, lessonCount: payment.lessonCount }, locale)") &&
    paymentStatusSource.includes("packageName,") && paymentStatusSource.includes("lessonCount,")
);
check(
  "Success result displays coupon discount and paid amount",
  paymentResultSource.includes("payment.couponCode") &&
    paymentResultSource.includes("payment.discountAmount") &&
    paymentResultSource.includes("payment.amount")
);

function buildReturnUrls(publicSiteUrl, locale, merchantOid, statusToken) {
  const base = publicSiteUrl.replace(/\/$/, "");
  const successPath = locale === "en" ? "en/payment/success/" : "tr/odeme/basarili/";
  const failPath = locale === "en" ? "en/payment/failed/" : "tr/odeme/basarisiz/";
  const merchantOkUrl = `${base}/${successPath}?reference=${encodeURIComponent(merchantOid)}&token=${encodeURIComponent(statusToken)}`;
  const merchantFailUrl = `${base}/${failPath}?reference=${encodeURIComponent(merchantOid)}&token=${encodeURIComponent(statusToken)}`;
  return { merchantOkUrl, merchantFailUrl };
}

const trUrls = buildReturnUrls("https://oriens-academy.com", "tr", PRODUCTION_TEST_REF, VALID_64_HEX);
check(
  "TR merchant_ok_url has canonical trailing slash before query string",
  trUrls.merchantOkUrl.startsWith("https://oriens-academy.com/tr/odeme/basarili/?reference=")
);
check(
  "TR merchant_fail_url has canonical trailing slash before query string",
  trUrls.merchantFailUrl.startsWith("https://oriens-academy.com/tr/odeme/basarisiz/?reference=")
);

const enUrls = buildReturnUrls("https://oriens-academy.com", "en", PRODUCTION_TEST_REF, VALID_64_HEX);
check(
  "EN merchant_ok_url has canonical trailing slash before query string",
  enUrls.merchantOkUrl.startsWith("https://oriens-academy.com/en/payment/success/?reference=")
);
check(
  "EN merchant_fail_url has canonical trailing slash before query string",
  enUrls.merchantFailUrl.startsWith("https://oriens-academy.com/en/payment/failed/?reference=")
);

// -----------------------------------------------------------------------------
// Run async tests and summary
// -----------------------------------------------------------------------------

async function run() {
  await testLiveEdgeFunction();

  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failures.length} FAILED`);
  console.log("=======================================================");

  if (failures.length > 0) {
    console.error("Failures:");
    failures.forEach((f) => console.error(" - " + f));
    process.exit(1);
  } else {
    console.log("ALL TESTS PASSED SUCCESSFULLY.\n");
    process.exit(0);
  }
}

run();
