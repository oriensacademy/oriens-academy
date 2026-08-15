export interface ContactPackageContext {
  id: string;
  name: string;
  price: number | null;
  currency: string;
  lessons: number | null;
}

export function getContactPackageContext(metadata: unknown): ContactPackageContext | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata as Record<string, unknown>;
  if (typeof value.package_id !== "string" || typeof value.package_name !== "string") return null;
  return {
    id: value.package_id,
    name: value.package_name,
    price: typeof value.package_price === "number" ? value.package_price : null,
    currency: typeof value.package_currency === "string" ? value.package_currency : "TRY",
    lessons: typeof value.package_lessons === "number" ? value.package_lessons : null,
  };
}

export function formatPackagePrice(value: ContactPackageContext, locale = "tr-TR") {
  if (value.price === null) return null;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
    maximumFractionDigits: 0,
  }).format(value.price);
}
