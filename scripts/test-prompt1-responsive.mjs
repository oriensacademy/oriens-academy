import { chromium } from "playwright";

const base = process.env.QA_BASE_URL || "http://localhost:62173";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const results = [];

for (const width of [375, 768, 1024, 1440, 1920]) {
  await page.setViewportSize({ width, height: width < 800 ? 900 : 1000 });
  for (const path of ["/tr", "/en", "/tr/sinavlar", "/en/exams", "/tr/hakkimizda", "/en/about"]) {
    const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    if (!response?.ok()) throw new Error(`${path} returned ${response?.status()}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflow) throw new Error(`${path} overflows horizontally at ${width}px`);
  }
  results.push({ width, overflow: false });
}

await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${base}/tr/sinavlar`, { waitUntil: "networkidle" });
const indexCells = page.locator('nav[aria-label] ol > li');
if (await indexCells.count() !== 15) throw new Error(`Expected 15 exam index cells, found ${await indexCells.count()}`);
const topPositions = await indexCells.evaluateAll((cells) => [...new Set(cells.map((cell) => Math.round(cell.getBoundingClientRect().top)))]);
if (topPositions.length !== 3) throw new Error(`Expected three exam rows at 1440px, found ${topPositions.length}`);

await page.goto(`${base}/tr`, { waitUntil: "networkidle" });
const marquee = page.locator('[data-testid="testimonial-marquee"]');
if (await marquee.count()) {
  if (await marquee.locator('[data-marquee-row]').count() !== 2) throw new Error("Testimonial marquee must have two rows");
}

await page.goto(`${base}/tr/hakkimizda`, { waitUntil: "networkidle" });
if (await page.locator('[data-testid="testimonial-marquee"], [data-testid="testimonials-columns"]').count()) throw new Error("Testimonials must not render on About");

for (const legacy of ["lnat", "lsat", "gamsat"]) {
  const response = await page.goto(`${base}/tr/sinavlar/${legacy}`, { waitUntil: "domcontentloaded" });
  if (!response || response.status() >= 400) throw new Error(`Legacy route ${legacy} returned ${response?.status()}`);
}

await browser.close();
console.log(JSON.stringify({ status: "PASS", results, examGrid: "3x5", aboutTestimonials: false }));
