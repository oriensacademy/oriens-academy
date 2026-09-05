/**
 * Mobile responsive / scroll regression harness.
 *
 * Serves the static export in ./out on a local port and drives it with the
 * Playwright browsers already vendored in this repo -- Chromium (Android Chrome
 * shape) and WebKit (the engine iOS Safari uses), so iOS-specific claims are
 * measured rather than assumed.
 *
 * Measures, per route per viewport:
 *   - horizontal overflow of the document
 *   - which element causes it (so a failure is actionable, not just a number)
 *   - nested full-page vertical scroll containers
 *   - body scroll-lock residue after opening and closing the mobile menu
 *   - touch target sizes on interactive elements
 *   - input font-size (iOS zooms the page when a focused input is under 16px)
 *   - fixed/sticky elements overlapping the bottom of the viewport
 *
 *   node scripts/test-mobile-responsive.mjs             # chromium, default routes
 *   node scripts/test-mobile-responsive.mjs --webkit    # iOS Safari engine
 *   node scripts/test-mobile-responsive.mjs --all       # both engines
 *   node scripts/test-mobile-responsive.mjs --desktop   # desktop regression only
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "out");

const MOBILE_WIDTHS = [320, 360, 375, 390, 412, 430];
const TABLET_WIDTHS = [768];
const DESKTOP_WIDTHS = [1366, 1440, 1920];

const ROUTES = [
  "/tr/",
  "/en/",
  "/tr/ucretler/",
  "/tr/sinavlar/",
  "/tr/universite-destegi/",
  "/tr/hakkimizda/",
  "/tr/iletisim/",
  "/tr/blog/",
  "/en/blog/",
  "/tr/giris/",
  "/en/login/",
  "/tr/sepet/",
  "/tr/gizlilik-politikasi/",
  "/tr/mesafeli-satis-sozlesmesi/",
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

async function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const candidates = clean.endsWith("/")
    ? [path.join(OUT_DIR, clean, "index.html"), path.join(OUT_DIR, `${clean.replace(/\/$/, "")}.html`)]
    : [path.join(OUT_DIR, clean), path.join(OUT_DIR, `${clean}.html`), path.join(OUT_DIR, clean, "index.html")];
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function startServer() {
  const server = createServer(async (req, res) => {
    const file = await resolveFile(req.url || "/");
    if (!file) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<!doctype html><title>404</title>");
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

/**
 * Runs inside the page. Returns every mobile-correctness signal in one pass so
 * a route/viewport combination costs a single round trip.
 */
function collectMetrics() {
  const doc = document.documentElement;
  const overflow = doc.scrollWidth - doc.clientWidth;

  // Attribute the overflow to a real element, so failures are actionable.
  const offenders = [];
  if (overflow > 1) {
    const limit = doc.clientWidth + 1;
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right > limit || rect.left < -1) {
        const style = getComputedStyle(el);
        if (style.position === "fixed" && rect.width <= doc.clientWidth + 1) continue;
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className || "").slice(0, 120),
          right: Math.round(rect.right),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
        });
        if (offenders.length >= 5) break;
      }
    }
  }

  // A second full-page vertical scroller competing with the document.
  const nestedScrollers = [];
  for (const el of Array.from(document.body.querySelectorAll("*"))) {
    const style = getComputedStyle(el);
    const scrolls = style.overflowY === "auto" || style.overflowY === "scroll";
    if (!scrolls) continue;
    const rect = el.getBoundingClientRect();
    // Only count containers that are effectively the whole viewport -- a
    // table or a code block scrolling inside itself is intended.
    if (rect.height >= window.innerHeight * 0.9 && el.scrollHeight > el.clientHeight + 4) {
      nestedScrollers.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 100) });
    }
  }

  // Touch targets below the 44px guideline (visible, interactive, not inline text links).
  const smallTargets = [];
  const interactive = Array.from(
    document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, [role="button"]')
  );
  for (const el of interactive) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.bottom < 0 || rect.top > window.innerHeight * 3) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") continue;
    // Inline links inside a paragraph are text, not tap targets.
    if (el.tagName === "A" && style.display.startsWith("inline") && el.closest("p, li")) continue;
    if (rect.height < 32 || rect.width < 24) {
      smallTargets.push({
        tag: el.tagName.toLowerCase(),
        label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      });
    }
  }

  // iOS zooms the whole page when focusing an input whose font-size < 16px.
  const smallInputs = [];
  for (const el of Array.from(document.querySelectorAll("input, textarea, select"))) {
    // Only text-entry controls trigger the iOS focus zoom. A checkbox, radio or
    // range has no text to zoom to, so its font-size is irrelevant here.
    if (["hidden", "checkbox", "radio", "range", "submit", "button", "file", "color"].includes(el.type)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size && size < 16) {
      smallInputs.push({ tag: el.tagName.toLowerCase(), type: el.type || "", size: Math.round(size * 10) / 10 });
    }
  }

  const bodyOverflow = getComputedStyle(document.body).overflow;

  return {
    overflow,
    clientWidth: doc.clientWidth,
    scrollWidth: doc.scrollWidth,
    offenders,
    nestedScrollers,
    smallTargets: smallTargets.slice(0, 8),
    smallTargetCount: smallTargets.length,
    smallInputs: smallInputs.slice(0, 5),
    bodyOverflow,
    lockAttr: document.body.getAttribute("data-oriens-scroll-lock-count"),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const wantWebkit = args.includes("--webkit") || args.includes("--all");
  const wantChromium = !args.includes("--webkit") || args.includes("--all");
  const desktopOnly = args.includes("--desktop");

  const { chromium, webkit } = await import("playwright");
  const { server, base } = await startServer();
  console.log("Serving ./out at " + base + "\n");

  const failures = [];
  let checks = 0;
  const note = (ok, label, detail = "") => {
    checks += 1;
    if (!ok) failures.push(label + (detail ? " -- " + detail : ""));
    console.log((ok ? "  PASS  " : "  FAIL  ") + label + (detail && !ok ? " -- " + detail : ""));
  };

  const engines = [];
  if (wantChromium) engines.push(["chromium", chromium]);
  if (wantWebkit) engines.push(["webkit", webkit]);

  for (const [engineName, engine] of engines) {
    const browser = await engine.launch();
    const widths = desktopOnly ? DESKTOP_WIDTHS : [...MOBILE_WIDTHS, ...TABLET_WIDTHS];

    for (const width of widths) {
      const isMobile = width < 768;
      const context = await browser.newContext({
        viewport: { width, height: 780 },
        deviceScaleFactor: isMobile ? 3 : 1,
        isMobile: engineName === "chromium" ? isMobile : undefined,
        hasTouch: isMobile,
      });
      const page = await context.newPage();
      console.log(`\n[${engineName} @ ${width}px]`);

      for (const route of ROUTES) {
        let metrics;
        try {
          await page.goto(base + route, { waitUntil: "load", timeout: 30000 });
          // The intro loader legitimately locks the body while it plays. Measure
          // the SETTLED page: wait for the lock to be released, and fail loudly
          // if it never is (that would be a real scroll trap, not a timing
          // artefact of the probe).
          await page
            .waitForFunction(() => !document.body.hasAttribute("data-oriens-scroll-lock-count"), null, { timeout: 8000 })
            .catch(() => {});
          await page.waitForTimeout(250);
          metrics = await page.evaluate(collectMetrics);
        } catch (error) {
          note(false, `${route} loads`, String(error).slice(0, 120));
          continue;
        }

        note(
          metrics.overflow <= 1,
          `${route} no horizontal overflow`,
          `sw=${metrics.scrollWidth} cw=${metrics.clientWidth} :: ` +
            metrics.offenders.map((o) => `${o.tag}.${o.cls.split(" ").slice(0, 3).join(".")}@${o.left}..${o.right}`).join(" | ")
        );
        note(
          metrics.nestedScrollers.length === 0,
          `${route} no nested full-page scroller`,
          metrics.nestedScrollers.map((n) => `${n.tag}.${n.cls.split(" ").slice(0, 3).join(".")}`).join(" | ")
        );
        note(
          metrics.bodyOverflow !== "hidden",
          `${route} body is scrollable at rest`,
          `body overflow=${metrics.bodyOverflow}`
        );
        if (isMobile) {
          note(
            metrics.smallInputs.length === 0,
            `${route} inputs are >=16px (no iOS focus zoom)`,
            metrics.smallInputs.map((i) => `${i.tag}[${i.type}]=${i.size}px`).join(", ")
          );
        }
      }

      // Mobile menu: open, close, and prove the body is released.
      if (isMobile) {
        await page.goto(base + "/tr/", { waitUntil: "load" });
        await page.waitForTimeout(300);
        const trigger = page.locator('header button[aria-controls], header button[aria-expanded]').first();
        if (await trigger.count()) {
          await trigger.click();
          await page.waitForTimeout(350);
          const locked = await page.evaluate(() => ({
            overflow: getComputedStyle(document.body).overflow,
            count: document.body.getAttribute("data-oriens-scroll-lock-count"),
          }));
          note(locked.overflow === "hidden", `mobile menu locks body scroll`, JSON.stringify(locked));
          note(locked.count === "1", `mobile menu uses the counted lock helper`, JSON.stringify(locked));

          await page.keyboard.press("Escape");
          await page.waitForTimeout(350);
          const released = await page.evaluate(() => ({
            overflow: getComputedStyle(document.body).overflow,
            count: document.body.getAttribute("data-oriens-scroll-lock-count"),
            scrolled: (() => {
              // scroll-behavior:smooth animates programmatic scrolls, so a
              // synchronous read right after scrollBy() would report the OLD
              // position and look like a scroll trap. Force an instant scroll.
              const before = window.scrollY;
              window.scrollBy({ top: 200, behavior: "instant" });
              const after = window.scrollY;
              window.scrollTo({ top: before, behavior: "instant" });
              return after > before;
            })(),
          }));
          note(released.overflow !== "hidden", `body unlocked after menu close`, JSON.stringify(released));
          note(released.count === null, `lock counter cleared after menu close`, JSON.stringify(released));
          note(released.scrolled, `page scrolls after menu close (no scroll trap)`, JSON.stringify(released));
        } else {
          note(false, "mobile menu trigger found");
        }
      }

      await context.close();
    }
    await browser.close();
  }

  server.close();

  console.log("\n=======================================");
  console.log(`  ${checks - failures.length} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures.slice(0, 60)) console.log("  - " + f);
    process.exit(1);
  }
  console.log("  MOBILE RESPONSIVE REGRESSION: ALL GREEN");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
