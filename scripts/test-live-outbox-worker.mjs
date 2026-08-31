import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

async function main() {
  console.log("=== STEP 10: TESTING NOTIFICATION OUTBOX WORKER ON PRODUCTION ===");

  const fnUrl = `${supabaseUrl}/functions/v1/process-notification-outbox`;

  // 1. TEST UNAUTHORIZED INVOCATION (Must be 403 Forbidden)
  console.log("\n--- Testing Unauthenticated Access ---");
  const resAnon = await fetch(fnUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  console.log(`Unauthenticated call: status=${resAnon.status} (expected 403)`);

  const resWrongToken = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anonKey}`
    }
  });
  console.log(`Anon token call: status=${resWrongToken.status} (expected 403)`);

  // 2. TEST AUTHORIZED INVOCATION WITH SERVICE ROLE KEY
  console.log("\n--- Testing Authorized Service Role Invocation ---");
  const resAuth = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`
    }
  });
  const dataAuth = await resAuth.json();
  console.log(`Authorized call: status=${resAuth.status}, response=`, dataAuth);

  // 3. TEST OUTBOX IDEMPOTENCY / DEDUPE BEHAVIOR
  console.log("\n--- Testing Outbox Dedupe / Transaction Isolation ---");
  const testDedupeKey = `qa-release-test:${Date.now()}`;
  
  const { data: insertRow, error: insertErr } = await supabase.from("notification_deliveries").insert({
    channel: "email",
    event_type: "qa.test.outbox",
    entity_type: "qa_test",
    entity_id: "00000000-0000-0000-0000-000000000000",
    recipient: "admin@oriens-academy.com",
    status: "pending",
    template: "payment_success_admin",
    payload: {
      locale: "tr",
      reference: "QA-TEST-001",
      payer_name: "QA Release Test",
      payer_email: "admin@oriens-academy.com",
      package_id: "test-package",
      amount: 100,
      currency: "TRY"
    },
    dedupe_key: testDedupeKey
  }).select().single();

  console.log(`Inserted test outbox item with dedupe_key=${testDedupeKey}:`, insertRow ? `ID=${insertRow.id}` : `Error=${insertErr?.message}`);

  // Test duplicate dedupe key rejection
  const { error: dupErr } = await supabase.from("notification_deliveries").insert({
    channel: "email",
    event_type: "qa.test.outbox",
    entity_type: "qa_test",
    entity_id: "00000000-0000-0000-0000-000000000000",
    recipient: "admin@oriens-academy.com",
    status: "pending",
    template: "payment_success_admin",
    payload: { reference: "QA-TEST-002" },
    dedupe_key: testDedupeKey
  });
  console.log(`Duplicate dedupe key rejected by constraint: ${dupErr ? "PASS (Unique constraint rejected duplicate)" : "FAIL"}`);

  // Process outbox with worker
  console.log("\n--- Running Worker to Claim and Process Outbox item ---");
  const resProcess = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`
    }
  });
  const dataProcess = await resProcess.json();
  console.log("Worker execution response:", dataProcess);

  // Check state of our test outbox item
  if (insertRow?.id) {
    const { data: updatedItem } = await supabase
      .from("notification_deliveries")
      .select("id, status, attempt_count, last_error_code, last_error, sent_at")
      .eq("id", insertRow.id)
      .single();
    console.log(`Test outbox item processed state: status=${updatedItem?.status}, attempt_count=${updatedItem?.attempt_count}, sent_at=${updatedItem?.sent_at}, error=${updatedItem?.last_error_code || 'NONE'}`);
  }
}

main().catch(console.error);
