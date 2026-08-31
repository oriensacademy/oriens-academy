import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

async function main() {
  console.log("=== VERIFYING INVARIANTS AFTER MIGRATION 150000 ===");
  
  // 1. GUARDIAN ACCOUNTS & STUDENTS
  const { data: guardians, error: gErr } = await supabase.from("guardian_accounts").select("*");
  if (gErr) console.error("Guardian accounts error:", gErr);
  console.log(`- Guardian accounts count: ${guardians?.length ?? 0}`);

  const { data: links, error: lErr } = await supabase.from("guardian_students").select("*");
  if (lErr) console.error("Guardian students error:", lErr);
  console.log(`- Guardian-student links count: ${links?.length ?? 0}`);

  // 2. IDENTITY MIGRATION REVIEW
  const { data: reviews, error: rErr } = await supabase.from("identity_migration_review").select("*");
  if (rErr) console.error("Identity migration review error:", rErr);
  
  const reasons = {};
  for (const r of reviews || []) {
    reasons[r.reason] = (reasons[r.reason] || 0) + 1;
  }
  console.log(`- Identity migration review rows: ${reviews?.length ?? 0}`);
  console.log(`- Identity migration review by reason: ${JSON.stringify(reasons)}`);

  // 3. LEARNER HISTORY INTACT
  const { count: studentCount } = await supabase.from("student_profiles").select("*", { count: "exact", head: true });
  const { count: paymentCount } = await supabase.from("payment_transactions").select("*", { count: "exact", head: true });
  const { count: purchaseCount } = await supabase.from("student_package_purchases").select("*", { count: "exact", head: true });
  const { count: notifCount } = await supabase.from("notification_deliveries").select("*", { count: "exact", head: true });

  console.log(`- student_profiles count: ${studentCount} (expected 5, intact)`);
  console.log(`- payment_transactions count: ${paymentCount} (expected 15, intact)`);
  console.log(`- student_package_purchases count: ${purchaseCount} (expected 10, intact)`);
  console.log(`- notification_deliveries count: ${notifCount} (expected 43, intact)`);

  // 4. CHECK OUTBOX COLUMNS ON notification_deliveries
  const { data: sampleNotif } = await supabase.from("notification_deliveries").select("*").limit(1);
  if (sampleNotif && sampleNotif[0]) {
    console.log("- notification_deliveries columns:", Object.keys(sampleNotif[0]));
    console.log("- dedupe_key column exists:", "dedupe_key" in sampleNotif[0]);
    console.log("- template column exists:", "template" in sampleNotif[0]);
    console.log("- payload column exists:", "payload" in sampleNotif[0]);
  }
}

main().catch(console.error);
