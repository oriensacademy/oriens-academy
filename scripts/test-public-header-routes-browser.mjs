// Kanonik public header: /tr/ ana sayfa header'ı (src/components/sections/Navbar.tsx,
// src/app/[lang]/layout.tsx üzerinden) her public TR/EN rotada birebir aynı olmalı.
// Rota bağımlı tek fark aktif sekme/hesap vurgusudur (durum); yapı, ölçü ve görünürlük aynı.
// Ağ: yalnız yerel statik çıktı; dış istekler engellenir. Çalıştırma: HEADER_QA_BASE_URL.
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.HEADER_QA_BASE_URL || process.env.QA_BASE_URL || "http://127.0.0.1:62175";
const shots = process.env.HEADER_QA_SHOTS || "test-results/public-header";
const routes = {
  tr: ["/tr/", "/tr/giris/", "/tr/ucretler/", "/tr/hakkimizda/", "/tr/odeme/", "/tr/blog/"],
  en: ["/en/", "/en/login/", "/en/pricing/", "/en/about/", "/en/payment/", "/en/blog/"],
};
const widths = [390, 820, 1280, 1440];

function check(condition, message) {
  if (!condition) throw new Error(message);
}

const signature = (page) => page.evaluate(() => {
  const round = (rect) => rect ? [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)] : null;
  const visible = (el) => Boolean(el) && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0;
  // Site başlığı: sabit/yapışkan ya da logoyu taşıyan header (form kartlarındaki semantik <header> sayılmaz).
  const headers = [...document.querySelectorAll("header")].filter(visible).filter((el) => ["fixed", "sticky"].includes(getComputedStyle(el).position) || el.querySelector("img[alt='Oriens Academy']"));
  const header = headers[0];
  const style = header ? getComputedStyle(header) : null;
  const inner = header?.firstElementChild;
  const logo = header?.querySelector('img[alt="Oriens Academy"]');
  const nav = header?.querySelector("nav");
  const tabs = nav && visible(nav) ? [...nav.querySelectorAll("a")].map((a) => [a.textContent.trim(), new URL(a.href).pathname, round(a.getBoundingClientRect())]) : [];
  const buttons = header ? [...header.querySelectorAll("a,button")].filter(visible).map((el) => [el.tagName, (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " "), round(el.getBoundingClientRect())]) : [];
  return {
    headerCount: headers.length,
    referenceHeaders: document.querySelectorAll("[data-oh], .oh, .hw, .oh-panel, .reference-login-page header, .reference-pricing-page header, .reference-about-page header").length,
    cartLinks: header ? header.querySelectorAll('a[href*="sepet"], a[href*="cart"]').length : -1,
    position: style?.position,
    zIndex: style?.zIndex,
    top: style?.top,
    header: round(header?.getBoundingClientRect()),
    inner: round(inner?.getBoundingClientRect()),
    logo: round(logo?.getBoundingClientRect()),
    logoSrc: logo ? new URL(logo.currentSrc || logo.src).pathname : null,
    tabs,
    // Aktif durum (aria-current) hariç: yalnız metin + kutular.
    buttons,
    font: style ? `${style.fontFamily}|${getComputedStyle(header.querySelector("nav a, a")).fontSize}` : null,
  };
});

await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = {};
let diffs = 0;
try {
  for (const [locale, list] of Object.entries(routes)) {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(() => sessionStorage.setItem("oriens-loader-seen", "1"));
      const page = await context.newPage();
      await page.route("**/*", (route) => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
      let reference = null;
      for (const path of list) {
        await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
        await page.locator("header img[alt='Oriens Academy']").first().waitFor({ timeout: 20_000 });
        // Oturum kontrolü bitene kadar hesap yerinde dalga göstergesi durur; bitmesini bekle.
        await page.waitForFunction(() => !document.querySelector("header span[aria-label='Oriens Academy']"), null, { timeout: 15_000 });
        await page.waitForTimeout(500);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(150);
        const sig = await signature(page);
        check(sig.headerCount === 1, `${path}@${width}: ${sig.headerCount} visible headers`);
        check(sig.referenceHeaders === 0, `${path}@${width}: reference header markup still rendered`);
        check(sig.cartLinks === 0, `${path}@${width}: cart link in header`);
        check(sig.position === "fixed" && sig.top === "0px", `${path}@${width}: header not fixed to top (${sig.position})`);
        check(sig.header[3] === (width >= 768 ? 81 : 73) || sig.header[3] === (width >= 768 ? 80 : 72), `${path}@${width}: header height ${sig.header[3]}`);
        const firstContent = await page.evaluate(() => {
          // İlk görünür başlık/form (bölümler padding-top ile 0'dan başlayabilir; içerik header altında kalmamalı).
          const header = document.querySelector("header");
          const first = [...document.body.querySelectorAll("h1, h2, form, ol")].find((el) => !header.contains(el) && !el.closest('[role="dialog"], footer') && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== "hidden");
          return first ? Math.round(first.getBoundingClientRect().top + window.scrollY) : null;
        });
        if (!reference) reference = { path, sig };
        else {
          const a = JSON.stringify({ ...reference.sig });
          const b = JSON.stringify({ ...sig });
          if (a !== b) {
            diffs += 1;
            for (const key of Object.keys(sig)) {
              if (JSON.stringify(sig[key]) !== JSON.stringify(reference.sig[key])) console.error(`DIFF ${path}@${width} vs ${reference.path}: ${key}\n  ${JSON.stringify(reference.sig[key])}\n  ${JSON.stringify(sig[key])}`);
            }
          }
        }

        // Kaydırınca arka plan dolar (sticky davranış) — sayfa yeterince uzunsa.
        const scrollable = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 120);
        if (scrollable) {
          await page.evaluate(() => window.scrollTo(0, 400));
          await page.waitForTimeout(350);
          const scrolledBg = await page.evaluate(() => getComputedStyle(document.querySelector("header")).backgroundColor);
          check(scrolledBg !== "rgba(0, 0, 0, 0)" && scrolledBg !== "transparent", `${path}@${width}: header did not fill on scroll`);
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(200);
        }

        // Mobil menü: burger çekmeceyi açar.
        if (width < 1280) {
          await page.locator("header button[aria-expanded]").click();
          await page.locator('[role="dialog"][aria-modal="true"]').waitFor({ timeout: 5_000 });
          await page.keyboard.press("Escape");
          await page.locator('[role="dialog"][aria-modal="true"]').waitFor({ state: "detached", timeout: 5_000 });
        }
        const overlap = firstContent !== null && firstContent < sig.header[3] - 1;
        check(!overlap, `${path}@${width}: content starts under the fixed header (${firstContent}px)`);
        const name = `${path.replace(/\//g, "_").replace(/^_|_$/g, "") || "home"}-${width}`;
        await page.screenshot({ path: `${shots}/${name}.png`, clip: { x: 0, y: 0, width, height: Math.min(260, 900) } });
        report[`${path}@${width}`] = { header: sig.header, logo: sig.logo, tabs: sig.tabs.length, buttons: sig.buttons.length };
      }
      await context.close();
    }
  }
  check(diffs === 0, `${diffs} route-dependent header differences`);
  console.log(JSON.stringify({ status: "PASS", routes: Object.values(routes).flat(), widths, routeDependentDifferences: diffs, checks: Object.keys(report).length }));
} finally {
  await browser.close();
}
