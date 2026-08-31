import assert from "node:assert/strict";
import fs from "node:fs";

import { pricing as trPricing } from "../src/content/tr/pricing.ts";
import { pricing as enPricing } from "../src/content/en/pricing.ts";
import { hero as trHero, faq as trFaq } from "../src/content/tr/home.ts";
import { hero as enHero, faq as enFaq } from "../src/content/en/home.ts";
import { CANONICAL_DEFAULT_PACKAGES } from "../src/lib/admin/pricing.ts";

console.log("=== RUNNING PROMPT 06 VERIFICATION SUITE ===");

// TEST 1: Pricing Values & Discounts Unchanged
console.log("\n[TEST 1] Canonical Pricing Values Integrity");
const expectedPackages = [
  { id: "single", lessons: 1, total: 3200, unit: 3200, discount: null },
  { id: "package5", lessons: 5, total: 15000, unit: 3000, discount: 7 },
  { id: "package10", lessons: 10, total: 27000, unit: 2700, discount: 15 },
  { id: "package20", lessons: 20, total: 51000, unit: 2550, discount: 20 },
  { id: "package30", lessons: 30, total: 72000, unit: 2400, discount: 25 },
];

for (const exp of expectedPackages) {
  const pkg = CANONICAL_DEFAULT_PACKAGES.find(p => p.id === exp.id);
  assert.ok(pkg, `Package ${exp.id} must exist in CANONICAL_DEFAULT_PACKAGES`);
  assert.equal(pkg.current_total, exp.total, `Package ${exp.id} total price must be ${exp.total}`);
  assert.equal(pkg.unit_price, exp.unit, `Package ${exp.id} unit price must be ${exp.unit}`);
  assert.equal(pkg.discount_percentage, exp.discount, `Package ${exp.id} discount must be ${exp.discount}`);
  console.log(`  ✓ ${pkg.id}: ${pkg.lesson_count} lesson(s) = ${pkg.current_total} TL (unit: ${pkg.unit_price} TL, discount: ${pkg.discount_percentage ?? 0}%)`);
}

// TEST 2: "Birim Ders Ücreti" in TR & "Unit Lesson Price" in EN
console.log("\n[TEST 2] 'Birim Ders Ücreti' Label Standardization");
const creativePricingContent = fs.readFileSync("src/components/ui/oriens-creative-pricing.tsx", "utf8");

assert.ok(creativePricingContent.includes(`locale === "tr" ? "Birim Ders Ücreti: " : "Unit Lesson Price: "`), "Pricing card must render 'Birim Ders Ücreti: ' in TR and 'Unit Lesson Price: ' in EN");
assert.ok(!creativePricingContent.includes(`"Ders başı: "`), "Legacy 'Ders başı: ' label must not exist in pricing cards");
console.log("  ✓ TR: 'Birim Ders Ücreti: ' verified");
console.log("  ✓ EN: 'Unit Lesson Price: ' verified");

// TEST 3: Distinct 5-Lesson and 10-Lesson Descriptions
console.log("\n[TEST 3] Distinct 5-Lesson & 10-Lesson Supporting Copy");
const tr5 = trPricing.packages.items.package5.description;
const tr10 = trPricing.packages.items.package10.description;
const en5 = enPricing.packages.items.package5.description;
const en10 = enPricing.packages.items.package10.description;

assert.notEqual(tr5, tr10, "TR 5-lesson and 10-lesson copy must not be identical");
assert.notEqual(en5, en10, "EN 5-lesson and 10-lesson copy must not be identical");

assert.equal(tr5, "Düzenli çalışmaya başlamak ve kısa vadeli konu hedeflerini takip etmek için esnek paket.");
assert.equal(tr10, "Sınav hazırlığını, konu takibini ve düzenli ilerleme değerlendirmesini birlikte yürüten dengeli paket.");
assert.equal(en5, "A flexible package for starting structured study and tracking short-term topic goals.");
assert.equal(en10, "A balanced package combining exam preparation, topic tracking and regular progress review.");

console.log(`  ✓ TR 5-Lesson:  "${tr5}"`);
console.log(`  ✓ TR 10-Lesson: "${tr10}"`);
console.log(`  ✓ EN 5-Lesson:  "${en5}"`);
console.log(`  ✓ EN 10-Lesson: "${en10}"`);

// TEST 4: Subtle Premium Pricing Trust Marker
console.log("\n[TEST 4] Subtle Premium Trust Marker Verification");
assert.ok(creativePricingContent.includes(`Şeffaf Fiyatlandırma`), "Trust marker must include 'Şeffaf Fiyatlandırma' for TR");
assert.ok(creativePricingContent.includes(`Her öğrenci için aynı standart ücretler.`), "Trust marker must include 'Her öğrenci için aynı standart ücretler.' for TR");
assert.ok(creativePricingContent.includes(`Transparent Pricing`), "Trust marker must include 'Transparent Pricing' for EN");
assert.ok(creativePricingContent.includes(`The same standard rates for every student.`), "Trust marker must include the current EN transparency copy");
assert.ok(creativePricingContent.includes(`ShieldCheck`), "Trust marker must render ShieldCheck icon");
console.log("  ✓ Subtle trust marker present with shield icon and clean pill styling.");

// TEST 5: Single Lesson "İndirimsiz" / "Standard Price" (No 0% discount)
console.log("\n[TEST 5] Single Lesson Discount Presentation Integrity");
assert.ok(creativePricingContent.includes(`{locale === "tr" ? "İndirimsiz" : "Standard Price"}`), "Zero-discount package must display 'İndirimsiz' / 'Standard Price'");
assert.equal(CANONICAL_DEFAULT_PACKAGES.find(p => p.id === "single")?.discount_percentage, null, "Single lesson must have discount null");
console.log("  ✓ Single lesson renders 'İndirimsiz' / 'Standard Price' without artificial 0% badge.");

// TEST 6: Global 15-Exam Count Consistency
console.log("\n[TEST 6] Global 15-Exam Copy Consistency");
assert.ok(trHero.body.includes("IB, AP, IGCSE, A-Level, SAT, ACT, ESAT, TMUA, TARA, UCAT, IMAT, MCAT, GRE, GMAT ve OMPT"), "TR homepage hero must list all 15 exams");
assert.ok(enHero.body.includes("IB, AP, IGCSE, A-Level, SAT, ACT, ESAT, TMUA, TARA, UCAT, IMAT, MCAT, GRE, GMAT, and OMPT"), "EN homepage hero must list all 15 exams");

assert.ok(trFaq.items[0].a.includes("IB, AP, IGCSE, A-Level, SAT, ACT, ESAT, TMUA, TARA, UCAT, IMAT, MCAT, GRE, GMAT ve OMPT"), "TR FAQ 1 must list all 15 exams");
assert.ok(enFaq.items[0].a.includes("IB, AP, IGCSE, A-Level, SAT, ACT, ESAT, TMUA, TARA, UCAT, IMAT, MCAT, GRE, GMAT, and OMPT"), "EN FAQ 1 must list all 15 exams");
console.log("  ✓ All 15 exams listed consistently across marketing copy and FAQs.");

console.log("\n==========================================");
console.log("ALL PROMPT 06 SUITE VERIFICATIONS PASSED!");
console.log("==========================================");
