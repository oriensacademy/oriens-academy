// No-send regression suite for the Supabase mail producers.
//
//   npx --yes deno@2 run --no-lock --allow-env --allow-read=supabase/config.toml supabase/tests/mail-flow-no-send.ts
//
// Runs the real Edge Function handlers and the real shared Gmail sender against
// supabase/tests/mail-no-send/fake-backend.ts. No network permission is granted, every
// outbound call is answered by the fake transport, and no real mail can leave.
import {
  invoke, PUBLISHABLE_KEY, resetState, SECRET_KEY, state, table, tokenFor, type FakeUser,
} from "./mail-no-send/fake-backend.ts";
import "../functions/request-password-recovery/index.ts";
import "../functions/request-email-change/index.ts";
import "../functions/verify-email-change/index.ts";
import "../functions/send-welcome-email/index.ts";
import "../functions/request-purchase-email-verification/index.ts";
import "../functions/verify-purchase-email-verification/index.ts";
import "../functions/process-notification-outbox/index.ts";
import { sendTransactionalEmail } from "../functions/_shared/email/service.ts";
import { computeOtpHash } from "../functions/_shared/otp/hash.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

let failures = 0;
function check(label: string, condition: unknown) {
  if (!condition) failures += 1;
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
}
function section(title: string, ok: () => boolean) {
  console.log(`${title}=${ok() ? "PASS" : "FAIL"}`);
}

function user(email: string, extra: Partial<FakeUser> = {}): FakeUser {
  const created: FakeUser = {
    id: crypto.randomUUID(),
    email,
    email_confirmed_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    ...extra,
  };
  state.users.push(created);
  return created;
}
const bearer = (account: FakeUser) => ({ authorization: `Bearer ${tokenFor(account)}`, apikey: PUBLISHABLE_KEY });
// Lets a test send to the same recipient again without waiting out the 60s claim window.
const ageIdempotencyWindow = () => table("notification_deliveries").forEach((row) => (row.updated_at = "2000-01-01T00:00:00.000Z"));
const admin = createClient("http://fake-supabase.test", SECRET_KEY, { auth: { persistSession: false } });

// ---------------------------------------------------------------------------
// PASSWORD RESET REQUEST
// ---------------------------------------------------------------------------
{
  const before = failures;
  resetState();
  const learner = user("learner@example.test");
  for (let i = 0; i < 60; i += 1) user(`filler-${i}@example.test`);
  const lateLearner = user("late-page@example.test");

  let res = await invoke("request-password-recovery", { email: learner.email, locale: "tr" });
  check("reset: missing Turnstile token -> 400 BOT_VERIFICATION_REQUIRED", res.status === 400 && res.body.error_code === "BOT_VERIFICATION_REQUIRED");
  res = await invoke("request-password-recovery", { email: learner.email, locale: "tr", turnstileToken: "XXXX.DUMMY.TOKEN.XXXX" });
  check("reset: rejected Turnstile token -> 400 BOT_VERIFICATION_FAILED", res.status === 400 && res.body.error_code === "BOT_VERIFICATION_FAILED");
  check("reset: Turnstile failure creates no recovery token and no mail", state.generateLinkCalls.length === 0 && state.mailbox.length === 0);

  res = await invoke("request-password-recovery", { email: "nobody@example.test", locale: "tr", turnstileToken: "fixture-valid-turnstile" });
  check("reset: unknown account -> neutral 200, no token, no mail", res.status === 200 && res.body.success === true && state.generateLinkCalls.length === 0 && state.mailbox.length === 0);

  state.rateLimitAllowed = false;
  res = await invoke("request-password-recovery", { email: learner.email, locale: "tr", turnstileToken: "fixture-valid-turnstile" });
  check("reset: rate limit -> 429 RATE_LIMIT_EXCEEDED, no mail", res.status === 429 && res.body.error_code === "RATE_LIMIT_EXCEEDED" && state.mailbox.length === 0);
  state.rateLimitAllowed = true;

  res = await invoke("request-password-recovery", { email: "  Learner@Example.test ", locale: "tr", turnstileToken: "fixture-valid-turnstile" });
  const trMail = state.mailbox[0];
  const trLink = state.generateLinkCalls[0];
  check("reset TR: neutral 200 response", res.status === 200 && res.body.success === true);
  check("reset TR: Supabase recovery token generated for the normalized address", trLink?.type === "recovery" && trLink?.email === learner.email);
  check("reset TR: redirect is the canonical /tr/sifre-yenile page", trLink?.redirect_to === "https://oriens-academy.com/tr/sifre-yenile");
  check("reset TR: exactly one mail, to the account address only", state.mailbox.length === 1 && trMail.to === learner.email);
  check("reset TR: archive BCC unchanged (admin@)", trMail?.bcc === "admin@oriens-academy.com");
  check("reset TR: Turkish subject", trMail?.subject.includes("Şifre Sıfırlama Bağlantısı"));
  check("reset TR: mail carries the recovery link", trMail?.body.includes("type=recovery") && trMail.body.includes(encodeURIComponent("https://oriens-academy.com/tr/sifre-yenile")));
  check("reset TR: delivery row recorded as sent", table("notification_deliveries").some((row) => row.event_type === "account_password_recovery" && row.status === "sent"));
  const auditMeta = JSON.stringify(table("audit_logs").find((row) => row.action === "account.password_recovery_dispatched") ?? {});
  check("reset TR: audit log written without token or link", auditMeta.includes("password_recovery_dispatched") && !auditMeta.includes("token=") && !auditMeta.includes("verify?"));

  res = await invoke("request-password-recovery", { email: lateLearner.email, locale: "en", turnstileToken: "fixture-valid-turnstile" });
  const enMail = state.mailbox[1];
  check("reset EN: account beyond the first listUsers page is found", res.status === 200 && enMail?.to === lateLearner.email);
  check("reset EN: redirect is /en/reset-password", state.generateLinkCalls[1]?.redirect_to === "https://oriens-academy.com/en/reset-password");
  check("reset EN: English subject", enMail?.subject.includes("Reset Your Password"));

  ageIdempotencyWindow();
  // Admin "send reset link" path: no Turnstile, authorised by is_admin() on the caller's session.
  const staff = user("staff@example.test", { app_metadata: { role: "admin" } });
  res = await invoke("request-password-recovery", { email: learner.email, locale: "tr" }, bearer(staff));
  check("reset admin: admin session bypasses Turnstile (server-side is_admin)", res.status === 200 && state.mailbox.length === 3 && state.mailbox[2].to === learner.email);
  check("reset admin: project API key used as apikey, never the user JWT", state.rejectedApiKeys === 0);
  res = await invoke("request-password-recovery", { email: learner.email, locale: "tr" }, bearer(learner));
  check("reset admin: non-admin session still needs Turnstile", res.status === 400 && res.body.error_code === "BOT_VERIFICATION_REQUIRED" && state.mailbox.length === 3);

  state.gmailFailures = 1;
  ageIdempotencyWindow();
  res = await invoke("request-password-recovery", { email: learner.email, locale: "tr", turnstileToken: "fixture-valid-turnstile" });
  check("reset: provider failure surfaces as 500 (not a silent success)", res.status === 500);
  section("PASSWORD RESET REQUEST", () => failures === before);
}

// ---------------------------------------------------------------------------
// PASSWORD RESET TOKEN VERIFY + PASSWORD UPDATE (server side)
// ---------------------------------------------------------------------------
{
  const before = failures;
  const config = await Deno.readTextFile("supabase/config.toml");
  check("token verify: recovery link is a GoTrue /verify link (token checked by Supabase Auth)", state.generateLinkCalls.every((call) => call.type === "recovery"));
  check("token verify: recovery expiry configured (auth.email otp_expiry)", /\[auth\.email\][\s\S]*?otp_expiry\s*=\s*\d+/.test(config));
  console.log("NOTE  browser-side token verify / single-use / updateUser covered by scratchpad reset-flow QA (mocked GoTrue)");
  section("PASSWORD RESET TOKEN VERIFY", () => failures === before);
}

// ---------------------------------------------------------------------------
// EMAIL CHANGE REQUEST + OTP VERIFY
// ---------------------------------------------------------------------------
{
  const before = failures;
  resetState();
  const holder = user("holder@example.test");
  table("guardian_accounts").push({ user_id: holder.id, email: holder.email, status: "active" });

  let res = await invoke("request-email-change", { newEmail: "fresh@example.test", locale: "tr" });
  check("email change: no session -> 401", res.status === 401 && state.mailbox.length === 0);

  res = await invoke("request-email-change", { newEmail: "fresh@example.test", locale: "tr" }, bearer(holder));
  const otpMail = state.mailbox[0];
  const otp = otpMail?.body.match(/\b(\d{6})\b/)?.[1] ?? "";
  const challenge = table("email_change_challenges")[0];
  check("email change: 200 with masked new address", res.status === 200 && res.body.masked_new_email === "fr***@example.test");
  check("email change: one OTP mail, to the NEW address only", state.mailbox.length === 1 && otpMail.to === "fresh@example.test");
  check("email change: 6-digit code, no magic link", otp.length === 6 && !/verify\?token|type=email_change/.test(otpMail.body));
  check("email change: challenge stores only an HMAC hash", challenge && challenge.code_hash !== otp && !JSON.stringify(challenge).includes(`"${otp}"`));
  check("email change: canonical email not changed before verification", holder.email === "holder@example.test");

  res = await invoke("request-email-change", { newEmail: "fresh@example.test", locale: "tr" }, bearer(holder));
  check("email change: resend cooldown -> 429", res.status === 429 && state.mailbox.length === 1);

  // Delivery failure must not be reported as "code sent" and must not lock the user out.
  const other = user("other@example.test");
  state.gmailFailures = 1;
  res = await invoke("request-email-change", { newEmail: "second@example.test", locale: "en" }, bearer(other));
  check("email change: provider failure -> 500 MAIL_SEND_FAILED", res.status === 500 && res.body.error_code === "MAIL_SEND_FAILED");
  check("email change: undelivered challenge retired (retry not blocked)", table("email_change_challenges").filter((row) => row.user_id === other.id).every((row) => row.superseded_at));
  ageIdempotencyWindow();
  res = await invoke("request-email-change", { newEmail: "second@example.test", locale: "en" }, bearer(other));
  check("email change: immediate retry after failure succeeds", res.status === 200 && state.mailbox.at(-1)?.to === "second@example.test");
  section("EMAIL CHANGE REQUEST", () => failures === before);

  const beforeVerify = failures;
  res = await invoke("verify-email-change", { code: "12345", locale: "tr" }, bearer(holder));
  check("otp verify: malformed code -> 400 INVALID_FORMAT", res.status === 400 && res.body.error_code === "INVALID_FORMAT");
  const wrong = otp === "000000" ? "111111" : "000000";
  res = await invoke("verify-email-change", { code: wrong, locale: "tr" }, bearer(holder));
  check("otp verify: wrong code -> INVALID_CODE with remaining attempts", res.status === 400 && res.body.error_code === "INVALID_CODE" && res.body.remaining_attempts === 4);
  check("otp verify: wrong code leaves canonical email unchanged", holder.email === "holder@example.test");
  const mailsBefore = state.mailbox.length;
  res = await invoke("verify-email-change", { code: otp, locale: "tr" }, bearer(holder));
  check("otp verify: correct code -> 200", res.status === 200 && res.body.email === "fresh@example.test");
  check("otp verify: Supabase Auth email updated (canonical)", holder.email === "fresh@example.test");
  check("otp verify: guardian account email updated", table("guardian_accounts")[0].email === "fresh@example.test");
  const notice = state.mailbox.slice(mailsBefore);
  check("otp verify: security notice to OLD address only, new address masked", notice.length === 1 && notice[0].to === "holder@example.test" && !notice[0].body.includes("fresh@example.test"));
  res = await invoke("verify-email-change", { code: otp, locale: "tr" }, bearer(holder));
  check("otp verify: code is single-use (ALREADY_VERIFIED on replay)", res.status === 400 && res.body.error_code === "ALREADY_VERIFIED");

  const expired = user("expired@example.test");
  const expiredCode = "424242";
  table("email_change_challenges").push({
    id: crypto.randomUUID(), user_id: expired.id, old_email: expired.email, new_email: "late@example.test",
    code_hash: await computeOtpHash({ purpose: "email_change", userId: expired.id, email: "late@example.test", code: expiredCode, secret: "fixture-hmac-secret" }),
    expires_at: new Date(Date.now() - 1000).toISOString(), attempt_count: 0, created_at: new Date().toISOString(),
    verified_at: null, superseded_at: null,
  });
  res = await invoke("verify-email-change", { code: expiredCode, locale: "en" }, bearer(expired));
  check("otp verify: expired code -> EXPIRED, email unchanged", res.body.error_code === "EXPIRED" && expired.email === "expired@example.test");
  section("EMAIL CHANGE OTP VERIFY", () => failures === beforeVerify);
}

// ---------------------------------------------------------------------------
// WELCOME RECIPIENT SECURITY
// ---------------------------------------------------------------------------
{
  const before = failures;
  resetState();
  const learner = user("welcome@example.test", { user_metadata: { full_name: "Learner" } });
  const pending = user("pending@example.test", { email_confirmed_at: null });
  const staff = user("staff@example.test", { app_metadata: { role: "admin" } });

  let res = await invoke("send-welcome-email", { email: "victim@example.test", fullName: "x" });
  check("welcome: anonymous body.email -> 401, no mail", res.status === 401 && state.mailbox.length === 0);
  res = await invoke("send-welcome-email", { studentUserId: learner.id }, { apikey: PUBLISHABLE_KEY });
  check("welcome: anonymous body.studentUserId -> 401, no mail", res.status === 401 && state.mailbox.length === 0);
  res = await invoke("send-welcome-email", { email: "victim@example.test" }, { authorization: "Bearer not-a-real-session" });
  check("welcome: invalid session -> 401, no mail", res.status === 401 && state.mailbox.length === 0);

  res = await invoke("send-welcome-email", { email: "victim@example.test", studentUserId: pending.id }, bearer(learner));
  check("welcome: signed-in user cannot redirect to body.email / other id", res.status === 200 && state.mailbox.length === 1 && state.mailbox[0].to === learner.email);
  res = await invoke("send-welcome-email", {}, bearer(learner));
  check("welcome: second call deduplicated (ALREADY_SENT)", res.body.reason === "ALREADY_SENT" && state.mailbox.length === 1);

  res = await invoke("send-welcome-email", {}, bearer(pending));
  check("welcome: unverified email deferred", res.body.reason === "EMAIL_NOT_VERIFIED" && state.mailbox.length === 1);
  res = await invoke("send-welcome-email", {}, bearer(staff));
  check("welcome: admin accounts excluded", res.body.reason === "ADMIN_EXCLUDED" && state.mailbox.length === 1);

  const serviceTarget = user("service-target@example.test");
  table("student_profiles").push({ id: serviceTarget.id, full_name: "Service Target", email: serviceTarget.email, preferred_language: "en", active: true });
  res = await invoke("send-welcome-email", { studentUserId: serviceTarget.id, email: "victim@example.test" }, { authorization: `Bearer ${SECRET_KEY}`, apikey: SECRET_KEY });
  check("welcome: service caller resolves recipient from the database", res.status === 200 && state.mailbox.at(-1)?.to === serviceTarget.email);
  res = await invoke("send-welcome-email", { studentUserId: "not-a-uuid" }, { authorization: `Bearer ${SECRET_KEY}`, apikey: SECRET_KEY });
  check("welcome: service caller with malformed id -> 401", res.status === 401);
  check("welcome: no mail ever sent to an address taken from the body", !state.mailbox.some((mail) => mail.to.includes("victim")));
  section("WELCOME RECIPIENT SECURITY", () => failures === before);
}

// ---------------------------------------------------------------------------
// REGISTRATION: signup OTP -> verification -> welcome via trigger + outbox
// ---------------------------------------------------------------------------
// signUp returns a session immediately (Confirm Email is off), so every
// registration mail step runs with the new account's own session. The welcome
// mail is never requested by the client: the OTP verifier marks
// guardian_accounts.email_verified_at and the trigger enqueues it.
{
  const before = failures;
  resetState();
  const signup = user("new-signup@example.test");
  table("guardian_accounts").push({ user_id: signup.id, email: signup.email, full_name: "Yeni Kayıt", preferred_language: "tr", email_verified_at: null });
  const findCode = async (body: string) => {
    const challenge = table("purchase_email_verification_challenges").find((row) => row.verified_at == null && row.superseded_at == null);
    for (const candidate of new Set(body.match(/\b\d{6}\b/g) ?? [])) {
      const hash = await computeOtpHash({ purpose: "purchase_email_verification", userId: signup.id, email: signup.email, code: candidate, secret: "fixture-hmac-secret" });
      if (challenge && hash === challenge.code_hash) return candidate;
    }
    return "";
  };
  const welcomeRows = () => table("notification_deliveries").filter((row) => row.event_type === "guardian.welcome");

  let res = await invoke("request-purchase-email-verification", { candidateEmail: signup.email, locale: "tr" });
  check("registration: OTP request without a session -> 401, no mail", res.status === 401 && state.mailbox.length === 0);

  res = await invoke("request-purchase-email-verification", { candidateEmail: signup.email, locale: "tr" }, bearer(signup));
  const otpMail = state.mailbox[0];
  check("registration: OTP producer -> 200 and exactly one mail to the account address", res.status === 200 && state.mailbox.length === 1 && otpMail?.to === signup.email);
  const code = otpMail ? await findCode(otpMail.body) : "";
  check("registration: OTP mail carries the 6-digit code; only its hash is stored", /^\d{6}$/.test(code) && table("purchase_email_verification_challenges").every((row) => row.code_hash !== code));
  check("registration: OTP mail has no magic link", !!otpMail && !/token_hash=|type=magiclink|\/auth\/v1\/verify/i.test(otpMail.body));

  res = await invoke("request-purchase-email-verification", { candidateEmail: signup.email, locale: "tr" }, bearer(signup));
  check("registration: immediate resend -> 429 RESEND_COOLDOWN, no extra mail", res.status === 429 && res.body.error_code === "RESEND_COOLDOWN" && state.mailbox.length === 1);

  const wrong = code === "000000" ? "111111" : "000000";
  res = await invoke("verify-purchase-email-verification", { code: wrong, locale: "tr" }, bearer(signup));
  check("registration: wrong code -> 400 INVALID_CODE, no welcome enqueued", res.status === 400 && res.body.error_code === "INVALID_CODE" && welcomeRows().length === 0);
  res = await invoke("verify-purchase-email-verification", { code }, {});
  check("registration: verify without a session -> 401", res.status === 401 && welcomeRows().length === 0);

  res = await invoke("verify-purchase-email-verification", { code, locale: "tr" }, bearer(signup));
  const guardian = table("guardian_accounts")[0];
  check("registration: correct code -> 200, guardian marked verified", res.status === 200 && res.body.success === true && guardian.email_verified_at != null);
  check("registration: verification enqueues exactly one welcome for the canonical account address",
    welcomeRows().length === 1 && welcomeRows()[0].recipient === signup.email && welcomeRows()[0].status === "pending");
  console.log(`REGISTRATION OTP PRODUCER=${failures === before ? "PASS" : "FAIL"}`);
  console.log(`PRE-AUTH LEGITIMATE REGISTRATION=${failures === before ? "PASS" : "FAIL"} (signup session drives OTP + verify; no client welcome call)`);

  const mailsBeforeWelcome = state.mailbox.length;
  res = await invoke("process-notification-outbox", {}, { authorization: `Bearer ${SECRET_KEY}`, apikey: SECRET_KEY });
  const welcomeMail = state.mailbox[mailsBeforeWelcome];
  check("welcome: outbox worker delivers the welcome once to the account address",
    res.status === 200 && state.mailbox.length === mailsBeforeWelcome + 1 && welcomeMail?.to === signup.email && welcomeRows()[0].status === "sent");
  check("welcome: archive BCC is kept on the welcome mail", /admin@oriens-academy\.com/i.test(welcomeMail?.bcc ?? ""));
  console.log(`WELCOME AFTER REGISTRATION=${failures === before ? "PASS" : "FAIL"}`);

  res = await invoke("verify-purchase-email-verification", { code, locale: "tr" }, bearer(signup));
  check("duplicate: re-submitting the used code -> ALREADY_VERIFIED, no second welcome row", res.body.error_code === "ALREADY_VERIFIED" && welcomeRows().length === 1);
  res = await invoke("process-notification-outbox", {}, { authorization: `Bearer ${SECRET_KEY}`, apikey: SECRET_KEY });
  check("duplicate: outbox rerun claims nothing, still one welcome mail", res.body.claimed === 0 && state.mailbox.filter((mail) => mail.to === signup.email).length === 2);

  const relayBefore = state.mailbox.length;
  res = await invoke("send-welcome-email", { email: "someone-else@example.test", fullName: "x" });
  check("relay: anonymous send-welcome-email with an arbitrary recipient -> 401, no mail", res.status === 401 && state.mailbox.length === relayBefore);
  res = await invoke("send-welcome-email", { email: "someone-else@example.test" }, bearer(signup));
  check("relay: signed-in caller cannot redirect the welcome to another address", state.mailbox.slice(relayBefore).every((mail) => mail.to === signup.email));
  console.log(`ARBITRARY ANONYMOUS RECIPIENT=${failures === before ? "DENIED" : "FAIL"}`);
  section("REGISTRATION FLOW", () => failures === before);
}

// ---------------------------------------------------------------------------
// OUTBOX IDEMPOTENCY
// ---------------------------------------------------------------------------
{
  const before = failures;
  resetState();
  const staff = user("staff@example.test", { app_metadata: { role: "admin" } });
  const learner = user("learner@example.test");
  table("admin_profiles").push({ user_id: staff.id, role: "admin", active: true });
  const now = new Date(Date.now() - 1000).toISOString();
  for (const [index, recipient] of ["one@example.test", "two@example.test"].entries()) {
    table("notification_deliveries").push({
      id: crypto.randomUUID(), event_type: "guardian.welcome", entity_type: "guardian", entity_id: `fixture-${index}`,
      recipient, template: "guardian_welcome", payload: { full_name: "Fixture", locale: "tr" }, status: "pending",
      attempt_count: 0, next_attempt_at: now, dedupe_key: `guardian.welcome:fixture-${index}`, created_at: now, updated_at: now,
    });
  }

  let res = await invoke("process-notification-outbox", {});
  check("outbox: anonymous worker call -> 403", res.status === 403 && state.mailbox.length === 0);
  res = await invoke("process-notification-outbox", {}, bearer(learner));
  check("outbox: non-admin session -> 403", res.status === 403 && state.mailbox.length === 0);

  state.gmailFailures = 1;
  res = await invoke("process-notification-outbox", {}, bearer(staff));
  check("outbox: first run claims both rows", res.status === 200 && res.body.claimed === 2);
  const rows = table("notification_deliveries");
  const failedRow = rows.find((row) => row.status === "failed");
  check("outbox: provider failure -> row failed with retry scheduled in the future", failedRow && String(failedRow.next_attempt_at) > new Date().toISOString());
  check("outbox: each recipient sent at most once", new Set(state.mailbox.map((mail) => mail.to)).size === state.mailbox.length);

  res = await invoke("process-notification-outbox", {}, { authorization: `Bearer ${SECRET_KEY}`, apikey: SECRET_KEY });
  check("outbox: immediate rerun claims nothing (no duplicate send)", res.body.claimed === 0);
  const sentBefore = state.mailbox.length;
  if (failedRow) failedRow.next_attempt_at = new Date(Date.now() - 1000).toISOString();
  res = await invoke("process-notification-outbox", {}, bearer(staff));
  check("outbox: retry delivers only the failed row", res.body.claimed === 1 && state.mailbox.length === sentBefore + 1);
  check("outbox: every row sent exactly once overall", rows.every((row) => row.status === "sent") && state.mailbox.length === 2);
  res = await invoke("process-notification-outbox", {}, bearer(staff));
  check("outbox: drained queue claims nothing", res.body.claimed === 0 && state.mailbox.length === 2);

  const params = {
    supabaseAdmin: admin, to: "dup@example.test", subject: "Fixture", html: "<p>x</p>", text: "x",
    eventType: "fixture.manual", entityType: "user", entityId: "fixture", idempotencyKey: "fixture-key",
  };
  const first = await sendTransactionalEmail(params);
  const second = await sendTransactionalEmail(params);
  check("manual send: double submit inside window -> second suppressed", first.status === "sent" && second.status === "suppressed");
  check("manual send: one delivery row for the double submit", rows.filter((row) => row.event_type === "fixture.manual").length === 1);
  section("OUTBOX IDEMPOTENCY", () => failures === before);
}

// ---------------------------------------------------------------------------
// NO REAL EMAIL
// ---------------------------------------------------------------------------
{
  const netStatus = await Deno.permissions.query({ name: "net" });
  check("no-send: process has no network permission", netStatus.state !== "granted");
  check("no-send: zero calls escaped the fake transport", state.realFetchCalls === 0);
  console.log(`NO REAL EMAIL=${netStatus.state !== "granted" && state.realFetchCalls === 0 ? "PASS" : "FAIL"} (REAL EMAIL SENT = 0)`);
}

console.log(failures ? `MAIL_FLOW_NO_SEND=FAIL (${failures} failing checks)` : "MAIL_FLOW_NO_SEND=PASS");
Deno.exit(failures ? 1 : 0);
