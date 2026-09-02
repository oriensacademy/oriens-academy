import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
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

const backupDir = "C:\\Users\\merto\\Desktop\\oriens-cikti\\pre-cleanup-backup";

async function main() {
  console.log("=== PRE-CLEANUP BACKUP STARTED ===");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`Created directory: ${backupDir}`);
  }

  // 1. Auth Users
  const { data: authUsersData, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) throw authErr;

  const sanitizedAuthUsers = (authUsersData.users || []).map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    role: u.role,
    user_metadata: u.user_metadata,
    app_metadata: u.app_metadata,
  }));
  fs.writeFileSync(
    path.join(backupDir, "auth_users_snapshot.json"),
    JSON.stringify(sanitizedAuthUsers, null, 2)
  );
  console.log(`- auth_users: ${sanitizedAuthUsers.length} rows saved`);

  // Tables to backup
  const tables = [
    "student_profiles",
    "guardian_accounts",
    "guardian_students",
    "student_package_purchases",
    "student_package_adjustments",
    "payment_transactions",
    "payment_refunds",
    "student_lessons",
    "student_homework",
    "student_admin_notes",
    "student_exam_attempts",
    "bookings",
    "availability_slots",
    "notification_deliveries",
    "audit_logs"
  ];

  const summary = {
    backup_timestamp: new Date().toISOString(),
    auth_users_count: sanitizedAuthUsers.length,
    tables: {},
  };

  for (const tableName of tables) {
    const { data, error, count } = await supabase
      .from(tableName)
      .select("*", { count: "exact" });

    if (error) {
      console.warn(`! Table ${tableName}: ${error.message}`);
      summary.tables[tableName] = { error: error.message };
    } else {
      fs.writeFileSync(
        path.join(backupDir, `${tableName}_snapshot.json`),
        JSON.stringify(data || [], null, 2)
      );
      summary.tables[tableName] = { count: count ?? (data?.length || 0) };
      console.log(`- ${tableName}: ${data?.length || 0} rows saved`);
    }
  }

  fs.writeFileSync(
    path.join(backupDir, "summary.json"),
    JSON.stringify(summary, null, 2)
  );
  console.log(`Backup completed successfully in: ${backupDir}`);
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
