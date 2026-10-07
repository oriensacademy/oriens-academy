import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const sourcePath = new URL("../src/lib/admin/audit-presentation.ts", import.meta.url);
const source = await readFile(sourcePath, "utf8");
const transpiled = ts.transpileModule(source.replace(/^import type .*;\r?\n/m, ""), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const presentation = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`);

const row = (overrides = {}) => ({
  id: 1,
  action: "legacy.updated",
  actor_user_id: null,
  created_at: "2026-09-05T10:00:00.000Z",
  entity_id: null,
  entity_type: "legacy_entity",
  metadata: null,
  ...overrides,
});

assert.deepEqual(presentation.asAuditMetadata(null), {}, "null metadata must normalize to an object");
assert.deepEqual(presentation.asAuditMetadata([]), {}, "unexpected array metadata must normalize safely");
assert.equal(presentation.paymentCorrelationReference(row()), "", "null entity must not create a reference");
assert.equal(presentation.paymentCorrelationReference(row({ entity_id: "ORI20260001" })), "ORI20260001", "ORI entity must remain text");
assert.equal(presentation.auditActionLabel("future.unknown"), "future.unknown", "unknown action must fall back to raw text");
assert.equal(presentation.auditEntityLabel("future_entity"), "future_entity", "unknown entity must fall back to raw text");

const failed = row({
  action: "payment_failed",
  entity_type: "payment_transaction",
  entity_id: "ORI20260002",
  metadata: { amount_kurus: 125_50, failed_reason_code: null, failed_reason_msg: null },
});
assert.equal(presentation.isPaymentAuditLog(failed), true, "failed payment must use structured detail");
assert.match(presentation.formatPaymentAmount(failed.metadata), /125/, "payment amount must format safely");
assert.equal(presentation.formatPaymentAmount({ amount_kurus: "not-a-number" }), null, "invalid amount must be omitted");

const timeline = presentation.correlatePaymentTimeline([
  row({ id: 3, action: "payment_completed", entity_type: "payment_transaction", entity_id: "ORI20260003", created_at: "2026-09-05T10:00:03.000Z" }),
  row({ id: 1, action: "payment_session_requested", entity_type: "payment_transaction", entity_id: "ORI20260003", created_at: "2026-09-05T10:00:01.000Z" }),
  row({ id: 2, action: "paytr_token_created", entity_type: "payment_transaction", entity_id: "OTHER", metadata: { public_reference: "ORI20260003" }, created_at: "2026-09-05T10:00:02.000Z" }),
  row({ id: 4, action: "legacy.updated", entity_id: "OTHER" }),
], "ORI20260003");
assert.deepEqual(timeline.map((item) => item.id), [1, 2, 3], "timeline correlation must be exact and chronological");

const largeJson = presentation.safeAuditJson({ payload: "x".repeat(25_000) });
assert.ok(largeJson.length < 21_000 && largeJson.includes("kısaltıldı"), "large metadata must be truncated");

const detailSource = await readFile(new URL("../src/components/admin/AuditDetailSheet.tsx", import.meta.url), "utf8");
assert.match(detailSource, /const logId = log\?\.id \?\? null/);
assert.match(detailSource, /if \(logId !== prevLogId\)/, "closed detail must compare normalized null IDs");
assert.doesNotMatch(detailSource, /if \(log\?\.id !== prevLogId\)/, "undefined/null render loop must not return");

const pageSource = await readFile(new URL("../src/app/admin/denetim/page.tsx", import.meta.url), "utf8");
// Referans Denetim ekranı (#view-denetim) satır detay paneli içermez; liste salt okunur
// ve boş/eksik veride güvenli varsayılanlarla çizilir.
assert.doesNotMatch(pageSource, /admin_delete_audit_log|deleteAuditLog|\.delete\(/, "audit page must stay read-only");
assert.match(pageSource, /const EMPTY_LOGINS: AdminLoginEvent\[\] = \[\];/, "missing login data must fall back to an empty list");
assert.match(pageSource, /const EMPTY_ACTIONS: PanelAction\[\] = \[\];/, "missing audit data must fall back to an empty list");

console.log("audit page resilience: PASS");
