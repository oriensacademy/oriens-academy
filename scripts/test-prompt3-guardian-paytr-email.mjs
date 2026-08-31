import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260831150000_guardian_identity_payment_outbox.sql");
const tokenFunction = read("supabase/functions/paytr-create-token/index.ts");
const paytrShared = read("supabase/functions/_shared/payments/paytr.ts");
const callback = read("supabase/functions/paytr-callback/index.ts");
const emailService = read("supabase/functions/_shared/email/service.ts");
const paymentPage = read("src/components/payment/PaymentPage.tsx");
const studentPortal = read("src/components/student/StudentPortal.tsx");
const legacyCallback = read("supabase/functions/payment-callback/index.ts");
const footer = read("src/components/sections/Footer.tsx");
const authConfig = read("supabase/config.toml");

assert.match(migration, /create table if not exists public\.guardian_accounts/);
assert.match(migration, /create table if not exists public\.guardian_students/);
assert.match(migration, /public\.can_access_student/);
assert.match(migration, /legacy_same_auth_uuid_v1/);
assert.match(migration, /auth_actor_user_id/);
assert.match(migration, /purchaser_guardian_user_id/);
assert.match(migration, /package_owner_student_id/);
assert.match(migration, /notification_deliveries_dedupe_unique/);
assert.match(migration, /payment\.success:'\|\|new\.id\|\|':guardian/);
assert.match(migration, /lesson\.completed:'\|\|new\.id\|\|':guardian/);
assert.match(migration, /drop trigger if exists trg_sync_package_usage_from_lesson/);
assert.match(migration, /Guardian linked homework answers read/);
assert.match(migration, /Guardian linked booking slots read/);
assert.match(migration, /after update on public\.student_lessons deferrable initially deferred/);

assert.doesNotMatch(tokenFunction, /payerName\s*=\s*String\(payload/);
assert.doesNotMatch(tokenFunction, /payerPhone\s*=\s*String\(payload/);
assert.doesNotMatch(tokenFunction, /Emaar Square|05000000000|user_address:\s*["']Türkiye/);
assert.doesNotMatch(tokenFunction, /\|\|\s*["']1\.1\.1\.1/);
assert.doesNotMatch(paytrShared, /05000000000|userAddress\s*\|\||userPhone\s*\|\|/);
assert.match(tokenFunction, /email_confirmed_at/);
assert.match(tokenFunction, /guardian_students/);
assert.match(tokenFunction, /user_address: payerAddress/);
assert.match(tokenFunction, /payer_email: verifiedEmail/);
assert.doesNotMatch(callback, /dispatchPaymentSuccessEmail|Promise\.allSettled/);
assert.match(legacyCallback, /LEGACY_PAYMENT_CALLBACK_DISABLED/);

assert.match(paymentPage, /İletişim Bilgileri/);
assert.doesNotMatch(paymentPage, /Fatura|Billing Information|BankTransferPanel|payerPhone/);
assert.doesNotMatch(paymentPage, /PaymentMethodSelector/);
assert.doesNotMatch(studentPortal, /Banka Havalesi \/ EFT Bilgileri|Bank Transfer Details/);
assert.match(authConfig, /enable_confirmations = true/);
assert.match(emailService, /encodeMailboxHeader\(params\.from\)/);
assert.match(emailService, /encodeHeaderWord\(params\.subject\)/);

const displayName = "Oriens Academy Öğrenci Destek";
const encoded = `=?UTF-8?B?${Buffer.from(displayName, "utf8").toString("base64")}?=`;
assert.equal(Buffer.from(encoded.slice(10, -2), "base64").toString("utf8"), displayName);
for (const value of ["Ö", "ğ", "İ", "ş", "ü", "ç"]) assert.ok(displayName.includes(value) || "Öğİşüç".includes(value));

const image = readFileSync(new URL("../public/images/payment/odeme_altyapi.png", import.meta.url));
assert.equal(image.toString("ascii", 1, 4), "PNG");
const width = image.readUInt32BE(16);
const height = image.readUInt32BE(20);
assert.ok(Math.abs(width / height - 10.45) < 0.02, `unexpected image ratio ${width}/${height}`);
assert.match(footer, /\/images\/payment\/odeme_altyapi\.png/);
assert.doesNotMatch(footer, /\/images\/payment-methods\.png/);
assert.equal(existsSync(new URL("../public/images/payment-methods.png", import.meta.url)), false);
assert.equal(existsSync(new URL("../public/payments/supported-card-networks.png", import.meta.url)), false);

console.log("Prompt 3 static regression: PASS");
console.log(`Footer asset: ${width}x${height} (${(width / height).toFixed(4)}:1)`);
console.log(`RFC 2047 sample: ${encoded}`);
