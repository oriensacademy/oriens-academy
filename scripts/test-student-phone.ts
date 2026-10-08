// Öğrenci telefonu normalizasyonu ve WhatsApp bağlantısı (ağ yok).
// SQL karşılığı public.normalize_student_phone ile aynı tablo kullanılır.
import assert from "node:assert/strict";
import { formatTrPhoneDisplay, normalizeStudentPhone, trPhoneWaDigits } from "../src/lib/format/phone";

const cases: Array<[string | null, string | null | undefined]> = [
  ["0532 123 45 67", "905321234567"],
  ["+90 (532) 123 45 67", "905321234567"],
  ["(0532) 123-45-67", "905321234567"],
  ["5321234567", "905321234567"],
  ["905321234567", "905321234567"],
  ["0090 532 123 4567", "905321234567"],
  ["+44 20 7946 0958", "442079460958"],
  ["", null],
  ["   ", null],
  [null, null],
  ["123", undefined],
  ["0532 123 45", undefined],
  ["053212345678", undefined],
  ["abc", undefined],
  ["5".repeat(31), undefined],
];
for (const [input, expected] of cases) assert.equal(normalizeStudentPhone(input), expected, `normalize(${JSON.stringify(input)})`);

// Detay ekranındaki bağlantı: https://wa.me/<rakamlar>, sorgu dizisi yok.
const waHref = (phone: string | null, guardianPhone: string | null) => {
  const digits = trPhoneWaDigits(phone || guardianPhone);
  return /^\d{11,15}$/.test(digits) ? `https://wa.me/${digits}` : null;
};
assert.equal(waHref(normalizeStudentPhone("0532 123 45 67") ?? null, null), "https://wa.me/905321234567");
assert.equal(waHref("905321234567", "5339998877"), "https://wa.me/905321234567", "öğrenci numarası önce");
assert.equal(waHref(null, "5339998877"), "https://wa.me/905339998877", "veli yedeği (10 hane)");
assert.equal(waHref(null, "+905339998877"), "https://wa.me/905339998877", "veli yedeği (+90)");
assert.equal(waHref(null, null), null, "numara yoksa bağlantı yok");
assert.equal(formatTrPhoneDisplay("905321234567"), "+90 (532) 123 45 67");
assert.equal(normalizeStudentPhone(formatTrPhoneDisplay("905321234567")), "905321234567", "düzenleme alanı değişmeden kaydedilirse aynı değer");

console.log(`STUDENT PHONE: ${cases.length + 7} assertions PASS`);
