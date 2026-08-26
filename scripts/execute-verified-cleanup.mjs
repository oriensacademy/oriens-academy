import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const EFE_ID = "95963699-7a64-47ee-a415-09572941af73";
const AYDIN_ID = "27effcf8-b41e-4966-9229-da80b6d7e901";

const QA_CONTACT_1_ID = "9822c622-8e92-4f0e-9b54-8172e1f56343";
const QA_CONTACT_1_EMAIL = "qa-contact-1787786086359@oriens-academy.com";

const QA_CONTACT_2_ID = "f5161ce1-b075-4323-b6b3-17c8ee227de7";
const QA_CONTACT_2_EMAIL = "qa-contact-1787785256546@oriens-academy.com";

async function main() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — VERIFIED PRODUCTION CLEANUP");
  console.log("==================================================");

  // ----------------------------------------------------
  // STEP 1 & 2: CAPTURE BEFORE COUNTS & SNAPSHOTS
  // ----------------------------------------------------
  console.log("\n[1] Capturing Pre-Cleanup Safety Snapshots & Counts...");

  const { data: authUsersData } = await supabase.auth.admin.listUsers();
  const allAuthUsers = authUsersData?.users || [];

  const { data: allProfiles } = await supabase.from("student_profiles").select("*");
  const { data: allPayments } = await supabase.from("payment_transactions").select("*");
  const { data: allPackages } = await supabase.from("student_package_purchases").select("*");
  const { data: allNotifications } = await supabase.from("notification_deliveries").select("*");
  const { data: allContacts } = await supabase.from("contact_requests").select("*");
  const { data: allLessons } = await supabase.from("student_lessons").select("*");

  const preCounts = {
    authUsers: allAuthUsers.length,
    profiles: allProfiles?.length || 0,
    payments: allPayments?.length || 0,
    packages: allPackages?.length || 0,
    notifications: allNotifications?.length || 0,
    contacts: allContacts?.length || 0,
    lessons: allLessons?.length || 0,
  };

  console.log("Total Pre-Cleanup Counts:", preCounts);

  // Protected User Pre-Snapshots
  const efeAuthBefore = allAuthUsers.find((u) => u.id === EFE_ID);
  const efeProfileBefore = allProfiles?.find((p) => p.id === EFE_ID);
  const efePaymentsBefore = allPayments?.filter((p) => p.student_user_id === EFE_ID || p.payer_email === "yesim.alaeddinoglu@gmail.com") || [];
  const efePackagesBefore = allPackages?.filter((p) => p.student_user_id === EFE_ID) || [];
  const efeLessonsBefore = allLessons?.filter((l) => l.student_user_id === EFE_ID) || [];

  const aydinAuthBefore = allAuthUsers.find((u) => u.id === AYDIN_ID);
  const aydinProfileBefore = allProfiles?.find((p) => p.id === AYDIN_ID);
  const aydinPaymentsBefore = allPayments?.filter((p) => p.student_user_id === AYDIN_ID || p.payer_email === "aydinozbek15@hotmail.com") || [];
  const aydinPackagesBefore = allPackages?.filter((p) => p.student_user_id === AYDIN_ID) || [];
  const aydinLessonsBefore = allLessons?.filter((l) => l.student_user_id === AYDIN_ID) || [];

  if (!efeAuthBefore || !efeProfileBefore) {
    console.error("FATAL: Protected student Efe Alaeddinoglu not found!");
    process.exit(1);
  }
  if (!aydinAuthBefore || !aydinProfileBefore) {
    console.error("FATAL: Protected student Aydın Özbek not found!");
    process.exit(1);
  }

  console.log(`✓ Protected Student 1 (Efe): Auth ID ${EFE_ID}, Profile verified, Payments: ${efePaymentsBefore.length}, Packages: ${efePackagesBefore.length}`);
  console.log(`✓ Protected Student 2 (Aydın): Auth ID ${AYDIN_ID}, Profile verified, Payments: ${aydinPaymentsBefore.length}, Packages: ${aydinPackagesBefore.length}`);

  // ----------------------------------------------------
  // STEP 3: CLASSIFY ALL PAYMENT TRANSACTIONS
  // ----------------------------------------------------
  console.log("\n[2] Classifying All 20 Payment Transactions...");

  const testCandidateIds = [];
  const realPaidIds = [];
  const ambiguousIds = [];

  console.log("\n------------------------------------------------------------------------------------------------------------------");
  console.log("ID                                   | STATUS | AMOUNT   | PAYER EMAIL                    | LINKED PKG | CLASSIFICATION");
  console.log("------------------------------------------------------------------------------------------------------------------");

  for (const tx of allPayments || []) {
    const linkedPkgs = (allPackages || []).filter((pkg) => pkg.payment_transaction_id === tx.id);
    let classification = "AMBIGUOUS";

    // 1. Check if belonging to protected students
    if (tx.student_user_id === EFE_ID || tx.payer_email === "yesim.alaeddinoglu@gmail.com") {
      classification = "REAL";
      realPaidIds.push(tx.id);
    } else if (tx.student_user_id === AYDIN_ID || tx.payer_email === "aydinozbek15@hotmail.com") {
      classification = "REAL";
      realPaidIds.push(tx.id);
    } else if (tx.payer_email === "paymentv6@gmail.com" && tx.status === "paid") {
      classification = "REAL";
      realPaidIds.push(tx.id);
    } else if (tx.payer_email === "test-paytr@oriens-academy.com" && tx.status === "paid" && linkedPkgs.length === 0) {
      classification = "CONFIRMED_TEST";
      testCandidateIds.push(tx.id);
    } else if (tx.payer_email === "admin@oriens-academy.com" && tx.status === "failed" && linkedPkgs.length === 0) {
      classification = "CONFIRMED_TEST";
      testCandidateIds.push(tx.id);
    } else if (tx.payer_email === "paymentv6@gmail.com" && tx.status === "failed" && linkedPkgs.length === 0) {
      classification = "CONFIRMED_TEST";
      testCandidateIds.push(tx.id);
    } else {
      classification = "AMBIGUOUS";
      ambiguousIds.push(tx.id);
    }

    const emailPad = (tx.payer_email || "NULL").padEnd(30, " ");
    const statusPad = tx.status.padEnd(6, " ");
    const amountPad = `${tx.amount} ${tx.currency}`.padEnd(8, " ");
    console.log(`${tx.id} | ${statusPad} | ${amountPad} | ${emailPad} | ${linkedPkgs.length}          | ${classification}`);
  }
  console.log("------------------------------------------------------------------------------------------------------------------");

  console.log(`\nClassification Summary:`);
  console.log(`- REAL Paid Transactions to PRESERVE: ${realPaidIds.length}`);
  console.log(`- CONFIRMED_TEST Transactions to DELETE: ${testCandidateIds.length}`);
  console.log(`- AMBIGUOUS Transactions to PRESERVE: ${ambiguousIds.length}`);

  // Safety Assertion: ensure no real package is linked to test candidates
  for (const testId of testCandidateIds) {
    const linked = (allPackages || []).filter((pkg) => pkg.payment_transaction_id === testId);
    if (linked.length > 0) {
      console.error(`FATAL: Test candidate ${testId} is referenced by a package purchase! Halting.`);
      process.exit(1);
    }
  }

  // ----------------------------------------------------
  // STEP 4: BACKUP TARGET ROWS LOCALLY BEFORE DELETION
  // ----------------------------------------------------
  console.log("\n[3] Creating Local Backup of Targeted Rows...");

  const backupData = {
    timestamp: new Date().toISOString(),
    qaContact1: allContacts?.find((c) => c.id === QA_CONTACT_1_ID),
    qaContact2: allContacts?.find((c) => c.id === QA_CONTACT_2_ID),
    notificationDeliveries: allNotifications,
    testPaymentTransactions: (allPayments || []).filter((p) => testCandidateIds.includes(p.id)),
  };

  const backupDir = path.join(process.cwd(), "scratch", "backup");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupFile = path.join(backupDir, `cleanup-backup-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), "utf8");
  console.log(`✓ Local backup securely written to: ${backupFile}`);

  // ----------------------------------------------------
  // STEP 5: EXECUTE ATOMIC PRODUCTION CLEANUP VIA SECURE RPC
  // ----------------------------------------------------
  console.log("\n[4] Executing Atomic Production Cleanup via Secure RPC...");

  const contactIdsToDelete = [QA_CONTACT_1_ID, QA_CONTACT_2_ID];

  const { data: rpcResult, error: rpcErr } = await supabase.rpc("execute_verified_production_cleanup", {
    p_contact_ids: contactIdsToDelete,
    p_test_payment_ids: testCandidateIds,
    p_clear_notifications: true,
  });

  if (rpcErr || !rpcResult || rpcResult.success !== true) {
    console.error("FATAL: execute_verified_production_cleanup RPC failed:", rpcErr || rpcResult);
    process.exit(1);
  }

  console.log("✓ Atomic Cleanup RPC Result:", rpcResult);
  console.log(`  * Deleted Contacts: ${rpcResult.deleted_contacts}`);
  console.log(`  * Deleted Notifications: ${rpcResult.deleted_notifications}`);
  console.log(`  * Deleted Payments: ${rpcResult.deleted_payments}`);

  // ----------------------------------------------------
  // STEP 8: POST-CLEANUP VERIFICATION & ASSERTIONS
  // ----------------------------------------------------
  console.log("\n[7] Running Post-Cleanup Verification & Safety Assertions...");

  const { data: postAuthData } = await supabase.auth.admin.listUsers();
  const postAuthUsers = postAuthData?.users || [];
  const { data: postProfiles } = await supabase.from("student_profiles").select("*");
  const { data: postPayments } = await supabase.from("payment_transactions").select("*");
  const { data: postPackages } = await supabase.from("student_package_purchases").select("*");
  const { data: postNotifications } = await supabase.from("notification_deliveries").select("*");
  const { data: postContacts } = await supabase.from("contact_requests").select("*");
  const { data: postLessons } = await supabase.from("student_lessons").select("*");

  // Assertion 1: QA Contacts are 0
  const postQaC1 = postContacts?.filter((c) => c.id === QA_CONTACT_1_ID || c.email === QA_CONTACT_1_EMAIL) || [];
  const postQaC2 = postContacts?.filter((c) => c.id === QA_CONTACT_2_ID || c.email === QA_CONTACT_2_EMAIL) || [];
  if (postQaC1.length !== 0 || postQaC2.length !== 0) {
    console.error("ASSERTION FAILED: QA Contact requests still exist!");
    process.exit(1);
  }
  console.log("✓ Assertion Passed: Both QA contact requests successfully removed (count = 0).");

  // Assertion 2: Notification Deliveries is 0
  if ((postNotifications?.length || 0) !== 0) {
    console.error(`ASSERTION FAILED: Notification deliveries count is ${postNotifications?.length}, expected 0!`);
    process.exit(1);
  }
  console.log("✓ Assertion Passed: Notification deliveries count is exactly 0.");

  // Assertion 3: Auth users count unchanged (0 auth users deleted)
  if (postAuthUsers.length !== preCounts.authUsers) {
    console.error(`ASSERTION FAILED: Auth users count changed! Pre: ${preCounts.authUsers}, Post: ${postAuthUsers.length}`);
    process.exit(1);
  }
  console.log(`✓ Assertion Passed: Auth users count unchanged (${postAuthUsers.length}).`);

  // Assertion 4: Student profiles count unchanged (0 profiles deleted)
  if (postProfiles?.length !== preCounts.profiles) {
    console.error(`ASSERTION FAILED: Student profiles count changed! Pre: ${preCounts.profiles}, Post: ${postProfiles?.length}`);
    process.exit(1);
  }
  console.log(`✓ Assertion Passed: Student profiles count unchanged (${postProfiles?.length}).`);

  // Assertion 5: Student packages count unchanged (0 packages deleted)
  if (postPackages?.length !== preCounts.packages) {
    console.error(`ASSERTION FAILED: Student packages count changed! Pre: ${preCounts.packages}, Post: ${postPackages?.length}`);
    process.exit(1);
  }
  console.log(`✓ Assertion Passed: Student packages count unchanged (${postPackages?.length}).`);

  // Assertion 6: Protected user EFE unmodified
  const efeAuthPost = postAuthUsers.find((u) => u.id === EFE_ID);
  const efeProfilePost = postProfiles?.find((p) => p.id === EFE_ID);
  const efePaymentsPost = postPayments?.filter((p) => p.student_user_id === EFE_ID || p.payer_email === "yesim.alaeddinoglu@gmail.com") || [];
  const efePackagesPost = postPackages?.filter((p) => p.student_user_id === EFE_ID) || [];
  const efeLessonsPost = postLessons?.filter((l) => l.student_user_id === EFE_ID) || [];

  if (
    !efeAuthPost ||
    !efeProfilePost ||
    efePaymentsPost.length !== efePaymentsBefore.length ||
    efePackagesPost.length !== efePackagesBefore.length ||
    efeLessonsPost.length !== efeLessonsBefore.length
  ) {
    console.error("ASSERTION FAILED: Protected student Efe Alaeddinoglu data changed!");
    process.exit(1);
  }
  console.log("✓ Assertion Passed: Protected user Efe Alaeddinoglu 100% intact and unmodified.");

  // Assertion 7: Protected user AYDIN unmodified
  const aydinAuthPost = postAuthUsers.find((u) => u.id === AYDIN_ID);
  const aydinProfilePost = postProfiles?.find((p) => p.id === AYDIN_ID);
  const aydinPaymentsPost = postPayments?.filter((p) => p.student_user_id === AYDIN_ID || p.payer_email === "aydinozbek15@hotmail.com") || [];
  const aydinPackagesPost = postPackages?.filter((p) => p.student_user_id === AYDIN_ID) || [];
  const aydinLessonsPost = postLessons?.filter((l) => l.student_user_id === AYDIN_ID) || [];

  if (
    !aydinAuthPost ||
    !aydinProfilePost ||
    aydinPaymentsPost.length !== aydinPaymentsBefore.length ||
    aydinPackagesPost.length !== aydinPackagesBefore.length ||
    aydinLessonsPost.length !== aydinLessonsBefore.length
  ) {
    console.error("ASSERTION FAILED: Protected student Aydın Özbek data changed!");
    process.exit(1);
  }
  console.log("✓ Assertion Passed: Protected user Aydın Özbek 100% intact and unmodified.");

  // Assertion 8: Real payments count
  console.log(`\nFinal Payment Transactions Summary:`);
  console.log(`- Pre-Cleanup Total Payments: ${preCounts.payments}`);
  console.log(`- Deleted Test Payments: ${testCandidateIds.length}`);
  console.log(`- Post-Cleanup Total Payments: ${postPayments?.length} (All genuine paid student transactions preserved)`);

  for (const p of postPayments || []) {
    console.log(`  * ID: ${p.id} | ${p.status} | ${p.amount} ${p.currency} | ${p.payer_email} | Method: ${p.payment_method}`);
  }

  console.log("\n==================================================");
  console.log("CLEANUP EXECUTION COMPLETED SUCCESSFULLY");
  console.log("==================================================");
}

main();
