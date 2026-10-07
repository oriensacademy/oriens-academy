export interface PackageDisplaySource {
  lesson_count?: number | null;
  lessonCount?: number | null;
  package_id?: string | null;
  packageId?: string | null;
  name_tr?: string | null;
  name_en?: string | null;
  nameTr?: string | null;
  nameEn?: string | null;
  custom_package_name?: string | null;
  metadata?: unknown;
}

const CANONICAL_PACKAGE_LABELS: Record<string, { tr: string; en: string }> = {
  single: { tr: "1 Ders", en: "Single Lesson" },
  package5: { tr: "5 Derslik Paket", en: "5-Lesson Package" },
  package10: { tr: "10 Derslik Paket", en: "10-Lesson Package" },
  package20: { tr: "20 Derslik Paket", en: "20-Lesson Package" },
  package30: { tr: "30 Derslik Paket", en: "30-Lesson Package" },
  custom: { tr: "Özel Paket", en: "Custom Package" },
};

function positiveLessonCount(source: PackageDisplaySource | number | null | undefined): number | null {
  if (typeof source === "number") return Number.isInteger(source) && source > 0 ? source : null;
  if (!source) return null;
  const metadata = source.metadata && typeof source.metadata === "object" && !Array.isArray(source.metadata)
    ? source.metadata as Record<string, unknown>
    : {};
  const direct = source.lesson_count ?? source.lessonCount ?? metadata.lesson_count ?? metadata.total_lessons;
  const number = Number(direct);
  if (Number.isInteger(number) && number > 0) return number;
  const technicalId = String(source.package_id ?? source.packageId ?? "");
  const match = technicalId.match(/(?:package|pkg)?(\d+)$/i);
  return match ? Number(match[1]) : technicalId.toLowerCase() === "single" ? 1 : null;
}

/** Prefer canonical DB labels; known IDs provide a safe, human-readable fallback. */
export function packageDisplayName(
  source: PackageDisplaySource | number | null | undefined,
  locale: "tr" | "en" = "tr",
): string {
  if (source && typeof source === "object") {
    const dbName = locale === "tr"
      ? source.name_tr ?? source.nameTr
      : source.name_en ?? source.nameEn;
    const customName = source.custom_package_name?.trim();
    if (customName) return customName;
    if (dbName?.trim()) return dbName.trim();
    const technicalId = String(source.package_id ?? source.packageId ?? "").toLowerCase();
    if (CANONICAL_PACKAGE_LABELS[technicalId]) return CANONICAL_PACKAGE_LABELS[technicalId][locale];
  }
  const count = positiveLessonCount(source);
  if (!count) return locale === "tr" ? "Ders Paketi" : "Lesson Package";
  if (count === 1) return locale === "tr" ? "1 Ders" : "Single Lesson";
  return locale === "tr" ? `${count} Derslik Paket` : `${count}-Lesson Package`;
}
