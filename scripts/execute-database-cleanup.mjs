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

const PROTECTED_ADMIN_EMAILS = [
  "admin@oriens-academy.com",
  "oriensacademy@gmail.com",
];

async function main() {
  console.log("=== EXECUTING ATOMIC CLEANUP VIA RPC ===");

  const { data: rpcResult, error: rpcErr } = await supabase.rpc("admin_cleanup_all_students_and_payments");
  if (rpcErr) {
    console.error("Cleanup RPC failed:", rpcErr);
    process.exit(1);
  }
  console.log("Cleanup RPC output:", rpcResult);

  // Clean non-admin auth users if any remain
  console.log("\nChecking auth users...");
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) throw authErr;

  for (const user of authData.users) {
    const email = (user.email || "").toLowerCase().trim();
    if (PROTECTED_ADMIN_EMAILS.includes(email)) {
      console.log(`  -> PROTECTED ADMIN USER: ${email} (ID: ${user.id})`);
    } else {
      console.log(`  -> Deleting remaining non-admin auth user: ${email} (ID: ${user.id})`);
      await supabase.auth.admin.deleteUser(user.id);
    }
  }

  // Verification
  console.log("\n=== POST-CLEANUP FINAL VERIFICATION ===");
  const { count: finalStudentCount } = await supabase.from("student_profiles").select("*", { count: "exact", head: true });
  const { count: finalGuardianCount } = await supabase.from("guardian_accounts").select("*", { count: "exact", head: true });
  const { count: finalPurchasesCount } = await supabase.from("student_package_purchases").select("*", { count: "exact", head: true });
  const { count: finalPaymentsCount } = await supabase.from("payment_transactions").select("*", { count: "exact", head: true });
  const { count: finalNotesCount } = await supabase.from("student_admin_notes").select("*", { count: "exact", head: true });
  const { count: finalAttemptsCount } = await supabase.from("student_exam_attempts").select("*", { count: "exact", head: true });
  const { count: finalBookingsCount } = await supabase.from("bookings").select("*", { count: "exact", head: true });
  const { count: finalPackagesCount } = await supabase.from("pricing_packages").select("*", { count: "exact", head: true });
  const { data: finalAdmins } = await supabase.from("admin_profiles").select("*");
  const { data: finalAuthUsers } = await supabase.auth.admin.listUsers();

  console.log(`student_profiles: ${finalStudentCount} (Expected: 0)`);
  console.log(`guardian_accounts: ${finalGuardianCount} (Expected: 0)`);
  console.log(`student_package_purchases: ${finalPurchasesCount} (Expected: 0)`);
  console.log(`payment_transactions: ${finalPaymentsCount} (Expected: 0)`);
  console.log(`student_admin_notes: ${finalNotesCount} (Expected: 0)`);
  console.log(`student_exam_attempts: ${finalAttemptsCount} (Expected: 0)`);
  console.log(`bookings: ${finalBookingsCount} (Expected: 0)`);
  console.log(`pricing_packages (untouched catalog): ${finalPackagesCount} rows`);
  console.log(`admin_profiles: ${finalAdmins?.length} (Expected: 1)`);
  console.log(`auth.users remaining: ${finalAuthUsers.users.length} (Expected: 2 protected admin accounts)`);
  for (const u of finalAuthUsers.users) {
    console.log(`- Admin account: ${u.email} (ID: ${u.id})`);
  }

  const allZero =
    finalStudentCount === 0 &&
    finalGuardianCount === 0 &&
    finalPurchasesCount === 0 &&
    finalPaymentsCount === 0 &&
    finalNotesCount === 0 &&
    finalAttemptsCount === 0 &&
    finalBookingsCount === 0;

  if (allZero && finalAdmins && finalAdmins.length > 0 && finalPackagesCount > 0) {
    console.log("\n>>> SUCCESS: ALL STUDENT & PAYMENT RECORDS ARE EXACTLY 0. PRICING & ADMIN PRESERVED! <<<");
  } else {
    console.warn("\n>>> WARNING: Check verification output above. <<<");
  }
}

main().catch(console.error);
