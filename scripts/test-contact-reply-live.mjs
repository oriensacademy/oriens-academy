import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "")];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = env.ADMIN_AUTH_EMAIL || env.ORIENS_LOCAL_ADMIN_EMAIL;
const adminPassword = env.ORIENS_LOCAL_ADMIN_PASSWORD;
assert(url && anonKey && serviceKey && adminEmail && adminPassword, "Live QA environment is incomplete");
const qaRecipient = "admin@oriens-academy.com";

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const caller = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: authData, error: authError } = await caller.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
assert.ifError(authError);
assert(authData.session, "Admin session was not created");
const { data: isAdmin, error: adminError } = await caller.rpc("is_admin");
assert.ifError(adminError);
assert.equal(isAdmin, true, "Authenticated QA account is not an admin");

const qaRunId = crypto.randomUUID();
const { data: contact, error: contactError } = await admin.from("contact_requests").insert({
  full_name: "ORIENS CONTACT QA",
  email: qaRecipient,
  phone: null,
  subject: `[ORIENS CONTACT QA] ${qaRunId.slice(0, 8)}`,
  message: "[ORIENS CONTACT QA] Original inbound message for production reply-flow verification.",
  locale: "tr",
  status: "new",
  privacy_consent: true,
  source: "website",
  metadata: { qa: true, qa_run_id: qaRunId },
}).select("id,email").single();
assert.ifError(contactError);
assert(contact, "QA contact request was not created");

const idempotencyKey = crypto.randomUUID();
const payload = {
  contactRequestId: contact.id,
  messageText: "[ORIENS CONTACT QA] Bu mesaj, yönetici paneli iletişim yanıt akışının güvenli üretim doğrulamasıdır.",
  idempotencyKey,
};
const first = await caller.functions.invoke("send-contact-reply", { body: payload });
assert.ifError(first.error);
assert.equal(first.data?.success, true, `First send failed: ${first.data?.error_code || "unknown"}`);
assert.equal(first.data?.duplicate, false, "First send was incorrectly marked duplicate");

const second = await caller.functions.invoke("send-contact-reply", { body: payload });
assert.ifError(second.error);
assert.equal(second.data?.success, true, "Idempotent replay did not return the sent result");
assert.equal(second.data?.duplicate, true, "Idempotent replay was not recognized as duplicate");

const { data: replies, error: repliesError } = await admin
  .from("contact_replies")
  .select("id,sender_email,recipient_email,delivery_status,external_message_id,sent_at,idempotency_key")
  .eq("contact_request_id", contact.id);
assert.ifError(repliesError);
assert.equal(replies?.length, 1, "Duplicate invocation created more than one reply row");
assert.equal(replies[0].sender_email, "info@oriens-academy.com");
assert.equal(replies[0].recipient_email, qaRecipient);
assert.equal(replies[0].delivery_status, "sent");
assert(replies[0].external_message_id, "Provider message ID was not stored");
assert(replies[0].sent_at, "Sent timestamp was not stored");
assert.equal(replies[0].idempotency_key, idempotencyKey);

console.log(JSON.stringify({
  status: "PASS",
  recipient: qaRecipient,
  sender: "info@oriens-academy.com",
  contactRequestId: contact.id,
  replyId: replies[0].id,
  deliveryStatus: replies[0].delivery_status,
  duplicateRows: 0,
}, null, 2));
