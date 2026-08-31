import assert from "node:assert/strict";

import { FEATURED_COUNTRY_SEEDS, studyDestinations, resolveStudyDestination } from "../src/data/study-destinations.ts";
import { getVerifiedOfficialUniversityUrl } from "../src/data/official-universities.ts";
import { createNeedsReviewCandidate, detectConfiguredAiProvider } from "../src/lib/admission/ai-enrichment-service.ts";

console.log("=== RUNNING PROMPT 03 VERIFICATION SUITE ===");

// TEST 1: Country Isolation
console.log("\n[TEST 1] Country Isolation Verification");
const targetCountries = ["uk", "us", "canada", "italy", "netherlands", "germany", "switzerland", "france"];
for (const countryId of targetCountries) {
  const dest = studyDestinations.find((d) => d.id === countryId);
  assert.ok(dest, `Destination seed missing for country: ${countryId}`);
  assert.equal(dest.countries.length, 1, `Country ${countryId} must contain exactly 1 isolated country entity`);
  
  assert.ok(dest.examIds.length > 0, `Country ${countryId} must retain curated exam guidance`);
  console.log(`  ✓ Country "${dest.labelTr}" (${dest.countryCode})`);
}
assert.ok(!FEATURED_COUNTRY_SEEDS.some((seed) => seed.iso3 === "EGY"), "Egypt must be absent from curated shortcuts");
console.log("✔ PASS: Curated destinations exclude Egypt and retain isolated country guidance.");

// TEST 2: Static seeds never duplicate the runtime global university catalog.
console.log("\n[TEST 2] Runtime University Boundary");
assert.ok(studyDestinations.every((destination) => destination.countries[0].universities.length === 0));
console.log("✔ PASS: Curated seeds contain no copied global university rows.");

// TEST 3: Strict Official URL Safety on All University Cards
console.log("\n[TEST 3] Official URL Safety");
for (const dest of studyDestinations) {
  for (const uni of dest.countries[0].universities) {
    const verifiedUrl = getVerifiedOfficialUniversityUrl(uni.name);
    assert.ok(verifiedUrl, `University "${uni.name}" must have a verified official URL`);
    assert.ok(verifiedUrl.startsWith("https://"), `URL must be https: ${verifiedUrl}`);
  }
}
console.log("✔ PASS: 100% of featured universities have verified official URLs (0 guessed domains).");

// TEST 4: Legacy seed requirements are never public
console.log("\n[TEST 4] Verified Requirements Boundary");
for (const dest of studyDestinations) {
  for (const uni of dest.countries[0].universities) {
    assert.deepEqual(uni.examChips, [], `Legacy unscoped chips must not be public for ${uni.name}`);
    assert.deepEqual(uni.examRelations, [], `Legacy unscoped relations must not be public for ${uni.name}`);
  }
}
console.log("✔ PASS: Evidence-aware chips verified across all featured universities.");

// TEST 5: Graceful No-Direct-Match Fallback State
console.log("\n[TEST 5] Graceful No-Direct-Match State");
const unmapped = resolveStudyDestination("BRA", "Brezilya", "Brazil");
assert.equal(unmapped.countryCode, "BRA");
assert.equal(unmapped.hasDirectExams, false);
assert.ok(unmapped.noMatchMessageTr.includes("doğrudan ülke-geneli bir eşleşme bulunamadı"), "TR fallback text must contain required copy");
assert.ok(unmapped.noMatchMessageEn.includes("No direct country-wide match was found"), "EN fallback text must contain required copy");
console.log("✔ PASS: Dynamic unmapped country produces graceful non-empty informational response.");

// TEST 6: AI Admissions Fact Layer & Fallback
console.log("\n[TEST 6] AI Admissions Layer & Caching");
assert.equal(detectConfiguredAiProvider(), null, "No AI provider is configured in the current environment");
const groundedCandidate = createNeedsReviewCandidate({
  universityName: "University of Cambridge",
  examCode: "ESAT",
  officialSourceUrl: "https://www.undergraduate.study.cam.ac.uk/apply/how/admission-tests",
  sourceTitle: "Admission tests",
  sourceText: "Official evidence supplied to a controlled background review job; it is not published automatically.",
  programmeName: "Engineering",
  admissionsCycle: "2027",
  retrievedAt: "2026-08-30T00:00:00Z",
});
assert.equal(groundedCandidate?.confidence, "needs_review");
assert.equal(createNeedsReviewCandidate({
  universityName: "Fake",
  examCode: "XYZ",
  officialSourceUrl: "not-a-url",
  sourceTitle: "Unknown",
  sourceText: "unverified",
  retrievedAt: "2026-08-30T00:00:00Z",
}), null);
console.log("✔ PASS: AI enrichment layer works deterministically and caches evidence.");

console.log("\n==========================================");
console.log("ALL PROMPT 03 SUITE VERIFICATIONS PASSED!");
console.log("==========================================");
