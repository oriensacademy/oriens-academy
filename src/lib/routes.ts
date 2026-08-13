import type { Locale } from "@/content/dictionaries";

export type LocalizedRouteId =
  | "home"
  | "exams"
  | "pricing"
  | "about"
  | "contact"
  | "universitySupport"
  | "booking"
  | "assessment"
  | "privacy"
  | "terms";

const localizedSegments: Record<LocalizedRouteId, Record<Locale, string>> = {
  home: { tr: "", en: "" },
  exams: { tr: "sinavlar", en: "exams" },
  pricing: { tr: "ucretler", en: "pricing" },
  about: { tr: "hakkimizda", en: "about" },
  contact: { tr: "iletisim", en: "contact" },
  universitySupport: { tr: "universite-destegi", en: "university-support" },
  booking: { tr: "randevu", en: "booking" },
  assessment: { tr: "degerlendirme", en: "assessment" },
  privacy: { tr: "privacy", en: "privacy" },
  terms: { tr: "terms", en: "terms" },
};

export function localizedPath(route: LocalizedRouteId, locale: Locale): string {
  const segment = localizedSegments[route][locale];
  return segment ? `/${locale}/${segment}` : `/${locale}`;
}

export function examHubSegment(locale: Locale): string {
  return localizedSegments.exams[locale];
}

export function universitySupportSegment(locale: Locale): string {
  return localizedSegments.universitySupport[locale];
}

export function pricingSegment(locale: Locale): string {
  return localizedSegments.pricing[locale];
}

export function aboutSegment(locale: Locale): string {
  return localizedSegments.about[locale];
}

export function bookingSegment(locale: Locale): string {
  return localizedSegments.booking[locale];
}

export function contactSegment(locale: Locale): string {
  return localizedSegments.contact[locale];
}

export function assessmentSegment(locale: Locale): string {
  return localizedSegments.assessment[locale];
}
export function privacySegment(locale: Locale): string { return localizedSegments.privacy[locale]; }
export function termsSegment(locale: Locale): string { return localizedSegments.terms[locale]; }



export function primaryNavigationPath(anchor: string, locale: Locale): string {
  if (anchor === "#exam-preparation") return localizedPath("exams", locale);
  if (anchor === "#university-support") return localizedPath("universitySupport", locale);
  if (anchor === "#pricing") return localizedPath("pricing", locale);
  if (anchor === "#about") return localizedPath("about", locale);
  return `${localizedPath("home", locale)}${anchor}`;
}

const primaryNavigationRoutes: Partial<Record<string, LocalizedRouteId>> = {
  "#exam-preparation": "exams",
  "#university-support": "universitySupport",
  "#pricing": "pricing",
  "#about": "about",
};

function normalizedPath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

/**
 * Resolves active top-level navigation without coupling the Navbar to
 * translated URL segments. Exam detail pages intentionally inherit the
 * active state of the exam hub.
 */
export function isPrimaryNavigationActive(
  anchor: string,
  pathname: string,
  locale: Locale
): boolean {
  const route = primaryNavigationRoutes[anchor];
  if (!route) return false;

  const current = normalizedPath(pathname);
  const target = localizedPath(route, locale);
  return route === "exams" ? current === target || current.startsWith(`${target}/`) : current === target;
}

export function examDetailPath(locale: Locale, slug: string): string {
  return `${localizedPath("exams", locale)}/${slug}`;
}

export function pathForLocale(pathname: string, target: Locale): string {
  const cleanPath = pathname.replace(/\/$/, "") || "/";
  const detailMatch = cleanPath.match(/^\/(?:tr\/sinavlar|en\/exams)\/([^/]+)$/);
  if (detailMatch) return examDetailPath(target, detailMatch[1]);

  if (/^\/(?:tr\/sinavlar|en\/exams)$/.test(cleanPath)) {
    return localizedPath("exams", target);
  }

  for (const route of Object.keys(localizedSegments) as LocalizedRouteId[]) {
    if (route === "home" || route === "exams") continue;
    const values = localizedSegments[route];
    if (cleanPath === `/tr/${values.tr}` || cleanPath === `/en/${values.en}`) {
      return localizedPath(route, target);
    }
  }

  const rest = cleanPath.replace(/^\/(tr|en)/, "");
  return `/${target}${rest}`;
}
