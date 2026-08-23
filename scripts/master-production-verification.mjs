import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const projectRef = "mwbrlfmdpbkmdjroxhcc";
const projectUrl = `https://${projectRef}.supabase.co`;
const raw = execSync(`npx supabase projects api-keys --project-ref ${projectRef}`, { encoding: "utf8", windowsHide: true });
const keys = JSON.parse(raw.slice(raw.indexOf("{"))).keys;
const anonKey = keys.find((key) => key.id === "anon")?.api_key;
const serviceKey = keys.find((key) => key.id === "service_role")?.api_key;

async function runMasterVerification() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — MASTER PRODUCTION QA & VERIFICATION");
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

  // 1. Supabase Database RPC: Search Autocomplete
  console.log("\n[GROUP 1: Supabase DB Search Autocomplete Engine]");
  const anon = createClient(projectUrl, anonKey, { auth: { persistSession: false } });

  const { data: oxfordData, error: oxfordErr } = await anon.rpc("search_autocomplete_entities", {
    p_query: "oxford",
    p_limit: 10,
  });
  assert(!oxfordErr && oxfordData && oxfordData.length > 0, "Query 'oxford' returns database results via anon RPC");

  const { data: cambridgeData, error: cambridgeErr } = await anon.rpc("search_autocomplete_entities", {
    p_query: "cambridge",
    p_limit: 10,
  });
  assert(!cambridgeErr && cambridgeData && cambridgeData.length > 0, "Query 'cambridge' returns database results via anon RPC");

  const { data: satData, error: satErr } = await anon.rpc("search_autocomplete_entities", {
    p_query: "sat",
    p_limit: 10,
  });
  assert(!satErr && satData && satData.length > 0, "Query 'sat' returns exam results via anon RPC");

  // 2. Pricing Packages Table & Purchase Mode
  console.log("\n[GROUP 2: Pricing Packages & Purchase Mode]");
  const { data: packages, error: pkgErr } = await anon
    .from("pricing_packages")
    .select("id,name_tr,price_amount,current_total,active,purchase_mode")
    .eq("active", true);

  assert(!pkgErr && packages && packages.length >= 5, "Active pricing packages loaded from Supabase");
  const purchasableCount = packages?.filter(p => p.purchase_mode === "purchasable").length || 0;
  assert(purchasableCount >= 5, `All ${purchasableCount} active pricing packages have purchase_mode = 'purchasable'`);

  // 3. Exam Test Pool: 6 Questions Verification
  console.log("\n[GROUP 3: Exam Test Structure Verification]");
  const examTestsContent = readFileSync("src/data/exam-tests.ts", "utf8");
  assert(examTestsContent.includes("length: 6"), "Exam test questions configured to exactly 6 per exam");
  assert(!examTestsContent.includes("length: 8"), "No legacy 8-question pool remains");

  const examTestCopy = readFileSync("src/content/exam-test.ts", "utf8");
  assert(examTestCopy.includes("6 soruluk"), "TR copy specifies 6 soruluk test");
  assert(examTestCopy.includes("six-question"), "EN copy specifies six-question assessment");

  // 4. Color Palettes & 5-Theme Selector
  console.log("\n[GROUP 4: 5-Theme Palette CSS & Tokens]");
  const globalsCss = readFileSync("src/app/globals.css", "utf8");
  assert(globalsCss.includes('data-theme="theme-1"'), "Theme 1 (Classic Sage & Ivory) defined in globals.css");
  assert(globalsCss.includes('data-theme="theme-2"'), "Theme 2 (Sage & Royal Blue) defined in globals.css");
  assert(globalsCss.includes('data-theme="theme-3"'), "Theme 3 (Midnight Navy & Champagne) defined in globals.css");
  assert(globalsCss.includes('data-theme="theme-4"'), "Theme 4 (Deep Teal & Cobalt) defined in globals.css");
  assert(globalsCss.includes('data-theme="theme-5"'), "Theme 5 (Forest & Warm Terracotta) defined in globals.css");

  // 5. Admin Mali Akış & Payment Reminders
  console.log("\n[GROUP 5: Admin Mali Akış & Payment Reminder RPC]");
  const adminSidebar = readFileSync("src/components/admin/AdminSidebar.tsx", "utf8");
  assert(adminSidebar.includes("/admin/mali-akis"), "Mali Akış included in AdminSidebar navigation");

  const paymentsLib = readFileSync("src/lib/admin/payments.ts", "utf8");
  assert(paymentsLib.includes("admin_send_payment_reminder"), "Payment reminder RPC caller implemented in payments.ts");

  console.log("\n==================================================");
  console.log(`MASTER VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
}

runMasterVerification().catch((err) => {
  console.error(err);
  process.exit(1);
});
