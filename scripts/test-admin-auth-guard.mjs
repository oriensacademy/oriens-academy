// Admin oturum doğrulama testi (izole): `out/` statik derlemesini yerelde sunar,
// Supabase'e giden TÜM istekleri Playwright içinde karşılar (gerçek sunucuya
// istek çıkmaz) ve localStorage'a yazılmış sahte/bozuk oturumların admin
// paneli açmadığını doğrular.
//
// Kötü senaryoyu bilerek varsayar: REST katmanı (admin_profiles) her token'a
// "aktif admin" satırı döndürse bile panel yalnızca Supabase Auth'un
// /auth/v1/user ile doğruladığı kullanıcıda açılmalıdır.
//
// Çalıştırma: npm run build && node scripts/test-admin-auth-guard.mjs
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failures += 1;
};

// --- 1. Kaynak düzeyi: mock token bypass'ı üretim yoluna geri dönmemeli ---
const accountSource = fs.readFileSync(path.join(ROOT, "src/lib/auth/account-context.tsx"), "utf8");
const resolveStart = accountSource.indexOf("async function resolveAccount(");
const resolveBody = accountSource.slice(resolveStart, accountSource.indexOf("\nexport function AccountProvider", resolveStart));
check(resolveStart > 0, "resolveAccount bulundu");
check(!resolveBody.includes("mock-dev-access-token"), "resolveAccount mock token'a güvenmiyor");
check(/auth\.getUser\(/.test(resolveBody), "resolveAccount kimliği auth.getUser ile sunucuda doğruluyor");
check(resolveBody.indexOf("auth.getUser(") < resolveBody.indexOf("admin_profiles"), "rol kontrolü doğrulamadan sonra");
const notificationsSource = fs.readFileSync(path.join(ROOT, "src/lib/admin/admin-notifications-context.tsx"), "utf8");
check(/if \(!isVerifiedAdmin\) return;/.test(notificationsSource), "admin bildirim RPC'leri doğrulanmış admin oturumuna bağlı");

// --- 2. Tarayıcı düzeyi ---
if (!fs.existsSync(path.join(OUT, "admin", "index.html"))) {
  console.log("FAIL out/ derlemesi yok: önce `npm run build`");
  process.exit(1);
}

function envValue(name) {
  for (const f of [".env.production.local", ".env.local", ".env.production", ".env"]) {
    try {
      const line = fs.readFileSync(path.join(ROOT, f), "utf8").split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
      if (line) return line.slice(name.length + 1).replace(/^"|"$/g, "").trim();
    } catch {
      /* dosya yok */
    }
  }
  return null;
}
const SUPA_HOST = new URL(envValue("NEXT_PUBLIC_SUPABASE_URL")).host;
const STORAGE_KEY = `sb-${SUPA_HOST.split(".")[0]}-auth-token`;

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".txt": "text/plain", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webp": "image/webp", ".ico": "image/x-icon", ".jpg": "image/jpeg" };
const server = http.createServer((req, res) => {
  let file = path.join(OUT, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!file.startsWith(OUT) || !fs.existsSync(file)) {
    res.writeHead(404);
    return res.end("404");
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const BASE = `http://127.0.0.1:${server.address().port}`;

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const jwt = (sub, role, exp, sig = "unsigned") => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub, role: "authenticated", aud: "authenticated", exp, app_metadata: { role } })}.${sig}`;
const ADMIN_ID = "00000000-0000-4000-8000-00000000a001";
const STUDENT_ID = "00000000-0000-4000-8000-00000000b001";
const user = (id, role) => ({ id, aud: "authenticated", role: "authenticated", email: `${role}@example.invalid`, app_metadata: { role }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" });
// Sunucunun "tanıdığı" tek geçerli tokenlar bunlar; geri kalan her şey 403.
const VALID_ADMIN = jwt(ADMIN_ID, "admin", now + 3600, "server-signed-admin");
const VALID_STUDENT = jwt(STUDENT_ID, "student", now + 3600, "server-signed-student");
const session = (access_token, u, expires_at = now + 3600) => JSON.stringify({ access_token, refresh_token: "rt-" + access_token.slice(-8), token_type: "bearer", expires_in: 3600, expires_at, user: u });

const CASES = [
  { name: "token yok", storage: null, expect: "login" },
  { name: "çöp token (JSON değil)", storage: "not-a-session{{", expect: "login" },
  { name: "eski mock token + role=admin", storage: session("mock-dev-access-token", user(ADMIN_ID, "admin")), expect: "login" },
  { name: "sahte imzalı JWT + role=admin", storage: session(jwt(ADMIN_ID, "admin", now + 3600, "forged"), user(ADMIN_ID, "admin")), expect: "login" },
  { name: "süresi dolmuş token", storage: session(jwt(ADMIN_ID, "admin", now - 7200, "server-signed-admin"), user(ADMIN_ID, "admin"), now - 7200), expect: "login" },
  { name: "geçerli öğrenci (admin değil)", storage: session(VALID_STUDENT, user(STUDENT_ID, "student")), expect: "student" },
  { name: "geçerli admin", storage: session(VALID_ADMIN, user(ADMIN_ID, "admin")), expect: "admin" },
];

const browser = await chromium.launch();
for (const testCase of CASES) {
  for (const route of ["/admin/", "/admin/ogrenciler/"]) {
    const context = await browser.newContext({ locale: "tr-TR" });
    const adminRpcCalls = [];
    const externalHosts = new Set();
    await context.addInitScript(([key, value]) => {
      if (value !== null) localStorage.setItem(key, value);
      window.__adminSeen = false;
      const mark = () => {
        if (document.querySelector("#sb, aside[aria-label='Ana menü']")) window.__adminSeen = true;
      };
      new MutationObserver(mark).observe(document, { childList: true, subtree: true });
    }, [STORAGE_KEY, testCase.storage]);
    await context.routeWebSocket(/.*/, (ws) => ws.close());
    await context.route("**/*", async (r) => {
      const req = r.request();
      const url = new URL(req.url());
      if (url.hostname === "127.0.0.1") return r.continue();
      if (url.host !== SUPA_HOST) {
        externalHosts.add(url.hostname);
        return r.abort();
      }
      const json = (body, status = 200) => r.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: body === undefined ? "" : JSON.stringify(body) });
      if (req.method() === "OPTIONS") return r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
      const bearer = (req.headers()["authorization"] || "").replace(/^Bearer\s+/i, "");
      if (url.pathname.startsWith("/auth/v1/user")) {
        if (bearer === VALID_ADMIN) return json(user(ADMIN_ID, "admin"));
        if (bearer === VALID_STUDENT) return json(user(STUDENT_ID, "student"));
        return json({ code: 403, error_code: "bad_jwt", msg: "invalid JWT" }, 403);
      }
      if (url.pathname.startsWith("/auth/v1/token")) return json({ code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" }, 400);
      if (url.pathname.startsWith("/auth/v1/")) return json({}, 204);
      const rpc = /^\/rest\/v1\/rpc\/(\w+)/.exec(url.pathname);
      if (rpc) {
        if (rpc[1].startsWith("admin_") && bearer !== VALID_ADMIN) adminRpcCalls.push(rpc[1]);
        return json(null);
      }
      const table = /^\/rest\/v1\/(\w+)/.exec(url.pathname)?.[1];
      const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
      // Kötü senaryo: REST her token'a aktif admin profili döndürüyor.
      if (table === "admin_profiles") {
        const row = { user_id: ADMIN_ID, display_name: "QA Admin", role: "admin", active: true, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
        return json(single ? row : [row]);
      }
      if (table === "student_profiles" && bearer === VALID_STUDENT) {
        const row = { id: STUDENT_ID, full_name: "QA Öğrenci", email: "student@example.invalid", preferred_language: "tr", active: true, archived_at: null, onboarding_completed: true, exams_taken: [], target_exams: [], target_countries: [] };
        return json(single ? row : [row]);
      }
      if (single) return json({ code: "PGRST116", message: "no rows" }, 406);
      return json([]);
    });
    const page = await context.newPage();
    await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    const target = testCase.expect === "login" ? /\/tr\/giris\// : testCase.expect === "student" ? /\/tr\/hesabim\// : null;
    if (target) {
      await page.waitForURL(target, { timeout: 15000 }).catch(() => {});
    } else {
      await page.waitForSelector("#sb", { timeout: 15000 }).catch(() => {});
    }
    await page.waitForTimeout(400);
    const finalUrl = new URL(page.url());
    const adminSeen = await page.evaluate(() => window.__adminSeen === true);
    const label = `${testCase.name} ${route}`;
    if (testCase.expect === "admin") {
      check(finalUrl.pathname === route && adminSeen, `${label} → panel açıldı`);
    } else {
      check(target.test(finalUrl.pathname), `${label} → ${finalUrl.pathname}${finalUrl.search}`);
      check(!adminSeen, `${label} → admin içeriği hiç render edilmedi`);
      check(adminRpcCalls.length === 0, `${label} → admin RPC çağrısı yok (${adminRpcCalls.join(",") || "0"})`);
      if (testCase.expect === "login") check(finalUrl.searchParams.get("next") === route, `${label} → next=${route}`);
    }
    await context.close();
  }
}
await browser.close();
server.close();
console.log(failures === 0 ? "\nADMIN AUTH GUARD: PASS" : `\nADMIN AUTH GUARD: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
