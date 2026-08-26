import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mwbrlfmdpbkmdjroxhcc.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required in .env.local');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey);

async function audit() {
  console.log('=== AUDITING RECENT PAYMENTS & PACKAGE ENTITLEMENTS ===\n');

  // 1. Get all paid payment_transactions
  const { data: paidTxs, error: txErr } = await admin
    .from('payment_transactions')
    .select('id, student_user_id, package_id, public_reference, provider, provider_transaction_id, amount, currency, status, payer_name, payer_email, created_at, paid_at, metadata')
    .eq('status', 'paid')
    .order('created_at', { ascending: false });

  if (txErr) {
    console.error('Error fetching paid transactions:', txErr);
    process.exit(1);
  }

  console.log(`Found ${paidTxs.length} PAID transactions in database.\n`);

  let missingEntitlements = [];
  let validEntitlements = [];

  for (const tx of paidTxs) {
    // Look up student_package_purchases
    const { data: purchase, error: pErr } = await admin
      .from('student_package_purchases')
      .select('*')
      .eq('payment_transaction_id', tx.id)
      .maybeSingle();

    // Check student profile
    let studentProfile = null;
    if (tx.student_user_id) {
      const { data: sp } = await admin
        .from('student_profiles')
        .select('id, full_name, email, active')
        .eq('id', tx.student_user_id)
        .maybeSingle();
      studentProfile = sp;
    } else if (tx.payer_email) {
      const { data: sp } = await admin
        .from('student_profiles')
        .select('id, full_name, email, active')
        .eq('email', tx.payer_email.toLowerCase().trim())
        .maybeSingle();
      studentProfile = sp;
    }

    if (!purchase) {
      missingEntitlements.push({
        txId: tx.id,
        ref: tx.public_reference,
        provider: tx.provider,
        amount: `${tx.amount} ${tx.currency}`,
        payerEmail: tx.payer_email ? tx.payer_email.slice(0, 3) + '***@' + tx.payer_email.split('@')[1] : 'N/A',
        studentUserId: tx.student_user_id,
        studentFound: Boolean(studentProfile),
        packageId: tx.package_id,
        createdAt: tx.created_at,
        paidAt: tx.paid_at,
      });
    } else {
      validEntitlements.push({
        txId: tx.id,
        purchaseId: purchase.id,
        lessonCount: purchase.lesson_count,
        lessonsUsed: purchase.lessons_used,
        studentUserId: purchase.student_user_id,
      });
    }
  }

  console.log(`Summary:`);
  console.log(`- Total Paid Transactions: ${paidTxs.length}`);
  console.log(`- Verified with Package Entitlement: ${validEntitlements.length}`);
  console.log(`- Missing Package Entitlement: ${missingEntitlements.length}\n`);

  if (missingEntitlements.length > 0) {
    console.log('--- MISSING ENTITLEMENT DETAILS (REDACTED) ---');
    console.table(missingEntitlements);
  } else {
    console.log('✓ All paid transactions currently have matching package purchases.');
  }

  // Also check if any student_profiles have mismatching id with auth.users
  const { data: profiles } = await admin.from('student_profiles').select('id, email').limit(10);
  console.log(`\nSample Student Profiles count checked: ${profiles?.length || 0}`);
}

audit().catch(console.error);
