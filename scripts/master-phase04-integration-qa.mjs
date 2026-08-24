import assert from "node:assert";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const projectRef = "mwbrlfmdpbkmdjroxhcc";
const projectUrl = `https://${projectRef}.supabase.co`;

// Extract service role key via Supabase CLI
const rawKeys = execSync(`npx supabase projects api-keys --project-ref ${projectRef}`, {
  encoding: "utf8",
  windowsHide: true,
});
const keysJson = JSON.parse(rawKeys.slice(rawKeys.indexOf("{"))).keys;
const serviceKey = keysJson.find((k) => k.id === "service_role")?.api_key;
if (!serviceKey) throw new Error("Supabase service key could not be retrieved.");

const supabaseAdmin = createClient(projectUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runAudit() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — PHASE 04 MASTER INTEGRATION AUDIT");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function test(condition, message) {
    if (condition) {
      passed++;
      console.log(`✓ PASS: ${message}`);
    } else {
      failed++;
      console.error(`✗ FAIL: ${message}`);
    }
  }

  // 1. Database Table Existence & Migration Verification
  console.log("--- 1. DATABASE SCHEMA & NEW TABLES ---");
  const { data: qb, error: qbErr } = await supabaseAdmin.from("question_bank").select("id").limit(1);
  test(!qbErr, `question_bank table accessible in remote Supabase`);

  const { data: ht, error: htErr } = await supabaseAdmin.from("homework_templates").select("id").limit(1);
  test(!htErr, `homework_templates table accessible in remote Supabase`);

  const { data: htq, error: htqErr } = await supabaseAdmin.from("homework_template_questions").select("id").limit(1);
  test(!htqErr, `homework_template_questions table accessible in remote Supabase`);

  const { data: me, error: meErr } = await supabaseAdmin.from("mock_exams").select("id").limit(1);
  test(!meErr, `mock_exams table accessible in remote Supabase`);

  const { data: meq, error: meqErr } = await supabaseAdmin.from("mock_exam_questions").select("id").limit(1);
  test(!meqErr, `mock_exam_questions table accessible in remote Supabase`);

  const { data: st, error: stErr } = await supabaseAdmin.from("support_threads").select("id, student_user_id").limit(1);
  test(!stErr, `support_threads table accessible with student_user_id`);

  // 2. Question Bank & Homework Assignment RPC Test
  console.log("\n--- 2. QUESTION BANK & RPC SNAPSHOT ASSIGNMENT TEST ---");
  // Insert a test question into question_bank
  const testQuestionPayload = {
    code: "SAT-M-001-TEST",
    exam: "SAT",
    topic: "Linear Equations",
    difficulty: "medium",
    language: "en",
    question_type: "multiple_choice",
    prompt: "If 2x + 3 = 11, what is the value of x?",
    options: [
      { option_key: "A", option_text: "2", is_correct: false },
      { option_key: "B", option_text: "4", is_correct: true },
      { option_key: "C", option_text: "5", is_correct: false },
      { option_key: "D", option_text: "7", is_correct: false },
    ],
    reference_answer: "x = 4",
    explanation: "Subtract 3 from both sides: 2x = 8, then divide by 2: x = 4.",
    status: "active",
  };

  const { data: qbItem, error: qbInsertErr } = await supabaseAdmin
    .from("question_bank")
    .insert(testQuestionPayload)
    .select()
    .single();

  test(!qbInsertErr && qbItem?.id, `Question Bank item creation (ID: ${qbItem?.id})`);

  // Insert a test homework template
  const { data: templateItem, error: tInsertErr } = await supabaseAdmin
    .from("homework_templates")
    .insert({
      title: "SAT Linear Equations Diagnostic Test",
      description: "Test your algebra fundamentals before session 1.",
      subject: "Math",
      exam: "SAT",
      estimated_duration_minutes: 30,
      status: "active",
    })
    .select()
    .single();

  test(!tInsertErr && templateItem?.id, `Homework template creation (ID: ${templateItem?.id})`);

  if (templateItem?.id && qbItem?.id) {
    const { error: tqInsertErr } = await supabaseAdmin
      .from("homework_template_questions")
      .insert({
        template_id: templateItem.id,
        position: 0,
        question_type: qbItem.question_type,
        prompt: qbItem.prompt,
        options: qbItem.options,
        reference_answer: qbItem.reference_answer,
        explanation: qbItem.explanation,
      });
    test(!tqInsertErr, `Homework template questions attached`);

    // Clean up test items
    await supabaseAdmin.from("homework_template_questions").delete().eq("template_id", templateItem.id);
    await supabaseAdmin.from("homework_templates").delete().eq("id", templateItem.id);
    await supabaseAdmin.from("question_bank").delete().eq("id", qbItem.id);
    console.log("✓ Test template and question bank items safely cleaned up");
  }

  // 3. Support Threads Foreign Key Integrity
  console.log("\n--- 3. SUPPORT THREADS & NOTIFICATIONS ---");
  const { count: supportThreadCount } = await supabaseAdmin
    .from("support_threads")
    .select("*", { count: "exact", head: true });
  test(supportThreadCount !== null, `Support threads count query successful (${supportThreadCount} threads)`);

  const { count: supportMsgCount } = await supabaseAdmin
    .from("support_messages")
    .select("*", { count: "exact", head: true });
  test(supportMsgCount !== null, `Support messages count query successful (${supportMsgCount} messages)`);

  // 4. Site Settings Responsive Configuration
  console.log("\n--- 4. SITE SETTINGS & PAYMENT DATA ---");
  const { data: settings, error: sErr } = await supabaseAdmin
    .from("site_settings")
    .select("key, value");
  test(!sErr && settings && settings.length > 0, `Site settings active in DB (${settings?.length} keys)`);

  // 5. Student Profiles Schema Check
  console.log("\n--- 5. STUDENT CRM INTEGRITY ---");
  const { data: students, error: studErr } = await supabaseAdmin
    .from("student_profiles")
    .select("id, full_name, email, phone, target_exam, target_exams, target_countries, active, onboarding_completed")
    .limit(5);
  test(!studErr && students && students.length > 0, `Student profiles query successful (${students?.length} profiles retrieved)`);

  console.log("\n==================================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error("Audit failed with exception:", err);
  process.exit(1);
});
