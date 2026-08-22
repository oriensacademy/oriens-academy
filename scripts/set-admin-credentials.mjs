import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const ADMIN_EMAIL = "oriensacademy@gmail.com";
const ADMIN_PASSWORD = "v9@L2pR7!";

async function main() {
  console.log(`Setting admin credentials for ${ADMIN_EMAIL}...`);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. List users to check if user exists
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("List users error:", listError.message);
    return;
  }

  let user = usersData.users.find((u) => u.email === ADMIN_EMAIL);

  if (user) {
    console.log(`User found with ID: ${user.id}. Updating password and role...`);
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
      app_metadata: { role: "admin" },
      user_metadata: { display_name: "Oriens Academy Administrator", full_name: "Oriens Academy" },
    });
    if (updateError) {
      console.error("Update user error:", updateError.message);
      return;
    }
    user = updateData.user;
  } else {
    console.log(`User not found. Creating new admin user ${ADMIN_EMAIL}...`);
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      app_metadata: { role: "admin" },
      user_metadata: { display_name: "Oriens Academy Administrator", full_name: "Oriens Academy" },
    });
    if (createError) {
      console.error("Create user error:", createError.message);
      return;
    }
    user = createData.user;
  }

  console.log(`Auth user ID: ${user.id}`);

  // 2. Upsert admin profile
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

  if (profileError) {
    console.error("Admin profile upsert error:", profileError.message);
    return;
  }

  console.log("Admin profile verified in admin_profiles table.");

  // 3. Test sign in
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (signInError) {
    console.error("Sign in test failed:", signInError.message);
    return;
  }

  console.log("✅ Admin sign in test SUCCEEDED!");
  console.log(`Logged in User: ${signInData.user.email} (Role: ${signInData.user.app_metadata?.role})`);
}

main();
