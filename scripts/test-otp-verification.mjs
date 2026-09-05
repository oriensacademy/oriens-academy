/**
 * OTP verification forensic + regression suite.
 *
 * Exercises the REAL production RPCs (verify_purchase_email_otp,
 * verify_email_change_otp) against real challenge rows, using a throwaway
 * fixture user. No email is sent to anyone: the suite inserts challenge rows
 * directly with hashes computed the same way the Edge Functions compute them,
 * then verifies through the RPC. Every row it creates is removed at the end.
 *
 *   node scripts/test-otp-verification.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Any stable value works: the suite computes both sides of the hash itself, so
// it validates the verifier's *selection and state machine*, which is where the
// production bug lived. The real secret never leaves the Edge Function.
const SECRET = "otp-suite-fixed-secret";

let passed = 0;
const failures = [];
function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log("  PASS  " + name);
  } else {
    failures.push(name + (detail ? " -- " + detail : ""));
    console.log("  FAIL  " + name + (detail ? " -- " + detail : ""));
  }
}

/** Mirrors supabase/functions/_shared/otp/hash.ts exactly. */
function otpHash({ purpose, userId, email, code }) {
  const normalized = String(email).trim().toLowerCase();
  const message =
    purpose === "email_change"
      ? `email_change:${userId}:${normalized}:${code}`
      : `${userId}:${normalized}:${code}`;
  return createHmac("sha256", SECRET).update(message).digest("hex");
}

const FIXTURE_EMAIL = `otp-suite-${Date.now()}@fixture.oriens-academy.invalid`;
let userId = null;
const createdChallengeIds = [];

async function insertPurchaseChallenge({ code, email = FIXTURE_EMAIL, expiresInMs = 600000, attempts = 0, superseded = false, verified = false }) {
  const now = new Date();
  const { data, error } = await admin
    .from("purchase_email_verification_challenges")
    .insert({
      user_id: userId,
      candidate_email: email,
      code_hash: otpHash({ purpose: "purchase_email_verification", userId, email, code }),
      expires_at: new Date(now.getTime() + expiresInMs).toISOString(),
      resend_available_at: new Date(now.getTime() + 60000).toISOString(),
      attempt_count: attempts,
      superseded_at: superseded ? now.toISOString() : null,
      verified_at: verified ? now.toISOString() : null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error("fixture insert failed: " + error.message);
  createdChallengeIds.push(data.id);
  return data.id;
}

async function verifyPurchase(code, email = FIXTURE_EMAIL) {
  const { data, error } = await admin.rpc("verify_purchase_email_otp", {
    p_user_id: userId,
    p_candidate_email: email,
    p_code_hash: otpHash({ purpose: "purchase_email_verification", userId, email, code }),
  });
  if (error) return { rpcError: error.message };
  return data;
}

async function attemptsOf(id) {
  const { data } = await admin
    .from("purchase_email_verification_challenges")
    .select("attempt_count, verified_at, superseded_at")
    .eq("id", id)
    .maybeSingle();
  return data;
}

async function resetChallenges() {
  await admin.from("purchase_email_verification_challenges").delete().eq("user_id", userId);
  createdChallengeIds.length = 0;
}

async function main() {
  console.log("=== OTP VERIFICATION SUITE ===\n");

  // A fixture identity is required because the RPC marks guardian_accounts
  // verified in the same transaction and refuses when no account row exists.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: FIXTURE_EMAIL,
    password: `Fx!${Math.random().toString(36).slice(2)}A1`,
    email_confirm: true,
  });
  if (createErr) throw new Error("fixture user creation failed: " + createErr.message);
  userId = created.user.id;

  await admin.from("student_profiles").insert({
    id: userId,
    full_name: "OTP Suite Fixture",
    email: FIXTURE_EMAIL,
    preferred_language: "tr",
    active: true,
  });
  await admin.from("guardian_accounts").insert({
    user_id: userId,
    full_name: "OTP Suite Fixture",
    email: FIXTURE_EMAIL,
    preferred_language: "tr",
    active: true,
  });

  try {
    console.log("[1] CORRECT CODE");
    {
      const id = await insertPurchaseChallenge({ code: "482913" });
      const res = await verifyPurchase("482913");
      check("correct code is accepted", res?.success === true, JSON.stringify(res));
      const row = await attemptsOf(id);
      check("correct code does NOT decrement attempts", row?.attempt_count === 0, JSON.stringify(row));
      check("challenge is consumed", Boolean(row?.verified_at));
      const { data: ga } = await admin.from("guardian_accounts").select("email_verified_at").eq("user_id", userId).maybeSingle();
      check("account is marked verified in the same transaction", Boolean(ga?.email_verified_at), JSON.stringify(ga));
      await resetChallenges();
      await admin.from("guardian_accounts").update({ email_verified_at: null }).eq("user_id", userId);
    }

    console.log("\n[2] LEADING-ZERO CODE");
    {
      const id = await insertPurchaseChallenge({ code: "012345" });
      const res = await verifyPurchase("012345");
      check("leading-zero code is accepted", res?.success === true, JSON.stringify(res));
      const row = await attemptsOf(id);
      check("leading-zero code does not decrement attempts", row?.attempt_count === 0);
      await resetChallenges();
      await admin.from("guardian_accounts").update({ email_verified_at: null }).eq("user_id", userId);
    }

    console.log("\n[3] WRONG CODE");
    {
      const id = await insertPurchaseChallenge({ code: "111111" });
      const res = await verifyPurchase("222222");
      check("wrong code is rejected", res?.success === false && res?.error_code === "INVALID_CODE", JSON.stringify(res));
      check("wrong code reports remaining attempts", res?.remaining_attempts === 4, JSON.stringify(res));
      const row = await attemptsOf(id);
      check("wrong code decrements exactly once", row?.attempt_count === 1, JSON.stringify(row));

      console.log("\n[4] CORRECT CODE AFTER A WRONG ATTEMPT");
      const ok = await verifyPurchase("111111");
      check("correct code still accepted after a failure", ok?.success === true, JSON.stringify(ok));
      const after = await attemptsOf(id);
      check("success leaves the attempt count untouched", after?.attempt_count === 1, JSON.stringify(after));
      await resetChallenges();
      await admin.from("guardian_accounts").update({ email_verified_at: null }).eq("user_id", userId);
    }

    console.log("\n[5] RESEND: OLD CODE FAILS, NEW CODE PASSES");
    {
      // This is the production scenario: the gate remounted, requested a new
      // code, and the user typed the code from the previous email.
      const oldId = await insertPurchaseChallenge({ code: "555555", superseded: true });
      const newId = await insertPurchaseChallenge({ code: "666666" });
      const oldRes = await verifyPurchase("555555");
      check("superseded (old) code is rejected", oldRes?.success === false, JSON.stringify(oldRes));
      check("superseded code is not mislabelled as wrong-code-only", ["INVALID_CODE", "SUPERSEDED"].includes(oldRes?.error_code), JSON.stringify(oldRes));
      const newRes = await verifyPurchase("666666");
      check("newest code is accepted", newRes?.success === true, JSON.stringify(newRes));
      const oldRow = await attemptsOf(oldId);
      check("superseded row is never consumed", !oldRow?.verified_at);
      const newRow = await attemptsOf(newId);
      check("newest row is the one consumed", Boolean(newRow?.verified_at));
      await resetChallenges();
      await admin.from("guardian_accounts").update({ email_verified_at: null }).eq("user_id", userId);
    }

    console.log("\n[6] TWO ACTIVE CHALLENGES (the regression that caused the outage)");
    {
      // Before the fix the verifier compared against `order by created_at desc
      // limit 1` only, so the OLDER challenge's correct code reported as wrong.
      const olderId = await insertPurchaseChallenge({ code: "777777" });
      await new Promise((r) => setTimeout(r, 1100));
      const newerId = await insertPurchaseChallenge({ code: "888888" });
      const res = await verifyPurchase("777777");
      check("a correct code for the OLDER active challenge is accepted", res?.success === true, JSON.stringify(res));
      const older = await attemptsOf(olderId);
      const newer = await attemptsOf(newerId);
      check("the matching challenge is the one consumed", Boolean(older?.verified_at), JSON.stringify(older));
      check("the sibling is superseded, not consumed", Boolean(newer?.superseded_at) && !newer?.verified_at, JSON.stringify(newer));
      check("no attempt was charged for a correct code", older?.attempt_count === 0);
      await resetChallenges();
      await admin.from("guardian_accounts").update({ email_verified_at: null }).eq("user_id", userId);
    }

    console.log("\n[7] EXPIRY");
    {
      await insertPurchaseChallenge({ code: "343434", expiresInMs: -1000 });
      const res = await verifyPurchase("343434");
      check("expired code is reported as expired, not wrong", res?.success === false && res?.error_code === "EXPIRED", JSON.stringify(res));
      await resetChallenges();
    }

    console.log("\n[8] REUSE / ALREADY VERIFIED");
    {
      await insertPurchaseChallenge({ code: "909090", verified: true });
      const res = await verifyPurchase("909090");
      check("an already-consumed code cannot be reused", res?.success === false, JSON.stringify(res));
      check("reuse is classified as ALREADY_VERIFIED", res?.error_code === "ALREADY_VERIFIED", JSON.stringify(res));
      await resetChallenges();
    }

    console.log("\n[9] TOO MANY ATTEMPTS");
    {
      await insertPurchaseChallenge({ code: "121212", attempts: 5 });
      const res = await verifyPurchase("999999");
      check("lockout is reported distinctly", res?.success === false && res?.error_code === "TOO_MANY_ATTEMPTS", JSON.stringify(res));
      const correct = await verifyPurchase("121212");
      check("lockout also blocks the correct code (no bypass)", correct?.success === false, JSON.stringify(correct));
      await resetChallenges();
    }

    console.log("\n[10] CONCURRENCY: ONE CODE CANNOT BE CONSUMED TWICE");
    {
      const id = await insertPurchaseChallenge({ code: "246810" });
      const [a, b] = await Promise.all([verifyPurchase("246810"), verifyPurchase("246810")]);
      const successes = [a, b].filter((r) => r?.success === true).length;
      check("exactly one concurrent verification succeeds", successes === 1, JSON.stringify([a, b]));
      const row = await attemptsOf(id);
      check("the losing request did not charge an attempt for a correct code", row?.attempt_count === 0, JSON.stringify(row));
      await resetChallenges();
      await admin.from("guardian_accounts").update({ email_verified_at: null }).eq("user_id", userId);
    }

    console.log("\n[11] NO ACTIVE CHALLENGE AT ALL");
    {
      const res = await verifyPurchase("135791");
      check("missing challenge is not reported as a wrong code", res?.success === false && res?.error_code !== "INVALID_CODE", JSON.stringify(res));
    }

    console.log("\n[12] ROOT CAUSE REGRESSION: enqueue_email_notification is unambiguous");
    {
      // The 7-arg/8-arg overload pair made every trigger that enqueues mail raise
      // 42725, which aborted the UPDATE that sets email_verified_at.
      const { error } = await admin
        .from("guardian_accounts")
        .update({ email_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      check("setting email_verified_at no longer raises 42725", !error, error ? error.code + " " + error.message : "");
      await admin.from("guardian_accounts").update({ email_verified_at: null }).eq("user_id", userId);
    }
  } finally {
    console.log("\n[cleanup]");
    await admin.from("purchase_email_verification_challenges").delete().eq("user_id", userId);
    await admin.from("email_change_challenges").delete().eq("user_id", userId);
    await admin.from("notification_deliveries").delete().eq("recipient", FIXTURE_EMAIL);
    await admin.from("audit_logs").delete().eq("actor_user_id", userId);
    await admin.from("guardian_students").delete().eq("guardian_user_id", userId);
    await admin.from("guardian_accounts").delete().eq("user_id", userId);
    await admin.from("student_profiles").delete().eq("id", userId);
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    console.log("  fixture user removed:", delErr ? "ERR " + delErr.message : "yes");
  }

  console.log("\n=======================================");
  console.log(`  ${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) console.log("  - " + f);
    process.exit(1);
  }
  console.log("  OTP VERIFICATION: ALL GREEN");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
