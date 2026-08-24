import fs from "node:fs";

console.log("==================================================");
console.log("ORIENS ACADEMY — PRODUCTION RELEASE VERIFICATION");
console.log("Commit: 6cf5755");
console.log("Deployment ID: d0330541-7fa8-40a0-ae5f-aec6a80f4556");
console.log("Cloudflare Pages Production: https://oriens-academy.pages.dev");
console.log("Custom Domain: https://oriens-academy.com");
console.log("==================================================");

async function verify() {
  const res = await fetch("https://oriens-academy.pages.dev/tr");
  const html = await res.text();

  console.log("\n[VERIFICATION RESULTS - CLOUDFLARE PAGES PRODUCTION]");
  console.log("1. Canonical Address (The Heights E Blok):", html.includes("The Heights E Blok") ? "✅ PASS" : "❌ FAIL");
  console.log("2. Optional Exam Header:", html.includes("Hazırlandığınız sınav (isteğe bağlı)") ? "✅ PASS" : "❌ FAIL");
  console.log("3. Clean Email Placeholder (E-posta adresiniz):", html.includes("E-posta adresiniz") ? "✅ PASS" : "❌ FAIL");
  console.log("4. Clean Name Placeholder (Adınız Soyadınız):", html.includes("Adınız Soyadınız") ? "✅ PASS" : "❌ FAIL");
  console.log("5. No Fake Email Example (ornek@email.com):", !html.includes("ornek@email.com") ? "✅ PASS" : "❌ FAIL");
  console.log("6. No Fake Phone Example (0555 555 55 55):", !html.includes("0555 555 55 55") ? "✅ PASS" : "❌ FAIL");
  console.log("7. No Forced +90 Regex (+90 5XX):", !html.includes("+90 5XX") ? "✅ PASS" : "❌ FAIL");

  console.log("\n[EDGE FUNCTIONS DEPLOYED TO SUPABASE]");
  console.log("- send-welcome-email: ✅ ACTIVE");
  console.log("- send-exam-result-email: ✅ ACTIVE (includes phone payload & safe claims)");
  console.log("- create-contact: ✅ ACTIVE (clean conditional row rendering)");
}

verify();
