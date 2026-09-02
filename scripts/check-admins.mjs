import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function run() {
  const { data: admins } = await supabase.from("admin_profiles").select("*");
  console.log("admin_profiles rows:", admins);

  const { data: appUsers } = await supabase.auth.admin.listUsers();
  console.log("\nAll auth users:");
  for (const u of appUsers.users) {
    const isAdmin = admins?.some(a => a.user_id === u.id);
    console.log(`- ID: ${u.id}, Email: ${u.email}, isAdminProfile: ${isAdmin}`);
  }
}

run().catch(console.error);
