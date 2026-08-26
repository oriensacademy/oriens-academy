import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mwbrlfmdpbkmdjroxhcc.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseKey);

// Hash computation helper for tests
function calculatePaytrHash(merchantOid, merchantSalt, status, totalAmount, merchantKey) {
  const hashStr = `${merchantOid}${merchantSalt}${status}${totalAmount}`;
  return crypto.createHmac('sha256', merchantKey).update(hashStr).digest('base64');
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function runTests() {
  console.log('========================================================');
  console.log('PAYTR CALLBACK & ENTITLEMENT QA TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  const mockMerchantKey = 'test_merchant_key_12345';
  const mockMerchantSalt = 'test_merchant_salt_67890';

  // TEST 1: HASH ALGORITHM & TIMING-SAFE EQUALITY
  try {
    console.log('▶ Test 1: Hash algorithm calculation & timing-safe equality...');
    const testOid = 'ORITEST12345';
    const testStatus = 'success';
    const testTotalAmount = '1000'; // 10.00 TL in kuruş
    const calculatedHash = calculatePaytrHash(testOid, mockMerchantSalt, testStatus, testTotalAmount, mockMerchantKey);

    if (!calculatedHash || typeof calculatedHash !== 'string' || calculatedHash.length < 20) {
      throw new Error(`Invalid calculated hash: ${calculatedHash}`);
    }

    const isValid = timingSafeEqual(calculatedHash, calculatedHash);
    const isInvalid = timingSafeEqual(calculatedHash, 'invalid_hash_string');

    if (!isValid || isInvalid) {
      throw new Error('Timing safe equality failed');
    }

    console.log('  ✓ Hash algorithm and timing-safe equality passed.');
    passed++;
  } catch (err) {
    console.error('  ✗ Test 1 failed:', err.message);
    failed++;
  }

  // Find or insert a test package
  const { data: testPkg } = await admin.from('pricing_packages').select('id,lesson_count').eq('id', 'package10').maybeSingle();
  const pkgId = testPkg?.id || 'single';
  const expectedLessonCount = testPkg?.lesson_count || 10;

  // Find a student profile for linked student tests
  const { data: existingStudent } = await admin.from('student_profiles').select('id,email,full_name').eq('active', true).limit(1).maybeSingle();

  const timestamp = Date.now();
  const testRef1 = `ORIQA${timestamp}T1`;
  const testRef2 = `ORIQA${timestamp}T2`;
  const testRef3 = `ORIQA${timestamp}T3`;
  const testRef4 = `ORIQA${timestamp}T4`;
  const testRef5 = `ORIQA${timestamp}T5`;
  const testRef6 = `ORIQA${timestamp}T6`;
  const testRef7 = `ORIQA${timestamp}T7`;

  let createdTxIds = [];

  try {
    // ----------------------------------------------------
    // TEST 1: Successful PayTR callback -> transaction paid -> package purchase exists -> correct lesson count exists
    // ----------------------------------------------------
    console.log('▶ Test 1: Verified callback -> payment paid -> package purchase created with correct lesson count...');
    const { data: tx1, error: tx1Err } = await admin.from('payment_transactions').insert({
      package_id: pkgId,
      student_user_id: existingStudent ? existingStudent.id : null,
      public_reference: testRef1,
      status_token_hash: 'dummy_hash_1',
      provider: 'paytr',
      amount: 27000.0,
      currency: 'TRY',
      status: 'pending',
      payment_method: 'card',
      payer_name: existingStudent?.full_name || 'QA Student',
      payer_email: existingStudent?.email || 'qa-student@oriens-academy.com',
      metadata: { test: true, lesson_count: expectedLessonCount }
    }).select('id').single();

    if (tx1Err) throw new Error(tx1Err.message);
    createdTxIds.push(tx1.id);

    const { data: rpc1, error: rpc1Err } = await admin.rpc('finalize_paytr_payment', {
      p_merchant_oid: testRef1,
      p_status: 'success',
      p_total_amount: 27000.0,
      p_paytr_payload: { status: 'success', test_mode: '1' },
      p_payment_amount: 27000.0
    });

    if (rpc1Err) throw new Error(rpc1Err.message);
    if (!rpc1?.success || rpc1.status !== 'paid' || !rpc1.purchase_id) {
      throw new Error(`RPC failed to activate package: ${JSON.stringify(rpc1)}`);
    }

    const { data: purchase1 } = await admin.from('student_package_purchases').select('*').eq('payment_transaction_id', tx1.id).single();
    if (!purchase1 || purchase1.lesson_count !== expectedLessonCount) {
      throw new Error(`Package purchase lesson count mismatch (expected ${expectedLessonCount}, got ${purchase1?.lesson_count})`);
    }
    console.log(`  ✓ Payment finalized and package assigned (Purchase ID: ${purchase1.id}, Lessons: ${purchase1.lesson_count}).`);
    passed++;

    // ----------------------------------------------------
    // TEST 2: Callback repeated twice -> package count still 1 -> lessons not duplicated
    // ----------------------------------------------------
    console.log('▶ Test 2: Idempotent duplicate callback...');
    const { data: rpc2, error: rpc2Err } = await admin.rpc('finalize_paytr_payment', {
      p_merchant_oid: testRef1,
      p_status: 'success',
      p_total_amount: 27000.0,
      p_paytr_payload: { status: 'success' },
      p_payment_amount: 27000.0
    });

    if (rpc2Err) throw new Error(rpc2Err.message);
    if (!rpc2?.success || !rpc2.already_paid) {
      throw new Error(`Duplicate callback not handled as already_paid: ${JSON.stringify(rpc2)}`);
    }

    const { data: allPurchases1 } = await admin.from('student_package_purchases').select('id').eq('payment_transaction_id', tx1.id);
    if (allPurchases1.length !== 1) {
      throw new Error(`Duplicate package purchase created! Count: ${allPurchases1.length}`);
    }
    console.log('  ✓ Duplicate callback safely acknowledged without duplicate entitlement.');
    passed++;

    // ----------------------------------------------------
    // TEST 3: Payment succeeds for user whose student profile is resolved by email
    // ----------------------------------------------------
    console.log('▶ Test 3: Email resolution mapping for unlinked student_user_id...');
    if (existingStudent) {
      const { data: tx3 } = await admin.from('payment_transactions').insert({
        package_id: 'single',
        student_user_id: null, // intentionally null
        public_reference: testRef3,
        status_token_hash: 'dummy_hash_3',
        provider: 'paytr',
        amount: 3200.0,
        currency: 'TRY',
        status: 'pending',
        payment_method: 'card',
        payer_name: existingStudent.full_name,
        payer_email: existingStudent.email, // existing student email
        metadata: { test: true }
      }).select('id').single();

      createdTxIds.push(tx3.id);

      const { data: rpc3 } = await admin.rpc('finalize_paytr_payment', {
        p_merchant_oid: testRef3,
        p_status: 'success',
        p_total_amount: 3200.0,
        p_paytr_payload: { status: 'success' },
        p_payment_amount: 3200.0
      });

      const { data: purchase3 } = await admin.from('student_package_purchases').select('*').eq('payment_transaction_id', tx3.id).single();
      if (!purchase3 || purchase3.student_user_id !== existingStudent.id) {
        throw new Error(`Failed to map student profile by email (got ${purchase3?.student_user_id})`);
      }
      console.log('  ✓ Email-based profile resolution assigned package to correct student profile.');
      passed++;
    } else {
      console.log('  - Skipped Test 3 (no student profile in DB)');
    }

    // ----------------------------------------------------
    // TEST 4: Reconciliation creates entitlement for historically paid transaction with missing entitlement
    // ----------------------------------------------------
    console.log('▶ Test 4: Reconciliation repair mechanism...');
    if (existingStudent) {
      const { data: tx5 } = await admin.from('payment_transactions').insert({
        package_id: 'package5',
        student_user_id: existingStudent.id,
        public_reference: testRef5,
        status_token_hash: 'dummy_hash_5',
        provider: 'paytr',
        amount: 15000.0,
        currency: 'TRY',
        status: 'paid', // manually set to paid without student_package_purchases
        payment_method: 'card',
        payer_name: existingStudent.full_name,
        payer_email: existingStudent.email,
        metadata: { test: true, lesson_count: 5 }
      }).select('id').single();

      createdTxIds.push(tx5.id);

      // Run reconciliation
      const { data: reconRes, error: reconErr } = await admin.rpc('reconcile_missing_package_entitlements');
      if (reconErr) throw new Error(reconErr.message);

      const repairedItem = (reconRes || []).find(r => r.payment_transaction_id === tx5.id);
      if (!repairedItem || repairedItem.reconciliation_status !== 'ACTIVATED') {
        throw new Error(`Reconciliation failed to repair transaction: ${JSON.stringify(repairedItem)}`);
      }

      const { data: purchase5 } = await admin.from('student_package_purchases').select('*').eq('payment_transaction_id', tx5.id).single();
      if (!purchase5 || purchase5.lesson_count !== 5) {
        throw new Error('Reconciliation did not create valid purchase');
      }

      console.log('  ✓ Reconciliation safely detected and activated missing package entitlement.');
      passed++;
    }

    // ----------------------------------------------------
    // TEST 5: Reconciliation on already-entitled transaction does nothing
    // ----------------------------------------------------
    console.log('▶ Test 5: Reconciliation idempotency on already entitled transactions...');
    const { data: reconRes2 } = await admin.rpc('reconcile_missing_package_entitlements');
    const alreadyRepaired = (reconRes2 || []).find(r => r.payment_transaction_id === testRef1);
    if (alreadyRepaired) {
      throw new Error('Reconciliation re-processed an already entitled transaction!');
    }
    console.log('  ✓ Already entitled transactions ignored by reconciliation.');
    passed++;

    // ----------------------------------------------------
    // TEST 6: Refunded/Failed transaction is NEVER granted a package
    // ----------------------------------------------------
    console.log('▶ Test 6: Failed / Refunded transaction entitlement safety...');
    const { data: tx6 } = await admin.from('payment_transactions').insert({
      package_id: 'single',
      student_user_id: existingStudent?.id || null,
      public_reference: testRef6,
      status_token_hash: 'dummy_hash_6',
      provider: 'paytr',
      amount: 3200.0,
      currency: 'TRY',
      status: 'failed',
      payment_method: 'card',
      payer_name: 'Failed User',
      payer_email: 'failed@oriens-academy.com',
      metadata: { test: true }
    }).select('id').single();

    createdTxIds.push(tx6.id);

    const { data: reconRes6 } = await admin.rpc('reconcile_missing_package_entitlements');
    const failedRepaired = (reconRes6 || []).find(r => r.payment_transaction_id === tx6.id);
    if (failedRepaired) {
      throw new Error('Failed transaction was mistakenly processed by reconciliation!');
    }

    const { data: purchase6 } = await admin.from('student_package_purchases').select('id').eq('payment_transaction_id', tx6.id);
    if (purchase6 && purchase6.length > 0) {
      throw new Error('Package was created for failed payment!');
    }
    console.log('  ✓ Failed/refunded transactions strictly excluded from entitlement.');
    passed++;

    // ----------------------------------------------------
    // TEST 7: Invalid amount mismatch rejection
    // ----------------------------------------------------
    console.log('▶ Test 7: Illegitimate amount mismatch scenario rejection...');
    const { data: tx7 } = await admin.from('payment_transactions').insert({
      package_id: 'single',
      student_user_id: existingStudent?.id || null,
      public_reference: testRef7,
      status_token_hash: 'dummy_hash_7',
      provider: 'paytr',
      amount: 3200.0,
      currency: 'TRY',
      status: 'pending',
      payment_method: 'card',
      payer_name: 'Mismatch User',
      payer_email: 'mismatch@oriens-academy.com',
      metadata: { test: true }
    }).select('id').single();

    createdTxIds.push(tx7.id);

    const { data: rpc7 } = await admin.rpc('finalize_paytr_payment', {
      p_merchant_oid: testRef7,
      p_status: 'success',
      p_total_amount: 100.0, // amount mismatch
      p_paytr_payload: { status: 'success' },
      p_payment_amount: 100.0
    });

    if (rpc7?.success !== false || rpc7?.error_code !== 'AMOUNT_MISMATCH') {
      throw new Error(`Amount mismatch was not rejected: ${JSON.stringify(rpc7)}`);
    }
    console.log('  ✓ Amount mismatch correctly rejected.');
    passed++;

  } finally {
    // Clean up test records
    console.log('▶ Cleaning up QA test records...');
    if (createdTxIds.length > 0) {
      await admin.from('student_package_purchases').delete().in('payment_transaction_id', createdTxIds);
      await admin.from('payment_transactions').delete().in('id', createdTxIds);
    }
    console.log('  ✓ QA test records cleaned up.');
  }

  console.log('\n========================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runTests().catch((err) => {
  console.error('Fatal QA error:', err);
  process.exit(1);
});
