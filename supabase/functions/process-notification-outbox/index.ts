import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendTransactionalEmail } from "../_shared/email/service.ts";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { renderEmailShell, actionButton, normalizeLocale } from "../_shared/email/templates.ts";

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

function render(row: OutboxRow, liveRemaining?: number) {
  const p = row.payload || {};
  const isEn = normalizeLocale(p.locale) === "en";
  const lines: string[] = [];
  let subject = "Oriens Academy";
  let channel: "payments" | "support" = "payments";

  if (row.template === "payment_success_guardian") {
    subject = isEn ? `Payment Received & Lesson Rights Activated — ${p.reference}` : `Ödemeniz Alındı ve Ders Haklarınız Tanımlandı — ${p.reference}`;
    lines.push(
      isEn ? `Dear ${p.payer_name}, your payment was completed successfully and your purchased lesson rights have been credited to your account.` : `Sayın ${p.payer_name}, ödemeniz başarıyla alınmış ve satın aldığınız ders hakları hesabınıza tanımlanmıştır.`,
      `${isEn ? "Reference" : "Referans"}: ${p.reference}`,
      `${isEn ? "Package" : "Paket"}: ${p.package_name || p.package_id}`,
      `${isEn ? "Amount" : "Tutar"}: ${p.amount} ${p.currency}`,
    );
  } else if (row.template === "payment_success_admin") {
    subject = `[ORIENS] Payment success — ${p.reference}`;
    lines.push(`Reference: ${p.reference}`, `Payer: ${p.payer_name} <${p.payer_email}>`, `Package: ${p.package_id}`, `Amount: ${p.amount} ${p.currency}`);
  } else if (
    row.template === "lesson_completed_account_holder" ||
    row.template === "lesson_completed_guardian" ||
    row.template === "lesson_completed_student"
  ) {
    // MAIL-027: Strictly lesson and feedback only (No package info)
    channel = "support";
    subject = isEn ? "Lesson Completed Notification | Oriens Academy" : "Ders Tamamlandı Bilgilendirmesi | Oriens Academy";
    const name = String(p.account_holder_name || p.guardian_name || p.learner_name || (isEn ? "Account Owner" : "Hesap Sahibi"));
    lines.push(
      isEn ? `Hello ${name}, your lesson has been completed.` : `Merhaba ${name}, dersiniz tamamlandı.`,
      `${isEn ? "Lesson" : "Ders"}: ${p.lesson_title}`,
      `${isEn ? "Date" : "Tarih"}: ${p.lesson_date}`,
    );
    if (p.teacher_note && String(p.teacher_note).trim().length > 0) {
      lines.push(`${isEn ? "Instructor feedback" : "Eğitmenimizin geri bildirimi"}: ${String(p.teacher_note).trim()}`);
    }
  } else if (row.template === "lesson_remaining_rights_account_holder") {
    // MAIL-040: Post-lesson total remaining rights automation (Includes zero & low-balance advisory)
    channel = "support";
    const remaining = typeof liveRemaining === "number" ? liveRemaining : Math.max(0, Number(p.total_remaining_lessons ?? 0));
    subject = isEn ? `Lesson Completed | Remaining Lesson Rights: ${remaining}` : `Dersiniz Tamamlandı | Kalan Ders Hakkınız: ${remaining}`;
    const name = String(p.account_holder_name || p.guardian_name || p.student_name || (isEn ? "Account Owner" : "Hesap Sahibi"));
    lines.push(
      isEn ? `Hello ${name}, your lesson has been completed.` : `Merhaba ${name}, dersiniz tamamlandı.`,
      `${isEn ? "Completed Lesson" : "Tamamlanan Ders"}: ${p.lesson_title}`,
      `${isEn ? "Date" : "Tarih"}: ${p.lesson_date}`,
      `${isEn ? "Total Usable Lesson Rights" : "Kalan Toplam Ders Hakkınız"}: ${remaining}`,
    );
    if (remaining === 0) {
      lines.push(
        isEn
          ? "Notice: You have 0 lesson rights remaining. Please purchase new lesson rights to continue your education seamlessly."
          : "Bilgilendirme: Ders hakkınız kalmadı. Eğitiminize kesintisiz devam etmek için yeni ders hakkı satın alabilirsiniz."
      );
    } else if (remaining === 1) {
      lines.push(
        isEn
          ? "Reminder: You have only 1 lesson right remaining. You may want to renew your lesson rights before scheduling your next lesson."
          : "Hatırlatma: Kalan toplam ders hakkınız 1'e düştü. Yeni ders planlamadan önce ders haklarınızı yenilemek isteyebilirsiniz."
      );
    }
  } else if (row.template === "payment_refunded_account_holder") {
    const name = String(p.account_holder_name || p.guardian_name || p.learner_name || (isEn ? "Account Owner" : "Hesap Sahibi"));
    const full = p.refund_status === "full";
    subject = isEn
      ? `${full ? "Refund completed" : "Partial refund completed"} — ${p.reference}`
      : `${full ? "İade tamamlandı" : "Kısmi iade tamamlandı"} — ${p.reference}`;
    lines.push(
      isEn ? `Hello ${name}, your refund has been completed.` : `Merhaba ${name}, iade işleminiz tamamlandı.`,
      `${isEn ? "Transaction reference" : "İşlem referansı"}: ${p.reference}`,
      `${isEn ? "Refund reference" : "İade referansı"}: ${p.refund_reference}`,
      `${isEn ? "Refund amount" : "İade tutarı"}: ${p.refund_amount} ${p.currency}`,
      `${isEn ? "Package" : "Paket"}: ${p.package_name}`,
      `${isEn ? "Lesson rights revoked" : "İade edilen ders hakkı"}: ${p.revoked_lessons}`,
      `${isEn ? "Remaining active lesson rights" : "Aktif kalan ders hakkı"}: ${p.remaining_lessons}`,
      `${isEn ? "Refund status" : "İade durumu"}: ${full ? (isEn ? "Full" : "Tam") : (isEn ? "Partial" : "Kısmi")}`,
    );
  } else if (
    row.template === "guardian_welcome" ||
    row.template === "student_welcome" ||
    row.template === "student.welcome_email" ||
    row.template === "guardian.welcome"
  ) {
    channel = "support";
    const name = String(
      p.recipient_name || p.guardian_name || p.full_name || p.student_name || (isEn ? "Account Owner" : "Hesap Sahibi")
    );
    subject = isEn ? "Your Oriens Academy account is ready" : "Oriens Academy hesabınız hazır";
    lines.push(
      isEn
        ? `Dear ${name}, your Oriens Academy account has been created successfully.`
        : `Sayın ${name}, Oriens Academy hesabınız başarıyla oluşturuldu.`,
      isEn
        ? "You can manage lessons, packages and payments from your account."
        : "Ders, paket ve ödeme işlemlerinizi hesabınızdan yönetebilirsiniz.",
    );
  } else if (row.template === "package_assigned_manual") {
    // MAIL-041: Paket tanimlama bilgilendirmesi. Otomatik DEGIL -- admin panelinden
    // acik bir aksiyonla (admin_send_package_notification) kuyruga alinir.
    channel = "support";
    const name = String(p.account_holder_name || p.learner_name || (isEn ? "Account Owner" : "Hesap Sahibi"));
    const remaining = Math.max(0, Number(p.remaining_lessons ?? 0));
    subject = isEn ? "Your Lesson Package Is Ready | Oriens Academy" : "Ders Paketiniz Tanımlandı | Oriens Academy";
    lines.push(
      isEn
        ? `Hello ${name}, the lesson package below has been defined for ${p.learner_name}.`
        : `Merhaba ${name}, ${p.learner_name} için aşağıdaki ders paketi tanımlanmıştır.`,
      `${isEn ? "Package" : "Paket"}: ${p.package_name}`,
      `${isEn ? "Total lessons in package" : "Paketteki toplam ders"}: ${p.lesson_count}`,
      `${isEn ? "Remaining lessons in this package" : "Bu paketten kalan ders"}: ${remaining}`,
      `${isEn ? "Total usable lesson rights" : "Kullanılabilir toplam ders hakkınız"}: ${Math.max(0, Number(p.total_remaining_lessons ?? 0))}`,
    );
    if (p.start_date) {
      lines.push(`${isEn ? "Start date" : "Başlangıç tarihi"}: ${p.start_date}`);
    }
    if (p.end_date) {
      lines.push(`${isEn ? "End date" : "Bitiş tarihi"}: ${p.end_date}`);
    }
    lines.push(
      isEn
        ? "You can follow your lessons and remaining rights from your account at any time."
        : "Derslerinizi ve kalan haklarınızı dilediğiniz zaman hesabınızdan takip edebilirsiniz."
    );
  } else if (row.template === "lesson_rights_manual") {
    // MAIL-042: Ders hakki guncelleme bilgilendirmesi. Otomatik DEGIL -- hak
    // artirma/azaltma islemi kendi basina e-posta gondermez.
    channel = "support";
    const name = String(p.account_holder_name || p.learner_name || (isEn ? "Account Owner" : "Hesap Sahibi"));
    const totalRemaining = Math.max(0, Number(p.total_remaining_lessons ?? 0));
    subject = isEn
      ? `Your Lesson Rights Have Been Updated | Remaining: ${totalRemaining}`
      : `Ders Hakkınız Güncellendi | Kalan Ders Hakkınız: ${totalRemaining}`;
    lines.push(
      isEn
        ? `Hello ${name}, the lesson rights of ${p.learner_name} have been updated.`
        : `Merhaba ${name}, ${p.learner_name} adına tanımlı ders haklarınız güncellenmiştir.`,
      `${isEn ? "Package" : "Paket"}: ${p.package_name}`,
      `${isEn ? "Remaining lessons in this package" : "Bu paketten kalan ders"}: ${Math.max(0, Number(p.remaining_lessons ?? 0))}`,
      `${isEn ? "Total usable lesson rights" : "Kullanılabilir toplam ders hakkınız"}: ${totalRemaining}`,
    );
    if (totalRemaining === 0) {
      lines.push(
        isEn
          ? "Notice: You have 0 lesson rights remaining. Please purchase new lesson rights to continue your education seamlessly."
          : "Bilgilendirme: Ders hakkınız kalmadı. Eğitiminize kesintisiz devam etmek için yeni ders hakkı satın alabilirsiniz."
      );
    } else if (totalRemaining === 1) {
      lines.push(
        isEn
          ? "Reminder: You have only 1 lesson right remaining."
          : "Hatırlatma: Kalan toplam ders hakkınız 1'e düştü."
      );
    }
  } else {
    throw new Error("UNSUPPORTED_OUTBOX_TEMPLATE");
  }

  const text = lines.join("\n");
  const isPricingCta =
    (row.template === "lesson_remaining_rights_account_holder" && (liveRemaining === 0 || Number(p.total_remaining_lessons) === 0)) ||
    (row.template === "lesson_rights_manual" && Number(p.total_remaining_lessons ?? 0) === 0);
  const ctaUrl = isPricingCta
    ? (isEn ? "https://oriens-academy.com/en/pricing/" : "https://oriens-academy.com/tr/ucretler/")
    : (isEn ? "https://oriens-academy.com/en/account/" : "https://oriens-academy.com/tr/hesabim/");
  const ctaLabel = isPricingCta ? (isEn ? "Renew Lesson Rights" : "Ders Haklarını Yenile") : (isEn ? "Go to My Account" : "Hesabıma Git");
  const ctaButton = actionButton(ctaLabel, ctaUrl);
  const bodyHtml = `
    <div style="font-size:14px;line-height:1.65;color:#10271B;">
      ${lines.map((line) => `<p style="margin:0 0 12px 0;">${escapeHtml(line)}</p>`).join("")}
      <div style="margin-top:20px;">
        ${ctaButton}
      </div>
    </div>
  `;
  const html = renderEmailShell({
    locale: isEn ? "en" : "tr",
    eyebrow: isEn ? "Oriens Academy" : "Oriens Academy",
    title: subject,
    bodyHtml,
    footerEmail: "info@oriens-academy.com",
    footerNote: isEn
      ? "This is an automated notification from Oriens Academy."
      : "Bu otomatik bir bilgilendirme e-postasıdır.",
  });

  return { subject, text, html, channel };
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const schedulerKeyHash = Deno.env.get("OUTBOX_SCHEDULER_KEY_SHA256") ?? "";
  const apikey = req.headers.get("apikey") || "";
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const isServiceRequest = Boolean(serviceKey) && (bearer === serviceKey || apikey === serviceKey);
  const isScheduledRequest = body.source === "scheduled" && Boolean(schedulerKeyHash) && Boolean(apikey) &&
    (await sha256Hex(apikey)) === schedulerKeyHash;

  const admin = createClient(supabaseUrl, serviceKey);
  let isAdminRequest = false;
  if (!isServiceRequest && !isScheduledRequest && bearer) {
    const { data: userData } = await admin.auth.getUser(bearer);
    if (userData.user) {
      const { data: profile } = await admin
        .from("admin_profiles")
        .select("active,role")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      isAdminRequest = profile?.active === true && profile.role === "admin";
    }
  }

  if (!isServiceRequest && !isScheduledRequest && !isAdminRequest) {
    return buildJsonResponse({ success: false, error_code: "ADMIN_OR_SERVICE_REQUIRED" }, 403, req);
  }

  const { data, error } = await admin.rpc("claim_email_notifications", { p_limit: 10 });
  if (error) return buildJsonResponse({ success: false, error_code: "OUTBOX_CLAIM_FAILED" }, 500, req);

  let sent = 0;
  let failed = 0;
  for (const row of (data || []) as OutboxRow[]) {
    // 1. Decommissioned templates check: Cancel without error
    if (
      row.template === "package_activated_guardian" ||
      row.template === "lesson_rights_decreased" ||
      row.template === "package_low_balance_account_holder" ||
      row.template === "package_completed_renewal_account_holder"
    ) {
      await admin.from("notification_deliveries").update({
        status: "cancelled",
        last_error_code: "TEMPLATE_DECOMMISSIONED",
        last_error: `Template ${row.template} decommissioned or consolidated into MAIL-040.`,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      continue;
    }

    // 2. Lesson state check and live remaining rights calculation for MAIL-040
    let liveRemaining: number | undefined;
    if (row.template === "lesson_remaining_rights_account_holder") {
      const lessonId = row.entity_id || (row.payload as Record<string, unknown>)?.lesson_id;
      const { data: lesson } = await admin
        .from("student_lessons")
        .select("id, status, student_user_id, title, lesson_date")
        .eq("id", lessonId)
        .maybeSingle();

      if (!lesson || lesson.status !== "completed") {
        await admin.from("notification_deliveries").update({
          status: "cancelled",
          last_error_code: "LESSON_NOT_COMPLETED",
          last_error: `Lesson status is ${lesson?.status || "missing"}. Cancelled remaining rights delivery.`,
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        continue;
      }

      // Calculate authoritative live remaining rights across all active, non-expired packages
      const { data: rightsData } = await admin.rpc("calculate_student_usable_remaining_lessons", {
        p_student_id: lesson.student_user_id,
      });
      liveRemaining = Number(rightsData ?? 0);
    }

    try {
      const message = render(row, liveRemaining);
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
  return buildJsonResponse({ success: true, claimed: (data || []).length, sent, failed }, 200, req);
});
