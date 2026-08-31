import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendTransactionalEmail } from "../_shared/email/service.ts";

type OutboxRow = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  recipient: string;
  template: string | null;
  payload: Record<string, unknown>;
};

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));

function render(row: OutboxRow) {
  const p = row.payload || {};
  const isEn = p.locale === "en";
  const lines: string[] = [];
  let subject = "Oriens Academy";
  let channel: "payments" | "support" = "payments";

  if (row.template === "payment_success_guardian") {
    subject = isEn ? `Payment received — ${p.reference}` : `Ödemeniz alındı — ${p.reference}`;
    lines.push(
      isEn ? `Dear ${p.payer_name}, your payment was completed successfully.` : `Sayın ${p.payer_name}, ödemeniz başarıyla tamamlandı.`,
      `${isEn ? "Reference" : "Referans"}: ${p.reference}`,
      `${isEn ? "Package" : "Paket"}: ${p.package_id}`,
      `${isEn ? "Amount" : "Tutar"}: ${p.amount} ${p.currency}`,
    );
  } else if (row.template === "payment_success_admin") {
    subject = `[ORIENS] Payment success — ${p.reference}`;
    lines.push(`Reference: ${p.reference}`, `Payer: ${p.payer_name} <${p.payer_email}>`, `Package: ${p.package_id}`, `Amount: ${p.amount} ${p.currency}`);
  } else if (row.template === "package_activated_guardian") {
    subject = isEn ? `Package activated for ${p.learner_name}` : `${p.learner_name} için paket aktif edildi`;
    lines.push(
      isEn ? `Dear ${p.guardian_name}, the learner package is now active.` : `Sayın ${p.guardian_name}, öğrenci paketi aktif edildi.`,
      `${isEn ? "Learner" : "Öğrenci"}: ${p.learner_name}`,
      `${isEn ? "Package" : "Paket"}: ${p.package_name}`,
      `${isEn ? "Lessons granted" : "Tanımlanan ders"}: ${p.granted_lessons}`,
      `${isEn ? "Lessons remaining" : "Kalan ders"}: ${p.remaining_lessons}`,
      `${isEn ? "Activation date" : "Aktivasyon tarihi"}: ${p.activation_date}`,
    );
  } else if (row.template === "lesson_completed_guardian") {
    channel = "support";
    subject = isEn ? `Lesson completed — ${p.learner_name}` : `Ders tamamlandı — ${p.learner_name}`;
    lines.push(
      `${isEn ? "Learner" : "Öğrenci"}: ${p.learner_name}`,
      `${isEn ? "Lesson" : "Ders"}: ${p.lesson_title}`,
      `${isEn ? "Date" : "Tarih"}: ${p.lesson_date}`,
      `${isEn ? "Package" : "Paket"}: ${p.package_name || "-"}`,
      `${isEn ? "Remaining / total lessons" : "Kalan / toplam ders"}: ${p.remaining_lessons ?? "-"} / ${p.total_lessons ?? "-"}`,
    );
    if (p.teacher_note) lines.push(`${isEn ? "Teacher note" : "Öğretmen notu"}: ${p.teacher_note}`);
  } else if (row.template === "guardian_welcome") {
    channel = "support";
    subject = isEn ? "Welcome to your Oriens Parent Account" : "Oriens Veli Hesabınıza hoş geldiniz";
    lines.push(
      isEn ? `Dear ${p.guardian_name}, your verified Parent Account is ready.` : `Sayın ${p.guardian_name}, doğrulanmış Veli Hesabınız hazır.`,
      isEn ? "You can now manage your linked learners from one account." : "Bağlı öğrencilerinizi artık tek hesaptan yönetebilirsiniz.",
    );
  } else {
    throw new Error("UNSUPPORTED_OUTBOX_TEMPLATE");
  }

  const text = lines.join("\n");
  const html = `<div style="font-family:Arial,sans-serif;color:#10271B;line-height:1.65"><h1 style="font-size:20px">${escapeHtml(subject)}</h1>${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}<p style="margin-top:24px;color:#68756C">Oriens Academy</p></div>`;
  return { subject, text, html, channel };
}

function verifyServiceRole(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const parsed = JSON.parse(jsonPayload);
    return parsed.role === "service_role";
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const apikey = req.headers.get("apikey") || "";
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();

  const isAuthorized =
    verifyServiceRole(bearer) ||
    verifyServiceRole(apikey) ||
    bearer === serviceKey ||
    apikey === serviceKey;

  if (!isAuthorized) return new Response("Forbidden", { status: 403 });

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin.rpc("claim_email_notifications", { p_limit: 10 });
  if (error) return Response.json({ success: false, error_code: "OUTBOX_CLAIM_FAILED" }, { status: 500 });

  let sent = 0;
  let failed = 0;
  for (const row of (data || []) as OutboxRow[]) {
    try {
      const message = render(row);
      const result = await sendTransactionalEmail({
        supabaseAdmin: admin,
        to: row.recipient,
        subject: message.subject,
        html: message.html,
        text: message.text,
        eventType: row.event_type,
        entityType: row.entity_type,
        entityId: row.entity_id,
        idempotencyKey: row.id,
        channel: message.channel,
        deliveryId: row.id,
        skipArchiveBcc: row.recipient.toLowerCase() === "admin@oriens-academy.com",
      });
      if (result.status === "sent") sent += 1; else failed += 1;
    } catch (err) {
      failed += 1;
      await admin.from("notification_deliveries").update({
        status: "failed",
        last_error_code: "OUTBOX_RENDER_FAILED",
        last_error: err instanceof Error ? err.message.slice(0, 500) : "render failed",
        next_attempt_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
    }
  }
  return Response.json({ success: true, claimed: (data || []).length, sent, failed });
});
