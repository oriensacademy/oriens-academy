// Öğrenci detay ekranı tarayıcı testi: telefon (oluştur / düzenle / temizle),
// WhatsApp bağlantısı, üst bar, Akademik Profil ölçüleri ve paket çizgisi.
// `out/` statik derlemesi + tamamen sahte Supabase; gerçek ağ isteği, mutasyon,
// WhatsApp mesajı veya e-posta yok. Önce `npm run build`, sonra:
//   npm run test:student:browser
// Canlı statik dosyalarla (Supabase yine sahte): STUDENT_QA_BASE_URL=https://oriens-academy.com
import assert from "node:assert/strict";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const OUT = join(process.cwd(), "out");
const REMOTE_BASE = (process.env.STUDENT_QA_BASE_URL || "").replace(/\/$/, "");
const SHOTS = process.env.STUDENT_QA_SHOTS || ""; // isteğe bağlı ekran görüntüsü klasörü
const shot = (page, name) => (SHOTS ? page.screenshot({ path: join(SHOTS, `${name}.png`) }) : Promise.resolve());
if (!REMOTE_BASE && !existsSync(join(OUT, "admin", "ogrenciler", "detay", "index.html"))) {
  console.error("out/admin/ogrenciler/detay/index.html yok — önce `npm run build` çalıştırın.");
  process.exit(1);
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon" };
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://x").pathname);
  let file = normalize(join(OUT, pathname));
  if (!file.startsWith(OUT)) { response.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
  if (!existsSync(file)) { response.writeHead(404, { "Content-Type": "text/html" }); createReadStream(join(OUT, "404.html")).pipe(response); return; }
  response.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = REMOTE_BASE || `http://127.0.0.1:${server.address().port}`;
const allowedOrigin = new URL(baseUrl).origin;

const supabaseUrl = readFileSync(".env.local", "utf8").match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "") || "";
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const adminId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const nowSec = Math.floor(Date.now() / 1000);
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const adminUser = { id: adminId, aud: "authenticated", role: "authenticated", email: "admin@oriens-academy.com", email_confirmed_at: new Date().toISOString(), app_metadata: { role: "admin", provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: new Date().toISOString() };
const adminSession = { access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ aud: "authenticated", exp: nowSec + 3600, sub: adminId, role: "authenticated" })}.qa`, token_type: "bearer", expires_in: 3600, expires_at: nowSec + 3600, refresh_token: "qa-refresh", user: adminUser };

// ---- Sahte veri -------------------------------------------------------------
const ts = "2026-10-01T10:00:00Z";
const WITH_GUARDIAN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"; // telefonu yok, veli telefonu var
const NO_PHONE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"; // hiç telefon yok
const GUARDIAN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CREATED = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const studentRow = (id, fullName, overrides = {}) => ({ id, full_name: fullName, email: "", phone: null, school: "IELEV Lisesi", grade_level: "Mezun", education_program: "IB Diploma", exams_taken: ["SAT"], target_exams: [], target_countries: [], target_exam: null, target_country: null, target_university: null, preferred_language: "tr", active: true, archived_at: null, contact_guardian_name: null, created_at: ts, updated_at: ts, ...overrides });
const db = {
  admin_profiles: [{ user_id: adminId, display_name: "QA Yönetici", role: "admin", active: true, created_at: ts, updated_at: ts }],
  student_profiles: [studentRow(WITH_GUARDIAN, "Batu Akçay"), studentRow(NO_PHONE, "Ece Demir")],
  guardian_students: [{ guardian_user_id: GUARDIAN, student_id: WITH_GUARDIAN, relationship_role: "parent", is_primary: true, active: true, guardian_accounts: { full_name: "Selin Akçay", email: "qa-guardian@example.invalid", phone: "5339998877" } }],
  student_package_purchases: [{ id: "12121212-1212-4121-8121-121212121212", student_user_id: WITH_GUARDIAN, package_id: "p10", lesson_count: 10, lessons_used: 4, status: "active", payment_status: "paid", is_archived: false, start_date: "2026-10-01", end_date: null, price_amount: 0, currency: "TRY", created_at: ts, pricing_packages: { name_tr: "10 Derslik Paket", name_en: "10 Lesson Package" } }],
  student_grade_options: [{ id: "g1", label: "Mezun", active: true, sort_order: 1 }],
};
const calls = { create: [], update: [], signIn: 0, blocked: [] };

async function fakeSupabase(route) {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  if (path.startsWith("/auth/v1/token")) { calls.signIn += 1; return route.fulfill({ json: adminSession }); }
  if (path.startsWith("/auth/v1/user")) return route.fulfill({ json: adminUser });
  if (path.startsWith("/auth/v1/")) return route.fulfill({ json: {} });
  if (path.startsWith("/rest/v1/rpc/")) {
    const name = path.split("/rest/v1/rpc/")[1];
    const body = request.postDataJSON() ?? {};
    if (name === "admin_create_student") {
      calls.create.push(body);
      if (!db.student_profiles.some((row) => row.id === CREATED)) {
        db.student_profiles.unshift(studentRow(CREATED, body.p_full_name, { phone: body.p_phone ?? null, school: body.p_school ?? null, grade_level: body.p_grade_level ?? null, education_program: body.p_education_program ?? null, exams_taken: [], contact_guardian_name: body.p_guardian_name ?? null, updated_at: new Date().toISOString() }));
      }
      return route.fulfill({ json: { success: true, student_id: CREATED, replayed: false } });
    }
    if (name === "admin_update_student_form_profile") {
      calls.update.push(body);
      const row = db.student_profiles.find((item) => item.id === body.p_student_id);
      if (!row) return route.fulfill({ json: { success: false, error_code: "NOT_FOUND" } });
      const changed = [];
      for (const [key, value] of Object.entries(body.p_changes ?? {})) {
        if (JSON.stringify(row[key] ?? null) !== JSON.stringify(value ?? null)) changed.push(key);
        row[key] = value;
      }
      row.updated_at = new Date().toISOString();
      return route.fulfill({ json: { success: true, student_id: row.id, changed_fields: changed } });
    }
    if (name === "admin_guardian_last_sign_ins") {
      return route.fulfill({ json: [{ user_id: GUARDIAN, last_sign_in_at: "2026-10-08T18:30:00Z" }] });
    }
    return route.fulfill({ json: [] });
  }
  if (path.startsWith("/rest/v1/")) {
    const table = path.split("/rest/v1/")[1];
    if (request.method() !== "GET" && request.method() !== "HEAD") return route.fulfill({ status: 201, json: [] });
    let rows = db[table] ?? [];
    const idFilter = url.searchParams.get("id") || url.searchParams.get("user_id");
    if (idFilter?.startsWith("eq.")) rows = rows.filter((row) => (row.id ?? row.user_id) === idFilter.slice(3));
    const single = request.headers().accept?.includes("vnd.pgrst.object");
    return route.fulfill({ json: single ? rows[0] ?? null : rows, headers: { "Content-Range": `0-${Math.max(0, rows.length - 1)}/${rows.length}` } });
  }
  return route.fulfill({ json: {} });
}

async function newContext(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, locale: "tr-TR" });
  await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: `sb-${projectRef}-auth-token`, value: adminSession });
  await context.route((url) => url.origin !== allowedOrigin && !url.href.startsWith(supabaseUrl), (route) => { calls.blocked.push(new URL(route.request().url()).origin); return route.abort(); });
  await context.route(`${supabaseUrl}/**`, fakeSupabase);
  return context;
}

const detailUrl = (id) => `${baseUrl}/admin/ogrenciler/detay/?student=${id}`;
async function openDetail(page, id) {
  await page.goto(detailUrl(id), { waitUntil: "load" });
  await page.getByRole("heading", { name: "Akademik Profil" }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(400);
}
const waState = (page) => page.locator("[data-wa]").first().evaluate((el) => ({ tag: el.tagName, href: el.getAttribute("href"), disabled: el.disabled === true, tip: el.closest("[title]")?.getAttribute("title") || "", target: el.getAttribute("target"), rel: el.getAttribute("rel") }));

async function editPhone(page, value) {
  await page.getByRole("button", { name: "Bilgileri Düzenle" }).click();
  const input = page.locator("#f-tel");
  await input.waitFor();
  const before = await input.inputValue();
  const label = await page.locator('label[for="f-tel"]').textContent();
  const section = await input.evaluate((el) => el.closest("section")?.querySelector("h3")?.textContent?.trim());
  await input.fill(value);
  await shot(page, `edit-${value ? "phone" : "clear"}`);
  await page.getByRole("button", { name: /Devam Et/ }).click();
  await page.locator("#f-admin-pw").fill("qa-not-a-real-password");
  const updated = page.waitForRequest((request) => request.url().includes("/rest/v1/rpc/admin_update_student_form_profile"));
  await page.getByRole("button", { name: "Doğrula ve Güncelle" }).click();
  const body = (await updated).postDataJSON();
  await page.locator("#edit-dialog").waitFor({ state: "detached" });
  await page.waitForTimeout(600);
  return { before, label: label?.trim(), section, body };
}

const results = {};
const browser = await chromium.launch();
try {
  // ---- 1) Yeni öğrenci: telefon alanı, normalizasyon, RPC yükü -------------
  {
    const context = await newContext(browser, 1440);
    const page = await context.newPage();
    await page.goto(`${baseUrl}/admin/ogrenciler/`, { waitUntil: "load" });
    await page.getByRole("button", { name: /Yeni Öğrenci/ }).first().click();
    const tel = page.locator("#yo-tel");
    await tel.waitFor();
    assert.equal((await page.locator('label[for="yo-tel"]').textContent()).trim(), "Telefon Numarası");
    assert.equal(await tel.evaluate((el) => el.closest("section")?.querySelector("h3")?.textContent?.trim()), "Öğrenci", "telefon Öğrenci bölümünde");
    await page.locator("#yo-ad").fill("Deniz Telefon");
    await tel.fill("12345");
    await page.getByRole("button", { name: "Öğrenciyi Ekle" }).click();
    await page.getByText("Geçerli bir telefon numarası girin.").waitFor();
    assert.equal(calls.create.length, 0, "geçersiz numara sunucuya gitmez");
    await tel.fill("0532 123 45 67");
    assert.equal(await tel.inputValue(), "(532) 123 45 67", "create: 0 ile paste canlı maskelenir");
    assert.equal(await tel.locator("xpath=..").locator("span").textContent(), "+90", "create: sabit +90 prefix");
    for (const value of ["5321234567", "+90 532 123 45 67", "+90 (532) 123 45 67"]) {
      await tel.fill(value);
      assert.equal(await tel.inputValue(), "(532) 123 45 67", `create mask: ${value}`);
    }
    await tel.press("Backspace");
    assert.equal(await tel.inputValue(), "(532) 123 45 6", "create: backspace maskeyi korur");
    await tel.pressSequentially("7");
    assert.equal(await tel.inputValue(), "(532) 123 45 67", "create: backspace sonrası yazma");
    await shot(page, "create-dialog");
    const created = page.waitForRequest((request) => request.url().includes("/rest/v1/rpc/admin_create_student"));
    await page.getByRole("button", { name: "Öğrenciyi Ekle" }).click();
    const body = (await created).postDataJSON();
    assert.equal(body.p_phone, "905321234567", "create payload normalize");
    await page.getByRole("button", { name: "Detayı aç" }).click();
    await page.waitForURL(/\/admin\/ogrenciler\/detay/);
    await page.getByRole("heading", { name: "Akademik Profil" }).waitFor({ timeout: 30_000 });
    const wa = await waState(page);
    assert.equal(wa.href, "https://wa.me/905321234567");
    assert.equal(wa.target, "_blank");
    assert.match(wa.rel || "", /noopener/);
    results.create = { payloadPhone: body.p_phone, storedPhone: db.student_profiles.find((row) => row.id === CREATED).phone, waHref: wa.href };

    // ---- 2) Düzenle: alan dolu gelir, değişir, WhatsApp yeni numarayı kullanır
    const edit = await editPhone(page, "+90 (533) 444 55 66");
    assert.equal(edit.before, "(532) 123 45 67", "mevcut numara düzenleme alanında maskeli");
    assert.equal(edit.label, "Telefon Numarası");
    assert.equal(edit.section, "Öğrenci Bilgileri");
    assert.equal(edit.body.p_changes.phone, "905334445566", "update payload normalize");
    assert.equal(db.student_profiles.find((row) => row.id === CREATED).phone, "905334445566");
    assert.equal((await waState(page)).href, "https://wa.me/905334445566", "WhatsApp yeni numara");
    results.edit = { before: edit.before, payloadPhone: edit.body.p_changes.phone, waHref: (await waState(page)).href };

    // ---- 3) Temizle: null yazılır; velisi olmayan öğrencide buton pasif
    const clear = await editPhone(page, "");
    assert.ok("phone" in clear.body.p_changes);
    assert.equal(clear.body.p_changes.phone, null, "boş alan null");
    assert.equal(db.student_profiles.find((row) => row.id === CREATED).phone, null);
    const cleared = await waState(page);
    assert.equal(cleared.tag, "BUTTON");
    assert.equal(cleared.disabled, true);
    assert.equal(cleared.href, null);
    assert.equal(cleared.tip, "Telefon numarası eklenmemiş");
    results.clear = { payloadPhone: clear.body.p_changes.phone, wa: "disabled" };

    // Değiştirilmeyen telefon yeniden gönderilmez.
    await page.getByRole("button", { name: "Bilgileri Düzenle" }).click();
    await page.locator("#f-ad").fill("Deniz Telefon Yeni");
    await page.getByRole("button", { name: /Devam Et/ }).click();
    await page.locator("#f-admin-pw").fill("qa-not-a-real-password");
    const nameOnly = page.waitForRequest((request) => request.url().includes("/rest/v1/rpc/admin_update_student_form_profile"));
    await page.getByRole("button", { name: "Doğrula ve Güncelle" }).click();
    assert.ok(!("phone" in (await nameOnly).postDataJSON().p_changes), "telefon değişmediyse yükte yok");
    await page.locator("#edit-dialog").waitFor({ state: "detached" });

    // Geri bağlantısı öğrenci listesine gider.
    await page.getByRole("link", { name: "Öğrencilere Dön" }).click();
    await page.waitForURL((url) => /\/admin\/ogrenciler\/?$/.test(url.pathname));
    results.backLink = new URL(page.url()).pathname;
    await context.close();
  }

  // ---- 4) Veli yedeği, pasif durum, düzen ölçüleri (1440 / 1280 / 390) ------
  results.layout = {};
  for (const width of [1440, 1280, 820, 390]) {
    const context = await newContext(browser, width);
    const page = await context.newPage();
    await openDetail(page, NO_PHONE);
    const none = await waState(page);
    assert.equal(none.disabled, true);
    assert.equal(none.tip, "Telefon numarası eklenmemiş");

    await openDetail(page, WITH_GUARDIAN);
    const fallback = await waState(page);
    assert.equal(fallback.href, "https://wa.me/905339998877", "öğrenci telefonu yoksa veli");

    const m = await page.evaluate(() => {
      const box = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
      const h2 = [...document.querySelectorAll("h2")].find((el) => el.textContent.trim() === "Akademik Profil");
      const card = h2.closest("section");
      const grid = h2.nextElementSibling;
      const pkg = [...document.querySelectorAll("section")].find((el) => /Aktif Paket/.test(el.textContent) && /ders kaldı/.test(el.textContent));
      const bar = pkg.querySelector('[role="progressbar"]');
      const back = document.querySelector('a[aria-label="Öğrencilere Dön"]');
      const wa = document.querySelector("[data-wa]");
      const edit = [...document.querySelectorAll("button")].find((el) => /Bilgileri Düzenle/.test(el.textContent));
      const tabs = document.querySelector('[role="tablist"][aria-label="Öğrenci sekmeleri"]');
      const hero = tabs.closest("header");
      const tabItems = [...tabs.querySelectorAll('[role="tab"]')];
      const metadata = hero.querySelector('[aria-label="Öğrenci bilgileri"]');
      const cs = getComputedStyle(card);
      return {
        docW: document.documentElement.scrollWidth, vw: innerWidth,
        card: box(card), grid: box(grid), pkg: box(pkg), padB: parseFloat(cs.paddingBottom),
        cols: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        cellPad: getComputedStyle(grid.firstElementChild).padding, gap: getComputedStyle(grid).gap, titleSize: getComputedStyle(h2).fontSize,
        bar: { children: bar.children.length, now: bar.getAttribute("aria-valuenow"), max: bar.getAttribute("aria-valuemax"), ratio: bar.firstElementChild.getBoundingClientRect().width / bar.getBoundingClientRect().width },
        back: box(back), wa: box(wa), edit: box(edit),
        actionsInHero: hero.contains(wa) && hero.contains(edit),
        metadata: metadata.textContent.replace(/\s+/g, " ").trim(),
        accent: getComputedStyle(hero, "::before").backgroundImage,
        tabIcons: tabItems.filter((item) => item.querySelector("svg")).length,
        tabBackground: getComputedStyle(tabs).backgroundColor,
        tabClipped: tabItems.some((item) => item.scrollWidth > item.clientWidth + 1),
        tabsScrollable: tabs.scrollWidth >= tabs.clientWidth,
      };
    });
    assert.ok(m.docW <= m.vw, `${width}: yatay taşma yok (${m.docW} > ${m.vw})`);
    for (const key of ["back", "wa", "edit"]) assert.ok(m[key].x >= 0 && m[key].r <= m.vw, `${width}: ${key} ekranda`);
    assert.ok(m.wa.r <= m.edit.x + 1 && Math.abs(m.wa.y - m.edit.y) < 2, `${width}: WhatsApp, Bilgileri Düzenle'nin solunda`);
    assert.equal(m.actionsInHero, true, `${width}: aksiyonlar header kartında`);
    assert.match(m.metadata, /IELEV Lisesi.*Mezun.*IB Diploma/, `${width}: gerçek header metadata`);
    assert.doesNotMatch(m.metadata, /Veli son giriş/, `${width}: PDF-16 header'da veli son giriş yok`);
    assert.match(m.accent, /linear-gradient/, `${width}: green-gold accent`);
    assert.equal(m.tabIcons, 4, `${width}: dört tab ikonu`);
    assert.notEqual(m.tabBackground, "rgba(0, 0, 0, 0)", `${width}: tab background`);
    assert.equal(m.tabClipped, false, `${width}: tab label kırpılmıyor`);
    assert.ok(Math.abs(m.grid.b - (m.card.b - m.padB)) <= 1.5, `${width}: Akademik Profil ızgarası kartı dolduruyor`);
    assert.equal(m.cellPad, "14px 12px 14px 14px");
    assert.equal(m.gap, "10px");
    assert.equal(m.titleSize, "22px");
    if (width >= 1280) {
      assert.equal(m.cols, 4);
      assert.ok(Math.abs(m.card.h - m.pkg.h) <= 1, `${width}: Akademik Profil ve paket kartı aynı yükseklik`);
      assert.ok(Math.abs(m.card.y - m.pkg.y) <= 1, `${width}: aynı satır`);
    } else if (width === 390) {
      assert.equal(m.cols, 2);
      assert.ok(m.wa.w <= 46, "390: WhatsApp yalnız ikon");
      assert.ok(m.edit.r <= m.vw, "390: düzenle butonu taşmıyor");
      assert.equal(m.tabsScrollable, true, "390: sekmeler kendi container'ında kaydırılabilir");
    }
    assert.equal(m.bar.children, 1, "Genel: tek parça çizgi");
    assert.equal(m.bar.now, "6");
    assert.equal(m.bar.max, "10");
    assert.ok(Math.abs(m.bar.ratio - 0.6) < 0.01, `Genel: %60 (${m.bar.ratio})`);

    await page.getByRole("tab", { name: "Paket & Ödeme" }).or(page.getByRole("button", { name: "Paket & Ödeme" })).first().click();
    const pb = page.locator("[data-package-bar]").first();
    await pb.waitFor({ timeout: 15_000 });
    const pm = await pb.evaluate((el) => ({ children: el.children.length, now: el.getAttribute("aria-valuenow"), ratio: el.firstElementChild.getBoundingClientRect().width / el.getBoundingClientRect().width, docW: document.documentElement.scrollWidth, vw: innerWidth }));
    assert.equal(pm.children, 1, "Paket: tek parça çizgi");
    // PDF-21: paket sekmesinde dolu kısım kullanılan ders oranı (10 dersten 4 kullanıldı).
    assert.equal(pm.now, "4");
    assert.ok(Math.abs(pm.ratio - 0.4) < 0.01, `Paket: kullanılan %40 (${pm.ratio})`);
    assert.ok(pm.docW <= pm.vw, `${width}: paket sekmesi taşma yok`);
    await shot(page, `package-tab-${width}`);
    results.layout[width] = { academic: `${Math.round(m.card.w)}x${Math.round(m.card.h)}`, grid: `${Math.round(m.grid.w)}x${Math.round(m.grid.h)}`, package: `${Math.round(m.pkg.w)}x${Math.round(m.pkg.h)}`, cols: m.cols, bar: `${Math.round(m.bar.ratio * 100)}%`, packageTab: `${Math.round(pm.ratio * 100)}%`, wa: Math.round(m.wa.w) };
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

const waLinks = [results.create.waHref, results.edit.waHref, "https://wa.me/905339998877"];
assert.ok(waLinks.every((href) => !/[?&]text=/.test(href)), "WhatsApp text parametresi yok");
console.log(JSON.stringify({ base: REMOTE_BASE || "local out/", ...results, signIns: calls.signIn, createCalls: calls.create.length, updateCalls: calls.update.length, whatsappTextParams: 0, blockedOrigins: [...new Set(calls.blocked)] }, null, 2));
console.log("STUDENT PHONE BROWSER QA: PASS");
