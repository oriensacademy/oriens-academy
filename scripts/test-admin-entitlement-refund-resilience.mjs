import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const migration = read("supabase/migrations/20260906240000_refund_entitlement_and_notification_hardening.sql");
const refundEdge = read("supabase/functions/paytr-refund/index.ts");
const refundDialog = read("src/components/admin/PaymentRefundDialog.tsx");
const adminDashboard = read("src/lib/admin/dashboard.ts");
const adminDashboardPage = read("src/app/admin/page.tsx");
const studentPortal = read("src/components/student/StudentPortal.tsx");
const studentManager = read("src/components/admin/StudentLearningManager.tsx");
const packageNames = read("src/lib/packages/display.ts");
const notificationWorker = read("supabase/functions/process-notification-outbox/index.ts");

for (const code of [
  "FULL_REFUND_REQUIRES_ALL_UNUSED_LESSONS",
  "ALL_UNUSED_LESSONS_REQUIRE_FULL_REFUND",
  "PARTIAL_REFUND_MUST_KEEP_ONE_LESSON",
]) assert.match(migration, new RegExp(code));
assert.match(migration, /for update/i);
assert.match(migration, /send_notification boolean not null default false/);
assert.match(migration, /if v_refund\.send_notification then/);
assert.match(refundEdge, /p_send_notification: sendNotification/);
// Referans #od-iade penceresinde bildirim seçeneği yok: panel iadesi e-posta
// göndermez (sunucudaki send_notification varsayılanı false ile aynı). Kısmi
// iadede iptal edilecek hak tutara göre hesaplanır ve en az bir hak bırakır.
assert.match(refundDialog, /sendNotification: false/);
assert.doesNotMatch(refundDialog, /odi-mail|odi-ders|Veliye gönder|İadeyi onayla/);
assert.match(refundDialog, /Math\.min\(remaining - 1, Math\.max\(1, proportional\)\)/);

function finalize(state, amount, revoke, providerSucceeded = true) {
  const refundable = state.captured - state.refunded;
  const unused = state.total - state.used;
  if (amount === refundable && revoke !== unused) throw new Error("FULL_REFUND_REQUIRES_ALL_UNUSED_LESSONS");
  if (revoke === unused && amount !== refundable) throw new Error("ALL_UNUSED_LESSONS_REQUIRE_FULL_REFUND");
  if (amount < refundable && unused - revoke < 1) throw new Error("PARTIAL_REFUND_MUST_KEEP_ONE_LESSON");
  if (!providerSucceeded) return state;
  const result = { ...state, refunded: state.refunded + amount, total: state.total - revoke };
  return { ...result, refundStatus: result.refunded === result.captured ? "full" : "partial", packageStatus: result.total - result.used === 0 ? "refunded" : "active" };
}

const oneLira = finalize({ captured: 1, refunded: 0, total: 1, used: 0, aggregateRemaining: 11 }, 1, 1);
assert.deepEqual(oneLira, { captured: 1, refunded: 1, total: 0, used: 0, aggregateRemaining: 11, refundStatus: "full", packageStatus: "refunded" });
assert.equal(oneLira.aggregateRemaining - 1, 10);
assert.throws(() => finalize({ captured: 1, refunded: 0, total: 1, used: 0 }, 1, 0), /FULL_REFUND/);
assert.throws(() => finalize({ captured: 100, refunded: 0, total: 10, used: 2 }, 50, 8), /ALL_UNUSED/);
assert.equal(finalize({ captured: 100, refunded: 0, total: 10, used: 2 }, 25, 2).total, 8);
const unchanged = { captured: 100, refunded: 0, total: 10, used: 2 };
assert.deepEqual(finalize(unchanged, 25, 2, false), unchanged);
assert.match(refundEdge, /if \(!claim\.claimed/);
assert.match(refundEdge, /never issue the refund a second time/i);

// Paket adı referans fiyat kartlarıyla aynı: "1 Ders" / "{n} Derslik Paket".
assert.match(packageNames, /`\$\{count\} Derslik Paket`/);
assert.match(studentPortal, /packageDisplayName/);
assert.match(studentManager, /packageDisplayName/);
assert.doesNotMatch(studentPortal, /function getPurchasePackageName|function getHumanPackageName/);
assert.match(studentPortal, /const statusLabel = isRefunded/);
assert.match(studentManager, /const statusLabel = isRefunded/);

// Panel referans #view-panel "Gelir trendi" kartına geçti: son 6 ay, iadeler
// düşülmüş net tahsilat (eski 21 günlük grafikler kaldırıldı).
assert.match(adminDashboard, /Array\.from\(\{ length: 6 \}/);
assert.match(adminDashboard, /Number\(row\.amount \|\| 0\) - Number\(row\.refunded_amount \|\| 0\)/);
assert.match(adminDashboardPage, /Gelir trendi/);
assert.match(adminDashboardPage, /Son 6 ay · iadeler düşülmüş net tahsilat/);

assert.match(studentManager, /E-posta gönderim sırasında/);
assert.match(studentManager, /deliveryStatusText/);
assert.match(migration, /package\.rights_summary/);
assert.match(notificationWorker, /Mevcut ders haklarınız aşağıdaki gibidir/);
assert.doesNotMatch(notificationWorker.split('row.template === "package_rights_summary"')[1].split("} else if")[0], /Talebiniz üzerine|Özel Paket|Satın aldığınız özel paket/);

console.log("admin entitlement/refund resilience: PASS (pure model + source invariants; no PayTR call)");
