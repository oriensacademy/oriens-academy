import assert from "node:assert";
import { execSync } from "node:child_process";
import {
  EMAIL_ARCHIVE_BCC,
  getArchiveBccAddress,
  extractEmails,
  buildRfc822Message,
  resolveMailIdentity,
  sendTransactionalEmail,
} from "../supabase/functions/_shared/email/service.ts";

const projectRef = "mwbrlfmdpbkmdjroxhcc";
const projectUrl = `https://${projectRef}.supabase.co`;

function getServiceKey() {
  try {
    const rawKeys = execSync(`npx supabase projects api-keys --project-ref ${projectRef}`, {
      encoding: "utf8",
      windowsHide: true,
    });
    const keysJson = JSON.parse(rawKeys.slice(rawKeys.indexOf("{"))).keys;
    const key = keysJson.find((k) => k.id === "service_role")?.api_key;
    if (!key) throw new Error("Service key not found");
    return key;
  } catch (err) {
    console.warn("Could not fetch remote service key:", err.message);
    return null;
  }
}

async function runBccArchiveTestSuite() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — GLOBAL EMAIL BCC ARCHIVE TEST SUITE");
  console.log("==================================================");
  console.log(`Canonical Archive Recipient : ${EMAIL_ARCHIVE_BCC}`);
  console.log(`Resolved Archive Address    : ${getArchiveBccAddress()}\n`);

  let passCount = 0;
  let testCount = 0;

  async function runTest(name, fn) {
    testCount++;
    try {
      await fn();
      console.log(`✓ [PASS] Test ${testCount}: ${name}`);
      passCount++;
    } catch (err) {
      console.error(`✗ [FAIL] Test ${testCount}: ${name}`);
      console.error(`  Error: ${err.message}`);
      throw err;
    }
  }

  // 1. UNIT TESTS: ADDRESS EXTRACTION & NORMALIZATION
  await runTest("extractEmails normalizes bare and formatted addresses case-insensitively", () => {
    const r1 = extractEmails("student@example.com");
    assert.deepStrictEqual(r1, ["student@example.com"]);

    const r2 = extractEmails("STUDENT@EXAMPLE.COM");
    assert.deepStrictEqual(r2, ["student@example.com"]);

    const r3 = extractEmails("John Doe <john@example.com>, Jane Doe <JANE@EXAMPLE.COM>");
    assert.deepStrictEqual(r3, ["john@example.com", "jane@example.com"]);

    const r4 = extractEmails(["INFO@ORIENS-ACADEMY.COM", "  admin@oriens-academy.com  "]);
    assert.deepStrictEqual(r4, ["info@oriens-academy.com", "admin@oriens-academy.com"]);

    const r5 = extractEmails(null);
    assert.deepStrictEqual(r5, []);
  });

  // 2. UNIT TESTS: BCC DEDUPLICATION LOGIC
  await runTest("Deduplication: Customer recipient gets hidden BCC archive", () => {
    const to = "controlled-student@example.com";
    const archiveAddress = getArchiveBccAddress();
    const toEmails = extractEmails(to);
    const ccEmails = extractEmails(undefined);
    const explicitBccEmails = extractEmails(undefined);

    const alreadyTargeted =
      toEmails.includes(archiveAddress) ||
      ccEmails.includes(archiveAddress) ||
      explicitBccEmails.includes(archiveAddress);

    assert.strictEqual(alreadyTargeted, false, "Customer address must NOT be considered already targeted");

    const finalBccList = [...new Set([...explicitBccEmails, archiveAddress])];
    assert.deepStrictEqual(finalBccList, ["info@oriens-academy.com"]);
  });

  await runTest("Deduplication: TO info@oriens-academy.com skips duplicate BCC", () => {
    const to = "info@oriens-academy.com";
    const archiveAddress = getArchiveBccAddress();
    const toEmails = extractEmails(to);
    const ccEmails = extractEmails(undefined);
    const explicitBccEmails = extractEmails(undefined);

    const alreadyTargeted =
      toEmails.includes(archiveAddress) ||
      ccEmails.includes(archiveAddress) ||
      explicitBccEmails.includes(archiveAddress);

    assert.strictEqual(alreadyTargeted, true, "info@ recipient must be recognized as already targeted");

    const finalBccList = [...new Set(explicitBccEmails)];
    assert.deepStrictEqual(finalBccList, [], "BCC list must be empty to avoid duplicate in info inbox");
  });

  await runTest("Deduplication: Uppercase INFO@ORIENS-ACADEMY.COM is deduplicated", () => {
    const to = "INFO@ORIENS-ACADEMY.COM";
    const archiveAddress = getArchiveBccAddress();
    const toEmails = extractEmails(to);

    const alreadyTargeted = toEmails.includes(archiveAddress);
    assert.strictEqual(alreadyTargeted, true, "Uppercase address must match canonical lowercase");
  });

  await runTest("Deduplication: Formatted 'Oriens Info <info@oriens-academy.com>' is deduplicated", () => {
    const to = "Oriens Academy Info <info@oriens-academy.com>";
    const archiveAddress = getArchiveBccAddress();
    const toEmails = extractEmails(to);

    const alreadyTargeted = toEmails.includes(archiveAddress);
    assert.strictEqual(alreadyTargeted, true, "Formatted name+email must match archive address");
  });

  // 3. MIME STRUCTURAL INTEGRITY
  await runTest("RFC 822 MIME builder formats Bcc header correctly without leaking to To header", () => {
    const mime = buildRfc822Message({
      from: "Oriens Academy Destek <support@oriens-academy.com>",
      to: "student@example.com",
      bcc: "info@oriens-academy.com",
      replyTo: "support@oriens-academy.com",
      subject: "Yeni Dersiniz Planlandı",
      html: "<html><body><p>Dersiniz onaylandı.</p></body></html>",
      text: "Dersiniz onaylandı.",
    });

    assert(mime.includes("From: Oriens Academy Destek <support@oriens-academy.com>"), "From header missing");
    assert(mime.includes("To: student@example.com"), "To header missing");
    assert(mime.includes("Bcc: info@oriens-academy.com"), "Bcc header missing");
    assert(mime.includes("Reply-To: support@oriens-academy.com"), "Reply-To header missing");
    assert(mime.includes("Content-Type: multipart/alternative"), "Multipart boundary missing");

    // Ensure NO visible "BCC archived" or "internal copy" marker was injected into body
    assert(!mime.includes("BCC archived"), "Body must not leak internal tracking markers");
    assert(!mime.includes("internal copy"), "Body must not leak internal copy markers");
  });

  // 4. CHANNEL ALIASES & SENDER IDENTITIES
  await runTest("All sender channels (contact, support, payments, general, admin) retain correct aliases", () => {
    const contact = resolveMailIdentity("contact");
    assert.strictEqual(contact.fromEmail, "contact@oriens-academy.com");
    assert.strictEqual(contact.replyTo, "contact@oriens-academy.com");

    const support = resolveMailIdentity("support");
    assert.strictEqual(support.fromEmail, "support@oriens-academy.com");
    assert.strictEqual(support.replyTo, "support@oriens-academy.com");

    const payments = resolveMailIdentity("payments");
    assert.strictEqual(payments.fromEmail, "payments@oriens-academy.com");
    assert.strictEqual(payments.replyTo, "payments@oriens-academy.com");

    const general = resolveMailIdentity("general");
    assert.strictEqual(general.fromEmail, "info@oriens-academy.com");
    assert.strictEqual(general.replyTo, "info@oriens-academy.com");

    const admin = resolveMailIdentity("admin");
    assert.strictEqual(admin.fromEmail, "info@oriens-academy.com");
    assert.strictEqual(admin.replyTo, "admin@oriens-academy.com");
  });

  // 5. TRANSACTIONAL SEND LAYER SCENARIOS (DEV / SIMULATED ENVIRONMENT)
  process.env.NODE_ENV = "development";
  const mockSupabase = {
    from: () => ({
      insert: async () => ({ error: null }),
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  };

  await runTest("TEST A: Support channel email to student applies archive BCC", async () => {
    const result = await sendTransactionalEmail({
      supabaseAdmin: mockSupabase,
      to: "controlled-student@example.com",
      channel: "support",
      subject: "Ders Programınız Güncellendi",
      html: "<p>Ders saatiniz güncellenmiştir.</p>",
      text: "Ders saatiniz güncellenmiştir.",
      eventType: "lesson.link_ready.student",
      entityType: "student_lesson",
      entityId: "lesson-123",
    });

    assert.strictEqual(result.status, "sent");
    assert.strictEqual(result.archiveBccApplied, true);
    assert.strictEqual(result.archiveRecipient, "info@oriens-academy.com");
  });

  await runTest("TEST B: Payments channel email to student applies archive BCC", async () => {
    const result = await sendTransactionalEmail({
      supabaseAdmin: mockSupabase,
      to: "controlled-student@example.com",
      channel: "payments",
      subject: "Ödemeniz Onaylandı",
      html: "<p>Ödemeniz başarıyla alındı.</p>",
      text: "Ödemeniz başarıyla alındı.",
      eventType: "payment.success.student",
      entityType: "payment_transaction",
      entityId: "pay-123",
    });

    assert.strictEqual(result.status, "sent");
    assert.strictEqual(result.archiveBccApplied, true);
    assert.strictEqual(result.archiveRecipient, "info@oriens-academy.com");
  });

  await runTest("TEST C: Direct info@oriens-academy.com recipient does NOT duplicate BCC", async () => {
    const result = await sendTransactionalEmail({
      supabaseAdmin: mockSupabase,
      to: "info@oriens-academy.com",
      channel: "general",
      subject: "Yeni İletişim Formu Talebi",
      html: "<p>Yeni talep geldi.</p>",
      text: "Yeni talep geldi.",
      eventType: "contact.created.admin_notification",
      entityType: "contact_request",
      entityId: "c-123",
    });

    assert.strictEqual(result.status, "sent");
    assert.strictEqual(result.archiveBccApplied, false);
    assert.strictEqual(result.archiveRecipient, undefined);
  });

  await runTest("TEST D: Future new template through central mail service automatically applies BCC", async () => {
    const result = await sendTransactionalEmail({
      supabaseAdmin: mockSupabase,
      to: "future-student@example.com",
      channel: "general",
      subject: "Gelecekteki Yeni Şablon Bildirimi",
      html: "<p>Yeni özellik bilgilendirmesi.</p>",
      text: "Yeni özellik bilgilendirmesi.",
      eventType: "future.feature_announcement.student",
      entityType: "announcement",
      entityId: "anno-999",
    });

    assert.strictEqual(result.status, "sent");
    assert.strictEqual(result.archiveBccApplied, true);
    assert.strictEqual(result.archiveRecipient, "info@oriens-academy.com");
  });

  console.log(`\n==================================================`);
  console.log(`ALL TESTS: ${passCount}/${testCount} TESTS PASSED`);
  console.log(`==================================================\n`);

  // 6. LIVE REMOTE CONTROLLED API VERIFICATION
  const serviceKey = getServiceKey();
  if (serviceKey) {
    console.log("Running Live Remote Verification 1: Preview delivery to info@oriens-academy.com (Deduplication Check)...");
    const resPreview = await fetch(`${projectUrl}/functions/v1/email-preview-delivery`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: `[QA Global BCC Test] Direct Info Deduplication Verification ${Date.now()}`,
        html: "<p>Global BCC Archive Live Verification</p>",
        text: "Global BCC Archive Live Verification",
        channel: "general",
      }),
    });

    const jsonPreview = await resPreview.json();
    console.log("Live Preview Delivery (To info@) response:", jsonPreview);
    assert(jsonPreview.success === true, "Live preview delivery failed");
    assert.strictEqual(jsonPreview.delivery.archiveBccApplied, false, "To info@ must have archiveBccApplied = false");
    console.log("✓ [PASS] Live Remote Edge Function Deduplication verified successfully (0 duplicate BCC)!");

    console.log("\nRunning Live Remote Verification 2: External Student Delivery (BCC Archive Check)...");
    const resExternal = await fetch(`${projectUrl}/functions/v1/send-exam-result-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "controlled.qa.archive.test@gmail.com",
        fullName: "QA Archive Student",
        examCode: "SAT",
        locale: "tr",
        result: {
          examCode: "SAT",
          total: 10,
          correct: 8,
          incorrect: 2,
          unanswered: 0,
          accuracy: 80,
          performanceTier: "strong",
          topics: [{ id: "math", label: "Math", correct: 8, total: 10, accuracy: 80 }],
          strengths: ["Trigonometry"],
          improvementAreas: ["Functions"],
          breakdown: [{ id: "q1", question: "Solve x", selectedAnswer: "5", correctAnswer: "5", isCorrect: true, explanation: "x=5", topicId: "math" }]
        }
      }),
    });

    const jsonExternal = await resExternal.json();
    console.log("Live External Delivery response:", jsonExternal);
    assert(jsonExternal.success === true, "Live external delivery failed");
    assert.strictEqual(jsonExternal.delivery.archiveBccApplied, true, "External recipient must have archiveBccApplied = true");
    assert.strictEqual(jsonExternal.delivery.archiveRecipient, "info@oriens-academy.com", "Archive recipient must be info@oriens-academy.com");
    console.log("✓ [PASS] Live Remote Edge Function BCC Archive verified successfully (BCC applied to info@oriens-academy.com)!");
  } else {
    console.log("Remote service key unavailable; local verification complete.");
  }
}

runBccArchiveTestSuite().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
