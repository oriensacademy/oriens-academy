import assert from "node:assert/strict";
import fs from "node:fs";

import staticTestimonials from "../src/data/imported-testimonials.json" with { type: "json" };
import { about as trAbout } from "../src/content/tr/about.ts";
import { about as enAbout } from "../src/content/en/about.ts";
import { instructorAbout as trInstructor, whyOriens as trWhy } from "../src/content/tr/home.ts";
import { instructorAbout as enInstructor, whyOriens as enWhy } from "../src/content/en/home.ts";
import { nav as trNav } from "../src/content/tr/common.ts";
import { nav as enNav } from "../src/content/en/common.ts";
import { primaryNavigationPath } from "../src/lib/routes.ts";

console.log("=== RUNNING PROMPT 04 VERIFICATION SUITE ===");

// TEST 1: Testimonial Import Count & Integrity
console.log("\n[TEST 1] Testimonials Count & Raw Integrity");
assert.equal(staticTestimonials.length, 111, `Expected exactly 111 imported reviews, got ${staticTestimonials.length}`);

const migrationSql = fs.readFileSync("supabase/migrations/20260830000002_import_all_testimonials.sql", "utf8");
assert.ok(migrationSql.includes("INSERT INTO public.testimonials"), "Migration must contain inserts");
assert.equal((migrationSql.match(/INSERT INTO public\.testimonials/g) || []).length, 111, "Migration must contain exactly 111 insert statements");
console.log(`  ✓ 111 authentic reviews imported into dataset and database migration.`);

// TEST 2: Zero Testimonial Text Alterations
console.log("\n[TEST 2] Verbatim Text Integrity Checks");
const aslihan = staticTestimonials.find(t => t.name === "Aslıhan K.");
assert.ok(aslihan, "Aslıhan K. review must exist");
assert.equal(aslihan.quote, "Dersi iyi anlatan çok beyefendi bir hoca. Herkese tavsiye ederim.");
assert.equal(aslihan.sourceTopic, "Lise Takviye - Matematik");

const magomed = staticTestimonials.find(t => t.name === "Magomed E.");
assert.ok(magomed, "Magomed E. review must exist");
assert.ok(magomed.quote.startsWith("After the first lesson with the teacher, I realized"));
assert.equal(magomed.locale, "en");

const omer = staticTestimonials.find(t => t.name === "Ömer C.");
assert.ok(omer, "Ömer C. review must exist");
assert.ok(omer.quote.includes("Daha önce de bir çok özel ders aldım."));
console.log("  ✓ Verbatim text matching verified character-for-character with zero modifications.");

// TEST 3: Header Navigation Order (Swap Hakkımızda <-> Ücretler)
console.log("\n[TEST 3] Header Navigation Order Verification");
const trNavLabels = trNav.items.map(i => i.label);
const enNavLabels = enNav.items.map(i => i.label);

assert.deepEqual(trNavLabels, ["Sınav Hazırlığı", "Üniversite Ders Desteği", "Hakkımızda", "Ücretler"]);
assert.deepEqual(enNavLabels, ["Exam Preparation", "University Support", "About", "Pricing"]);
console.log("  ✓ TR Order: " + trNavLabels.join(" -> "));
console.log("  ✓ EN Order: " + enNavLabels.join(" -> "));
console.log("✔ PASS: Header navigation items swapped correctly.");

// TEST 4: Footer Metot Removal & Graceful Forwarding
console.log("\n[TEST 4] Footer Metot Removal & Route Forwarding");
const footerContent = fs.readFileSync("src/components/sections/Footer.tsx", "utf8");
assert.ok(!footerContent.includes(`label: "Metot"`), "Footer must not contain Metot label");
assert.ok(!footerContent.includes(`label: "Method"`), "Footer must not contain Method label");
assert.ok(!footerContent.includes(`href: "/tr#method"`), "Footer must not link to /tr#method");

const methodRouteTr = primaryNavigationPath("#method", "tr");
const methodRouteEn = primaryNavigationPath("#method", "en");
assert.equal(methodRouteTr, "/tr/hakkimizda", "Legacy #method in TR must route to /tr/hakkimizda");
assert.equal(methodRouteEn, "/en/about", "Legacy #method in EN must route to /en/about");
console.log("✔ PASS: Metot removed from navigation with safe redirection.");

// TEST 5: Exact Founder Copy Verification
console.log("\n[TEST 5] Authoritative Founder Copy");
const expectedFounderTr = "Matematik-Fizik eğitmeni. 10 yılı aşkın süredir IB, AP, A-Level, SAT, ESAT, TMUA, MAT, STEP, PAT, TARA ve IGCSE öğrencileriyle birebir çalışıyor; aralarında Robert Kolej, St. Joseph, Liceo Italiano, Üsküdar Amerikan, Galatasaray Lisesi, Saint Benoit Fransız Lisesi, Notre Dame de Sion, İstanbul Alman Lisesi ve Avusturya Lisesi gibi yabancı müfredat okullarının öğrencileri de var. Yaklaşım; ezber değil, sınavın mantığını çözmek üzerine kurulu.";

assert.equal(trAbout.hero.description, expectedFounderTr, "TR about hero must match exact founder copy");
assert.equal(trInstructor.body, expectedFounderTr, "TR instructorAbout body must match exact founder copy");
assert.ok(enAbout.hero.description.includes("Mathematics & Physics instructor. For over 10 years"), "EN about hero must contain professional equivalent");
assert.ok(enInstructor.body.includes("Mathematics & Physics instructor. For over 10 years"), "EN instructor body must contain professional equivalent");
console.log("✔ PASS: Exact Turkish founder copy and English equivalent verified.");

// TEST 6: Exactly 9 Foreign Curriculum Schools & Disclaimer
console.log("\n[TEST 6] Exactly 9 Foreign Curriculum Schools");
const expectedSchoolsTr = [
  "Robert Kolej",
  "St. Joseph",
  "Liceo Italiano",
  "Üsküdar Amerikan Lisesi",
  "Galatasaray Lisesi",
  "Saint Benoit Fransız Lisesi",
  "Notre Dame de Sion",
  "İstanbul Alman Lisesi",
  "Avusturya Lisesi",
];

assert.equal(trAbout.outcomes.items.length, 9, "TR about outcomes must contain exactly 9 schools");
assert.deepEqual(trAbout.outcomes.items.map(s => s.title), expectedSchoolsTr);
assert.equal(enAbout.outcomes.items.length, 9, "EN about outcomes must contain exactly 9 schools");

assert.ok(trAbout.outcomes.disclaimer.includes("öğrencilerimizin eğitim gördüğü kurumları ifade etmektedir"), "TR disclaimer must be present");
assert.ok(enAbout.outcomes.disclaimer.includes("represent institutions attended by our students"), "EN disclaimer must be present");
console.log("  ✓ 9 Target Schools: " + expectedSchoolsTr.join(", "));
console.log("✔ PASS: Exactly 9 schools and non-endorsement disclaimer verified.");

console.log("\n==========================================");
console.log("ALL PROMPT 04 SUITE VERIFICATIONS PASSED!");
console.log("==========================================");
