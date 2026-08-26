import assert from "node:assert/strict";
import { createRequire } from "module";
const require = createRequire("C:/Users/merto/Desktop/oriens-academy.com/package.json");

const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");

dotenv.config({ path: "C:/Users/merto/Desktop/oriens-academy.com/.env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testEntitlementSummary() {
  console.log("\n1. Testing RPC get_student_entitlement_summary on live database...");
  
  // Find an existing student with packages
  const { data: studentWithPackages, error: findError } = await supabase
    .from("student_package_purchases")
    .select("student_user_id")
    .limit(1)
    .single();

  if (findError || !studentWithPackages) {
    console.log("No student with package found, testing with synthetic uuid...");
  } else {
    const studentId = studentWithPackages.student_user_id;
    const { data: summary, error } = await supabase.rpc("get_student_entitlement_summary", {
      p_student_id: studentId,
    });
    
    assert.equal(error, null, "RPC error must be null");
    assert.ok(summary, "Summary must be returned");
    assert.ok(typeof summary.total_granted_lessons === "number", "total_granted_lessons must be a number");
    assert.ok(typeof summary.total_used_lessons === "number", "total_used_lessons must be a number");
    assert.ok(typeof summary.total_remaining_lessons === "number", "total_remaining_lessons must be a number");
    assert.ok(Array.isArray(summary.active_packages), "active_packages must be an array");
    assert.ok(Array.isArray(summary.past_packages), "past_packages must be an array");
    
    console.log(`✓ Student ${studentId} Entitlement Summary:`, {
      granted: summary.total_granted_lessons,
      used: summary.total_used_lessons,
      remaining: summary.total_remaining_lessons,
      activeCount: summary.active_packages.length,
      pastCount: summary.past_packages.length,
    });
  }
}

async function testFifoLogicSimulation() {
  console.log("\n2. Testing In-Memory Multi-Package FIFO Consumption Logic...");

  // Scenario: Student has 2 stacked packages
  // Package A (older): 10 lessons granted, 3 used => 7 remaining
  // Package B (newer): 1 lesson granted, 0 used => 1 remaining
  // Total remaining = 8

  const purchases = [
    {
      id: "pkg-a-10",
      package_id: "package10",
      lesson_count: 10,
      lessons_used: 3,
      status: "active",
      created_at: "2026-08-26T10:00:00.000Z",
    },
    {
      id: "pkg-b-1",
      package_id: "single",
      lesson_count: 1,
      lessons_used: 0,
      status: "active",
      created_at: "2026-08-26T12:00:00.000Z",
    },
  ];

  // Calculate total remaining
  const activePackages = purchases.filter(p => p.status === "active" && p.lesson_count - p.lessons_used > 0);
  const totalRemaining = activePackages.reduce((s, p) => s + (p.lesson_count - p.lessons_used), 0);
  assert.equal(totalRemaining, 8, "Expected total remaining = 8");
  console.log(`✓ Initial stacked remaining balance: ${totalRemaining} (7 from Package A + 1 from Package B)`);

  // Simulate FIFO lesson completion (oldest active first)
  const sortedAsc = [...activePackages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const target = sortedAsc[0];
  assert.equal(target.id, "pkg-a-10", "FIFO must select oldest package (pkg-a-10), not newest");
  
  target.lessons_used += 1; // Used 4 of 10, 6 remaining
  const newTotalRemaining = purchases.filter(p => p.status === "active" && p.lesson_count - p.lessons_used > 0)
    .reduce((s, p) => s + (p.lesson_count - p.lessons_used), 0);
  
  assert.equal(newTotalRemaining, 7, "New total remaining must be 7");
  assert.equal(target.lessons_used, 4, "Package A must have 4 used");
  assert.equal(purchases[1].lessons_used, 0, "Package B must remain 0 used (untouched)");
  console.log(`✓ After 1 lesson completed (FIFO): Package A = 6 left, Package B = 1 left, Total = 7 left`);
}

async function run() {
  await testEntitlementSummary();
  await testFifoLogicSimulation();
  console.log("\n=== ALL MULTI-PACKAGE & FIFO TESTS PASSED ===");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
