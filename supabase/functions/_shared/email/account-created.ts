import { escapeHtml } from "./templates.ts";

export function renderAccountCreatedEmail(payload: Record<string, unknown>, locale: "tr" | "en") {
  const isEn = locale === "en";
  const name = String(
    payload.account_holder_name ||
    payload.recipient_name ||
    payload.guardian_name ||
    payload.full_name ||
    payload.student_name ||
    (isEn ? "Account Owner" : "Hesap Sahibi"),
  );
  const subject = isEn ? "Your Oriens Academy account is ready" : "Oriens Academy hesabınız hazır";
  const greeting = isEn
    ? `Dear ${name}, your Oriens Academy account has been created successfully.`
    : `Sayın ${name}, Oriens Academy hesabınız başarıyla oluşturuldu.`;
  const info = isEn
    ? "You can manage lessons, packages and payments from your account."
    : "Ders, paket ve ödeme işlemlerinizi hesabınızdan yönetebilirsiniz.";
  const bodyHtml = `<p style="margin:0 0 16px 0;font-size:16px;line-height:26px;color:#3D4A43;">${escapeHtml(greeting)}</p><div style="padding:18px 20px;background-color:#FAF8F3;border:1px solid #EFE9DC;border-radius:12px;font-size:14px;line-height:22px;color:#3D4A43;">${escapeHtml(info)}</div>`;
  return { subject, title: subject, text: `${greeting}\n${info}`, bodyHtml, visualVariant: "account-created" as const };
}
