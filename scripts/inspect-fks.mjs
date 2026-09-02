import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function run() {
  // Let's test select from related tables to see what records exist
  const tables = [
    "student_profiles",
    "guardian_accounts",
    "guardian_students",
    "student_package_purchases",
    "student_package_adjustments",
    "payment_transactions",
    "student_lessons",
    "student_homework",
    "student_admin_notes",
    "student_exam_attempts",
    "bookings",
    "availability_slots",
    "notification_deliveries",
    "audit_logs"
  ];

  for (const t of tables) {
    const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
    if (error) console.log(`${t}: ERROR ${error.message}`);
    else console.log(`${t}: ${count} rows`);
  }
}

run().catch(console.error);
