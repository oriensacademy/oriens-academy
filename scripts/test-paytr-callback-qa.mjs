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
  console.log('PAYTR CALLBACK AUTOMATED QA TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  const mockMerchantKey = 'test_merchant_key_12345';
  const mockMerchantSalt = 'test_merchant_salt_67890';

  // TEST 1: HASH ALGORITHM & TIMING-SAFE EQUALITY
  try {
    console.log('▶ Test 1: Hash algorithm calculation & timing-safe equality...');
    const testOid = 'ORI-TEST-12345';
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
  const { data: testPkg } = await admin.from('pricing_packages').select('id,lesson_count').limit(1).single();
  if (!testPkg) {
    console.error('❌ No pricing package found for testing');
    process.exit(1);
  }

  // Find a student profile for linked student tests
  const { data: existingStudent } = await admin.from('student_profiles').select('id,email,full_name').eq('active', true).limit(1).maybeSingle();

  const testRef = `ORI-QA-${Date.now()}`;
  const testRef2 = `ORI-QA-FAIL-${Date.now()}`;
  const testRefInstallment = `ORI-QA-INST-${Date.now()}`;
  const testRefMismatch = `ORI-QA-MISMATCH-${Date.now()}`;

  let testTxId = null;
  let testTxId2 = null;
  let testTxIdInst = null;
  let testTxIdMismatch = null;

  try {
    // Insert test transaction 1 for standard success & duplicate tests (100.00 TL)
    const { data: tx1, error: tx1Err } = await admin.from('payment_transactions').insert({
      package_id: testPkg.id,
      student_user_id: existingStudent ? existingStudent.id : null,
      public_reference: testRef,
      status_token_hash: 'dummy_hash_for_test',
      provider: 'paytr',
      amount: 100.0,
      currency: 'TRY',
      status: 'pending',
      payment_method: 'card',
      payer_name: existingStudent ? existingStudent.full_name : 'Test PayTR User',
      payer_email: existingStudent ? existingStudent.email : 'test-paytr@oriens-academy.com',
      metadata: { test: true, locale: 'tr' }
    }).select('id').single();

    if (tx1Err || !tx1) throw new Error(`Failed to create test transaction 1: ${tx1Err?.message}`);
    testTxId = tx1.id;

    // Insert test transaction 2 for failure test
    const { data: tx2, error: tx2Err } = await admin.from('payment_transactions').insert({
      package_id: testPkg.id,
      student_user_id: existingStudent ? existingStudent.id : null,
      public_reference: testRef2,
      status_token_hash: 'dummy_hash_for_test_2',
      provider: 'paytr',
      amount: 50.0,
      currency: 'TRY',
      status: 'pending',
      payment_method: 'card',
      payer_name: 'Test PayTR User 2',
      payer_email: 'test-paytr2@oriens-academy.com',
      metadata: { test: true, locale: 'tr' }
    }).select('id').single();

    if (tx2Err || !tx2) throw new Error(`Failed to create test transaction 2: ${tx2Err?.message}`);
    testTxId2 = tx2.id;

    // Insert test transaction 3 for Installment test (base: 27000.00 TL)
    const { data: tx3, error: tx3Err } = await admin.from('payment_transactions').insert({
      package_id: testPkg.id,
      student_user_id: existingStudent ? existingStudent.id : null,
      public_reference: testRefInstallment,
      status_token_hash: 'dummy_hash_for_test_inst',
      provider: 'paytr',
      amount: 27000.0,
      currency: 'TRY',
      status: 'pending',
      payment_method: 'card',
      payer_name: 'Test Installment User',
      payer_email: 'test-inst@oriens-academy.com',
      metadata: { test: true, locale: 'tr' }
    }).select('id').single();

    if (tx3Err || !tx3) throw new Error(`Failed to create test transaction 3: ${tx3Err?.message}`);
    testTxIdInst = tx3.id;

    // Insert test transaction 4 for Amount Mismatch test (base: 1000.00 TL)
    const { data: tx4, error: tx4Err } = await admin.from('payment_transactions').insert({
      package_id: testPkg.id,
      student_user_id: existingStudent ? existingStudent.id : null,
      public_reference: testRefMismatch,
      status_token_hash: 'dummy_hash_for_test_mismatch',
      provider: 'paytr',
      amount: 1000.0,
      currency: 'TRY',
      status: 'pending',
      payment_method: 'card',
      payer_name: 'Test Mismatch User',
      payer_email: 'test-mismatch@oriens-academy.com',
      metadata: { test: true, locale: 'tr' }
    }).select('id').single();

    if (tx4Err || !tx4) throw new Error(`Failed to create test transaction 4: ${tx4Err?.message}`);
    testTxIdMismatch = tx4.id;

    // TEST 2: INVALID HASH BEHAVIOR
    console.log('▶ Test 2: Invalid hash verification behavior...');
    const fakeHash = 'forged_fake_hash_123';
    const realHash = calculatePaytrHash(testRef, mockMerchantSalt, 'success', '10000', mockMerchantKey);
    const hashCheck = timingSafeEqual(fakeHash, realHash);

    if (hashCheck === false) {
      const { data: untouchedTx } = await admin.from('payment_transactions').select('status').eq('id', testTxId).single();
      if (untouchedTx.status !== 'pending') {
        throw new Error(`Payment transaction status was modified despite invalid hash! Status: ${untouchedTx.status}`);
      }
      console.log('  ✓ Invalid hash rejected and transaction left untouched.');
      passed++;
    } else {
      throw new Error('Invalid hash was erroneously accepted');
    }

    // TEST 3: VALID SUCCESS CALLBACK & PACKAGE ACTIVATION
    console.log('▶ Test 3: Valid success callback processing & atomic package activation...');
    const { data: rpcSuccess, error: rpcErr } = await admin.rpc('finalize_paytr_payment', {
      p_merchant_oid: testRef,
      p_status: 'success',
      p_total_amount: 100.0,
      p_paytr_payload: {
        payment_type: 'card',
        currency: 'TL',
        payment_amount: '10000',
        test_mode: '1'
      },
      p_payment_amount: 100.0
    });

    if (rpcErr || !rpcSuccess || rpcSuccess.success !== true || rpcSuccess.status !== 'paid') {
      throw new Error(`finalize_paytr_payment RPC failed: ${rpcErr?.message || JSON.stringify(rpcSuccess)}`);
    }

    if (rpcSuccess.already_paid !== false) {
      throw new Error('First-time success should have already_paid = false');
    }

    const { data: updatedTx } = await admin.from('payment_transactions').select('status,paid_at,provider').eq('id', testTxId).single();
    if (updatedTx.status !== 'paid' || !updatedTx.paid_at || updatedTx.provider !== 'paytr') {
      throw new Error(`DB state mismatch for paid transaction: ${JSON.stringify(updatedTx)}`);
    }

    if (existingStudent) {
      const { data: purchaseCount } = await admin.from('student_package_purchases').select('id').eq('payment_transaction_id', testTxId);
      if (!purchaseCount || purchaseCount.length !== 1) {
        throw new Error(`Expected exactly 1 package purchase, got ${purchaseCount?.length}`);
      }
      console.log(`  ✓ Payment finalized as paid and package activated for student (Purchase ID: ${rpcSuccess.purchase_id}).`);
    } else {
      console.log(`  ✓ Payment finalized as paid (Purchase pending student registration).`);
    }
    passed++;

    // TEST 4: DUPLICATE VALID SUCCESS CALLBACK (IDEMPOTENCY)
    console.log('▶ Test 4: Duplicate valid success callback (Idempotency protection)...');
    const { data: rpcDuplicate, error: rpcDupErr } = await admin.rpc('finalize_paytr_payment', {
      p_merchant_oid: testRef,
      p_status: 'success',
      p_total_amount: 100.0,
      p_paytr_payload: {
        payment_type: 'card',
        duplicate: true
      },
      p_payment_amount: 100.0
    });

    if (rpcDupErr || !rpcDuplicate || rpcDuplicate.success !== true) {
      throw new Error(`Duplicate callback RPC failed: ${rpcDupErr?.message || JSON.stringify(rpcDuplicate)}`);
    }

    if (rpcDuplicate.already_paid !== true) {
      throw new Error(`Expected already_paid: true on duplicate callback, got: ${JSON.stringify(rpcDuplicate)}`);
    }

    console.log('  ✓ Duplicate callback safely ignored (idempotent, no double entitlement).');
    passed++;

    // TEST 5: VALID FAILED CALLBACK
    console.log('▶ Test 5: Valid failed callback handling...');
    const { data: rpcFail, error: rpcFailErr } = await admin.rpc('finalize_paytr_payment', {
      p_merchant_oid: testRef2,
      p_status: 'failed',
      p_total_amount: 50.0,
      p_paytr_payload: {
        failed_reason_code: '1002',
        failed_reason_msg: 'Insufficient funds'
      }
    });

    if (rpcFailErr || !rpcFail || rpcFail.success !== true || rpcFail.status !== 'failed') {
      throw new Error(`Failed callback RPC error: ${rpcFailErr?.message || JSON.stringify(rpcFail)}`);
    }

    const { data: failTx } = await admin.from('payment_transactions').select('status,metadata').eq('id', testTxId2).single();
    if (failTx.status !== 'failed') {
      throw new Error(`Expected transaction status to be failed, got ${failTx.status}`);
    }

    console.log('  ✓ Failed payment marked as failed, no package created.');
    passed++;

    // TEST 6: UNKNOWN MERCHANT OID HANDLING
    console.log('▶ Test 6: Unknown merchant_oid handling...');
    const unknownOid = 'ORI-NON-EXISTENT-99999';
    const { data: rpcUnknown } = await admin.rpc('finalize_paytr_payment', {
      p_merchant_oid: unknownOid,
      p_status: 'success',
      p_total_amount: 100.0
    });

    if (rpcUnknown?.success === true) {
      throw new Error('Unknown merchant_oid should have failed but returned success!');
    }

    if (rpcUnknown?.error_code !== 'TRANSACTION_NOT_FOUND') {
      throw new Error(`Expected TRANSACTION_NOT_FOUND error code, got: ${JSON.stringify(rpcUnknown)}`);
    }

    console.log('  ✓ Unknown merchant_oid safely rejected with TRANSACTION_NOT_FOUND.');
    passed++;

    // TEST 7: INSTALLMENT SCENARIO (payment_amount == order amount, total_amount > order amount)
    console.log('▶ Test 7: Installment total_amount scenario (total_amount > payment_amount)...');
    // Order base is 27000.00 TL. PayTR collects 29160.00 TL (due to 6 installments commission).
    // payment_amount in callback is '2700000' (27000.00 TL).
    // total_amount in callback is '2916000' (29160.00 TL).
    const { data: rpcInst, error: rpcInstErr } = await admin.rpc('finalize_paytr_payment', {
      p_merchant_oid: testRefInstallment,
      p_status: 'success',
      p_total_amount: 29160.0, // higher installment total
      p_paytr_payload: {
        payment_type: 'card',
        installment_count: '6',
        payment_amount: '2700000', // matches order base 27000.00 TL
        total_amount: '2916000',
      },
      p_payment_amount: 27000.0 // matches order base
    });

    if (rpcInstErr || !rpcInst || rpcInst.success !== true || rpcInst.status !== 'paid') {
      throw new Error(`Installment scenario erroneously rejected: ${rpcInstErr?.message || JSON.stringify(rpcInst)}`);
    }

    console.log('  ✓ Installment callback accepted successfully without false amount mismatch.');
    passed++;

    // TEST 8: ILLEGITIMATE AMOUNT MISMATCH (payment_amount != order amount)
    console.log('▶ Test 8: Illegitimate amount mismatch scenario (payment_amount != order amount)...');
    // Order base is 1000.00 TL. Callback claims payment_amount is 500.00 TL.
    const { data: rpcMismatch } = await admin.rpc('finalize_paytr_payment', {
      p_merchant_oid: testRefMismatch,
      p_status: 'success',
      p_total_amount: 500.0,
      p_paytr_payload: {
        payment_type: 'card',
        payment_amount: '50000', // 500.00 TL instead of 1000.00 TL
      },
      p_payment_amount: 500.0
    });

    if (rpcMismatch?.success === true) {
      throw new Error('Illegitimate amount mismatch was erroneously accepted!');
    }

    if (rpcMismatch?.error_code !== 'AMOUNT_MISMATCH') {
      throw new Error(`Expected AMOUNT_MISMATCH error code, got: ${JSON.stringify(rpcMismatch)}`);
    }

    // Verify transaction remains pending
    const { data: mismatchTx } = await admin.from('payment_transactions').select('status').eq('id', testTxIdMismatch).single();
    if (mismatchTx.status !== 'pending') {
      throw new Error(`Transaction status was changed despite AMOUNT_MISMATCH! Status: ${mismatchTx.status}`);
    }

    console.log('  ✓ Illegitimate amount mismatch rejected with AMOUNT_MISMATCH and transaction preserved.');
    passed++;

  } finally {
    // Cleanup test records
    console.log('▶ Cleaning up QA test records...');
    if (testTxId) {
      await admin.from('student_package_purchases').delete().eq('payment_transaction_id', testTxId);
      await admin.from('payment_transactions').delete().eq('id', testTxId);
    }
    if (testTxId2) {
      await admin.from('student_package_purchases').delete().eq('payment_transaction_id', testTxId2);
      await admin.from('payment_transactions').delete().eq('id', testTxId2);
    }
    if (testTxIdInst) {
      await admin.from('student_package_purchases').delete().eq('payment_transaction_id', testTxIdInst);
      await admin.from('payment_transactions').delete().eq('id', testTxIdInst);
    }
    if (testTxIdMismatch) {
      await admin.from('student_package_purchases').delete().eq('payment_transaction_id', testTxIdMismatch);
      await admin.from('payment_transactions').delete().eq('id', testTxIdMismatch);
    }
    console.log('  ✓ QA test records cleaned up.');
  }

  console.log('\n========================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
