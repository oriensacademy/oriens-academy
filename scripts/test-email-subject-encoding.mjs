import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Import directly from service.ts using file read or module eval
const serviceSource = readFileSync(new URL("../supabase/functions/_shared/email/service.ts", import.meta.url), "utf8");

// Extract encodeHeaderWord from serviceSource
const match = serviceSource.match(/export function encodeHeaderWord\(value: string\): string \{([\s\S]*?)\n\}\n\nfunction encodeMailboxHeader/);
assert.ok(match, "could not extract encodeHeaderWord from service.ts");

// Strip TypeScript type annotations for raw Node execution
const jsBody = match[1]
  .replace(/:\s*string\[\]/g, "")
  .replace(/:\s*string/g, "")
  .replace(/:\s*number/g, "");

const encodeHeaderWord = new Function("value", jsBody);

function decodeRfc2047(header) {
  const normalized = header.replace(/\?=\s+=\?UTF-8\?Q\?/gi, "");
  return normalized.replace(/=\?UTF-8\?Q\?(.*?)\?=/gi, (_, raw) => {
    const bytes = [];
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === "_") {
        bytes.push(0x20);
      } else if (raw[i] === "=" && i + 2 < raw.length) {
        bytes.push(parseInt(raw.substr(i + 1, 2), 16));
        i += 2;
      } else {
        bytes.push(raw.charCodeAt(i));
      }
    }
    return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  });
}

console.log("Running RFC 2047 Email Subject Encoding Tests...");

// Test 1: Exact prompt target
const targetSubject = "Oriens Academy hesabınız hazır";
const encTarget = encodeHeaderWord(targetSubject);
console.log("Target Subject:", targetSubject);
console.log("Encoded Target:", encTarget);
assert.equal(encTarget, "=?UTF-8?Q?Oriens_Academy_hesab=C4=B1n=C4=B1z_haz=C4=B1r?=");
assert.equal(decodeRfc2047(encTarget), targetSubject);
assert.ok(/^[\x20-\x7E]+$/.test(encTarget), "Encoded subject must contain only printable 7-bit ASCII");
console.log("✓ Test 1 Passed: Target subject correctly Q-encoded and decodes losslessly.");

// Test 2: Full Turkish alphabet with special letters
const turkishLetters = "ı İ ş Ş ğ Ğ ü Ü ö Ö ç Ç";
const encLetters = encodeHeaderWord(turkishLetters);
console.log("Turkish Letters:", turkishLetters);
console.log("Encoded Letters:", encLetters);
assert.equal(decodeRfc2047(encLetters), turkishLetters);
assert.ok(/^[\x20-\x7E]+$/.test(encLetters), "Encoded letters must contain only printable 7-bit ASCII");
console.log("✓ Test 2 Passed: All Turkish characters preserved without loss.");

// Test 3: Mailbox display name in From header
const fromName = "Oriens Academy Öğrenci Destek";
const encFrom = encodeHeaderWord(fromName);
console.log("From Name:", fromName);
console.log("Encoded From:", encFrom);
assert.equal(encFrom, "=?UTF-8?Q?Oriens_Academy_=C3=96=C4=9Frenci_Destek?=");
assert.equal(decodeRfc2047(encFrom), fromName);
assert.ok(/^[\x20-\x7E]+$/.test(encFrom), "From display name must contain only printable 7-bit ASCII");
console.log("✓ Test 3 Passed: Mailbox From display name correctly encoded.");

// Test 4: Long subject requiring line folding
const longSubject = "Sayın Veli, öğrencimiz için hazırlanan çok uzun ders tamamlama ve paket bilgilendirme e-postası hazır";
const encLong = encodeHeaderWord(longSubject);
console.log("Long Subject Encoded:", encLong);
assert.equal(decodeRfc2047(encLong), longSubject);
assert.ok(/^[\x20-\x7E]+$/.test(encLong), "Long encoded subject must contain only printable 7-bit ASCII");
console.log("✓ Test 4 Passed: Long subject folds safely across encoded-words without multi-byte corruption.");

// Test 5: Plain ASCII unchanged
const plainAscii = "Oriens Academy";
const encPlain = encodeHeaderWord(plainAscii);
assert.equal(encPlain, plainAscii);
console.log("✓ Test 5 Passed: Pure ASCII is not redundantly encoded.");

console.log("\nALL EMAIL SUBJECT UTF-8 TESTS PASSED!");
