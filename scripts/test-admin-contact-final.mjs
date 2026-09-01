import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const sidebar = read("src/components/admin/AdminSidebar.tsx");
const settings = read("src/app/admin/ayarlar/page.tsx");
const dashboard = read("src/app/admin/page.tsx");
const dashboardData = read("src/lib/admin/dashboard.ts");
const evaluations = read("src/app/admin/degerlendirmeler/page.tsx");
const detail = read("src/components/admin/ContactDetailSheet.tsx");
const contacts = read("src/lib/admin/contacts.ts");
const edge = read("supabase/functions/send-contact-reply/index.ts");
const migration = read("supabase/migrations/20260901130000_contact_reply_history.sql");

for (const unwanted of [
  "Operasyonel Kopya:",
  "Korumalı Sistem Anahtarları",
  "navigation.show_pricing",
  "notification.admin_locale",
  "Ödeme Bilgileri / Payment Details",
  "payment.bank_account_holder",
  "payment.bank_name",
  "payment.iban",
]) {
  assert(!settings.includes(unwanted), `settings still exposes: ${unwanted}`);
}

assert(!sidebar.includes('href: "/admin/denetim"'), "Audit Logs remains in primary sidebar");
assert(settings.includes('href="/admin/denetim"'), "Audit Logs is not reachable from Settings");
assert(!sidebar.includes('href: "/admin/icerik"'), "content management remains in primary sidebar");
assert(!sidebar.includes('href: "/admin/odevler"'), "homework remains in primary sidebar");
assert(!dashboard.includes('href="/admin/icerik"'), "dashboard links to content management");
assert(!dashboard.includes('href="/admin/odevler"'), "dashboard links to homework");
assert(!dashboard.includes("Bekleyen Ödev"), "homework metric remains on dashboard");
assert(!dashboardData.includes("pendingHomework"), "dashboard still queries homework metrics");

assert.equal((sidebar.match(/href: "\/admin\/degerlendirmeler"/g) || []).length, 1, "Evaluations must have exactly one primary sidebar item");
assert(sidebar.includes('labelEn: "Evaluations"'), "Evaluations English label is missing");
assert(evaluations.includes("filterSubmissionsOnly"), "Evaluations does not use the existing review surface");
assert(dashboard.includes('href="/admin/degerlendirmeler"'), "dashboard does not link to Evaluations");

const originalIndex = detail.indexOf("contact.message");
const replyIndex = detail.indexOf("replies.map");
assert(originalIndex >= 0 && replyIndex > originalIndex, "original request is not rendered before replies");
assert(detail.includes("reply.sender_email") && detail.includes("reply.recipient_email"), "thread sender/recipient fields are missing");
assert(detail.includes("reply.sent_at || reply.created_at"), "thread timestamps are missing");
assert(detail.includes("deliveryLabel(reply.delivery_status)"), "delivery status is missing");
assert(detail.includes("sendAdminContactReply"), "reply composer is not connected to send flow");
assert(!detail.includes("mailto:"), "contact detail still uses mailto");
assert(contacts.includes('.from("contact_replies")'), "reply history is not fetched from its dedicated store");

assert(migration.includes("references public.contact_requests(id) on delete restrict"), "contact reply FK is missing or unsafe");
assert(migration.includes("contact_replies_request_idempotency unique"), "database idempotency constraint is missing");
assert(migration.includes("CONTACT_REPLY_CONTENT_IMMUTABLE"), "sent history immutability guard is missing");
assert(migration.includes('for select\n  to authenticated\n  using (public.is_admin())'), "admin-only reply read policy is missing");
assert(!migration.includes("to anon"), "reply history grants access to anon");

assert(edge.includes('caller.rpc("is_admin")'), "Edge send path does not verify admin authorization");
assert(edge.indexOf('caller.rpc("is_admin")') < edge.indexOf('.from("contact_replies")\n    .insert'), "admin authorization occurs after reply claim");
assert(edge.includes('.from("contact_requests")') && edge.includes("recipientEmail = String(contact.email"), "recipient is not resolved from canonical contact request");
assert(edge.includes("sender_email: INFO_EMAIL") && edge.includes('email: INFO_EMAIL'), "info@ sender is not server-controlled");
assert(edge.includes('claimError?.code === "23505"'), "duplicate reply claim is not handled");
assert(edge.includes("sendTransactionalEmail"), "reply does not use Workspace transactional email service");
assert(edge.includes('delivery_status: sent ? "sent" : "failed"'), "delivery result is not persisted");

console.log(JSON.stringify({
  status: "PASS",
  settingsCleanup: true,
  sidebarCleanup: true,
  dashboardCleanup: true,
  evaluationsPrimaryModule: true,
  conversationThread: true,
  contactReplyPersistence: true,
  idempotency: true,
  adminAuthorization: true,
  workspaceSender: "info@oriens-academy.com",
}, null, 2));
