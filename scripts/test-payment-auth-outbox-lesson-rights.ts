import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Session } from "@supabase/supabase-js";
import { isUsablePaymentSession, resolvePaymentSession } from "../src/lib/payments/client";
import { paymentErrorMessage } from "../src/lib/payments/public-errors";
import { getAdminPaymentStatus } from "../src/lib/admin/payment-status";
import { previewLessonAdjustment } from "../src/lib/admin/lesson-adjustments";

const root = process.cwd();
const now = 2_000_000_000;

function token(sub: string, exp: number, role = "authenticated") {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({ sub, exp, role })}.signature`;
}

function session(accessToken: string, userId = "user-1"): Session {
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: "refresh",
    user: { id: userId } as Session["user"],
  };
}

async function main() {
const fresh = session(token("user-1", now + 3600));
assert.equal(isUsablePaymentSession(fresh, now), true, "fresh authenticated user JWT must be accepted");
assert.equal(isUsablePaymentSession(session(token("user-1", now + 30)), now), false, "near-expiry JWT must refresh");
assert.equal(isUsablePaymentSession(session(token("user-2", now + 3600)), now), false, "JWT subject must match session user");
assert.equal(isUsablePaymentSession(session(token("user-1", now + 3600, "anon")), now), false, "anon JWT must not be accepted");
assert.equal(isUsablePaymentSession(session("mock-dev-access-token"), now), false, "mock token must not reach payment functions");

let refreshCalls = 0;
const freshResolved = await resolvePaymentSession({ auth: {
  getSession: async () => ({ data: { session: fresh }, error: null }),
  refreshSession: async () => { refreshCalls += 1; return { data: { session: fresh }, error: null }; },
} } as never, now);
assert.equal(freshResolved?.access_token, fresh.access_token);
assert.equal(refreshCalls, 0, "fresh session must not refresh unnecessarily");

const refreshed = session(token("user-1", now + 7200));
const refreshedResolved = await resolvePaymentSession({ auth: {
  getSession: async () => ({ data: { session: session(token("user-1", now - 1)) }, error: null }),
  refreshSession: async () => { refreshCalls += 1; return { data: { session: refreshed }, error: null }; },
} } as never, now);
assert.equal(refreshedResolved?.access_token, refreshed.access_token, "expired session must refresh once");
assert.equal(refreshCalls, 1);

const failedRefresh = await resolvePaymentSession({ auth: {
  getSession: async () => ({ data: { session: null }, error: null }),
  refreshSession: async () => ({ data: { session: null }, error: new Error("refresh failed") }),
} } as never, now);
assert.equal(failedRefresh, null, "failed refresh must return local session expiry");
assert.equal(paymentErrorMessage("INVALID_SESSION", "tr", "Invalid user session."), "Oturumunuzun süresi dolmuş. Lütfen yeniden giriş yapın.");
assert.equal(paymentErrorMessage("EMAIL_NOT_VERIFIED", "tr"), "Ödeme yapabilmek için e-posta adresinizi doğrulamanız gerekiyor.");
assert.equal(paymentErrorMessage("LEARNER_ACCESS_DENIED", "tr"), "Bu ödeme için hesap ve öğrenci bilgileri doğrulanamadı.");

assert.equal(getAdminPaymentStatus("pending").label, "Bekliyor");
assert.equal(getAdminPaymentStatus("paid").label, "Ödendi");
assert.equal(getAdminPaymentStatus("failed", { paytr_callback: { failed_reason_code: "6" } }).label, "Vazgeçildi");
assert.equal(getAdminPaymentStatus("failed", { paytr_callback: { failed_reason_code: "0", failed_reason_msg: "3D doğrulama tamamlanmadı" } }).label, "3D Doğrulaması Tamamlanmadı");
assert.equal(getAdminPaymentStatus("failed", { paytr_callback: { failed_reason_msg: "timeout" } }).label, "Zaman Aşımı");
assert.equal(getAdminPaymentStatus("failed", { paytr_callback: { failed_reason_code: "1", failed_reason_msg: "Yetersiz bakiye" } }).label, "Başarısız");

assert.deepEqual(previewLessonAdjustment(10, 3, 1), { oldLessonCount: 10, newLessonCount: 11, lessonsUsed: 3, oldRemaining: 7, newRemaining: 8, valid: true });
assert.equal(previewLessonAdjustment(10, 3, 5).newRemaining, 12, "+N must add unused rights");
assert.equal(previewLessonAdjustment(10, 3, -1).newRemaining, 6, "-1 must remove one unused right");
assert.equal(previewLessonAdjustment(10, 3, -7).newRemaining, 0, "-N may reduce remaining rights to zero");
assert.equal(previewLessonAdjustment(10, 3, -8).valid, false, "negative remaining must be rejected");

const paymentClient = readFileSync(resolve(root, "src/lib/payments/client.ts"), "utf8");
assert.match(paymentClient, /if \(!session\)[\s\S]*SESSION_EXPIRED[\s\S]*functions\.invoke/, "local expiry must precede gateway invocation");
assert.doesNotMatch(paymentClient, /headers:\s*token\s*\?/, "payment invocation must never fall back to an empty header object");

const worker = readFileSync(resolve(root, "supabase/functions/process-notification-outbox/index.ts"), "utf8");
assert.match(worker, /profile\?\.active === true && profile\.role === "admin"/, "immediate worker kick must authorize active admins");
assert.match(worker, /OUTBOX_SCHEDULER_KEY_SHA256/, "scheduled worker kick must use a configured key hash");
assert.doesNotMatch(worker, /parsed\.role ===/, "worker must not trust an unverified JWT role claim");
assert.match(worker, /claim_email_notifications/, "worker must retain atomic claim RPC");

const migration = readFileSync(resolve(root, "supabase/migrations/20260901150000_payment_auth_outbox_lesson_rights.sql"), "utf8");
assert.match(migration, /for update;/i, "lesson adjustment must lock the purchase row");
assert.match(migration, /v_new_remaining < 0/, "negative remaining must be rejected");
assert.match(migration, /adjustment_type[\s\S]*'manual_adjustment'/, "manual adjustment ledger must be written");
assert.match(migration, /process-notification-outbox-every-minute[\s\S]*'\* \* \* \* \*'/, "recurring one-minute outbox safety net must exist");
assert.doesNotMatch(migration, /search_autocomplete|university_search|search_university/, "migration must not contain university search work");

const learningUi = readFileSync(resolve(root, "src/components/admin/StudentLearningManager.tsx"), "utf8");
assert.match(learningUi, /Ders Hakkı Ekle/);
assert.match(learningUi, /Ders Hakkı Azalt/);
assert.match(learningUi, /Geçmiş Ders Ekle|lessonCopy\.pastAction/);
assert.match(learningUi, /Ders Yapıldı/);
assert.doesNotMatch(learningUi, /window\.confirm/);

console.log("Payment/auth/outbox/lesson-right regression checks passed.");
}

void main();
