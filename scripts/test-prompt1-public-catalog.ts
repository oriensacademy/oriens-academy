import assert from "node:assert/strict";
import fs from "node:fs";

import { canonicalExamCodes } from "../src/content/canonical-exams";
import { examRecords } from "../src/content/exams";
import { examTests } from "../src/data/exam-tests";
import { FEATURED_COUNTRY_SEEDS } from "../src/data/study-destinations";
import { PUBLIC_NAV_ORDER } from "../src/lib/public-navigation";

const expected = ["IB", "AP", "IGCSE", "A-Level", "SAT", "ACT", "ESAT", "TMUA", "TARA", "UCAT", "IMAT", "MCAT", "GRE", "GMAT", "OMPT"];
const removed = ["LNAT", "LSAT", "GAMSAT"];
const read = (path: string) => fs.readFileSync(path, "utf8");

assert.deepEqual([...canonicalExamCodes], expected);
assert.deepEqual(examRecords.map((exam) => exam.code), expected);
assert.ok(removed.every((code) => !canonicalExamCodes.includes(code as never)));
const questions = canonicalExamCodes.flatMap((code) => examTests[code].questions);
assert.equal(questions.length, 90);
assert.ok(canonicalExamCodes.every((code) => examTests[code].questions.length === 6));

assert.ok(!FEATURED_COUNTRY_SEEDS.some((seed) => seed.iso3 === "EGY"));
assert.ok(PUBLIC_NAV_ORDER.indexOf("pricing") < PUBLIC_NAV_ORDER.indexOf("about"));

const examHub = read("src/components/exams/ExamHub.tsx");
assert.match(examHub, /lg:grid-cols-5/);
const route = read("src/app/[lang]/[examHub]/[slug]/page.tsx");
for (const slug of ["lnat", "lsat", "gamsat"]) assert.match(route, new RegExp(`"${slug}"`));

const publicQuery = read("src/lib/admin/content.ts");
assert.match(publicQuery, /\.eq\("featured", true\)/);
assert.match(publicQuery, /\.limit\(20\)/);
const migration = read("supabase/migrations/20260831120000_public_catalog_15_and_testimonial_selection.sql");
assert.match(migration, /PUBLIC_TESTIMONIAL_FEATURED_LIMIT_20/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /v_public_exams <> 15 or v_public_questions <> 90/);
for (const hash of [
  "8cd6bb5f583f4a142164110e54b02087cff9705b92b1f07ef991080333a86209",
  "726ef8b6076fe9caecada6b975d9c4ad0d2bb1b2c5179010460bd85c0c888308",
  "9bac00063b83476c05565cb6e2509014b21d1d489ef30167d6d7268aab242dae",
  "e5ec44467f8dfd2af1a1dae1683491373f4e1dee346a09d67e254c0e5c8fa01c",
  "8ad9a08be5c7df18da0d9f5932c454ea9ffe9e9f0d1c66802fd277c5df30c1ba",
]) assert.match(migration, new RegExp(hash));

const marquee = read("src/components/ui/marquee-01.tsx");
assert.match(marquee, /data-marquee-row/);
assert.match(marquee, /reverse/);
const css = read("src/app/globals.css");
assert.match(css, /focus-within/);
assert.match(css, /prefers-reduced-motion/);
assert.doesNotMatch(marquee, /randomuser|unsplash/i);

const about = read("src/components/about/AboutPage.tsx");
assert.doesNotMatch(about, /getPublicTestimonials|TestimonialsColumns/);
assert.match(read("src/content/tr/about.ts"), /Oriens Academy ile tanışın/);
assert.match(read("src/content/en/about.ts"), /Meet Oriens Academy/);
assert.doesNotMatch(read("src/components/ui/oriens-creative-pricing.tsx"), /data-pricing-total/);

const studentNav = read("src/lib/student/navigation.ts");
assert.match(studentNav, /id: "homework", labelIndex: 3, visible: false/);
assert.match(studentNav, /id: "exam_history", labelIndex: 6, visible: false/);
assert.match(read("src/components/auth/AccountMenu.tsx"), /LogoutConfirmationModal/);

console.log(JSON.stringify({ status: "PASS", exams: 15, publicQuestions: 90, featuredCap: 20, curatedEgypt: false }));
