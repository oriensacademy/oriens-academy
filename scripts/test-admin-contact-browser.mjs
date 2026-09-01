import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.ORIENS_ADMIN_QA_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });
const contactId = "11111111-1111-4111-8111-111111111111";
const createdAt = "2026-09-01T09:00:00.000Z";
const contact = {
  id: contactId,
  full_name: "ORIENS QA",
  email: "admin@oriens-academy.com",
  phone: "+90 555 000 0000",
  subject: "[ORIENS CONTACT QA] Conversation",
  message: "Original customer message",
  locale: "tr",
  status: "new",
  privacy_consent: true,
  source: "website",
  metadata: {},
  created_at: createdAt,
  updated_at: createdAt,
};

function installAdmin(context) {
  return context.addInitScript(() => {
    localStorage.setItem("oriens_local_dev_auth", JSON.stringify({ accountType: "admin", email: "admin@oriens-academy.com" }));
  });
}

async function mockBackend(context, sendCounter) {
  await context.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split("/rest/v1/")[1]?.split("?")[0];
    const wantsSingle = request.headers().accept?.includes("application/vnd.pgrst.object+json");
    let body = [];
    if (request.method() === "GET" && table === "contact_requests") body = [contact];
    if (request.method() === "GET" && table === "contact_replies") body = [];
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "Content-Range": body.length ? "0-0/1" : "*/0" }, body: JSON.stringify(wantsSingle ? body[0] || null : body) });
  });

  await context.route("**/rest/v1/rpc/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await context.route("**/functions/v1/send-contact-reply", async (route) => {
    sendCounter.count += 1;
    const payload = route.request().postDataJSON();
    assert.equal(payload.contactRequestId, contactId, "composer sent the wrong contact ID");
    assert.equal(payload.messageText, "Panel QA reply", "composer sent the wrong message");
    assert.equal("recipientEmail" in payload, false, "browser was allowed to choose the recipient");
    await new Promise((resolve) => setTimeout(resolve, 250));
    const sentAt = "2026-09-01T09:05:00.000Z";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        duplicate: false,
        reply: {
          id: "22222222-2222-4222-8222-222222222222",
          contact_request_id: contactId,
          direction: "outbound",
          sender_email: "info@oriens-academy.com",
          recipient_email: "admin@oriens-academy.com",
          sender_name: "Oriens Academy",
          message_text: payload.messageText,
          message_html: null,
          external_message_id: "qa-message-id",
          delivery_status: "sent",
          sent_by_admin_user_id: "dev-admin-user-00000000",
          idempotency_key: payload.idempotencyKey,
          error_metadata: null,
          created_at: sentAt,
          sent_at: sentAt,
        },
      }),
    });
  });
}

for (const width of [375, 768, 1024, 1440, 1920]) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  await installAdmin(context);
  await mockBackend(context, { count: 0 });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/admin/ayarlar`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Ayarlar / Settings" }).waitFor({ timeout: 30_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `${width}px Settings has ${overflow}px horizontal overflow`);
  const body = await page.locator("body").innerText();
  for (const unwanted of ["Operasyonel Kopya", "Korumalı Sistem Anahtarları", "Payment Details", "navigation.show_pricing", "notification.admin_locale"]) {
    assert(!body.includes(unwanted), `${width}px Settings exposes ${unwanted}`);
  }
  assert(body.includes("Denetim Logları / Audit Logs"), `${width}px Audit Logs module is missing from Settings`);
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await installAdmin(context);
  const sendCounter = { count: 0 };
  await mockBackend(context, sendCounter);
  const page = await context.newPage();

  await page.goto(`${baseUrl}/admin/degerlendirmeler`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Değerlendirmeler / Evaluations" }).waitFor({ timeout: 30_000 });
  const sidebar = await page.locator("aside").innerText();
  assert(sidebar.includes("Değerlendirmeler / Evaluations"), "Evaluations is missing from primary navigation");
  assert(!sidebar.includes("Ödev İşlemleri"), "Homework remains in primary navigation");
  assert(!sidebar.includes("İçerik & Materyal"), "Content/material management remains in primary navigation");
  assert(!sidebar.includes("Denetim Logları"), "Audit Logs remains in primary navigation");

  await page.goto(`${baseUrl}/admin/iletisim-destek`, { waitUntil: "domcontentloaded" });
  await page.getByText("ORIENS QA", { exact: true }).waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: "Oku / Detay" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("heading", { name: "İletişim Talebi Detayı / Contact Request Details" }).waitFor();
  await dialog.getByText("Original customer message", { exact: true }).waitFor();
  const textarea = dialog.getByLabel("Yanıt / Reply");
  await textarea.fill("Panel QA reply");
  const sendButton = dialog.getByRole("button", { name: "Gönder / Send" });
  await sendButton.click();
  await page.waitForTimeout(50);
  assert(await dialog.getByRole("button", { name: /Gönderiliyor/ }).isDisabled(), "send button was not locked while the request was in flight");
  await dialog.getByText("Panel QA reply", { exact: true }).waitFor();
  await dialog.getByText("Gönderildi / Sent", { exact: true }).waitFor();
  assert.equal(sendCounter.count, 1, "double click caused duplicate send calls");
  assert((await dialog.getByText("Original customer message", { exact: true }).boundingBox()).y < (await dialog.getByText("Panel QA reply", { exact: true }).boundingBox()).y, "thread chronology is incorrect");
  await context.close();
}

await browser.close();
console.log(JSON.stringify({ status: "PASS", viewports: [375, 768, 1024, 1440, 1920], conversationReply: true, doubleClickProtected: true }, null, 2));
