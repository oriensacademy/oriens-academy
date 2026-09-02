import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

async function run() {
  console.log("=== PRE-FLIGHT READ-ONLY AUDIT ===");

  // 1. Auth users
  const { data: authUsers, error: aErr } = await supabase.auth.admin.listUsers();
  if (aErr) console.error("Error listing auth users:", aErr);
  else {
    console.log(`Total auth.users: ${authUsers.users.length}`);
    for (const u of authUsers.users) {
      console.log(`- User ID: ${u.id}, Email: ${u.email}, Created: ${u.created_at}, Role: ${u.role}, Metadata:`, u.user_metadata);
    }
  }

  // 2. Guardians
  const { data: guardians, error: gErr } = await supabase.from("guardian_accounts").select("*");
  console.log(`guardian_accounts: ${guardians?.length ?? 0}`);
  if (guardians) {
    for (const g of guardians) {
      console.log(`  - ID: ${g.id}, user_id: ${g.user_id}, Name: ${g.full_name}, Email: ${g.email}, Verified: ${g.email_verified_at}`);
    }
  }

  // 3. Student profiles
  const { data: students, error: sErr } = await supabase.from("student_profiles").select("*");
  console.log(`student_profiles: ${students?.length ?? 0}`);
  if (students) {
    for (const s of students) {
      console.log(`  - ID: ${s.id}, user_id: ${s.user_id}, Name: ${s.full_name}, Grade: ${s.grade_level}, Target: ${s.target_exam}`);
    }
  }

  // 4. Guardian students relation
  const { data: gs, error: gsErr } = await supabase.from("guardian_students").select("*");
  console.log(`guardian_students: ${gs?.length ?? 0}`);
  if (gs) {
    for (const item of gs) {
      console.log(`  - guardian_id: ${item.guardian_id}, student_id: ${item.student_id}, rel: ${item.relationship}`);
    }
  }

  // 5. student_package_purchases
  const { data: purchases, error: spErr } = await supabase.from("student_package_purchases").select("*");
  console.log(`student_package_purchases: ${purchases?.length ?? 0}`);

  // 6. payment_transactions
  const { data: payments, error: pErr } = await supabase.from("payment_transactions").select("*");
  console.log(`payment_transactions: ${payments?.length ?? 0}`);
  if (payments) {
    for (const p of payments) {
      console.log(`  - ID: ${p.id}, OID: ${p.merchant_oid}, Status: ${p.status}, Amount: ${p.amount}, is_preload: ${p.is_preload}, is_archived: ${p.is_archived}`);
    }
  }

  // 7. Check other tables related to lessons / appointments / completed lessons
  const tables = [
    "appointments",
    "lessons",
    "completed_lessons",
    "lesson_records",
    "student_exam_attempts",
    "student_notifications",
    "notification_outbox",
    "financial_ledger",
    "payment_adjustments",
    "refund_requests",
    "refunds",
    "package_lesson_adjustments"
  ];

  for (const t of tables) {
    try {
      const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
      if (error) {
        console.log(`Table ${t}: [does not exist or error: ${error.message}]`);
      } else {
        console.log(`Table ${t}: ${count} rows`);
      }
    } catch (e) {
      console.log(`Table ${t}: [exception: ${e.message}]`);
    }
  }
}

run().catch(console.error);
