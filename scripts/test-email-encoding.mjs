/**
 * E-posta kodlama regresyon testi.
 *
 * Üretilen RFC 2822 mesajını GERÇEKTEN çözer (başlıkları RFC 2047'ye göre,
 * gövdeleri base64'e göre) ve Türkçe karakterlerin bayt bayt geri geldiğini
 * doğrular. Hiçbir e-posta gönderilmez.
 *
 * Neden var: teslim edilen maillerde "hesabınız hazır" -> "hesabnz hazr"
 * şeklinde yalnızca ı/ğ/ş/İ düşüyordu. Bunlar Latin-1'de BULUNMAYAN Türkçe
 * harfler; ö/ü/ç ise Latin-1'de var olduğu için hayatta kalıyordu. Sebep,
 * gövdelerin `Content-Transfer-Encoding: 8bit` ile ham UTF-8 gönderilmesiydi.
 *
 *   node scripts/test-email-encoding.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SERVICE = "supabase/functions/_shared/email/service.ts";

let passed = 0;
const failures = [];
function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log("  GECTI  " + name);
  } else {
    failures.push(name + (detail ? " -- " + detail : ""));
    console.log("  KALDI  " + name + (detail ? " -- " + detail : ""));
  }
}

// service.ts, Deno'ya özgü importlar içerdiği için doğrudan derlenemez; test
// edilen iki saf fonksiyon (encodeHeaderWord, buildRfc822Message) ile
// yardımcıları çıkarılıp tek başına derlenir. Böylece test, gerçek üretim
// kaynağını okur -- kopyalanmış bir taklidini değil.
const source = readFileSync(path.join(ROOT, SERVICE), "utf8");
function extract(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error("bulunamadi: " + startMarker);
  const end = source.indexOf(endMarker, start);
  if (end === -1) throw new Error("bitis bulunamadi: " + endMarker);
  return source.slice(start, end);
}

const extracted =
  extract("function utf8Binary(", "function encodeMailboxHeader(") +
  extract("function encodeMailboxHeader(", "/** Base64 body content") +
  extract("/** Base64 body content", "export function buildRfc822Message(params: {") +
  extract("export function buildRfc822Message(params: {", "function getEnvVar(");

const outDir = mkdtempSync(path.join(tmpdir(), "mailenc-"));
const tsFile = path.join(outDir, "mailenc.ts");
writeFileSync(
  tsFile,
  extracted.replace("crypto.randomUUID()", '"BOUNDARYFIXED0000000000000000000"'),
  "utf8"
);
execFileSync(
  process.execPath,
  [
    path.join(ROOT, "node_modules", "typescript", "bin", "tsc"),
    tsFile,
    "--outDir",
    outDir,
    "--module",
    "esnext",
    "--target",
    "es2022",
    "--moduleResolution",
    "bundler",
    "--skipLibCheck",
  ],
  { cwd: ROOT, stdio: "pipe" }
);
const mod = await import(pathToFileURL(path.join(outDir, "mailenc.js")).href);
const { encodeHeaderWord, buildRfc822Message } = mod;

/** RFC 2047 çözücü: hem B hem Q kodlu kelimeleri çözer. */
function decodeHeader(value) {
  return value
    // RFC 2047: iki bitisik encoded-word arasindaki bosluk/katlama yok sayilir.
    .replace(/\?=[\r\n\s]+=\?/g, "?==?")
    .replace(/=\?UTF-8\?B\?([^?]*)\?=/gi, (_m, payload) => Buffer.from(payload, "base64").toString("utf8"))
    .replace(/=\?UTF-8\?Q\?([^?]*)\?=/gi, (_m, payload) =>
      Buffer.from(payload.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_x, hex) => String.fromCharCode(parseInt(hex, 16))), "binary").toString("utf8")
    );
}

function parseMessage(raw) {
  const [headerBlock, ...rest] = raw.split("\r\n\r\n");
  const bodyRaw = rest.join("\r\n\r\n");
  const headers = {};
  // Katlanmış başlık satırlarını birleştir.
  for (const line of headerBlock.replace(/\r\n[ \t]+/g, (m) => m.replace(/\r\n[ \t]+/, "\r\n ")).split("\r\n")) {
    const idx = line.indexOf(":");
    if (idx > 0 && !/^[ \t]/.test(line)) headers[line.slice(0, idx).toLowerCase()] = line.slice(idx + 1).trim();
    else if (idx === -1 && Object.keys(headers).length) {
      const last = Object.keys(headers).pop();
      headers[last] += line;
    }
  }
  return { headers, bodyRaw, headerBlock };
}

// Yalnizca ASCII-disi Turkce harfler. Duz "I" bilerek disarida: ASCII oldugu
// icin base64 yukunun icinde dogal olarak gecer ve yanlis pozitif uretirdi.
const TURKISH = "ışğüöçİŞĞÜÖÇ";
const SUBJECT = "Oriens Academy hesabınız hazır — ışğüöç İŞĞÜÖÇ";
const TEXT = "Sayın Mert Ömeroğlu, hesabınız başarıyla oluşturuldu. Kalan ders hakkınız: 3.";
const HTML = "<p>Sayın <strong>Mert Ömeroğlu</strong>, hesabınız başarıyla oluşturuldu. Şu ışıkta çalışır.</p>";

console.log("\n[1] BASLIK KODLAMASI (RFC 2047)");
{
  const encoded = encodeHeaderWord(SUBJECT);
  check("baslik kodlanmis olarak uretiliyor", encoded.includes("=?UTF-8?B?"), encoded.slice(0, 60));
  check("cozuldugunde baslik birebir geri geliyor", decodeHeader(encoded) === SUBJECT, decodeHeader(encoded));
  const words = encoded.split("\r\n ");
  check(
    "her encoded-word RFC 2047'nin 75 karakter sinirinda",
    words.every((w) => w.length <= 75),
    words.map((w) => w.length).join(",")
  );
  check("saf ASCII baslik gereksiz yere kodlanmiyor", encodeHeaderWord("Payment success ORI123") === "Payment success ORI123");
  check(
    "cok baytli karakter iki kelimeye bolunmuyor",
    decodeHeader(encodeHeaderWord("ı".repeat(120))) === "ı".repeat(120)
  );
}

console.log("\n[2] GOVDE KODLAMASI");
{
  const raw = buildRfc822Message({
    from: "Oriens Academy Öğrenci Destek <info@oriens-academy.com>",
    to: "ogrenci@example.com",
    bcc: "admin@oriens-academy.com",
    replyTo: "info@oriens-academy.com",
    subject: SUBJECT,
    html: HTML,
    text: TEXT,
  });
  const { headers, bodyRaw } = parseMessage(raw);

  check("gövdeler 8bit yerine base64 ile aktariliyor", !raw.includes("Content-Transfer-Encoding: 8bit") && raw.includes("Content-Transfer-Encoding: base64"));
  check("ham mesajda cıplak Turkce karakter kalmiyor", ![...TURKISH].some((ch) => bodyRaw.includes(ch)));

  const parts = bodyRaw.split(/--====_Oriens_[A-Za-z0-9]+_====/).filter((p) => p.includes("Content-Type:"));
  check("iki MIME parcasi uretildi", parts.length === 2, String(parts.length));

  const decoded = parts.map((part) => {
    const payload = part.split("\r\n\r\n").slice(1).join("\r\n\r\n").trim();
    return Buffer.from(payload.replace(/\r\n/g, ""), "base64").toString("utf8");
  });
  check("duz metin parcasi birebir cozuluyor", decoded[0] === TEXT, decoded[0]);
  check("HTML parcasi birebir cozuluyor", decoded[1] === HTML, decoded[1]);
  check("kaybolan harfler geri geldi (ı ğ ş)", decoded[0].includes("hesabınız başarıyla") && decoded[1].includes("ışıkta"));

  check("base64 satirlari 76 karakteri asmiyor", decoded.length === 2 && bodyRaw.split("\r\n").every((line) => line.length <= 78));

  console.log("\n[3] BASLIKLAR");
  check("Subject basligi cozuldugunde dogru", decodeHeader(headers.subject) === SUBJECT, headers.subject);
  check("From görünen adı cozuldugunde dogru", decodeHeader(headers.from).includes("Oriens Academy Öğrenci Destek"), headers.from);
  check("From adresi bozulmadi", headers.from.includes("<info@oriens-academy.com>"));
  check("Bcc arsiv adresi korunuyor", headers.bcc === "admin@oriens-academy.com");
  check("MIME-Version bildirildi", raw.includes("MIME-Version: 1.0"));
  check("charset her parcada UTF-8", (raw.match(/charset=UTF-8/g) || []).length === 2);
}

console.log("\n[4] GERCEK URETIM METINLERI");
{
  const cases = [
    "Oriens Academy hesabınız hazır",
    "Dersiniz Tamamlandı | Kalan Ders Hakkınız: 3",
    "Ödemeniz Alındı ve Ders Haklarınız Tanımlandı — ORI2026",
    "Yeni E-posta Adresinizi Doğrulayın | Oriens Academy",
    "Oriens Academy — 012345 E-posta Doğrulama Kodunuz",
    "Randevu Tarih Değişikliği: Matematik Dersi | Oriens Academy",
  ];
  for (const subject of cases) {
    const roundTrip = decodeHeader(encodeHeaderWord(subject));
    check(`konu birebir donuyor: "${subject.slice(0, 42)}…"`, roundTrip === subject, roundTrip);
  }
}

rmSync(outDir, { recursive: true, force: true });

console.log("\n=======================================");
console.log(`  ${passed} gecti, ${failures.length} kaldi`);
if (failures.length) {
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log("  E-POSTA KODLAMASI: TAMAMEN TEMIZ");
