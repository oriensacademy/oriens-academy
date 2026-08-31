import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { canonicalExams } from "../src/content/canonical-exams";

const expected = ["IB","AP","IGCSE","A-Level","SAT","ACT","ESAT","TMUA","TARA","UCAT","IMAT","MCAT","GRE","GMAT","OMPT"];
assert.deepEqual(canonicalExams.map((exam) => exam.code), expected, "canonical code/order mismatch");
assert.equal(new Set(canonicalExams.map((exam) => exam.slug)).size, 15, "slugs must be unique");
assert.equal(canonicalExams.filter((exam) => exam.customerGroup === 1).length, 6);
assert.equal(canonicalExams.filter((exam) => exam.customerGroup === 2).length, 9);
assert.ok(canonicalExams.every((exam, index) => exam.active && exam.supportedPublic && exam.displayOrder === index + 1));
assert.ok(canonicalExams.every((exam) => exam.officialUrl.startsWith("https://") && exam.officialBody));

const byCode = new Map(canonicalExams.map((exam) => [exam.code, exam]));
assert.equal(byCode.get("TARA")?.canonicalName, "Test of Academic Reasoning for Admissions");
assert.equal(byCode.get("TARA")?.officialBody, "UAT-UK; delivered by Pearson VUE");
assert.equal(byCode.get("UCAT")?.canonicalName, "University Clinical Aptitude Test");
assert.equal(byCode.get("SAT")?.canonicalName, "SAT");
assert.equal(byCode.get("ACT")?.canonicalName, "ACT");
assert.equal(byCode.get("GMAT")?.canonicalName, "GMAT Exam");
assert.equal(byCode.get("OMPT")?.canonicalName, "Online Mathematics Placement Test");
assert.ok(byCode.get("UCAT")?.aliases.some((alias) => alias.alias === "UKCAT" && alias.type === "legacy"));
assert.ok(canonicalExams.filter((exam) => exam.code !== "UCAT").every((exam) => exam.displayNameEn !== "UKCAT"));

const questions = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/data/exam-tests-source.json"), "utf8")) as Record<string, Array<{topic:string;cat:string;q:string;answers:string[];correct:string;exp:string}>>;
assert.deepEqual(Object.keys(questions), expected.map((code) => code.toLowerCase()));
const all = Object.entries(questions).flatMap(([exam, items]) => items.map((item, index) => ({ exam, index, ...item })));
assert.equal(all.length, 90, "public practice bank must contain 90 questions");
for (const [exam, items] of Object.entries(questions)) {
  assert.equal(items.length, 6, `${exam} must contain six questions`);
  for (const [index, item] of items.entries()) {
    assert.ok(item.topic.trim() && item.q.trim() && item.exp.trim(), `${exam} question ${index + 1} has blank content`);
    assert.equal(item.answers.length, 4, `${exam} question ${index + 1} must have four options`);
    assert.ok(["a","b","c","d"].includes(item.correct), `${exam} question ${index + 1} has invalid answer`);
    assert.ok(item.answers.every((answer) => answer.trim()), `${exam} question ${index + 1} has blank option`);
    assert.doesNotMatch(item.topic, /[çğıöşüÇĞİÖŞÜ]/, `${exam} topic must remain English`);
  }
}
assert.equal(new Set(all.map((item) => item.q.trim().toLowerCase())).size, 90, "question text must be unique");
assert.equal(new Set(all.map((item) => `${item.exam}-q-${item.index + 1}`)).size, 90, "question IDs must be unique");
const taraText = JSON.stringify(questions.tara).toLowerCase();
assert.doesNotMatch(taraText, /test-arched|architecture|architectural|spatial projection|parthenon/);
for (const section of ["critical thinking", "problem solving", "writing task"]) assert.ok(taraText.includes(section));
const ucatText = JSON.stringify(questions.ucat).toLowerCase();
assert.doesNotMatch(ucatText, /abstract reasoning/);
for (const section of ["verbal reasoning", "decision making", "quantitative reasoning", "situational judgement"]) assert.ok(ucatText.includes(section));

const unsafeFixtures = [
  "src/lib/student/preferences.ts", "src/components/assessment/AssessmentForm.tsx",
  "src/data/study-destinations.ts", "src/lib/search/retrieval-engine.ts",
  "src/lib/search/entity-matcher.ts", "src/components/exams/ExamDetailVisual.tsx",
].map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n").toLowerCase();
assert.doesNotMatch(unsafeFixtures, /test-arched|test di ammissione ad architettura|tara \(architecture/);

console.log(JSON.stringify({ exams: canonicalExams.length, group1: 6, group2: 9, questions: all.length, perExam: 6, tara: "PASS", ucat: "PASS", englishTopics: "PASS" }));
