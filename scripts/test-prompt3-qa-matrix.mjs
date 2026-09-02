import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();

console.log("=== PROMPT 3 COMPREHENSIVE QA MATRIX ===");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

// 1. Check StudentPortal.tsx for contact address removal
const studentPortalContent = readFileSync(resolve(root, "src/components/student/StudentPortal.tsx"), "utf8");
assert(!studentPortalContent.includes("İletişim Adresi"), "StudentPortal does not display 'İletişim Adresi'");
assert(!studentPortalContent.includes("Contact Address"), "StudentPortal does not display 'Contact Address'");
assert(!studentPortalContent.includes("E-posta değişikliği ayrı doğrulama gerektirir"), "Technical email verification explanation removed");
assert(!studentPortalContent.includes("Email changes require separate verification"), "EN email verification explanation removed");
assert(studentPortalContent.includes("getHumanPackageName"), "StudentPortal has getHumanPackageName helper");
assert(studentPortalContent.includes("10 Derslik Paket"), "StudentPortal contains 10 Derslik Paket humanization");
assert(studentPortalContent.includes("10-Lesson Package"), "StudentPortal contains 10-Lesson Package humanization");

// 2. Check PaymentPage.tsx for visual badge removal
const paymentPageContent = readFileSync(resolve(root, "src/components/payment/PaymentPage.tsx"), "utf8");
assert(!paymentPageContent.includes("{isTr ? \"Doğrulandı\" : \"Verified\"}"), "PaymentPage visual badge removed from email display");
assert(paymentPageContent.includes("emailVerified"), "PaymentPage still retains emailVerified logic");
assert(paymentPageContent.includes("requestPurchaseEmailVerification"), "PaymentPage still retains purchase OTP gate");

// 3. Check TestimonialsManager.tsx for counter copy
const testimonialsManagerContent = readFileSync(resolve(root, "src/components/admin/TestimonialsManager.tsx"), "utf8");
assert(testimonialsManagerContent.includes("Yayınlanan Yorumlar: {featuredCount}/20"), "TestimonialsManager displays 'Yayınlanan Yorumlar: {featuredCount}/20'");
assert(!testimonialsManagerContent.includes("Public ana sayfa seçimi:"), "Old counter copy completely removed");

// 4. Check payments.ts for is_archived filtering and mali akış logic
const paymentsTsContent = readFileSync(resolve(root, "src/lib/admin/payments.ts"), "utf8");
assert(paymentsTsContent.includes('.eq("is_archived", false)'), "listAdminPaymentsPaginated filters is_archived = false");
assert(paymentsTsContent.includes('row.payment_method === "bank_transfer"'), "Pending metric restricted to legitimate bank transfers");

// 5. Read .env.local for Supabase credentials and verify remote database
const envContent = readFileSync(resolve(root, ".env.local"), "utf8");
const envVars = Object.fromEntries(
  envContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && supabaseKey) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // A. Check payment_transactions archive state
  const { data: payRows, error: payErr } = await supabase
    .from("payment_transactions")
    .select("id, is_archived, status, payment_method");
  
  if (payErr) {
    assert(false, `Supabase payment_transactions query error: ${payErr.message}`);
  } else {
    const activeCount = payRows.filter((r) => r.is_archived === false).length;
    const archivedCount = payRows.filter((r) => r.is_archived === true).length;
    assert(archivedCount === 19, `Exact 19 historical transactions archived (got ${archivedCount})`);
    assert(activeCount === 0, `0 active historical transactions visible (got ${activeCount})`);
  }

  // B. Check student_package_purchases intact
  const { count: sppCount, error: sppErr } = await supabase
    .from("student_package_purchases")
    .select("*", { count: "exact", head: true });
  assert(!sppErr && sppCount >= 10, `student_package_purchases preserved intact (count: ${sppCount})`);

  // C. Check exact 20 featured testimonials
  const { data: featTestimonials, error: featErr } = await supabase
    .from("testimonials")
    .select("id, name, quote, active, verified, featured")
    .eq("featured", true);
  
  if (featErr) {
    assert(false, `Supabase testimonials query error: ${featErr.message}`);
  } else {
    assert(featTestimonials.length === 20, `Exact 20 testimonials featured (got ${featTestimonials.length})`);
    
    // Check teacher name safety
    const forbiddenPattern = /doğuhan|doguhan|doğukan|dogukan/i;
    let foundForbidden = false;
    for (const t of featTestimonials) {
      if (forbiddenPattern.test(t.name) || forbiddenPattern.test(t.quote)) {
        foundForbidden = true;
        console.error(`Forbidden name detected in testimonial ${t.id}: ${t.name}`);
      }
    }
    assert(!foundForbidden, "0 testimonials contain teacher names (Doğuhan/Doguhan/Doğukan/Dogukan)");
  }

  // D. Test get_public_testimonials_v2 RPC
  const { data: rpcData, error: rpcErr } = await supabase.rpc("get_public_testimonials_v2", {
    p_locale: null,
    p_limit: 20,
  });
  if (rpcErr) {
    assert(false, `get_public_testimonials_v2 RPC error: ${rpcErr.message}`);
  } else {
    assert(rpcData.length === 20, `RPC returns exactly 20 items (got ${rpcData.length})`);
    const allFeatured = rpcData.every((r) => r.featured === true);
    assert(allFeatured, "All items returned by RPC have featured === true");
  }
} else {
  console.warn("Supabase env credentials not fully found in .env.local, skipping DB queries");
}

console.log(`\nQA SUMMARY: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
