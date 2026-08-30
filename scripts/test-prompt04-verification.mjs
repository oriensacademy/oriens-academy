import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseTestimonialSource } from "./lib/testimonial-source.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = parseTestimonialSource(path.join(root, "yorumlar.txt"));
const publicData = fs.readFileSync(path.join(root, "src/lib/admin/content.ts"), "utf8");
const adminUi = fs.readFileSync(path.join(root, "src/components/admin/TestimonialsManager.tsx"), "utf8");
const protectionSql = fs.readFileSync(path.join(root, "supabase/migrations/20260830011300_testimonial_editorial_controls.sql"), "utf8");
const navbar = fs.readFileSync(path.join(root, "src/components/sections/Navbar.tsx"), "utf8");
const footer = fs.readFileSync(path.join(root, "src/components/sections/Footer.tsx"), "utf8");

assert.equal(source.rawBlocks.length, 111);
assert.equal(source.validRecords.length, 111);
assert.equal(source.uniqueRecords.length, 110);
assert.equal(source.duplicateBlocks, 1);
const duplicate = source.validRecords.filter((record) => record.author === "İsmail İ." && record.dateText === "28 Mayıs 2021" && record.topic === "Sınav Hazırlık - YKS");
assert.equal(duplicate.length, 2, "The one known duplicate identity must be preserved once canonically");

assert.match(publicData, /from\("testimonials"\)/);
assert.match(publicData, /is\("archived_at", null\)/);
assert.doesNotMatch(publicData, /imported-testimonials\.json/);
assert.doesNotMatch(publicData, /\.delete\s*\(/);
assert.match(publicData, /archiveAdminTestimonial/);
assert.match(protectionSql, /before delete on public\.testimonials/);
assert.match(protectionSql, /must be archived, not deleted/);
assert.match(adminUi, /featured/i);
assert.match(adminUi, /pin_order/);
assert.match(adminUi, /display_order/);
assert.match(adminUi, /preview/i);

const aboutTr = navbar.indexOf('"Hakkımızda"');
const pricingTr = navbar.indexOf('"Ücretler"');
const aboutEn = navbar.indexOf('"About"');
const pricingEn = navbar.indexOf('"Pricing"');
assert.ok(aboutTr >= 0 && pricingTr > aboutTr);
assert.ok(aboutEn >= 0 && pricingEn > aboutEn);
assert.doesNotMatch(footer, /label:\s*["'](?:Metot|Method)["']/);
assert.doesNotMatch(footer, /#method/);

console.log(JSON.stringify({ status: "PASS", testimonials: { raw: 111, valid: 111, unique: 110, duplicate: 1 }, databaseOnly: true, immutableAndArchiveOnly: true }, null, 2));
