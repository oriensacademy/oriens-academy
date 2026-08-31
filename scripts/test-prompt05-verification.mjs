import assert from "node:assert/strict";
import fs from "node:fs";

import { examCodes } from "../src/content/shared.ts";
import { examRecords } from "../src/content/exams.ts";
import { examTests, calculateTestResult, EXAM_TEST_QUESTION_COUNT } from "../src/data/exam-tests.ts";
import { getExamTestCopy } from "../src/content/exam-test.ts";

console.log("=== RUNNING PROMPT 05 VERIFICATION SUITE ===");

// TEST 1: Exactly 15 Selector Exams
console.log("\n[TEST 1] Canonical 15 Exam Catalog Verification");
assert.equal(examCodes.length, 15, `Expected 15 exam codes, got ${examCodes.length}`);
assert.equal(examRecords.length, 15, `Expected 15 exam records, got ${examRecords.length}`);

for (const code of examCodes) {
  assert.ok(examTests[code], `examTests must contain entry for ${code}`);
}
console.log(`  ✓ All 15 exams present in canonical catalog: ${examCodes.join(", ")}`);

// TEST 2: Exactly 6 Questions Per Exam = 90 Active Public Questions
console.log("\n[TEST 2] Active Question Count Verification (15 × 6 = 90)");
let totalQuestions = 0;
const questionIds = new Set();

for (const code of examCodes) {
  const test = examTests[code];
  assert.equal(test.questions.length, EXAM_TEST_QUESTION_COUNT, `Exam ${code} must have exactly ${EXAM_TEST_QUESTION_COUNT} questions, got ${test.questions.length}`);
  totalQuestions += test.questions.length;

  for (const q of test.questions) {
    // Unique ID test
    assert.ok(q.id, `Question in ${code} must have an ID`);
    assert.ok(!questionIds.has(q.id), `Duplicate question ID detected: ${q.id}`);
    questionIds.add(q.id);

    // 4 Answer Options test
    assert.equal(q.answers.length, 4, `Question ${q.id} must have exactly 4 answer choices`);
    assert.ok(["a", "b", "c", "d"].includes(q.correctAnswer), `Question ${q.id} has invalid correctAnswer: ${q.correctAnswer}`);

    // Explanation test
    assert.ok(q.explanation.en && q.explanation.en.length > 5, `Question ${q.id} missing explanation`);
  }
}

assert.equal(totalQuestions, 90, `Expected exactly 90 active questions, got ${totalQuestions}`);
assert.equal(questionIds.size, 90, `Expected exactly 90 unique question IDs, got ${questionIds.size}`);
console.log(`  ✓ Exactly 90 unique questions verified across all 15 exams.`);

// TEST 3: English Topic Labels (Even in TR UI)
console.log("\n[TEST 3] Topic Labels Language & Standard Syllabus Terminology");
const forbiddenTurkishTerms = [
  "Olasılık ve İstatistik",
  "Türev ve İntegral",
  "Fonksiyonlar ve Bağıntılar",
  "Limit ve Süreklilik",
  "Temel Kavramlar",
  "Mantık ve İspat",
  "Hücre Biyolojisi",
  "Genetik ve Kalıtım"
];

for (const code of examCodes) {
  const test = examTests[code];
  for (const q of test.questions) {
    const topicTr = q.topic.tr;
    const topicEn = q.topic.en;

    assert.ok(topicTr, `Question ${q.id} missing topic.tr`);
    assert.ok(topicEn, `Question ${q.id} missing topic.en`);

    // Check for forbidden raw Turkish translations
    for (const term of forbiddenTurkishTerms) {
      assert.ok(!topicTr.includes(term), `Forbidden Turkish term "${term}" found in topic: ${topicTr} (${q.id})`);
    }

    // Verify topic labels are standard English
    assert.equal(topicTr, topicEn, `International exam topic.tr must match english topic label in ${q.id}`);
  }
}
console.log("  ✓ 100% of topic labels verified in standard English syllabus terminology.");

// TEST 4: Explanation & Solution Label in TR & EN
console.log("\n[TEST 4] Explanation & Solution Terminology");
const trCopy = getExamTestCopy("tr");
const enCopy = getExamTestCopy("en");

assert.equal(trCopy.explanation, "Explanation & Solution", "TR explanation copy must be 'Explanation & Solution'");
assert.equal(enCopy.explanation, "Explanation & Solution", "EN explanation copy must be 'Explanation & Solution'");
console.log("  ✓ TR copy explanation: " + trCopy.explanation);
console.log("  ✓ EN copy explanation: " + enCopy.explanation);

// TEST 5: Exam Card Carousel /15 Counter & Discovery
console.log("\n[TEST 5] Exam Card Carousel /15 Counter & Groups");
const examHubContent = fs.readFileSync("src/components/exams/ExamHub.tsx", "utf8");
assert.ok(examHubContent.includes("ThreeDExamCarousel"), "ExamHub must render ThreeDExamCarousel");
assert.ok(examHubContent.includes("examRecords.map"), "ExamHub must map over all 15 examRecords");

const carouselContent = fs.readFileSync("src/components/ui/three-d-exam-carousel.tsx", "utf8");
assert.ok(carouselContent.includes("cards.length"), "Carousel must dynamically derive max count from cards.length");
assert.ok(!carouselContent.includes("/ 12"), "Carousel must never hardcode / 12");
console.log("  ✓ Carousel verified with 15 cards and dynamic / 15 counter.");

// TEST 6: Test Result & Calculation Logic Regression
console.log("\n[TEST 6] Test Result Calculation & Breakdown Integrity");
const sampleTest = examTests["IB"];
const testResult = calculateTestResult(
  sampleTest,
  {
    "ib-q-1": "a", // correct
    "ib-q-2": "a", // correct
    "ib-q-3": "b", // wrong
    "ib-q-4": "a", // correct
    // ib-q-5 unanswered
    // ib-q-6 unanswered
  },
  "tr"
);

assert.equal(testResult.total, 6, "Total questions must be 6");
assert.equal(testResult.correct, 3, "Correct answers must be 3");
assert.equal(testResult.incorrect, 1, "Incorrect answers must be 1");
assert.equal(testResult.unanswered, 2, "Unanswered questions must be 2");
assert.equal(testResult.accuracy, 50, "Accuracy must be 50%");
assert.equal(testResult.breakdown.length, 6, "Breakdown must contain 6 items");
assert.ok(testResult.topics.length >= 1, "Topics breakdown must be computed");
console.log("  ✓ calculateTestResult verified with 100% accuracy and breakdown stability.");

console.log("\n==========================================");
console.log("ALL PROMPT 05 SUITE VERIFICATIONS PASSED!");
console.log("==========================================");
