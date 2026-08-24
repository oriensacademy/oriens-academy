import { execSync } from "node:child_process";
import {
  renderStudentBankTransferPendingEmail,
  renderStudentPaymentReminderEmail,
  renderStudentPaymentSuccessEmail,
} from "../supabase/functions/_shared/email/templates.ts";

const TARGET_RECIPIENT = "info@oriens-academy.com";
const PROJECT_REF = "mwbrlfmdpbkmdjroxhcc";
const FUNCTION_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/email-preview-delivery`;

function getApiKeys() {
  const rawKeys = execSync(`npx supabase projects api-keys --project-ref ${PROJECT_REF}`, {
    encoding: "utf8",
    windowsHide: true,
  });
  const keysJson = JSON.parse(rawKeys.slice(rawKeys.indexOf("{"))).keys;
  const serviceKey = keysJson.find((k) => k.id === "service_role")?.api_key;
  if (!serviceKey) throw new Error("Service role API key could not be retrieved from Supabase.");
  return { serviceKey };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("=== DELIVERING AFFECTED EMAIL TEMPLATES TO info@oriens-academy.com ===");
  const { serviceKey } = getApiKeys();

  const bankTransferDetails = {
    accountHolder: "Oriens Akademi Eğitim ve Danışmanlık A.Ş.",
    bankName: "QNB Finansbank",
    iban: "TR120011100000000012345678",
    branchName: "Levent Şubesi",
  };

  const templates = [
    {
      id: "bank_transfer_pending",
      title: "Havale/EFT Ödeme Talebi",
      payload: renderStudentBankTransferPendingEmail({
        studentName: "Mert Ömeroğlu",
        packageName: "SAT Birebir Hazırlık Paketi",
        packageId: "sat-10",
        lessonCount: 10,
        amount: 24500,
        currency: "TRY",
        publicReference: "OA-2026-89412",
        orderId: "ord-20260825-01",
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        bankDetails: bankTransferDetails,
        locale: "tr",
      }),
      channel: "billing",
      eventType: "payment.bank_transfer_pending",
    },
    {
      id: "payment_reminder",
      title: "Ödeme Hatırlatması",
      payload: renderStudentPaymentReminderEmail({
        studentName: "Mert Ömeroğlu",
        packageName: "AP Calculus BC Birebir Paketi",
        publicReference: "OA-2026-78319",
        amount: 18500,
        currency: "TRY",
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        bankDetails: bankTransferDetails,
        locale: "tr",
      }),
      channel: "billing",
      eventType: "payment.reminder",
    },
    {
      id: "payment_success_metric",
      title: "Ödeme Onayı ve Ders Bakiyesi",
      payload: renderStudentPaymentSuccessEmail({
        studentName: "Mert Ömeroğlu",
        packageName: "IB Matematik HL Kapsamlı Paket",
        lessonCount: 20,
        amount: 45000,
        currency: "TRY",
        paymentMethod: "card",
        publicReference: "OA-2026-65123",
        paidAt: new Date().toISOString(),
        locale: "tr",
      }),
      channel: "billing",
      eventType: "payment.receipt",
    },
  ];

  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    console.log(`\n[${i + 1}/${templates.length}] Gönderiliyor: ${t.title} (${t.payload.subject})`);

    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        channel: t.channel,
        subject: t.payload.subject,
        html: t.payload.html,
        text: t.payload.text,
        eventType: t.eventType,
      }),
    });

    const responseBody = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`  HATA (${res.status}):`, responseBody);
      throw new Error(`Email delivery failed for ${t.id}`);
    }

    console.log(`  BAŞARILI: Message ID = ${responseBody.delivery?.provider_message_id || "sent"}`);
    await sleep(800);
  }

  console.log("\n=== TÜM AFFECTED E-POSTA ŞABLONLARI BAŞARIYLA İLETİLDİ ===");
}

main().catch((err) => {
  console.error("Email preview execution failed:", err);
  process.exit(1);
});
