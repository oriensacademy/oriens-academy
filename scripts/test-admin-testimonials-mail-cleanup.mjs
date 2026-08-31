import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(path.resolve(file), "utf8");
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(target) : [target];
});

const columns = read("src/components/ui/testimonials-columns-1.tsx");
assert.match(columns, /useAnimationFrame/);
assert.match(columns, /data-paused=/);
assert.match(columns, /onPointerEnter/);
assert.match(columns, /onFocusCapture/);
assert.match(columns, /useReducedMotion/);
assert.match(columns, /md:hidden/);
assert.match(columns, /grid-cols-2/);
assert.match(columns, /grid-cols-3/);
assert.doesNotMatch(columns, /randomuser|unsplash/i);

const publicSection = read("src/components/sections/ResultsTestimonials.tsx");
assert.match(publicSection, /getPublicTestimonials\(locale\)/);
assert.doesNotMatch(publicSection, /resultsTestimonials\.testimonials/);

const manager = read("src/components/admin/TestimonialsManager.tsx");
assert.doesNotMatch(manager, /Orijinal Kaynak Yorum Bütünlüğü|111 ham/);

const sourceFiles = walk("src").filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));
const nativeConfirms = sourceFiles.flatMap((file) => {
  const matches = read(file).match(/(?:window\.)?confirm\s*\(/g) || [];
  return matches.map(() => file);
});
assert.deepEqual(nativeConfirms, []);
assert.match(read("src/app/admin/indirim-kuponlari/page.tsx"), /useConfirmationDialog/);

const settings = read("src/app/admin/ayarlar/page.tsx");
assert.match(settings, /Denetim Loglarını Görüntüle/);
assert.match(settings, /\/admin\/denetim/);
const audit = read("src/app/admin/denetim/page.tsx");
assert.match(audit, /dateFrom/);
assert.match(audit, /actionFilter/);

const productMailFiles = [...walk("src"), ...walk("supabase/functions")].filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));
const productMailSource = productMailFiles.map(read).join("\n");
assert.doesNotMatch(productMailSource, /(?:support|contact|notifications)@oriens-academy\.com/i);
for (const email of ["admin@oriens-academy.com", "info@oriens-academy.com", "payments@oriens-academy.com", "zoom@oriens-academy.com"]) {
  assert.ok(productMailSource.includes(email), `${email} missing`);
}
const service = read("supabase/functions/_shared/email/service.ts");
assert.match(service, /EMAIL_ARCHIVE_BCC = ADMIN_EMAIL/);
assert.match(service, /case "zoom"/);

console.log(JSON.stringify({
  testimonialColumns: "PASS",
  sharedPause: "PASS",
  reducedMotion: "PASS",
  nativeConfirmCount: nativeConfirms.length,
  auditViewer: "PASS",
  canonicalMailboxCount: 4,
  legacyPublicMailboxCount: 0,
  operationalCopy: "admin@oriens-academy.com",
}));
