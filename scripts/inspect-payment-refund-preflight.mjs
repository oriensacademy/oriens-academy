import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_READ_CREDENTIALS_MISSING");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const [payments, captured, addresses, purchases, refundsProbe, paymentSchemaProbe] = await Promise.all([
  db.from("payment_transactions").select("id", { count: "exact", head: true }),
  db.from("payment_transactions").select("id", { count: "exact", head: true }).eq("status", "paid").eq("provider", "paytr").eq("payment_method", "card"),
  db.from("guardian_accounts").select("user_id", { count: "exact", head: true }).is("contact_address", null),
  db.from("student_package_purchases").select("id,lesson_count,lessons_used,status"),
  db.from("payment_refunds").select("id,payment_transaction_id,package_purchase_id,idempotency_key,provider_reference,requested_amount,lesson_rights_to_revoke,reason,status,provider_response,provider_error_code,provider_error_message,provider_call_started_at,provider_succeeded_at,finalized_at,failed_at,created_by,created_at,updated_at", { count: "exact", head: true }),
  db.from("payment_transactions").select("id,refunded_amount,refund_status,last_refunded_at,last_refund_reason,paytr_refund_reference", { count: "exact", head: true }),
]);

for (const [name, result] of Object.entries({ payments, captured, addresses, purchases })) {
  if (result.error) throw new Error(`${name.toUpperCase()}_READ_FAILED: ${result.error.message}`);
}
const purchaseRows = purchases.data ?? [];
console.log(JSON.stringify({
  readOnly: true,
  paymentRows: payments.count ?? 0,
  capturedPaytrCardRows: captured.count ?? 0,
  accountHoldersMissingAddress: addresses.count ?? 0,
  packagePurchaseRows: purchaseRows.length,
  unusedLessonRights: purchaseRows.reduce((sum, row) => sum + Math.max(0, Number(row.lesson_count) - Number(row.lessons_used)), 0),
  refundSchemaBeforeMigration: refundsProbe.error ? `incompatible_or_absent:${refundsProbe.error.code || "unknown"}` : "compatible_columns_present",
  refundRowsBeforeMigration: refundsProbe.error ? null : refundsProbe.count ?? 0,
  paymentRefundColumnsBeforeMigration: paymentSchemaProbe.error ? "absent" : "present",
  mutations: 0,
}, null, 2));
