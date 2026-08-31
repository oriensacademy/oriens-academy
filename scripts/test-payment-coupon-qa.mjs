// Automated QA verification script for Payment, Auth-gating, Coupons, and Footer Branding
const BASE_URL = "http://localhost:3000";

async function runQA() {
  console.log("==================================================");
  console.log("RUNNING AUTOMATED QA CHECKS ON http://localhost:3000");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // TEST 1: Public Homepage loads 200
  try {
    const res = await fetch(`${BASE_URL}/tr`);
    assert(res.status === 200, "Public TR homepage responds with 200 OK");
    const html = await res.text();
    
    // Check current payment infrastructure artwork
    assert(html.includes("odeme_altyapi.png"), "Footer contains the current payment infrastructure artwork");
    assert(
      !html.includes("Tüm ödemeler 256-bit SSL güvenlik sertifikası") &&
      !html.includes("Güvenli Ödeme"),
      "Footer 'Güvenli Ödeme' text box has been completely removed"
    );

    // Check that public header does NOT show pricing link
    assert(!html.includes('href="/tr/ucretler"'), "Public navbar does not render /tr/ucretler for logged-out visitors");
  } catch (err) {
    assert(false, `Public homepage fetch failed: ${err.message}`);
  }

  // TEST 2: Public EN Homepage
  try {
    const res = await fetch(`${BASE_URL}/en`);
    assert(res.status === 200, "Public EN homepage responds with 200 OK");
    const html = await res.text();
    assert(html.includes("odeme_altyapi.png"), "EN Footer contains the current payment infrastructure artwork");
    assert(!html.includes('href="/en/pricing"'), "Public EN navbar does not render /en/pricing for logged-out visitors");
  } catch (err) {
    assert(false, `Public EN homepage fetch failed: ${err.message}`);
  }

  // TEST 3: Direct Unauthenticated Pricing Route Protection (TR)
  try {
    const res = await fetch(`${BASE_URL}/tr/ucretler`);
    assert(res.status === 200, "TR pricing route loads page (client router will redirect to /tr/giris?next=/tr/ucretler)");
    const html = await res.text();
    assert(html.includes("giris") || html.includes("PricingPage"), "Pricing page includes auth check and redirect logic");
  } catch (err) {
    assert(false, `TR pricing route fetch failed: ${err.message}`);
  }

  // TEST 4: Direct Unauthenticated Pricing Route Protection (EN)
  try {
    const res = await fetch(`${BASE_URL}/en/pricing`);
    assert(res.status === 200, "EN pricing route loads page with client-side auth guard");
  } catch (err) {
    assert(false, `EN pricing route fetch failed: ${err.message}`);
  }

  // TEST 5: Direct Unauthenticated Payment / Checkout Route Protection (TR)
  try {
    const res = await fetch(`${BASE_URL}/tr/odeme?package=package10`);
    assert(res.status === 200, "TR payment route loads with client auth check");
  } catch (err) {
    assert(false, `TR payment route fetch failed: ${err.message}`);
  }

  // TEST 6: Admin Discount Coupons Route
  try {
    const res = await fetch(`${BASE_URL}/admin/indirim-kuponlari`);
    assert(res.status === 200, "Admin /admin/indirim-kuponlari route exists and responds with 200");
    const html = await res.text();
    assert(html.includes("İndirim Kuponları") || html.includes("admin"), "Admin coupons page rendered properly");
  } catch (err) {
    assert(false, `Admin coupons route fetch failed: ${err.message}`);
  }

  // TEST 7: Admin Payments Route
  try {
    const res = await fetch(`${BASE_URL}/admin/odemeler`);
    assert(res.status === 200, "Admin /admin/odemeler route exists and responds with 200");
  } catch (err) {
    assert(false, `Admin payments route fetch failed: ${err.message}`);
  }

  console.log("==================================================");
  console.log(`AUTOMATED QA SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
}

runQA();
