import assert from "node:assert/strict";

console.log("==================================================");
console.log("   ORIENS ACADEMY — PRODUCTION LIVE VERIFICATION");
console.log("   TARGET: https://oriens-academy.com");
console.log("==================================================\n");

async function checkUrl(url, description) {
  console.log(`Checking ${description}: ${url}...`);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "OriensProductionVerification/1.0",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  console.log(`  -> Status: ${res.status} ${res.statusText}`);
  assert.ok(res.ok, `URL ${url} must return 200 OK`);
  const text = await res.text();
  assert.ok(text.length > 500, `URL ${url} response body must not be empty`);
  assert.ok(!text.includes("This page couldn’t load"), `URL ${url} must not show Next.js error page`);
  return text;
}

async function runVerification() {
  // 1. Check Primary Domain Home
  const homeTr = await checkUrl("https://oriens-academy.com/tr", "TR Homepage");
  assert.ok(homeTr.includes("Oriens"), "Homepage must contain brand name");

  const homeEn = await checkUrl("https://oriens-academy.com/en", "EN Homepage");
  assert.ok(homeEn.includes("Oriens"), "Homepage EN must contain brand name");

  // 2. Check Pricing Route
  const pricingTr = await checkUrl("https://oriens-academy.com/tr/ucretler", "TR Pricing Page");
  assert.ok(pricingTr.includes("Paket") || pricingTr.includes("Fiyatlandırma") || pricingTr.includes("Danışmanlık"), "Pricing page rendered");

  // 3. Check Cart Route
  const cartTr = await checkUrl("https://oriens-academy.com/tr/sepet", "TR Cart Page");
  assert.ok(cartTr.includes("Sepet") || cartTr.includes("Paket"), "Cart page rendered");

  // 4. Check Exam Hub
  const examsTr = await checkUrl("https://oriens-academy.com/tr/sinavlar", "TR Exams Hub");
  assert.ok(examsTr.includes("SAT") || examsTr.includes("AP") || examsTr.includes("IB"), "Exams hub contains exam keywords");

  // 5. Check University Support Hub
  const uniDestegi = await checkUrl("https://oriens-academy.com/tr/universite-destegi", "TR University Support Hub");
  assert.ok(uniDestegi.includes("Üniversite") || uniDestegi.includes("University"), "University hub rendered");

  // 6. Check Admin login page
  const adminLogin = await checkUrl("https://oriens-academy.com/admin/login", "Admin Login Page");
  assert.ok(adminLogin.includes("Admin") || adminLogin.includes("Yönetici") || adminLogin.includes("Giriş"), "Admin login rendered");

  // 7. Check Student Login page
  const studentLogin = await checkUrl("https://oriens-academy.com/tr/giris", "Student Login Page");
  assert.ok(studentLogin.includes("Giriş") || studentLogin.includes("Hesap") || studentLogin.includes("Öğrenci"), "Student login rendered");

  console.log("\n==================================================");
  console.log("   ALL PRODUCTION URL CHECKS PASSED WITH 200 OK!");
  console.log("==================================================");
}

runVerification().catch((err) => {
  console.error("Production verification failed:", err);
  process.exit(1);
});
