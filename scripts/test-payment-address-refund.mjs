import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const registration = read("src/components/auth/UnifiedLoginPage.tsx");
const auth = read("src/lib/student/auth.ts");
const paymentPage = read("src/components/payment/PaymentPage.tsx");
const hosted = read("src/components/payment/HostedCardPanel.tsx");
const client = read("src/lib/payments/client.ts");
const token = read("supabase/functions/paytr-create-token/index.ts");
const refund = read("supabase/functions/paytr-refund/index.ts");
const migration = read("supabase/migrations/20260901100000_payment_address_refund_system.sql");
const outbox = read("supabase/functions/process-notification-outbox/index.ts");
const refundCopy = read("src/content/payment-refund.ts");
const paymentCopy = read("src/content/payment.ts");

// Registration and checkout address contract.
assert.doesNotMatch(registration, /register-address|İletişim Adresi|Contact Address|contactAddress/);
assert.doesNotMatch(auth.split("export async function registerStudent")[1].split("export async function resendGuardianConfirmation")[0], /contact_address|contactAddress/);
assert.match(paymentPage, /Fatura \/ Ödeme Adresi|billingAddress/);
assert.match(paymentCopy, /Billing Address/);
assert.match(refundCopy, /Partially Refunded|Kısmen İade Edildi/);
assert.match(hosted, /payerAddress/);
assert.match(client, /payerAddress: string/);
assert.match(token, /payload\.payerAddress/);
assert.match(token, /contact_address: payerAddress/);
assert.match(token, /user_address: payerAddress/);
assert.doesNotMatch(token, /user_address:\s*["']Türkiye["']|Emaar|company address|payerAddress\s*\|\|/i);
assert.match(token, /payer_name: payerName/);
assert.match(token, /payer_email: verifiedEmail/);
assert.match(token, /payer_phone: payerPhone/);
assert.match(token, /package_owner_student_id: learnerId/);
assert.match(token, /finalAmount = Math\.max\(0, Math\.round\(\(baseAmount - discountAmount\)/);
assert.doesNotMatch(paymentPage + hosted + client + token, /cardNumber|\bPAN\b\s*:|\bCVV\b\s*:/);

// Provider contract and server-only secrets.
assert.match(refund, /https:\/\/www\.paytr\.com\/odeme\/iade/);
assert.match(refund, /reference_no: providerReference/);
assert.match(refund, /PAYTR_MERCHANT_KEY/);
assert.doesNotMatch(read("src/lib/admin/payments.ts") + paymentPage, /PAYTR_MERCHANT_KEY|PAYTR_MERCHANT_SALT/);

// Authorization, validation, reservation, and retry-safe state machine.
assert.match(refund, /ADMIN_REQUIRED/);
assert.match(migration, /v_tx\.status<>'paid'/);
assert.match(migration, /REFUND_AMOUNT_EXCEEDS_AVAILABLE/);
assert.match(migration, /REFUND_LESSONS_EXCEED_UNUSED/);
assert.match(migration, /idempotency_key text not null unique/);
assert.match(migration, /status='refund_pending'/);
assert.match(migration, /status='active'.*status='refund_pending'/s);
assert.match(refund, /claim\.status === "provider_succeeded"/);
assert.match(refund, /if \(!claim\.claimed\)/);
assert.match(refund, /The provider was not called again/);
assert.match(migration, /if v_refund\.status='refund_succeeded'/);
assert.match(migration, /lesson_count=lesson_count-v_refund\.lesson_rights_to_revoke/);
assert.doesNotMatch(migration.split("create or replace function public.finalize_payment_refund")[1], /lessons_used\s*=/);
assert.match(migration, /adjustment_type,'refund'|-v_refund\.lesson_rights_to_revoke/);
assert.match(migration, /payment\.refunded:'\|\|v_refund\.id\|\|':account_holder'/);
assert.match(outbox, /payment_refunded_account_holder/);
assert.match(outbox, /relationship_role/);

// Pure entitlement/refund regression model (no network, no charge, no refund).
function finalize(state, amount, revoke) {
  if (amount <= 0 || amount > state.captured - state.refunded) throw new Error("REFUND_AMOUNT_EXCEEDS_AVAILABLE");
  if (revoke <= 0 || revoke > state.total - state.used) throw new Error("REFUND_LESSONS_EXCEED_UNUSED");
  return {
    ...state,
    refunded: state.refunded + amount,
    total: state.total - revoke,
    refundStatus: state.refunded + amount === state.captured ? "full" : "partial",
  };
}
const partial = finalize({ captured: 27000, refunded: 0, total: 10, used: 3 }, 5400, 2);
assert.deepEqual(partial, { captured: 27000, refunded: 5400, total: 8, used: 3, refundStatus: "partial" });
const full = finalize({ captured: 27000, refunded: 0, total: 10, used: 3 }, 27000, 7);
assert.equal(full.used, 3);
assert.equal(full.total - full.used, 0);
assert.equal(full.refundStatus, "full");
assert.throws(() => finalize({ captured: 100, refunded: 0, total: 10, used: 3 }, 101, 1), /REFUND_AMOUNT/);
assert.throws(() => finalize({ captured: 100, refunded: 0, total: 10, used: 3 }, 50, 8), /REFUND_LESSONS/);

console.log("payment/address/refund regression: PASS (static request capture + pure state model; no provider call)");
