import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const ADMIN_EMAIL = process.env.ORIENS_LOCAL_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ORIENS_LOCAL_ADMIN_PASSWORD;

if (!SUPABASE_SECRET_KEY?.startsWith("sb_secret_") || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error("Secure Supabase/admin environment variables are required.");
}

async function main() {
  console.log("Setting admin credentials from secure environment variables...");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  let user = usersData.users.find((candidate) => candidate.email === ADMIN_EMAIL);
  if (user) {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
      app_metadata: { role: "admin" },
      user_metadata: { display_name: "Oriens Academy Administrator", full_name: "Oriens Academy" },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      app_metadata: { role: "admin" },
      user_metadata: { display_name: "Oriens Academy Administrator", full_name: "Oriens Academy" },
    });
    if (error) throw error;
    user = data.user;
  }

  const { error: profileError } = await supabase.from("admin_profiles").upsert(
    {
      user_id: user.id,
      display_name: "Oriens Academy Administrator",
      role: "admin",
      active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (profileError) throw profileError;

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (signInError) throw signInError;

  console.log("Admin identity, profile, and sign-in verified.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Admin credential setup failed.");
  process.exitCode = 1;
});
