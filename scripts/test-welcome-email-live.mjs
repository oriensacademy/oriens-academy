import assert from "node:assert";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

console.log("==================================================");
console.log("ORIENS ACADEMY — WELCOME EMAIL LIVE ENDPOINT & IDEMPOTENCY QA");
console.log("==================================================");

let passed = 0;
let failed = 0;

function check(title, condition) {
  if (condition) {
    console.log(`✅ PASS: ${title}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${title}`);
    failed++;
  }
}

const projectRef = "mwbrlfmdpbkmdjroxhcc";
const projectUrl = `https://${projectRef}.supabase.co`;

const rawKeys = execSync(`npx supabase projects api-keys --project-ref ${projectRef}`, {
  encoding: "utf8",
  windowsHide: true,
});
const keysJson = JSON.parse(rawKeys.slice(rawKeys.indexOf("{"))).keys;
const anonKey = keysJson.find((k) => k.id === "anon")?.api_key;
const serviceKey = keysJson.find((k) => k.id === "service_role")?.api_key;
if (!anonKey || !serviceKey) throw new Error("API keys could not be retrieved.");

const supabaseAdmin = createClient(projectUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runLiveTest() {
  const testStudentId = `test-student-${crypto.randomUUID()}`;
  const testEmail = "info@oriens-academy.com"; // controlled safe email
  const testFullName = "Test Student QA";

  console.log(`\nTesting with synthetic student user ID: ${testStudentId}`);

  // Test 1: First invocation of send-welcome-email
  const res1 = await fetch(`${projectUrl}/functions/v1/send-welcome-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": anonKey,
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      studentUserId: testStudentId,
      email: testEmail,
      fullName: testFullName,
      locale: "tr",
    }),
  });

  const data1 = await res1.json();
  console.log("Response 1:", data1);
  check("First send-welcome-email call returned HTTP 200", res1.status === 200);
  check("First send-welcome-email succeeded", data1.success === true);

  // Test 2: Second invocation with the EXACT SAME student user ID (idempotency / duplicate test)
  const res2 = await fetch(`${projectUrl}/functions/v1/send-welcome-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": anonKey,
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      studentUserId: testStudentId,
      email: testEmail,
      fullName: testFullName,
      locale: "tr",
    }),
  });

  const data2 = await res2.json();
  console.log("Response 2 (Duplicate attempt):", data2);
  check("Duplicate send-welcome-email call returned HTTP 200", res2.status === 200);
  check("Duplicate send-welcome-email was SKIPPED with reason ALREADY_SENT",
    data2.success === true && data2.skipped === true && data2.reason === "ALREADY_SENT"
  );

  // Test 3: Verify notification_deliveries table record
  const { data: deliveries, error: delError } = await supabaseAdmin
    .from("notification_deliveries")
    .select("*")
    .eq("event_type", "student.welcome_email")
    .eq("entity_id", testStudentId);

  check("Database query succeeded", !delError && Array.isArray(deliveries));
  check("Exactly ONE delivery record logged in notification_deliveries", deliveries?.length === 1);
  if (deliveries && deliveries.length > 0) {
    const d = deliveries[0];
    check("Delivery event_type is 'student.welcome_email'", d.event_type === "student.welcome_email");
    check("Delivery provider is 'google_workspace'", d.provider === "google_workspace");
    check("Delivery recipient matches test email", d.recipient === testEmail);
  }

  // Cleanup synthetic test records
  await supabaseAdmin
    .from("notification_deliveries")
    .delete()
    .eq("event_type", "student.welcome_email")
    .eq("entity_id", testStudentId);

  console.log("\n==================================================");
  console.log(`LIVE QA RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
}

runLiveTest().catch((err) => {
  console.error("Live test failed:", err);
  process.exit(1);
});
