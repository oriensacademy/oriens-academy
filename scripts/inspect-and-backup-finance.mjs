import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
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
  console.log("=== FINANCE AUDIT & BACKUP ===");
  
  // 1. Fetch count of core tables
  const { count: studentCount } = await supabase.from("student_profiles").select("*", { count: "exact", head: true });
  const { count: userPackagesCount } = await supabase.from("student_package_purchases").select("*", { count: "exact", head: true });
  const { count: paymentsCount } = await supabase.from("payment_transactions").select("*", { count: "exact", head: true });
  
  console.log(`Current counts:`);
  console.log(`- student_profiles: ${studentCount}`);
  console.log(`- student_package_purchases: ${userPackagesCount}`);
  console.log(`- payment_transactions: ${paymentsCount}`);

  // 2. Fetch all payment_transactions for backup
  const { data: allPayments, error: pErr } = await supabase
    .from("payment_transactions")
    .select("*")
    .order("created_at", { ascending: false });

  if (pErr) {
    console.error("Failed to fetch payments:", pErr);
    process.exit(1);
  }

  // Save backup to disk
  const backupPath = "scripts/backup_payment_transactions.json";
  fs.writeFileSync(backupPath, JSON.stringify(allPayments, null, 2));
  console.log(`Backup saved to ${backupPath} (${allPayments.length} rows)`);

  // Analyze payment rows
  console.log("\nSummary of payment statuses:");
  const statusMap = {};
  for (const p of allPayments) {
    const key = `${p.status} | provider: ${p.provider} | method: ${p.payment_method}`;
    statusMap[key] = (statusMap[key] || 0) + 1;
  }
  console.table(statusMap);

  // Check for test/demo/synthetic records
  const demoRows = allPayments.filter((p) => {
    const email = (p.payer_email || "").toLowerCase();
    const name = (p.payer_name || "").toLowerCase();
    const isMock = p.provider === "manual_test" || p.provider === "mock" || email.includes("test@") || email.includes("@example.com") || email.includes("demo@") || name.includes("test") || name.includes("demo");
    return isMock && p.status !== "paid";
  });

  console.log(`\nIdentified disposable test/demo entries: ${demoRows.length}`);
}

main().catch(console.error);
