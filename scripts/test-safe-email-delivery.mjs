import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log("=== STEP 11: SAFE QA EMAIL DELIVERY TEST TO admin@oriens-academy.com ===");

  const fnUrl = `${supabaseUrl}/functions/v1/email-preview-delivery`;
  const payload = {
    channel: "general",
    recipient: "admin@oriens-academy.com",
    subject: "[ORIENS RELEASE QA] Production Release Deployment Verification",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #10271B; max-width: 600px;">
        <h2 style="color: #0E5A3A;">Oriens Academy — Canlı Yayın Doğrulama Bildirimi</h2>
        <p>Bu e-posta, <strong>Oriens Academy</strong> nihai kontrollü canlı yayına geçiş (Production Release) QA adımı kapsamında <code>admin@oriens-academy.com</code> adresine gönderilmiştir.</p>
        <div style="background-color: #F4FBF7; border-left: 4px solid #0E5A3A; padding: 12px; margin: 16px 0;">
          <p style="margin: 0; font-size: 14px;"><strong>Doğrulanan Bileşenler:</strong></p>
          <ul style="margin: 8px 0 0 16px; font-size: 13px;">
            <li>15 Desteklenen Genel Sınav Kataloğu (Canonical Order)</li>
            <li>Üniversite Keşif Motoru v2 & Autocomplete RPC</li>
            <li>Veli Kimlik Modeli & RLS İzolasyonu</li>
            <li>PayTR Sunucu Doğrulamalı Ödeme & Güvenli Outbox</li>
            <li>RFC 2047 UTF-8 Başlık Kodlaması (Türkçe Karakter Desteği: Ö, ç, ş, ğ, ü, İ)</li>
          </ul>
        </div>
        <p style="font-size: 12px; color: #68756C; margin-top: 24px;">Zaman Damgası: ${new Date().toISOString()} · Oriens Academy Prod QA</p>
      </div>
    `,
    text: "Oriens Academy — Canlı Yayın Doğrulama Bildirimi\nBu e-posta, nihai canlı yayına geçiş QA adımı kapsamında admin@oriens-academy.com adresine gönderilmiştir.",
    eventType: "qa.release.verification"
  };

  const res = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
      "apikey": serviceKey
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => null);
  console.log(`Email delivery test status: ${res.status}`);
  console.log(`Response:`, data);
}

main().catch(console.error);
