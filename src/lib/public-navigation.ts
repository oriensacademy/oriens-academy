import type { Locale } from "@/content/dictionaries";
import { localizedPath, type LocalizedRouteId } from "@/lib/routes";

export const PUBLIC_NAV_ORDER = ["home", "exams", "universitySupport", "pricing", "about", "contact"] as const;
export type PublicNavigationId = (typeof PUBLIC_NAV_ORDER)[number];

const labels: Record<PublicNavigationId, Record<Locale, string>> = {
  home: { tr: "Ana Sayfa", en: "Home" },
  exams: { tr: "Sınavlar", en: "Exams" },
  universitySupport: { tr: "Üniversite Desteği", en: "University Support" },
  pricing: { tr: "Ücretler", en: "Pricing" },
  about: { tr: "Hakkımızda", en: "About" },
  contact: { tr: "İletişim", en: "Contact" },
};

export function publicNavigation(locale: Locale, showPricing: boolean) {
  return PUBLIC_NAV_ORDER
    .filter((id) => showPricing || id !== "pricing")
    .map((id) => ({ id, label: labels[id][locale], href: localizedPath(id as LocalizedRouteId, locale) }));
}
