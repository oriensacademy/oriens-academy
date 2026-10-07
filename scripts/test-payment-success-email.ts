import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderPaymentSuccessEmail } from "../supabase/functions/_shared/email/payment-success";

const fixture = {
  reference: "ORI-QA-001",
  payer_name: "Test Kullanıcı",
  payer_email: "test@example.test",
  package_id: "package5",
  lesson_count: 5,
  amount: 15000,
  currency: "TRY",
};

const tr = renderPaymentSuccessEmail("guardian", fixture, "tr");
const expectedTrTitle = "Ödemeniz Başarıyla Alındı ve Ders Paketiniz Tanımlandı";
const expectedTrIntro = "Sayın Test Kullanıcı, ödemeniz başarıyla alınmış ve satın almış olduğunuz ders paketi hesabınıza tanımlanmıştır.";
assert.equal(tr.subject, expectedTrTitle);
assert.equal(tr.title, expectedTrTitle);
assert.match(tr.text, new RegExp(expectedTrIntro));
assert.match(tr.bodyHtml, new RegExp(expectedTrIntro));
for (const label of ["Referans", "Ad Soyad", "Paket İçeriği"]) assert.match(tr.bodyHtml, new RegExp(label));
for (const forbidden of ["E-posta", "Email", "Payer", "Ödeyen", "[ORIENS]", "Payment Received Successfully"]) assert.doesNotMatch(tr.bodyHtml, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.doesNotMatch(tr.subject, /ORI-QA-001|\[ORIENS\]/);
assert.match(tr.bodyHtml, /ORI-QA-001/);
assert.match(tr.bodyHtml, /5 Ders/);

const enFixture = { ...fixture, reference: "ORI-QA-002" };
const en = renderPaymentSuccessEmail("guardian", enFixture, "en");
assert.equal(en.subject, "Payment Received Successfully");
assert.equal(en.title, "Payment Received Successfully");
for (const label of ["Reference", "Full Name", "Package Contents"]) assert.match(en.bodyHtml, new RegExp(label));
for (const forbidden of ["Email", "Payer", "Amount"]) assert.doesNotMatch(en.bodyHtml, new RegExp(forbidden));
for (const forbidden of ["Referans", "Ödeyen", "E-posta", "Paket", "Tutar", "[ORIENS]"]) assert.doesNotMatch(en.bodyHtml, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.doesNotMatch(en.subject, /ORI-QA-002|\[ORIENS\]/);
assert.match(en.bodyHtml, /ORI-QA-002/);
assert.match(en.bodyHtml, /5 Lessons/);

const admin = renderPaymentSuccessEmail("admin", fixture, "tr");
assert.equal(admin.subject, "Payment Received Successfully");
assert.doesNotMatch(admin.subject, /ORI-QA-001|\[ORIENS\]/);
assert.match(admin.bodyHtml, /ORI-QA-001/);
assert.match(admin.bodyHtml, /Payer[\s\S]*test@example\.test/);

for (const rendered of [tr, en, admin]) {
  assert.match(rendered.bodyHtml, /<table role="presentation"/);
  assert.match(rendered.bodyHtml, /<td[^>]*>:\s*<\/td>/);
  assert.doesNotMatch(rendered.bodyHtml, /\[ORIENS\]/);
}

const migration = readFileSync("supabase/migrations/20260922120000_single_canonical_payment_success_delivery.sql", "utf8");
assert.match(migration, /preferred_language[\s\S]*guardian_accounts/);
assert.match(migration, /payment\.success:' \|\| v_reference \|\| ':customer'/);
assert.equal((migration.match(/enqueue_email_notification\s*\(/g) || []).length, 1);
assert.doesNotMatch(migration, /payment_success_admin/);

type SimulatedDelivery = { reference: string; recipient: string; locale: "tr" | "en"; template: string; dedupe: string };
function simulateCanonicalProducer(store: Map<string, SimulatedDelivery>, reference: string, recipient: string, locale: "tr" | "en") {
  const dedupe = `payment.success:${reference}:customer`;
  if (!store.has(dedupe)) store.set(dedupe, { reference, recipient, locale, template: "payment_success_guardian", dedupe });
}

const deliveries = new Map<string, SimulatedDelivery>();
simulateCanonicalProducer(deliveries, "ORI-QA-001", "tr-customer@example.test", "tr");
simulateCanonicalProducer(deliveries, "ORI-QA-002", "en-customer@example.test", "en");
simulateCanonicalProducer(deliveries, "ORI-QA-002", "en-customer@example.test", "en");
const rows = [...deliveries.values()];
assert.equal(rows.filter((row) => row.reference === "ORI-QA-001").length, 1);
assert.equal(rows.filter((row) => row.reference === "ORI-QA-001" && row.locale === "tr").length, 1);
assert.equal(rows.filter((row) => row.reference === "ORI-QA-001" && row.locale === "en").length, 0);
assert.equal(rows.filter((row) => row.reference === "ORI-QA-002").length, 1);
assert.equal(rows.filter((row) => row.reference === "ORI-QA-002" && row.locale === "en").length, 1);
assert.equal(rows.filter((row) => row.reference === "ORI-QA-002" && row.locale === "tr").length, 0);

const service = readFileSync("supabase/functions/_shared/email/service.ts", "utf8");
assert.match(service, /EMAIL_ARCHIVE_BCC\s*=\s*ADMIN_EMAIL/);
assert.match(service, /Do not add admin@ again when it is already a direct recipient/);

console.log("payment-success email renderer: PASS");
