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
  auth: { persistSession: false }
});

async function main() {
  console.log("=== PRE-MIGRATION PRODUCTION SNAPSHOT ===");
  
  // 1. EXAMS
  const { data: exams, error: examsErr } = await supabase.from("exams").select("*");
  if (examsErr) console.error("Exams err:", examsErr);
  const totalExams = exams ? exams.length : 0;
  const supportedPublicExams = exams ? exams.filter(e => e.supported_public).length : 0;
  const lnatLsatGamsat = exams ? exams.filter(e => ["LNAT", "LSAT", "GAMSAT"].includes(e.code)) : [];

  const { count: activeQuestions, error: qErr } = await supabase
    .from("exam_practice_questions")
    .select("*", { count: "exact", head: true })
    .eq("active", true);

  const { count: totalAttempts, error: attErr } = await supabase
    .from("student_exam_attempts")
    .select("*", { count: "exact", head: true });

  console.log("EXAMS:");
  console.log(`- total: ${totalExams}`);
  console.log(`- supported_public: ${supportedPublicExams}`);
  console.log(`- active public practice questions: ${activeQuestions}`);
  console.log(`- LNAT/LSAT/GAMSAT rows: ${lnatLsatGamsat.length} (${lnatLsatGamsat.map(e => `${e.code}: supported_public=${e.supported_public}, active=${e.active}`).join(", ")})`);
  console.log(`- legacy attempts: ${totalAttempts}`);

  // 2. TESTIMONIALS
  const { data: testimonials, error: testErr } = await supabase.from("testimonials").select("*");
  if (testErr) console.error("Testimonials err:", testErr);
  const totalTestimonials = testimonials ? testimonials.length : 0;
  const activeTestimonials = testimonials ? testimonials.filter(t => t.active).length : 0;
  const verifiedTestimonials = testimonials ? testimonials.filter(t => t.verified).length : 0;
  const featuredTestimonials = testimonials ? testimonials.filter(t => t.featured).length : 0;
  const doguhanMatches = testimonials ? testimonials.filter(t => (t.student_name && /do[gğ]uhan/i.test(t.student_name)) || (t.quote && /do[gğ]uhan/i.test(t.quote)) || (t.content && /do[gğ]uhan/i.test(t.content))) : [];
  
  // Target 5 source_hash states
  const targetHashes = [
    "b8a7f1a9e5b7b1e2a8e8f2e2d9b6c4a1", // replace or check actual hashes if known, or inspect doguhan featured hashes
    "c5e3d7a9b1c2d3e4f5a6b7c8d9e0f1a2"
  ];
  const doguhanFeatured = doguhanMatches.filter(t => t.featured);

  console.log("\nTESTIMONIALS:");
  console.log(`- total: ${totalTestimonials}`);
  console.log(`- active: ${activeTestimonials}`);
  console.log(`- verified: ${verifiedTestimonials}`);
  console.log(`- featured: ${featuredTestimonials}`);
  console.log(`- Doğuhan/Doguhan matches: ${doguhanMatches.length}`);
  console.log(`- Doğuhan currently featured matches: ${doguhanFeatured.length} (${doguhanFeatured.map(t => `${t.id.slice(0,8)}:${t.source_hash}`).join(", ")})`);

  // 3. EGYPT
  const { data: egyCountry, error: egyErr } = await supabase.from("countries").select("*").eq("iso2", "EG");
  const { count: egyUniCount, error: egyUniErr } = await supabase
    .from("universities")
    .select("*", { count: "exact", head: true })
    .eq("country_iso2", "EG")
    .eq("active", true);

  console.log("\nEGYPT:");
  console.log(`- EGY country exists: ${egyCountry && egyCountry.length > 0 ? "YES" : "NO"} (${egyCountry ? JSON.stringify(egyCountry[0]?.name) : ""})`);
  console.log(`- Egypt active university count: ${egyUniCount}`);

  // 4. UNIVERSITIES
  const { count: totalUnis } = await supabase.from("universities").select("*", { count: "exact", head: true });
  const { count: eligibleUnis } = await supabase.from("universities").select("*", { count: "exact", head: true }).eq("eligibility_status", "eligible").eq("active", true);
  const { count: needsReviewUnis } = await supabase.from("universities").select("*", { count: "exact", head: true }).eq("eligibility_status", "needs_review").eq("active", true);
  const { count: ineligibleUnis } = await supabase.from("universities").select("*", { count: "exact", head: true }).eq("eligibility_status", "ineligible").eq("active", true);
  const { count: totalAliases } = await supabase.from("search_aliases").select("*", { count: "exact", head: true });
  
  let ledgerCount = 0;
  try {
    const { count: lCount, error: lErr } = await supabase.from("university_url_verifications").select("*", { count: "exact", head: true });
    if (!lErr) ledgerCount = lCount ?? 0;
  } catch (e) {
    ledgerCount = 0;
  }

  console.log("\nUNIVERSITIES:");
  console.log(`- total: ${totalUnis}`);
  console.log(`- active eligible: ${eligibleUnis}`);
  console.log(`- active needs_review: ${needsReviewUnis}`);
  console.log(`- active ineligible: ${ineligibleUnis}`);
  console.log(`- aliases: ${totalAliases}`);
  console.log(`- URL verification ledger rows: ${ledgerCount}`);

  // 5. IDENTITY / PAYMENT
  const { data: authUsersList, error: authUsersErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const totalAuthUsers = authUsersList?.users ? authUsersList.users.length : 0;
  
  const { count: totalProfiles } = await supabase.from("student_profiles").select("*", { count: "exact", head: true });
  const { count: totalPayments } = await supabase.from("payment_transactions").select("*", { count: "exact", head: true });
  const { count: totalPurchases } = await supabase.from("student_package_purchases").select("*", { count: "exact", head: true });

  const { data: adminProfiles } = await supabase.from("admin_profiles").select("id, email");
  const adminIds = adminProfiles ? adminProfiles.map(a => a.id) : [];

  let adminPayments = 0;
  let adminPurchases = 0;
  if (adminIds.length > 0) {
    const { data: payRows } = await supabase.from("payment_transactions").select("id, user_id").in("user_id", adminIds);
    adminPayments = payRows ? payRows.length : 0;
    const { data: purRows } = await supabase.from("student_package_purchases").select("id, student_id").in("student_id", adminIds);
    adminPurchases = purRows ? purRows.length : 0;
  }

  console.log("\nIDENTITY/PAYMENT:");
  console.log(`- auth users: ${totalAuthUsers}`);
  console.log(`- admins: ${adminProfiles?.length ?? 0}`);
  console.log(`- student_profiles: ${totalProfiles}`);
  console.log(`- payments: ${totalPayments}`);
  console.log(`- purchases: ${totalPurchases}`);
  console.log(`- admin-owned historical payments: ${adminPayments}`);
  console.log(`- admin-owned historical purchases: ${adminPurchases}`);

  // 6. NOTIFICATIONS
  const { count: notifCount } = await supabase.from("notification_deliveries").select("*", { count: "exact", head: true });
  console.log("\nNOTIFICATIONS:");
  console.log(`- notification_deliveries count: ${notifCount}`);
}

main().catch(console.error);
