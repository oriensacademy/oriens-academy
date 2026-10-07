// Türkçe arama/sıralama ve tarih biçimleri için küçük, bağımlılıksız yardımcılar.
// Şema değişikliği yok; yalnız istemci tarafı listelerde kullanılır.

const FOLD_MAP: Record<string, string> = {
  ı: "i",
  ş: "s",
  ğ: "g",
  ü: "u",
  ö: "o",
  ç: "c",
  â: "a",
  î: "i",
  û: "u",
};

/** "Öğrenci" → "ogrenci", "IŞIK" → "isik". Arama karşılaştırması içindir. */
export function foldTurkish(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ışğüöçâîû]/g, (char) => FOLD_MAP[char] ?? char);
}

/** "ogrenci" sorgusu "Öğrenci" içeren metni bulur. Boş sorgu her şeyle eşleşir. */
export function matchesTurkishSearch(haystack: string | null | undefined, query: string | null | undefined): boolean {
  const needle = foldTurkish(query).trim();
  if (!needle) return true;
  return foldTurkish(haystack).includes(needle);
}

export function compareTr(a: string | null | undefined, b: string | null | undefined): number {
  return (a ?? "").localeCompare(b ?? "", "tr", { sensitivity: "base", numeric: true });
}

/** "01 Ekim 2026 Perşembe" */
export function formatTrLongDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
  const weekday = new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(date);
  return `${day} ${weekday}`;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Liste hücreleri için iki satır: üstte tarih, altta "Gün · SS:DD".
 * Bugün/Dün göreli adla gösterilir.
 */
export function formatTrListDate(value: string | null | undefined, now: Date = new Date()): { primary: string; secondary: string } {
  if (!value) return { primary: "—", secondary: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { primary: "—", secondary: "" };
  const primary = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  const dayLabel =
    diffDays === 0
      ? "Bugün"
      : diffDays === 1
        ? "Dün"
        : new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(date);
  return { primary, secondary: `${dayLabel} · ${time}` };
}

/**
 * Panel listeleri (referans tasarım): bugün/dün ise "Bugün"/"Dün" + saat,
 * değilse "02 Ekim 2026" + "Cuma · 16:14".
 */
export function formatTrShortListDate(value: string | null | undefined, now: Date = new Date()): { primary: string; secondary: string } {
  const full = formatTrListDate(value, now);
  if (full.primary === "—") return full;
  const [day, time] = full.secondary.split(" · ");
  return day === "Bugün" || day === "Dün" ? { primary: day, secondary: time } : full;
}

/** Referans tasarımdaki tutar biçimi: "₺27.000", "₺1.250,5". */
export function formatTrLira(amount: number | null | undefined): string {
  const value = Number(amount) || 0;
  return `₺${value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
}
