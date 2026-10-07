// @ts-expect-error Deno Edge bundling requires the explicit TypeScript extension.
import { normalContentBlock } from "./templates.ts";

export type PaymentSuccessLocale = "tr" | "en";

export type PaymentSuccessPayload = Record<string, unknown>;

const escapeHtml = (value: unknown) => String(value ?? "").replace(
  /[&<>"']/g,
  (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char),
);

function packageDisplayName(payload: PaymentSuccessPayload, locale: PaymentSuccessLocale) {
  const lessonCount = Number(payload.lesson_count ?? payload.total_lessons ?? 0);
  if (Number.isFinite(lessonCount) && lessonCount > 0) {
    return locale === "en"
      ? `${lessonCount} ${lessonCount === 1 ? "Lesson" : "Lessons"}`
      : `${lessonCount} Ders`;
  }

  const explicitName = String(payload.package_name || "").trim();
  if (explicitName) return explicitName;

  const id = String(payload.package_id || "").trim().toLowerCase();
  const canonical: Record<string, [string, string]> = {
    single: ["1 Ders", "1 Lesson"],
    package5: ["5 Ders", "5 Lessons"],
    package10: ["10 Ders", "10 Lessons"],
    package20: ["20 Ders", "20 Lessons"],
    package30: ["30 Ders", "30 Lessons"],
    custom: ["Özel Paket", "Custom Package"],
  };
  return canonical[id]?.[locale === "en" ? 1 : 0] ?? (locale === "en" ? "Lesson Package" : "Ders Paketi");
}

function amountDisplay(payload: PaymentSuccessPayload, locale: PaymentSuccessLocale) {
  const amount = Number(payload.amount);
  const currency = String(payload.currency || "TRY").toUpperCase();
  if (!Number.isFinite(amount)) return `${String(payload.amount ?? "")} ${currency}`.trim();
  return `${new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    maximumFractionDigits: 2,
  }).format(amount)} ${currency}`;
}

function detailRow(label: string, value: unknown) {
  return `<tr>
    <td style="padding:6px 0;font-weight:700;color:#10271B;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="width:18px;padding:6px 8px;text-align:center;color:#557064;vertical-align:top;">:</td>
    <td style="padding:6px 0;color:#10271B;vertical-align:top;">${escapeHtml(value)}</td>
  </tr>`;
}

function guardianDetailRow(label: string, value: unknown, first: boolean) {
  return `<tr>
    <td class="reference-row-label" width="42%" style="padding:14px 0;color:#6B746E;font-size:14px;vertical-align:middle;${first ? "" : "border-top:1px solid #E6E8E4;"}">${escapeHtml(label)}</td>
    <td style="width:0;padding:0;font-size:0;line-height:0;color:transparent;">:</td>
    <td class="reference-row-value" align="right" style="padding:14px 0;color:#1B2A22;font-size:15px;font-weight:600;text-align:right;vertical-align:middle;${first ? "" : "border-top:1px solid #E6E8E4;"}">${escapeHtml(value)}</td>
  </tr>`;
}

export function renderPaymentSuccessEmail(
  audience: "guardian" | "admin",
  payload: PaymentSuccessPayload,
  recipientLocale: PaymentSuccessLocale,
) {
  const locale = audience === "admin" ? "en" : recipientLocale;
  const isEn = locale === "en";
  const subject = audience === "admin"
    ? "Payment Received Successfully"
    : isEn
      ? "Payment Received Successfully"
      : "Ödemeniz Başarıyla Alındı ve Ders Paketiniz Tanımlandı";
  const payerName = String(payload.payer_name || "");
  const payerEmail = String(payload.payer_email || "");
  const packageName = packageDisplayName(payload, locale);
  const amount = amountDisplay(payload, locale);
  const intro = audience === "admin"
    ? "A payment was received successfully."
    : isEn
      ? `Dear ${payerName}, your payment was received successfully.`
      : `Sayın ${payerName}, ödemeniz başarıyla alınmış ve satın almış olduğunuz ders paketi hesabınıza tanımlanmıştır.`;
  const labels = audience === "admin"
    ? { reference: "Reference", payer: "Payer", email: "Email", package: "Package", amount: "Amount" }
    : isEn
      ? { reference: "Reference", payer: "Full Name", email: "", package: "Package Contents", amount: "" }
      : { reference: "Referans", payer: "Ad Soyad", email: "", package: "Paket İçeriği", amount: "" };
  const details: Array<[string, unknown]> = audience === "admin"
    ? [
      [labels.reference, payload.reference],
      [labels.payer, payerName],
      [labels.email, payerEmail],
      [labels.package, packageName],
      [labels.amount, amount],
    ]
    : [
      [labels.reference, payload.reference],
      [labels.payer, payerName],
      [labels.package, packageName],
    ];
  const text = [intro, ...details.map(([label, value]) => `${label}: ${String(value ?? "")}`)].join("\n");
  const detailsTable = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:auto;">
      ${details.map(([label, value], index) => audience === "guardian" ? guardianDetailRow(label, value, index === 0) : detailRow(label, value)).join("")}
    </table>`;
  const bodyHtml = audience === "guardian"
    ? `<p style="margin:0 0 24px 0;text-align:center;font-size:16px;line-height:26px;color:#3D4741;">${escapeHtml(intro)}</p>
      <div style="padding:8px 24px;background-color:#F7F8F6;border-radius:12px;">${detailsTable}</div>`
    : `<p style="margin:0 0 18px 0;">${escapeHtml(intro)}</p>${normalContentBlock(detailsTable)}`;

  return { subject, title: subject, text, bodyHtml, locale };
}
