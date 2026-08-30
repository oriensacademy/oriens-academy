import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { canonicalExamCodes, canonicalExams } from "../src/content/canonical-exams";
import { examTests, EXAM_TEST_QUESTION_COUNT, calculateTestResult } from "../src/data/exam-tests";
import { retrieveCanonicalExamFallback } from "../src/lib/search/canonical-exam-fallback";
import { resolveExamRoute, resolveExamSlug } from "../src/lib/routes";
import { FEATURED_COUNTRY_SEEDS, resolveStudyDestination } from "../src/data/study-destinations";
import { pricingPackages } from "../src/content/pricing";
import { pricing as trPricing } from "../src/content/tr/pricing";
import { pricing as enPricing } from "../src/content/en/pricing";
import { about as trAbout } from "../src/content/tr/about";
import { about as enAbout } from "../src/content/en/about";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
function sourceTree(directory: string): string {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceTree(relative);
    return /\.(?:ts|tsx|js|mjs|json)$/.test(entry.name) ? [read(relative)] : [];
  }).join("\n");
}

const expectedGroup1 = ["IB", "AP", "IGCSE", "A-Level", "SAT", "ACT"];
const expectedGroup2 = ["ESAT", "TMUA", "TARA", "UCAT", "LNAT", "IMAT", "GAMSAT", "MCAT", "LSAT", "GRE", "GMAT", "OMPT"];
assert.equal(canonicalExams.length, 18);
assert.deepEqual(canonicalExams.filter((exam) => exam.customerGroup === 1).map((exam) => exam.code), expectedGroup1);
assert.deepEqual(canonicalExams.filter((exam) => exam.customerGroup === 2).map((exam) => exam.code), expectedGroup2);
assert.equal(new Set(canonicalExams.map((exam) => exam.slug)).size, 18);
assert.ok(!canonicalExamCodes.includes("UKCAT" as never));
assert.equal(resolveExamSlug("UKCAT"), "ucat");
assert.equal(resolveExamRoute("tr", "UKCAT"), "/tr/sinavlar/ucat");
assert.equal(resolveExamRoute("en", "UKCAT"), "/en/exams/ucat");

const allQuestions = canonicalExamCodes.flatMap((code) => examTests[code].questions);
assert.equal(allQuestions.length, 108);
for (const code of canonicalExamCodes) assert.equal(examTests[code].questions.length, EXAM_TEST_QUESTION_COUNT);
assert.ok(allQuestions.every((question) => question.questionLanguage === "en" && question.topic.tr === question.topic.en));
assert.doesNotMatch(JSON.stringify(examTests.TARA), /architecture|mimarlık|spatial reasoning/i);
assert.doesNotMatch(JSON.stringify(examTests.UCAT), /abstract reasoning/i);
assert.equal(calculateTestResult(examTests.UCAT, {}, "en").total, 6);

for (const [query, expected] of [["IB", "IB"], ["International Baccalaureate", "IB"], ["A Level", "A-Level"], ["UKCAT", "UCAT"]] as const) {
  const result = retrieveCanonicalExamFallback(query);
  assert.equal(result.groups.qualifications[0]?.badge, expected, `${query} must resolve to ${expected}`);
  assert.equal(result.groups.universities.length, 0, "The client fallback must never bundle a university dataset");
}

assert.ok(FEATURED_COUNTRY_SEEDS.every((seed) => /^[A-Z]{3}$/.test(seed.iso3)));
assert.ok(!FEATURED_COUNTRY_SEEDS.some((seed) => /europe/i.test(`${seed.id} ${seed.labelEn}`)));
const japan = resolveStudyDestination("JPN", "Japonya", "Japan", { lat: 36.2, lng: 138.2 });
assert.equal(japan.countryCode, "JPN");
assert.equal(japan.countries[0].iso3, "JPN");
assert.deepEqual(japan.focus, { lat: 36.2, lng: 138.2, altitude: 1.2 });
assert.equal(japan.hasDirectExams, false);
assert.equal(japan.noMatchMessageTr, "Bu destinasyon için Oriens’in desteklediği uluslararası sınavlar içinde doğrudan ülke-geneli bir eşleşme bulunamadı. Üniversite ve program koşulları kuruma ve başvuru dönemine göre değişebilir.");
assert.equal(japan.noMatchMessageEn, "No direct country-wide match was found among the international exams currently supported by Oriens for this destination. University and programme requirements may vary by institution and admission cycle.");

assert.deepEqual(pricingPackages.map((item) => item.priceAmount), [3200, 15000, 27000, 51000, 72000]);
assert.equal(trPricing.packages.items.package5.description, "Düzenli çalışmaya başlamak ve kısa vadeli konu hedeflerini takip etmek için esnek paket.");
assert.equal(trPricing.packages.items.package10.description, "Sınav hazırlığını, konu takibini ve düzenli ilerleme değerlendirmesini birlikte yürüten dengeli paket.");
assert.equal(enPricing.packages.items.package5.description, "A flexible package for starting structured study and tracking short-term topic goals.");
assert.equal(enPricing.packages.items.package10.description, "A balanced package combining exam preparation, topic tracking and regular progress review.");

const exactFounderTr = "Matematik-Fizik eğitmeni. 10 yılı aşkın süredir IB, AP, A-Level, SAT, ESAT, TMUA, MAT, STEP, PAT, TARA ve IGCSE öğrencileriyle birebir çalışıyor; aralarında Robert Kolej, St. Joseph, Liceo Italiano, Üsküdar Amerikan, Galatasaray Lisesi, Saint Benoit Fransız Lisesi, Notre Dame de Sion, İstanbul Alman Lisesi ve Avusturya Lisesi gibi yabancı müfredat okullarının öğrencileri de var. Yaklaşım; ezber değil, sınavın mantığını çözmek üzerine kurulu.";
assert.equal(trAbout.hero.description, exactFounderTr);
assert.equal(trAbout.outcomes.items.length, 9);
assert.equal(enAbout.outcomes.items.length, 9);
assert.match(trAbout.outcomes.disclaimer, /resmi iş birliği veya kurum onayı anlamına gelmez/);
assert.equal(enAbout.outcomes.disclaimer, "School names identify institutions attended by our students and do not imply an official partnership or endorsement.");

const productionSource = sourceTree("src");
assert.doesNotMatch(productionSource, /(?:12 sınav|12 exams|14 sınav|14 exams)/i);
assert.doesNotMatch(productionSource, /(?:Doğrulanmış Örnekler|Doğrulanmış örnekler|Verified Examples)/);
assert.doesNotMatch(productionSource, /Açıklama\s*&\s*Soru Çözümü/);
assert.doesNotMatch(productionSource, /this country has no international exam system/i);

const navbar = read("src/components/sections/Navbar.tsx");
for (const labels of [["Ana Sayfa", "Sınavlar", "Üniversite Desteği", "Hakkımızda", "Ücretler"], ["Home", "Exams", "University Support", "About", "Pricing"]]) {
  const positions = labels.map((label) => navbar.indexOf(`"${label}"`));
  assert.ok(positions.every((position) => position >= 0));
  assert.ok(positions.every((position, index) => index === 0 || position > positions[index - 1]));
}
const footer = read("src/components/sections/Footer.tsx");
assert.doesNotMatch(footer, /label:\s*["'](?:Metot|Method)["']/);
assert.doesNotMatch(footer, /#method/);
const pricingPage = read("src/components/pricing/PricingPage.tsx");
assert.match(pricingPage, /Şeffaf Fiyatlandırma/);
assert.match(pricingPage, /Her öğrenci için aynı standart ücretler/);
assert.match(pricingPage, /Transparent Pricing/);
assert.match(pricingPage, /The same standard rates for every student/);
assert.match(read("src/components/pricing/PricingComparison.tsx"), /Birim Ders Ücreti/);
assert.match(read("src/components/pricing/PricingComparison.tsx"), /Unit Lesson Price/);

const searchUi = read("src/components/ui/gooey-search.tsx");
assert.doesNotMatch(searchUi, /retrieval-engine/);
assert.match(searchUi, /aria-autocomplete="list"/);
assert.match(searchUi, /Sınavlar/);
assert.match(searchUi, /Üniversiteler/);
assert.match(searchUi, /Aranıyor/);
const mapUi = read("src/components/discovery/StudyDestinationSection.tsx");
for (const state of ["idle", "loading", "success-with-data", "success-empty", "error"]) assert.match(mapUi, new RegExp(state));
assert.match(mapUi, /university\.countryCode === (?:countryCode|iso3)/);
assert.match(mapUi, /slice\(0, 3\)/);
assert.match(mapUi, /Öne Çıkan Üniversiteler/);
assert.match(mapUi, /Featured Universities/);
const featuredService = read("src/lib/universities/featured-service.ts");
assert.match(featuredService, /verified/);
assert.match(featuredService, /programme_name|faculty_name/);

const testimonials = read("src/lib/admin/content.ts");
assert.doesNotMatch(testimonials, /imported-testimonials\.json/);
assert.doesNotMatch(testimonials, /\.delete\s*\(/);
assert.match(testimonials, /archiveAdminTestimonial/);
assert.match(read("supabase/migrations/20260830011300_testimonial_editorial_controls.sql"), /before delete on public\.testimonials/);
assert.match(read("src/app/layout.tsx"), /RELEASE_VERSION/);

console.log(JSON.stringify({ status: "PASS", canonicalExams: 18, questions: 108, mapStates: 5, prices: "unchanged", acceptanceChecks: "behavior + contracts + production wiring" }, null, 2));
