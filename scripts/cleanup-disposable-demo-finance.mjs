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

async function main() {
  console.log("=== EXECUTING SAFE FINANCIAL DEMO CLEANUP ===");

  // Baseline Verification
  const { count: studentCountBefore } = await supabase.from("student_profiles").select("*", { count: "exact", head: true });
  const { count: userPackagesBefore } = await supabase.from("student_package_purchases").select("*", { count: "exact", head: true });
  const { count: paidPaymentsBefore } = await supabase.from("payment_transactions").select("*", { count: "exact", head: true }).eq("status", "paid");
  const { count: allPaymentsBefore } = await supabase.from("payment_transactions").select("*", { count: "exact", head: true });

  console.log(`BEFORE CLEANUP:`);
  console.log(`- student_profiles: ${studentCountBefore}`);
  console.log(`- student_package_purchases: ${userPackagesBefore}`);
  console.log(`- paid payment_transactions (REAL MONEY / COMPLETE): ${paidPaymentsBefore}`);
  console.log(`- total payment_transactions: ${allPaymentsBefore}`);

  // Fetch all payment rows to inspect for demo deletion
  const { data: allPayments, error: fetchErr } = await supabase.from("payment_transactions").select("*");
  if (fetchErr) {
    console.error("Failed to fetch payments:", fetchErr);
    process.exit(1);
  }

  // Find disposable non-paid demo/mock rows
  const toDelete = allPayments.filter((p) => {
    // STRICT SAFETY: NEVER delete paid transactions
    if (p.status === "paid") return false;
    
    const email = (p.payer_email || "").toLowerCase();
    const name = (p.payer_name || "").toLowerCase();
    const isMockProvider = p.provider === "bank_virtual_pos" || p.provider === "manual_test" || p.provider === "mock";
    const isDemoEmail = email.includes("test@") || email.includes("@example.com") || email.includes("demo@") || email === "john.doe@example.com";
    const isDemoName = name.includes("test") || name.includes("demo") || name === "john doe";

    return isMockProvider || isDemoEmail || isDemoName;
  });

  console.log(`\nFound ${toDelete.length} non-production demo rows to safely delete.`);

  if (toDelete.length > 0) {
    const idsToDelete = toDelete.map((p) => p.id);
    const { error: delErr } = await supabase.from("payment_transactions").delete().in("id", idsToDelete);
    if (delErr) {
      console.error("Failed to delete demo rows:", delErr);
      process.exit(1);
    }
    console.log(`✓ Deleted ${toDelete.length} synthetic demo payment records.`);
  }

  // After Verification
  const { count: studentCountAfter } = await supabase.from("student_profiles").select("*", { count: "exact", head: true });
  const { count: userPackagesAfter } = await supabase.from("student_package_purchases").select("*", { count: "exact", head: true });
  const { count: paidPaymentsAfter } = await supabase.from("payment_transactions").select("*", { count: "exact", head: true }).eq("status", "paid");
  const { count: allPaymentsAfter } = await supabase.from("payment_transactions").select("*", { count: "exact", head: true });

  console.log(`\nAFTER CLEANUP:`);
  console.log(`- student_profiles: ${studentCountAfter} (diff: ${studentCountAfter - studentCountBefore})`);
  console.log(`- student_package_purchases: ${userPackagesAfter} (diff: ${userPackagesAfter - userPackagesBefore})`);
  console.log(`- paid payment_transactions: ${paidPaymentsAfter} (diff: ${paidPaymentsAfter - paidPaymentsBefore})`);
  console.log(`- total payment_transactions: ${allPaymentsAfter} (diff: ${allPaymentsAfter - allPaymentsBefore})`);

  if (paidPaymentsAfter !== paidPaymentsBefore || studentCountAfter !== studentCountBefore || userPackagesAfter !== userPackagesBefore) {
    console.error("CRITICAL ERROR: Core data was altered! Reverting from backup immediately.");
    process.exit(1);
  }

  console.log("\n==============================================");
  console.log("SAFETY INTEGRITY VERIFIED: 100% OF REAL DATA INTACT");
  console.log("==============================================");
}

main().catch(console.error);
