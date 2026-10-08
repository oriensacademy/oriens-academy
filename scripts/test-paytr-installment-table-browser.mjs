/**
 * PayTR resmi taksit tablosu — tarayıcı QA (gerçek ödeme / gerçek veri YOK).
 *
 *   npm run build && node scripts/test-paytr-installment-table-browser.mjs
 *   QA_BASE_URL=https://oriens-academy.com node scripts/test-paytr-installment-table-browser.mjs
 *
 * - QA_BASE_URL yoksa `out/` yerel olarak sunulur.
 * - Supabase'e giden her istek taklit edilir (oturum, paketler, kupon teklifi);
 *   paytr-create-token isteği yakalanır ve yerelde yanıtlanır, PayTR'ye ödeme
 *   isteği çıkmaz. PayTR'ye yalnız taksit tablosu betiği + banka logoları gider.
 * - Normal Chrome (channel: chrome, gerçek UA) kullanılır; PayTR HeadlessChrome'a
 *   zaman zaman "Sistem Bakımı" döndürebiliyor.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const env = fs.readFileSync(".env.local", "utf8");
const supabaseUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "") || "";
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const TABLE_TOKEN = env.match(/^NEXT_PUBLIC_PAYTR_INSTALLMENT_TOKEN=(.+)$/m)?.[1]?.trim() || "";
const MERCHANT_ID = env.match(/^NEXT_PUBLIC_PAYTR_MERCHANT_ID=(.+)$/m)?.[1]?.trim() || "";

// --- static server for out/ ---------------------------------------------------
let server = null;
let base = process.env.QA_BASE_URL?.replace(/\/$/, "") || "";
if (!base) {
  const root = path.resolve("out");
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon" };
  server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.join(root, url);
    if (!file.startsWith(root)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) return res.writeHead(404).end("not found");
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}

// --- fake account / data ------------------------------------------------------
const holderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const learnerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const now = Math.floor(Date.now() / 1000);
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const user = { id: holderId, aud: "authenticated", role: "authenticated", email: "holder@example.test", email_confirmed_at: new Date().toISOString(), app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: new Date().toISOString() };
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ aud: "authenticated", exp: now + 3600, sub: holderId, role: "authenticated" })}.qa`;
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "qa-refresh", user };
const packages = [
  { id: "package10", name_tr: "10 Derslik Paket", name_en: "10-Lesson Package", price_amount: 27000, current_total: 27000, currency: "TRY", lesson_count: 10, unit_price: 2700, purchase_mode: "purchasable", active: true, featured: false, display_order: 1, billing_basis: "package" },
  { id: "package5", name_tr: "5 Derslik Paket", name_en: "5-Lesson Package", price_amount: 15000, current_total: 15000, currency: "TRY", lesson_count: 5, unit_price: 3000, purchase_mode: "purchasable", active: true, featured: false, display_order: 2, billing_basis: "package" },
];
const guardian = { user_id: holderId, full_name: "QA Account Holder", email: user.email, phone: "+905551112233", preferred_language: "tr", email_verified_at: new Date().toISOString(), active: true };
const learner = { id: learnerId, full_name: "QA Learner", email: "learner@example.test", active: true, preferred_language: "tr" };
const relation = { guardian_user_id: holderId, student_id: learnerId, relationship_role: "parent", is_primary: true, active: true };

// quote_checkout_coupon as the server returns it (rule only; amounts are computed by shared pricing).
const COUPONS = {
  QA10: { type: "percentage", value: 10 },
  QA10P5: { type: "percentage", value: 10, packages: ["package5"] },
  QAFIX1000: { type: "fixed", value: 1000 },
  QACAP: { type: "percentage", value: 10, max: 2500 },
  QAMIN: { type: "percentage", value: 10, min: 50000 },
};
function quote(code, ids) {
  const c = COUPONS[code];
  if (!c) return { valid: false, error_code: "COUPON_NOT_FOUND", message: "Kupon bulunamadı" };
  const subtotal = ids.reduce((sum, id) => sum + (packages.find((p) => p.id === id)?.current_total ?? 0), 0);
  const eligible = c.packages ? ids.filter((id) => c.packages.includes(id)) : ids;
  if (!eligible.length) return { valid: false, error_code: "PACKAGE_NOT_ELIGIBLE", message: "Uygun paket yok" };
  if (c.min && subtotal < c.min) return { valid: false, error_code: "MINIMUM_AMOUNT_NOT_MET", message: "Minimum tutar karşılanmadı" };
  return { valid: true, coupon_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", code, name: null, discount_type: c.type, discount_value: c.value, maximum_discount_amount: c.max ?? null, minimum_order_amount: c.min ?? null, eligible_package_ids: eligible, currency: "TRY" };
}

const json = (route, body, object = false, status = 200) => route.fulfill({ status, headers: { "content-type": object ? "application/vnd.pgrst.object+json" : "application/json", "access-control-allow-origin": "*" }, body: JSON.stringify(body) });

// --- browser --------------------------------------------------------------------
const browser = await chromium.launch({ channel: "chrome", headless: true });
const realUa = (await (await browser.newPage()).evaluate(() => navigator.userAgent)).replace("HeadlessChrome", "Chrome");
const results = [];
const issues = [];
const externalRequests = { paytrTable: 0, paytrImages: 0, paytrBlocked: [], supabaseUnmocked: [] };
const record = (name, ok, detail = "") => results.push({ name, ok, detail });

async function scenario({ name, url, cart = [], coupon = null, width = 1280, blockTable = false, stripEnv = false, mutate = null, delayFirstTable = 0, startPayment = false, fillPhone = false }) {
  const context = await browser.newContext({ userAgent: realUa, viewport: { width, height: 1000 }, locale: "tr-TR" });
  await context.addInitScript(({ authKey, authValue, cartKey, cartValue, coupon }) => {
    localStorage.setItem(authKey, JSON.stringify(authValue));
    localStorage.setItem(cartKey, JSON.stringify(cartValue));
    if (coupon) localStorage.setItem(`${cartKey}_coupon`, JSON.stringify(coupon));
    else localStorage.removeItem(`${cartKey}_coupon`);
  }, { authKey: `sb-${projectRef}-auth-token`, authValue: session, cartKey: `oriens_cart_user_${holderId}`, cartValue: cart.map((packageId) => ({ packageId, quantity: 1 })), coupon: coupon ? { code: coupon, coupon: quote(coupon, cart.length ? cart : ["package10"]) } : null });
  const page = await context.newPage();
  const errors = [];
  const tableRequests = [];
  const tokenRequests = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    const src = message.location().url || "";
    if (message.type() === "error" && !src.startsWith("https://challenges.cloudflare.com/") && !/Turnstile|challenges\.cloudflare/.test(message.text()) && !/ERR_FAILED|status of 4\d\d/.test(message.text())) errors.push(`console: ${message.text()}`);
  });

  // Supabase: everything mocked, nothing reaches the real project.
  await page.route(`${supabaseUrl}/**`, async (route) => {
    const req = route.request();
    const u = req.url();
    const object = (req.headers().accept || "").includes("vnd.pgrst.object");
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (u.includes("/auth/v1/user")) return json(route, user, true);
    if (u.includes("/auth/v1/")) return json(route, session, true);
    if (u.includes("/rest/v1/rpc/quote_checkout_coupon") || u.includes("/rest/v1/rpc/validate_checkout_coupon")) {
      const body = req.postDataJSON() || {};
      return json(route, quote(String(body.p_code || ""), body.p_package_ids || cart));
    }
    if (u.includes("/rest/v1/guardian_accounts")) return json(route, object ? guardian : [guardian], object);
    if (u.includes("/rest/v1/guardian_students")) return json(route, [relation]);
    if (u.includes("/rest/v1/student_profiles")) return json(route, object ? learner : [learner], object);
    if (u.includes("/rest/v1/pricing_packages")) return json(route, object ? packages[0] : packages, object);
    if (u.includes("/rest/v1/")) return json(route, object ? null : [], object);
    if (u.includes("/functions/v1/paytr-create-token")) {
      tokenRequests.push(req.postDataJSON());
      return json(route, { success: false, error_code: "QA_INTERCEPTED", message: "QA: ödeme oturumu oluşturulmadı (yakalandı)." });
    }
    if (u.includes("/functions/v1/")) return json(route, { success: true });
    externalRequests.supabaseUnmocked.push(u);
    return route.abort();
  });
  // PayTR: only the informational installment table + its images.
  await page.route("https://www.paytr.com/**", async (route) => {
    const u = route.request().url();
    if (u.startsWith("https://www.paytr.com/odeme/taksit-tablosu/")) {
      tableRequests.push(Object.fromEntries(new URL(u).searchParams));
      if (blockTable) return route.abort("failed");
      externalRequests.paytrTable += 1;
      if (delayFirstTable && tableRequests.length === 1) await new Promise((r) => setTimeout(r, delayFirstTable));
      return route.continue();
    }
    if (u.startsWith("https://www.paytr.com/img/")) {
      externalRequests.paytrImages += 1;
      return route.continue();
    }
    externalRequests.paytrBlocked.push(u);
    return route.abort();
  });
  // Simulate a build without NEXT_PUBLIC_PAYTR_* (values are inlined string literals).
  if (stripEnv) {
    await page.route(`${base}/_next/static/chunks/*.js`, async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      body = body.split(`"${TABLE_TOKEN}"`).join('""').split(`"${MERCHANT_ID}"`).join('""');
      return route.fulfill({ response, body });
    });
  }

  await page.goto(`${base}${url}`, { waitUntil: "domcontentloaded" });
  await page.getByText("Ödenecek Tutar", { exact: true }).waitFor({ timeout: 30_000 });
  if (mutate) await mutate(page, tableRequests);
  const table = page.locator("[data-paytr-installment-table]");
  if (!stripEnv) {
    await page.waitForFunction(() => {
      const el = document.querySelector("[data-paytr-installment-table]");
      return (el && el.getAttribute("data-paytr-installment-table") !== "loading") || document.body.innerText.includes("Taksit tablosu şu anda görüntülenemiyor");
    }, null, { timeout: 30_000 });
  } else {
    await page.waitForTimeout(1500);
  }

  if (fillPhone || startPayment) {
    await page.locator("#payment-phone").fill("+905551112233");
    await page.getByRole("button", { name: "Ödemeye Geç" }).waitFor({ timeout: 10_000 });
  }

  const parseTry = (text) => Number(String(text).replace(/[^\d,]/g, "").replace(",", "."));
  const displayText = await page.locator("span", { hasText: /^Ödenecek Tutar$/ }).locator("xpath=following-sibling::strong").first().textContent();
  const singleText = (await page.locator("[data-single-payment]").count()) ? await page.locator("[data-single-payment]").textContent() : null;
  const info = await page.evaluate(() => {
    const host = document.querySelector("[data-paytr-installment-table]");
    const tables = document.querySelectorAll("#paytr_taksit_tablosu");
    const cards = [...document.querySelectorAll("#paytr_taksit_tablosu .taksit-tablosu-wrapper")];
    const grid = document.querySelector("#paytr_taksit_tablosu");
    const hostRect = host?.getBoundingClientRect();
    const logosOverflow = [...document.querySelectorAll("#paytr_taksit_tablosu .taksit-logo img")].some((img) => {
      const r = img.getBoundingClientRect();
      const c = img.closest(".taksit-tablosu-wrapper").getBoundingClientRect();
      return r.left < c.left - 1 || r.right > c.right + 1;
    });
    const cardsOverflow = cards.some((card) => hostRect && card.getBoundingClientRect().right > hostRect.right + 1);
    const totals = [...document.querySelectorAll("#paytr_taksit_tablosu .taksit-tutar-wrapper .taksit-tutari:nth-child(2)")].map((el) => Number(el.textContent.replace(/[^\d,]/g, "").replace(",", ".")));
    return {
      status: host?.getAttribute("data-paytr-installment-table") ?? null,
      amountAttr: host?.getAttribute("data-paytr-amount") ?? null,
      tableCount: tables.length,
      cards: cards.length,
      banks: cards.map((card) => card.querySelector(".taksit-logo img")?.getAttribute("alt")).filter(Boolean),
      columns: grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length : 0,
      hostMaxHeight: host ? getComputedStyle(host).maxHeight : null,
      minTotal: totals.length ? Math.min(...totals) : null,
      maxTotal: totals.length ? Math.max(...totals) : null,
      logosOverflow,
      cardsOverflow,
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      fallbackShown: document.body.innerText.includes("Taksit tablosu şu anda görüntülenemiyor"),
      detailsShown: Boolean(document.querySelector("details summary") && document.body.innerText.includes("Taksit tablosu")),
      proceedVisible: [...document.querySelectorAll("button")].some((b) => {
        const r = b.getBoundingClientRect();
        return b.textContent.includes("Ödemeye Geç") && r.width > 0 && r.left >= 0 && r.right <= document.documentElement.clientWidth;
      }),
    };
  });

  if (process.env.QA_SCREENSHOT_DIR && info.status) {
    fs.mkdirSync(process.env.QA_SCREENSHOT_DIR, { recursive: true });
    const box = page.locator("[data-paytr-installment-table]").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
    await box.screenshot({ path: path.join(process.env.QA_SCREENSHOT_DIR, `${name.replace(/[^\w]+/g, "-")}-${width}.png`) });
  }

  let tokenAmountCheck = null;
  if (startPayment) {
    await page.getByRole("button", { name: "Ödemeye Geç" }).click();
    await page.waitForTimeout(2500);
    tokenAmountCheck = tokenRequests[0] ?? null;
  }

  await context.close();
  return { name, display: parseTry(displayText), single: singleText ? parseTry(singleText) : null, info, tableRequests, tokenRequests, tokenAmountCheck, errors };
}

const expectTable = (r, amountText) => {
  const req = r.tableRequests.at(-1);
  const problems = [];
  if (r.info.status !== "ready") problems.push(`status=${r.info.status}`);
  if (r.info.amountAttr !== amountText) problems.push(`attr=${r.info.amountAttr}`);
  if (!req || req.amount !== amountText) problems.push(`request amount=${req?.amount}`);
  if (req && (req.merchant_id !== "741293" || req.taksit !== "0" || req.tumu !== "0" || req.token !== TABLE_TOKEN)) problems.push(`params=${JSON.stringify({ ...req, token: req.token === TABLE_TOKEN ? "ok" : "MISMATCH" })}`);
  if (Math.round(r.display * 100) !== Math.round(Number(amountText) * 100)) problems.push(`display=${r.display}`);
  if (r.single !== null && Math.round(r.single * 100) !== Math.round(Number(amountText) * 100)) problems.push(`single=${r.single}`);
  if (r.info.tableCount !== 1) problems.push(`tables=${r.info.tableCount}`);
  if (r.info.cards < 1) problems.push("no bank cards");
  // PayTR totals include the bank financing cost → never below the single-payment amount.
  if (r.info.minTotal !== null && r.info.minTotal + 0.01 < Number(amountText)) problems.push(`table total ${r.info.minTotal} < amount`);
  if (r.info.pageOverflow) problems.push("page overflow");
  if (r.errors.length) problems.push(...r.errors);
  return problems;
};

try {
  const cases = [
    { key: "GUARDIAN DIRECT (A single, no coupon)", opts: { url: "/tr/odeme/?package=package10" }, amount: "27000.00" },
    { key: "GUARDIAN DIRECT + PERCENT COUPON (B)", opts: { url: "/tr/odeme/?package=package10", coupon: "QA10" }, amount: "24300.00" },
    { key: "CART MULTI PACKAGE (C)", opts: { url: "/tr/odeme/?source=cart", cart: ["package5", "package10"] }, amount: "42000.00" },
    { key: "CART ONE-ELIGIBLE PERCENT (D)", opts: { url: "/tr/odeme/?source=cart", cart: ["package5", "package10"], coupon: "QA10P5" }, amount: "40500.00" },
    { key: "CART ALL-ELIGIBLE PERCENT (E)", opts: { url: "/tr/odeme/?source=cart", cart: ["package5", "package10"], coupon: "QA10" }, amount: "37800.00" },
    { key: "CART FIXED COUPON (F)", opts: { url: "/tr/odeme/?source=cart", cart: ["package5", "package10"], coupon: "QAFIX1000" }, amount: "41000.00" },
    { key: "CART MAXIMUM DISCOUNT (G)", opts: { url: "/tr/odeme/?source=cart", cart: ["package5", "package10"], coupon: "QACAP" }, amount: "39500.00" },
    { key: "CART MINIMUM NOT MET (H)", opts: { url: "/tr/odeme/?source=cart", cart: ["package5", "package10"], coupon: "QAMIN" }, amount: "42000.00" },
  ];
  const summary = {};
  for (const c of cases) {
    const r = await scenario({ name: c.key, ...c.opts });
    const problems = expectTable(r, c.amount);
    summary[c.key] = { display: r.display, table: r.info.amountAttr, requests: r.tableRequests.map((q) => q.amount), banks: r.info.banks.length, columns: r.info.columns };
    record(c.key, !problems.length, problems.length ? problems.join("; ") : `display=${r.display.toFixed(2)} table=${r.info.amountAttr} banks=${r.info.banks.join(",")}`);
  }

  // Token request carries the same order (packages + coupon) the table was built from; amount itself is server-side.
  {
    const r = await scenario({ name: "TOKEN", url: "/tr/odeme/?source=cart", cart: ["package5", "package10"], coupon: "QA10P5", startPayment: true });
    const body = r.tokenAmountCheck;
    const ok = body && [...body.packageIds].sort().join(",") === "package10,package5" && body.couponCode === "QA10P5" && r.info.amountAttr === "40500.00";
    record("PAYTR TOKEN REQUEST = TABLE ORDER", Boolean(ok), body ? `packageIds=${body.packageIds} coupon=${body.couponCode} table=${r.info.amountAttr} (intercepted, not sent)` : "no token request");
  }

  // Amount changes while the first table script is still loading → final table matches the new amount, one table.
  {
    const r = await scenario({
      name: "RACE",
      url: "/tr/odeme/?source=cart",
      cart: ["package5", "package10"],
      delayFirstTable: 4000,
      mutate: async (page, reqs) => {
        await page.waitForFunction(() => document.querySelector("[data-paytr-installment-table]"), null, { timeout: 15_000 });
        while (!reqs.length) await page.waitForTimeout(100);
        await page.evaluate((key) => {
          localStorage.setItem(key, JSON.stringify([{ packageId: "package5", quantity: 1 }]));
          window.dispatchEvent(new CustomEvent("oriens:cart_updated", { detail: { key } }));
        }, `oriens_cart_user_${holderId}`);
        await page.waitForTimeout(6000);
      },
    });
    const problems = expectTable(r, "15000.00");
    if (r.info.maxTotal !== null && r.info.maxTotal > 30000) problems.push(`stale 42000 table visible (max total ${r.info.maxTotal})`);
    record("AMOUNT CHANGE WHILE LOADING (no stale table)", !problems.length, problems.length ? problems.join("; ") : `requests=${r.tableRequests.map((q) => q.amount).join("→")} final=${r.info.amountAttr} maxTotal=${r.info.maxTotal}`);
  }

  // Responsive
  for (const width of [390, 1280, 1440]) {
    const r = await scenario({ name: `W${width}`, url: "/tr/odeme/?source=cart", cart: ["package5", "package10"], width, fillPhone: true });
    const problems = expectTable(r, "42000.00");
    const expectedCols = width < 600 ? 1 : 2;
    if (r.info.columns !== expectedCols) problems.push(`columns=${r.info.columns} expected ${expectedCols}`);
    if (r.info.logosOverflow) problems.push("logo overflow");
    if (r.info.cardsOverflow) problems.push("card overflow");
    if (r.info.hostMaxHeight !== "416px") problems.push(`maxHeight=${r.info.hostMaxHeight}`);
    if (!r.info.proceedVisible) problems.push("payment button missing");
    record(`RESPONSIVE ${width}px`, !problems.length, problems.length ? problems.join("; ") : `columns=${r.info.columns} overflow=0 maxHeight=${r.info.hostMaxHeight}`);
  }

  // Table script fails → informational fallback, payment still starts.
  {
    const r = await scenario({ name: "FAIL", url: "/tr/odeme/?source=cart", cart: ["package5", "package10"], blockTable: true, startPayment: true });
    const ok = r.info.fallbackShown && r.info.tableCount === 0 && r.tokenRequests.length === 1 && !r.errors.length;
    record("TABLE SCRIPT FAILURE DOES NOT BLOCK PAYMENT", ok, `fallback=${r.info.fallbackShown} tokenRequests=${r.tokenRequests.length} errors=${r.errors.join("|") || 0}`);
  }

  // Missing NEXT_PUBLIC_PAYTR_* → no table, no details, payment still starts.
  {
    const r = await scenario({ name: "NOENV", url: "/tr/odeme/?source=cart", cart: ["package5", "package10"], stripEnv: true, startPayment: true });
    const ok = r.tableRequests.length === 0 && r.info.status === null && r.tokenRequests.length === 1 && !r.errors.length && Math.round(r.display) === 42000;
    record("MISSING ENV FALLBACK", ok, `tableRequests=${r.tableRequests.length} host=${r.info.status} tokenRequests=${r.tokenRequests.length} errors=${r.errors.join("|") || 0}`);
  }

  let failed = 0;
  for (const { name, ok, detail } of results) {
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  }
  console.log(`\nbase=${base}`);
  console.log(`external: paytrTableRequests=${externalRequests.paytrTable} paytrImages=${externalRequests.paytrImages} paytrBlocked=${externalRequests.paytrBlocked.length} supabaseUnmocked=${externalRequests.supabaseUnmocked.length}`);
  if (externalRequests.paytrBlocked.length) console.log("blocked PayTR:", [...new Set(externalRequests.paytrBlocked)].join(", "));
  console.log(`${results.length - failed}/${results.length} passed`);
  process.exitCode = failed ? 1 : 0;
} finally {
  await browser.close();
  server?.close();
}
