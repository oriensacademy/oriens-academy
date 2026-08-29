import assert from "node:assert/strict";

// We will dynamically test the modules
import { examCodes } from "../src/content/shared.ts";
import { examRecords } from "../src/content/exams.ts";
import { examDetailText as examDetailTextTr } from "../src/content/tr/exam-details.ts";
import { examDetailText as examDetailTextEn } from "../src/content/en/exam-details.ts";
import { examText as examTextTr } from "../src/content/tr/exams.ts";
import { examText as examTextEn } from "../src/content/en/exams.ts";
import { resolveExamSlug, resolveExamRoute } from "../src/lib/routes.ts";
import { getVerifiedOfficialUniversityUrl } from "../src/data/official-universities.ts";
import { retrieveSearchResults } from "../src/lib/search/retrieval-engine.ts";

console.log("=== RUNNING PROMPT 02 VERIFICATION SUITE ===");

// TEST 1: Exactly 18 Canonical Exams
console.log("\n[TEST 1] Exactly 18 Canonical Exams");
assert.equal(examCodes.length, 18, `Expected 18 exam codes, got ${examCodes.length}`);
assert.equal(examRecords.length, 18, `Expected 18 exam records, got ${examRecords.length}`);
const expected18 = [
  "IB", "AP", "IGCSE", "A-Level", "SAT", "ACT",
  "ESAT", "TMUA", "TARA", "UCAT", "LNAT", "IMAT",
  "GAMSAT", "MCAT", "LSAT", "GRE", "GMAT", "OMPT"
];
for (const code of expected18) {
  assert.ok(examCodes.includes(code), `Missing canonical exam code: ${code}`);
  assert.ok(examRecords.some(r => r.code === code), `Missing exam record for: ${code}`);
}
console.log("✔ PASS: Exactly 18 canonical exams verified.");

// TEST 2: Categorization (6 Curriculum + 12 Admission-Specific)
console.log("\n[TEST 2] 6 Curriculum + 12 Admission-Specific Categorization");
const curriculumExams = examRecords.filter(r => r.primaryCategory === "international-curriculum");
const admissionExams = examRecords.filter(r => r.primaryCategory === "admission-specific");
assert.equal(curriculumExams.length, 6, `Expected 6 curriculum exams, got ${curriculumExams.length}`);
assert.equal(admissionExams.length, 12, `Expected 12 admission exams, got ${admissionExams.length}`);
const expectedCurriculum = ["IB", "AP", "IGCSE", "A-Level", "SAT", "ACT"];
const expectedAdmission = ["ESAT", "TMUA", "TARA", "UCAT", "LNAT", "IMAT", "GAMSAT", "MCAT", "LSAT", "GRE", "GMAT", "OMPT"];
for (const c of expectedCurriculum) {
  assert.ok(curriculumExams.some(e => e.code === c), `Expected ${c} in curriculum`);
}
for (const a of expectedAdmission) {
  assert.ok(admissionExams.some(e => e.code === a), `Expected ${a} in admission-specific`);
}
console.log("✔ PASS: 6 + 12 categorization verified.");

// TEST 3: No duplicate active exams or slugs
console.log("\n[TEST 3] No Duplicate Codes or Slugs");
const uniqueCodes = new Set(examRecords.map(e => e.code));
const uniqueSlugs = new Set(examRecords.map(e => e.slug));
assert.equal(uniqueCodes.size, 18, "Duplicate exam code detected");
assert.equal(uniqueSlugs.size, 18, "Duplicate exam slug detected");
console.log("✔ PASS: All 18 codes and slugs are unique.");

// TEST 4: Legacy UKCAT -> UCAT Normalization
console.log("\n[TEST 4] Legacy UKCAT Normalization");
assert.equal(resolveExamSlug("ukcat"), "ucat", "ukcat must resolve to canonical ucat slug");
assert.equal(resolveExamSlug("UKCAT"), "ucat", "UKCAT must resolve to canonical ucat slug");
assert.equal(resolveExamSlug("ucat"), "ucat", "ucat must resolve to canonical ucat slug");
assert.equal(resolveExamSlug("UCAT"), "ucat", "UCAT must resolve to canonical ucat slug");
assert.equal(resolveExamSlug("a-level"), "a-level", "a-level must resolve to canonical a-level slug");
assert.equal(resolveExamSlug("alevel"), "a-level", "alevel must resolve to canonical a-level slug");
assert.equal(resolveExamSlug("A Level"), "a-level", "A Level must resolve to canonical a-level slug");
assert.equal(resolveExamRoute("tr", "ukcat"), "/tr/sinavlar/ucat", "Route for UKCAT must redirect to /tr/sinavlar/ucat");
assert.equal(resolveExamRoute("en", "ukcat"), "/en/exams/ucat", "Route for UKCAT must redirect to /en/exams/ucat");
console.log("✔ PASS: UKCAT and alias normalization verified.");

// TEST 5: Translation Completeness for all 18 exams in TR and EN
console.log("\n[TEST 5] TR and EN Content Integrity");
for (const code of expected18) {
  assert.ok(examTextTr[code], `Missing TR examText for ${code}`);
  assert.ok(examTextEn[code], `Missing EN examText for ${code}`);
  assert.ok(examDetailTextTr[code], `Missing TR examDetailText for ${code}`);
  assert.ok(examDetailTextEn[code], `Missing EN examDetailText for ${code}`);
  assert.ok(examDetailTextTr[code].overview.length >= 1, `TR overview missing for ${code}`);
  assert.ok(examDetailTextEn[code].overview.length >= 1, `EN overview missing for ${code}`);
  assert.ok(examDetailTextTr[code].faqs.length >= 1, `TR faqs missing for ${code}`);
  assert.ok(examDetailTextEn[code].faqs.length >= 1, `EN faqs missing for ${code}`);
}
console.log("✔ PASS: All 18 exams have full TR and EN text and detail entries.");

// TEST 6: Search Retrieval (Exact, Alias, Prefix, Typo/Fuzzy)
console.log("\n[TEST 6] Search Retrieval Engine Verification");
const testSearches = [
  { q: "IB", expectedType: "QUALIFICATION", matchSlug: "ib" },
  { q: "International Baccalaureate", expectedType: "QUALIFICATION", matchSlug: "ib" },
  { q: "A-Level", expectedType: "QUALIFICATION", matchSlug: "a-level" },
  { q: "A Level", expectedType: "QUALIFICATION", matchSlug: "a-level" },
  { q: "UKCAT", expectedType: "QUALIFICATION", matchSlug: "ucat" },
  { q: "UCAT", expectedType: "QUALIFICATION", matchSlug: "ucat" },
  { q: "LNAT", expectedType: "QUALIFICATION", matchSlug: "lnat" },
  { q: "GAMSAT", expectedType: "QUALIFICATION", matchSlug: "gamsat" },
  { q: "MCAT", expectedType: "QUALIFICATION", matchSlug: "mcat" },
  { q: "LSAT", expectedType: "QUALIFICATION", matchSlug: "lsat" },
  { q: "TARA", expectedType: "QUALIFICATION", matchSlug: "tara" },
  { q: "Cambridge", expectedType: "UNIVERSITY", matchSlug: "university-of-cambridge" },
  { q: "Cambdrige", expectedType: "UNIVERSITY", matchSlug: "university-of-cambridge" }, // typo
  { q: "Oxford", expectedType: "UNIVERSITY", matchSlug: "university-of-oxford" },
  { q: "Oxfrod", expectedType: "UNIVERSITY", matchSlug: "university-of-oxford" }, // typo
  { q: "Stanford", expectedType: "UNIVERSITY", matchSlug: "stanford-university" },
  { q: "Standford", expectedType: "UNIVERSITY", matchSlug: "stanford-university" }, // typo
  { q: "Harvard", expectedType: "UNIVERSITY", matchSlug: "harvard-university" },
  { q: "Harward", expectedType: "UNIVERSITY", matchSlug: "harvard-university" }, // typo
  { q: "MIT", expectedType: "UNIVERSITY", matchSlug: "massachusetts-institute-of-technology" },
  { q: "UCL", expectedType: "UNIVERSITY", matchSlug: "university-college-london" },
  { q: "LSE", expectedType: "UNIVERSITY", matchSlug: "london-school-of-economics" },
  { q: "Bocconi", expectedType: "UNIVERSITY", matchSlug: "bocconi-university" },
  { q: "Bokoni", expectedType: "UNIVERSITY", matchSlug: "bocconi-university" }, // typo
  { q: "ETH", expectedType: "UNIVERSITY", matchSlug: "eth-zurich" },
  { q: "U of T", expectedType: "UNIVERSITY", matchSlug: "university-of-toronto" },
  { q: "UBC", expectedType: "UNIVERSITY", matchSlug: "university-of-british-columbia" },
];

for (const test of testSearches) {
  const res = retrieveSearchResults(test.q);
  const items = test.expectedType === "QUALIFICATION" ? res.groups.qualifications : res.groups.universities;
  assert.ok(items.length > 0, `Search for "${test.q}" returned 0 ${test.expectedType} items`);
  const topMatch = items[0];
  assert.equal(topMatch.slug, test.matchSlug, `Search for "${test.q}" top match expected slug "${test.matchSlug}", got "${topMatch.slug}"`);
  console.log(`  ✓ Query "${test.q}" -> ${topMatch.type} "${topMatch.title}" (${topMatch.slug}) [score: ${topMatch.score}, layer: ${topMatch.matchLayer}]`);
}
console.log("✔ PASS: Search retrieval engine accurately matches all queries and typos.");

// TEST 7: Official URL Safety & Zero Guessed Domains
console.log("\n[TEST 7] Official URL Safety & Zero Guessed Domains");
assert.equal(getVerifiedOfficialUniversityUrl("Harvard University"), "https://www.harvard.edu");
assert.equal(getVerifiedOfficialUniversityUrl("University of Cambridge"), "https://www.cam.ac.uk");
assert.equal(getVerifiedOfficialUniversityUrl("University of Oxford"), "https://www.ox.ac.uk");
assert.equal(getVerifiedOfficialUniversityUrl("Massachusetts Institute of Technology (MIT)"), "https://www.mit.edu");
assert.equal(getVerifiedOfficialUniversityUrl("Bocconi University"), "https://www.unibocconi.it");
assert.equal(getVerifiedOfficialUniversityUrl("Nonexistent Fake University"), null);
assert.equal(getVerifiedOfficialUniversityUrl("Random College 123"), null);
console.log("✔ PASS: Official URL safety verified (strictly returns registry URLs, null for unverified).");

console.log("\n==========================================");
console.log("ALL PROMPT 02 SUITE VERIFICATIONS PASSED!");
console.log("==========================================");
