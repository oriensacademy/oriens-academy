import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

// We need service key to update site_settings
import { execSync } from "node:child_process";
const PROJECT_REF = "mwbrlfmdpbkmdjroxhcc";
const rawKeys = execSync(`npx supabase projects api-keys --project-ref ${PROJECT_REF}`, {
  encoding: "utf8",
  windowsHide: true,
});
const keysJson = JSON.parse(rawKeys.slice(rawKeys.indexOf("{"))).keys;
const serviceKey = keysJson.find((k) => k.id === "service_role")?.api_key;

const adminSupabase = createClient(supabaseUrl, serviceKey);
const publicSupabase = createClient(supabaseUrl, supabaseAnonKey);

async function testPricingToggle() {
  console.log("=== TESTING RUNTIME PRICING TOGGLE ON PRODUCTION DB ===");

  // 1. Set to OFF (false)
  console.log("\n1. Setting navigation.show_pricing = false...");
  const { error: offErr } = await adminSupabase
    .from("site_settings")
    .upsert({
      key: "navigation.show_pricing",
      value: false,
      is_public: true,
    }, { onConflict: "key" });

  assert.ifError(offErr);

  // Read via public client
  const { data: publicOffData } = await publicSupabase
    .from("site_settings")
    .select("value")
    .eq("key", "navigation.show_pricing")
    .eq("is_public", true)
    .single();

  console.log("   Public read when OFF:", publicOffData?.value);
  assert.strictEqual(publicOffData?.value, false, "Public client must see false when OFF");

  // 2. Set to ON (true)
  console.log("\n2. Setting navigation.show_pricing = true...");
  const { error: onErr } = await adminSupabase
    .from("site_settings")
    .upsert({
      key: "navigation.show_pricing",
      value: true,
      is_public: true,
    }, { onConflict: "key" });

  assert.ifError(onErr);

  // Read via public client
  const { data: publicOnData } = await publicSupabase
    .from("site_settings")
    .select("value")
    .eq("key", "navigation.show_pricing")
    .eq("is_public", true)
    .single();

  console.log("   Public read when ON:", publicOnData?.value);
  assert.strictEqual(publicOnData?.value, true, "Public client must see true when ON");

  console.log("\n=== RUNTIME PRICING TOGGLE VERIFIED SUCCESSFULLY ===");
}

testPricingToggle().catch((err) => {
  console.error("Pricing toggle test failed:", err);
  process.exit(1);
});
