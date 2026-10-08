// Türkiye telefon numarası: tek kanonik sınır.
// Saklama (guardian_accounts.phone): yalnız 10 hane ("5333591962") ya da NULL.
// Eski kayıtlardaki "+905333591962" / "05333591962" biçimleri okunurken bu
// yardımcılarla 10 haneye indirilir; toplu veri dönüştürmesi yapılmaz.
// Öğrenci telefonu (student_profiles.phone) ise "905XXXXXXXXX" biçiminde
// saklanır: normalizeStudentPhone ↔ SQL public.normalize_student_phone.

/** Girilen/yapıştırılan değerden en fazla 10 hane: +90 / 90 / baştaki 0 atılır. */
export function trPhoneInputDigits(value: string | null | undefined): string {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("90")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  return digits.slice(0, 10);
}

/** Kayıtlı değeri 10 haneye indirir; boşsa null. 10 haneye inmeyen değer olduğu gibi (rakam) döner. */
export function normalizeTrPhone(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 12 && digits.startsWith("90")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

export function isCompleteTrPhone(digits: string | null | undefined): boolean {
  return /^[1-9]\d{9}$/.test(digits ?? "");
}

/** Hesabım giriş alanı: (5XX) XXX XX XX — yazılırken kısmi biçim. */
export function formatTrPhoneInput(digits: string): string {
  const d = trPhoneInputDigits(digits);
  if (!d) return "";
  return `(${d.slice(0, 3)}${d.length > 3 ? `) ${d.slice(3, 6)}` : ""}${d.length > 6 ? ` ${d.slice(6, 8)}` : ""}${d.length > 8 ? ` ${d.slice(8, 10)}` : ""}`;
}

/** Panel gösterimi: +90 XXX XXX XX XX. Biçimlenemeyen değer olduğu gibi gösterilir. */
export function formatTrPhoneDisplay(value: string | null | undefined): string {
  const digits = normalizeTrPhone(value);
  if (!digits) return "";
  if (digits.length === 10) return `+90 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  return String(value).trim();
}

/** wa.me bağlantısı için uluslararası rakamlar (905XXXXXXXXX). */
export function trPhoneWaDigits(value: string | null | undefined): string {
  const digits = normalizeTrPhone(value);
  if (!digits) return "";
  return digits.length === 10 ? `90${digits}` : digits;
}

/**
 * Öğrenci telefonu: "0532 123 45 67", "+90 (532) 123 45 67", "5321234567" →
 * "905321234567". Türkiye dışı numaralar (11–15 hane, başında 0/90 yok) rakam
 * olarak korunur. Boş → null; çözümlenemeyen değer → undefined (geçersiz).
 * SQL karşılığı public.normalize_student_phone ile aynı kuralı uygular.
 */
export function normalizeStudentPhone(value: string | null | undefined): string | null | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.length > 30) return undefined;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^[1-9]\d{9}$/.test(digits)) return `90${digits}`;
  if (/^0[1-9]\d{9}$/.test(digits)) return `90${digits.slice(1)}`;
  if (/^90[1-9]\d{9}$/.test(digits)) return digits;
  if (/^[1-9]\d{10,14}$/.test(digits) && !digits.startsWith("90")) return digits;
  return undefined;
}
