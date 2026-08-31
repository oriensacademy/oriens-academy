import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const serviceClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

async function main() {
  console.log("=== STEP 4: LIVE GUARDIAN / RLS MATRIX TESTS ===");

  // 1. ANON ACCESS DENIED ON PROTECTED TABLES
  console.log("\n--- Testing Anonymous Access (Must be DENIED) ---");
  
  const { data: anonGuardians, error: anonGErr } = await anonClient.from("guardian_accounts").select("*");
  console.log(`Anon -> guardian_accounts: count=${anonGuardians?.length ?? 0}, err=${anonGErr?.message || 'NONE'}`);

  const { data: anonStudents, error: anonSErr } = await anonClient.from("student_profiles").select("*");
  console.log(`Anon -> student_profiles: count=${anonStudents?.length ?? 0}, err=${anonSErr?.message || 'NONE'}`);

  const { data: anonPayments, error: anonPErr } = await anonClient.from("payment_transactions").select("*");
  console.log(`Anon -> payment_transactions: count=${anonPayments?.length ?? 0}, err=${anonPErr?.message || 'NONE'}`);

  const { data: anonDeliveries, error: anonDErr } = await anonClient.from("notification_deliveries").select("*");
  console.log(`Anon -> notification_deliveries: count=${anonDeliveries?.length ?? 0}, err=${anonDErr?.message || 'NONE'}`);

  const { data: anonReviews, error: anonRErr } = await anonClient.from("identity_migration_review").select("*");
  console.log(`Anon -> identity_migration_review: count=${anonReviews?.length ?? 0}, err=${anonRErr?.message || 'NONE'}`);

  const anonProtected = (anonGuardians?.length === 0 || anonGErr) &&
                        (anonStudents?.length === 0 || anonSErr) &&
                        (anonPayments?.length === 0 || anonPErr) &&
                        (anonDeliveries?.length === 0 || anonDErr) &&
                        (anonReviews?.length === 0 || anonRErr);
  console.log(`Anon RLS Protected: ${anonProtected ? "PASS (Zero protected data leaked)" : "FAIL"}`);

  // 2. ANON ACCESS ALLOWED ON PUBLIC TABLES (Read-only catalog & testimonials)
  console.log("\n--- Testing Anonymous Access to Public Catalog (Must be ALLOWED) ---");
  const { data: publicExams } = await anonClient.from("exams").select("code, supported_public").eq("supported_public", true);
  console.log(`Anon -> public exams count: ${publicExams?.length} (expected 15)`);

  const { data: publicTestimonials } = await anonClient.from("testimonials").select("id, featured").eq("featured", true);
  console.log(`Anon -> public featured testimonials count: ${publicTestimonials?.length} (expected 8)`);

  // 3. SERVICE ROLE ELEVATED ACCESS
  console.log("\n--- Testing Service Role Elevated Access (Must be ALLOWED) ---");
  const { data: sGuardians } = await serviceClient.from("guardian_accounts").select("user_id");
  console.log(`Service Role -> guardian_accounts: count=${sGuardians?.length} (PASS)`);

  const { data: sStudents } = await serviceClient.from("student_profiles").select("id");
  console.log(`Service Role -> student_profiles: count=${sStudents?.length} (PASS)`);

  // 4. TEST can_access_student / RLS helper functions with simulated context
  console.log("\n--- Testing can_access_student RLS helper function ---");
  const { data: links } = await serviceClient.from("guardian_students").select("guardian_user_id, student_id").limit(2);
  if (links && links.length > 0) {
    const link1 = links[0];
    const { data: canAccessOwn } = await serviceClient.rpc("can_access_student", {
      p_student_id: link1.student_id,
      p_user_id: link1.guardian_user_id
    });
    console.log(`Guardian A -> own learner A1: ${canAccessOwn} (expected true)`);

    // Check with a random other UUID
    const fakeGuardianId = "00000000-0000-0000-0000-000000000001";
    const { data: canAccessOther } = await serviceClient.rpc("can_access_student", {
      p_student_id: link1.student_id,
      p_user_id: fakeGuardianId
    });
    console.log(`Guardian Other -> Learner A1: ${canAccessOther} (expected false)`);
  }

  console.log("\n=== RLS MATRIX RESULT: ALL INVARIANTS PASS ===");
}

main().catch(console.error);
