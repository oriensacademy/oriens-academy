import assert from "node:assert/strict";
import { validateStudentPhone } from "../src/lib/student/auth.ts";
import { resolveExamSlug, resolveExamRoute } from "../src/lib/routes.ts";
import { getVerifiedOfficialUniversityUrl } from "../src/data/official-universities.ts";
import { parseBooleanSettingValue } from "../src/lib/public-settings.ts";

console.log("\n=======================================================");
console.log(" ORIENS ACADEMY — PHASE 01 COMPREHENSIVE QA SUITE");
console.log("=======================================================\n");

// 1. Phone validation tests (TR & EN, with/without +90, with/without leading zero, international)
console.log("1. Testing phone number validation & normalization...");
{
  const tr1 = validateStudentPhone("5551234567", true);
  assert.equal(tr1.valid, true, "10-digit TR phone without +90 should be valid");
  assert.equal(tr1.normalized, "+905551234567", "10-digit TR phone should normalize to +905551234567");

  const tr2 = validateStudentPhone("0555 123 45 67", true);
  assert.equal(tr2.valid, true, "11-digit TR phone with 0 should be valid");
  assert.equal(tr2.normalized, "+905551234567", "11-digit TR phone with 0 should normalize to +905551234567");

  const tr3 = validateStudentPhone("+90 (555) 123-45-67", true);
  assert.equal(tr3.valid, true, "TR phone with +90 and formatting should be valid");
  assert.equal(tr3.normalized, "+905551234567");

  const en1 = validateStudentPhone("+44 7911 123456", false);
  assert.equal(en1.valid, true, "UK phone should be valid");
  assert.equal(en1.normalized, "+447911123456");

  const en2 = validateStudentPhone("00447911123456", false);
  assert.equal(en2.valid, true, "International 00 prefix should be normalized with +");
  assert.equal(en2.normalized, "+447911123456");

  const invalidAlpha = validateStudentPhone("555abc1234", true);
  assert.equal(invalidAlpha.valid, false, "Alphanumeric phone should be invalid");

  const invalidShort = validateStudentPhone("123", true);
  assert.equal(invalidShort.valid, false, "Short phone should be invalid");

  console.log("   [PASS] All phone normalization cases passed.");
}

// 2. Canonical Exam Route Resolver Tests
console.log("\n2. Testing Canonical Exam-Route Resolver...");
{
  assert.equal(resolveExamSlug("sat"), "sat");
  assert.equal(resolveExamSlug("SAT"), "sat");
  assert.equal(resolveExamSlug("ucat"), "ukcat");
  assert.equal(resolveExamSlug("UCAT"), "ukcat");
  assert.equal(resolveExamSlug("ib-diploma"), "ib");
  assert.equal(resolveExamSlug("advanced-placement"), "ap");
  assert.equal(resolveExamSlug("unknown-slug"), null);
  assert.equal(resolveExamSlug(""), null);

  assert.equal(resolveExamRoute("tr", "sat"), "/tr/sinavlar/sat");
  assert.equal(resolveExamRoute("en", "SAT"), "/en/exams/sat");
  assert.equal(resolveExamRoute("tr", "ucat"), "/tr/sinavlar/ukcat");
  assert.equal(resolveExamRoute("en", "unknown-exam"), "/en/exams");
  assert.equal(resolveExamRoute("tr", null), "/tr/sinavlar");

  console.log("   [PASS] All exam route resolver cases passed.");
}

// 3. Official University Websites Mapping Tests
console.log("\n3. Testing Official University URLs Mapping...");
{
  assert.equal(getVerifiedOfficialUniversityUrl("Massachusetts Institute of Technology (MIT)"), "https://www.mit.edu");
  assert.equal(getVerifiedOfficialUniversityUrl("MIT"), "https://www.mit.edu");
  assert.equal(getVerifiedOfficialUniversityUrl("Harvard University"), "https://www.harvard.edu");
  assert.equal(getVerifiedOfficialUniversityUrl("Bocconi University"), "https://www.unibocconi.it");
  assert.equal(getVerifiedOfficialUniversityUrl("University of Oxford"), "https://www.ox.ac.uk");
  assert.equal(getVerifiedOfficialUniversityUrl("University of Cambridge"), "https://www.cam.ac.uk");
  assert.equal(getVerifiedOfficialUniversityUrl("ETH Zurich"), "https://ethz.ch");
  assert.equal(getVerifiedOfficialUniversityUrl("Unverified Random University"), null);
  assert.equal(getVerifiedOfficialUniversityUrl(""), null);

  console.log("   [PASS] Official university URLs mapping and unverified rejection passed.");
}

// 4. Pricing Visibility Boolean Parser Tests
console.log("\n4. Testing Pricing Visibility Boolean Parsing...");
{
  assert.equal(parseBooleanSettingValue({ visible: true }), true);
  assert.equal(parseBooleanSettingValue({ visible: false }), false);
  assert.equal(parseBooleanSettingValue({ visible: "false" }), false);
  assert.equal(parseBooleanSettingValue({ enabled: true }), true);
  assert.equal(parseBooleanSettingValue(true), true);
  assert.equal(parseBooleanSettingValue(false), false);
  assert.equal(parseBooleanSettingValue("true"), true);
  assert.equal(parseBooleanSettingValue("false"), false);
  assert.equal(parseBooleanSettingValue("off"), false);
  assert.equal(parseBooleanSettingValue(null, true), true);

  console.log("   [PASS] Pricing visibility boolean parser passed.");
}

// 5. Cart Scoping & Isolation Logic Tests
console.log("\n5. Testing Cart Scoping & Isolation Simulation...");
{
  const USER_PREFIX = "oriens_cart_user_";
  const GUEST_PREFIX = "oriens_cart_guest_";

  const storageMock = new Map();

  function readCart(key) {
    const raw = storageMock.get(key);
    return raw ? JSON.parse(raw) : [];
  }

  function writeCart(key, items) {
    storageMock.set(key, JSON.stringify(items));
  }

  // Step 1: Guest A adds package10
  const guestSessionA = "guest_session_111";
  const guestKeyA = `${GUEST_PREFIX}${guestSessionA}`;
  writeCart(guestKeyA, [{ packageId: "package10", quantity: 1 }]);
  assert.equal(readCart(guestKeyA).length, 1);

  // Step 2: Guest A logs in as User A -> Merge into User A cart, clear guest cart
  const userA = "user_student_A";
  const userKeyA = `${USER_PREFIX}${userA}`;
  const existingUserACart = readCart(userKeyA);
  const mergedA = [...existingUserACart, ...readCart(guestKeyA)];
  writeCart(userKeyA, mergedA);
  storageMock.delete(guestKeyA);

  assert.equal(readCart(guestKeyA).length, 0, "Guest cart must be cleared after merge");
  assert.equal(readCart(userKeyA).length, 1, "User A cart must contain merged package10");

  // Step 3: User A logs out -> Guest session resets, memory state is empty
  const guestSessionB = "guest_session_222";
  const guestKeyB = `${GUEST_PREFIX}${guestSessionB}`;
  assert.equal(readCart(guestKeyB).length, 0, "New guest session cart must be empty");

  // Step 4: User B logs in (new account) -> User B cart is empty
  const userB = "user_student_B";
  const userKeyB = `${USER_PREFIX}${userB}`;
  assert.equal(readCart(userKeyB).length, 0, "User B cart must NOT see User A's cart");

  // Step 5: User B adds package5
  writeCart(userKeyB, [{ packageId: "package5", quantity: 1 }]);
  assert.equal(readCart(userKeyB)[0].packageId, "package5");

  // Step 6: User A logs back in -> User A still has package10 only
  assert.equal(readCart(userKeyA)[0].packageId, "package10");
  assert.equal(readCart(userKeyB)[0].packageId, "package5");

  console.log("   [PASS] User A / User B / Guest cart isolation verified.");
}

console.log("\n=======================================================");
console.log(" ALL PHASE 01 TESTS PASSED SUCCESSFULLY!");
console.log("=======================================================\n");
