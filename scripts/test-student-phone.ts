// Öğrenci telefonu normalizasyonu ve WhatsApp bağlantısı (ağ yok).
// SQL karşılığı public.normalize_student_phone ile aynı tablo kullanılır.
import assert from "node:assert/strict";
import {
  formatPaymentPhoneInput,
  formatTrGuardianPhoneInput,
  formatTrPhoneDisplay,
  formatTrPhoneInput,
  guardianPhoneInputDigits,
  isValidPaymentPhoneDigits,
  normalizeStudentPhone,
  trPhoneInputDigits,
  trPhoneWaDigits,
} from "../src/lib/format/phone";

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

for (const input of ["5321234567", "0532 123 45 67", "+90 532 123 45 67", "+90 (532) 123 45 67"]) {
  const digits = trPhoneInputDigits(input);
  assert.equal(digits, "5321234567", `input digits: ${input}`);
  assert.equal(`+90 ${formatTrPhoneInput(digits)}`, "+90 (532) 123 45 67", `live mask: ${input}`);
  assert.equal(normalizeStudentPhone(digits), "905321234567", `canonical payload: ${input}`);
}
assert.equal(formatTrPhoneInput(trPhoneInputDigits("")), "", "telefon temizlenebilir");
assert.equal(formatTrPhoneInput(trPhoneInputDigits("5321234567").slice(0, -1)), "(532) 123 45 6", "backspace maskeyi korur");

// Veli telefonu (PDF-14): +90 XXX XXX XX XX, kayıt 905… biçiminde.
for (const input of ["+90 533 999 88 77", "05339998877", "5339998877", "+905339998877"]) {
  const digits = guardianPhoneInputDigits(input);
  assert.equal(digits, "5339998877", `guardian digits: ${input}`);
  assert.equal(formatTrGuardianPhoneInput(digits), "+90 533 999 88 77", `guardian mask: ${input}`);
  assert.equal(normalizeStudentPhone(digits), "905339998877", `guardian payload: ${input}`);
}
assert.equal(formatTrGuardianPhoneInput("533"), "+90 533", "veli maskesi kısmi");
assert.equal(formatTrGuardianPhoneInput(""), "", "veli telefonu boş bırakılabilir");

// Ödeme sayfası (+90 ön eki ayrı çipte): "5XX XXX XX XX", yalnız 5 ile başlayan 10 hane geçerli.
assert.equal(formatPaymentPhoneInput("5321234567"), "532 123 45 67");
assert.equal(formatPaymentPhoneInput("+90 532 123 45 67"), "532 123 45 67", "yapıştırılan +90 temizlenir");
assert.equal(formatPaymentPhoneInput("0532 1234567"), "532 123 45 67", "baştaki 0 temizlenir");
assert.equal(formatPaymentPhoneInput("53212"), "532 12", "kısmi maske");
assert.equal(formatPaymentPhoneInput("532123456789"), "532 123 45 67", "fazla hane kesilir");
assert.equal(isValidPaymentPhoneDigits("5321234567"), true);
assert.equal(isValidPaymentPhoneDigits("4321234567"), false, "5 ile başlamalı");
assert.equal(isValidPaymentPhoneDigits("532123456"), false, "10 hane olmalı");
assert.equal(isValidPaymentPhoneDigits(""), false);

console.log(`STUDENT PHONE: ${cases.length + 21 + 23} assertions PASS`);
