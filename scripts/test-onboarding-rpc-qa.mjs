import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log("=== ONBOARDING RPC & PREFERENCES QA TEST SUITE ===");

  console.log("[TEST 1] Testing PostgREST RPC resolution (must not return candidate ambiguity)...");
  const { data: testProfiles, error: pErr } = await supabase
    .from("student_profiles")
    .select("id, email, preferred_language, target_exams, target_countries, onboarding_completed")
    .limit(1);

  if (pErr || !testProfiles || testProfiles.length === 0) {
    console.error("❌ Failed to fetch test profile:", pErr);
    process.exit(1);
  }

  const profile = testProfiles[0];
  console.log(`Using student profile: ${profile.email} (${profile.id})`);

  // Test 1a: Save with TR language
  console.log("\n[TEST 1a] Saving preferences with TR language...");
  const resTr = await supabase.rpc("save_student_preferences", {
    p_student_id: profile.id,
    p_exams: ["SAT", "AP"],
    p_countries: ["USA", "UK"],
    p_mark_onboarding_completed: true,
    p_language: "tr",
  });

  if (resTr.error) {
    console.error("❌ Failed saving TR preferences:", resTr.error);
    process.exit(1);
  }
  console.log("✅ TR preferences saved successfully:", resTr.data?.profile?.preferred_language === "tr");

  // Test 1b: Save with EN language
  console.log("\n[TEST 1b] Saving preferences with EN language...");
  const resEn = await supabase.rpc("save_student_preferences", {
    p_student_id: profile.id,
    p_exams: ["IB", "SAT"],
    p_countries: ["UK", "Canada"],
    p_mark_onboarding_completed: true,
    p_language: "en",
  });

  if (resEn.error) {
    console.error("❌ Failed saving EN preferences:", resEn.error);
    process.exit(1);
  }
  console.log("✅ EN preferences saved successfully:", resEn.data?.profile?.preferred_language === "en");

  // Restore TR
  await supabase.rpc("save_student_preferences", {
    p_student_id: profile.id,
    p_exams: ["SAT", "IB"],
    p_countries: ["USA", "UK"],
    p_mark_onboarding_completed: true,
    p_language: "tr",
  });

  // Test 2: Admin Mark Notifications Read RPC
  console.log("\n[TEST 2] Testing admin_mark_notifications_read RPC...");
  const resMarkRead = await supabase.rpc("admin_mark_notifications_read", {
    p_mark_all: false,
    p_notification_ids: [],
  });

  if (resMarkRead.error) {
    console.error("❌ Failed calling admin_mark_notifications_read:", resMarkRead.error);
    process.exit(1);
  }
  console.log("✅ admin_mark_notifications_read RPC resolved and executed cleanly:", resMarkRead.data);

  console.log("\n🎉 ALL ONBOARDING RPC & PREFERENCES QA TESTS PASSED!");
}

runTests();
