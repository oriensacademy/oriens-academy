import type { Locale } from "@/content/dictionaries";

export const SITE_URL = "https://oriens-academy.com";

export type LocalizedRouteId =
  | "home"
  | "exams"
  | "pricing"
  | "about"
  | "contact"
  | "universitySupport"
  | "booking"
  | "assessment"
  | "examTest"
  | "payment"
  | "cart"
  | "studentAccount"
  | "login"
  | "forgotPassword"
  | "changePassword"
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
  examTest: { tr: "kendini-dene", en: "test-yourself" },
  payment: { tr: "odeme", en: "payment" },
  cart: { tr: "sepet", en: "cart" },
  studentAccount: { tr: "hesabim", en: "account" },
  login: { tr: "giris", en: "login" },
  forgotPassword: { tr: "sifremi-unuttum", en: "forgot-password" },
  changePassword: { tr: "sifre-degistir", en: "change-password" },
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

export function cartSegment(locale: Locale): string {
  return localizedSegments.cart[locale];
}

export function cartPath(locale: Locale): string {
  return localizedPath("cart", locale);
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
export function examTestSegment(locale: Locale): string { return localizedSegments.examTest[locale]; }
export function paymentSegment(locale: Locale): string { return localizedSegments.payment[locale]; }
export function studentAccountSegment(locale: Locale): string { return localizedSegments.studentAccount[locale]; }
export function unifiedLoginSegment(locale: Locale): string { return localizedSegments.login[locale]; }
export function unifiedLoginPath(locale: Locale): string { return localizedPath("login", locale); }
export function forgotPasswordSegment(locale: Locale): string { return localizedSegments.forgotPassword[locale]; }
export function forgotPasswordPath(locale: Locale): string { return localizedPath("forgotPassword", locale); }
export function changePasswordSegment(locale: Locale): string { return localizedSegments.changePassword[locale]; }
export function changePasswordPath(locale: Locale): string { return localizedPath("changePassword", locale); }
export function studentAuthRootSegment(locale: Locale): string { return locale === "tr" ? "ogrenci" : "student"; }
export function studentLoginSegment(locale: Locale): string { return locale === "tr" ? "giris" : "login"; }
export function studentRegisterSegment(locale: Locale): string { return locale === "tr" ? "kayit" : "register"; }
export function studentLoginPath(locale: Locale): string { return `/${locale}/${studentAuthRootSegment(locale)}/${studentLoginSegment(locale)}`; }
export function studentRegisterPath(locale: Locale): string { return `/${locale}/${studentAuthRootSegment(locale)}/${studentRegisterSegment(locale)}`; }
export function paymentResultSegment(locale: Locale): string { return locale === "tr" ? "sonuc" : "result"; }
export function paymentResultPath(locale: Locale, reference?: string, token?: string): string {
  const path = `${localizedPath("payment", locale)}/${paymentResultSegment(locale)}`;
  if (!reference || !token) return path;
  return `${path}?reference=${encodeURIComponent(reference)}&token=${encodeURIComponent(token)}`;
}
export function privacySegment(locale: Locale): string { return localizedSegments.privacy[locale]; }
export function termsSegment(locale: Locale): string { return localizedSegments.terms[locale]; }



export function primaryNavigationPath(anchor: string, locale: Locale): string {
  if (anchor === "#exam-preparation") return localizedPath("exams", locale);
  if (anchor === "#university-support") return localizedPath("universitySupport", locale);
  if (anchor === "#pricing") return localizedPath("pricing", locale);
  if (anchor === "#about") return localizedPath("about", locale);
  if (anchor === "#method") return `${localizedPath("home", locale)}#method`;
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
  destination: string,
  pathname: string,
  locale: Locale
): boolean {
  const current = normalizedPath(pathname);
  const route = primaryNavigationRoutes[destination];
  const target = normalizedPath(route ? localizedPath(route, locale) : destination);
  const home = localizedPath("home", locale);
  const exams = localizedPath("exams", locale);

  if (target === home) return current === home;
  if (target !== exams && !Object.values(localizedSegments).some(
    (segments) => target === `/${locale}/${segments[locale]}`,
  )) return false;

  return target === exams ? current === target || current.startsWith(`${target}/`) : current === target;
}

export function examDetailPath(locale: Locale, slug: string): string {
  return `${localizedPath("exams", locale)}/${slug}`;
}

export function pathForLocale(pathname: string, target: Locale): string {
  const cleanPath = pathname.replace(/\/$/, "") || "/";
  if (/^\/(?:tr\/ogrenci\/giris|en\/student\/login|tr\/giris|en\/login)$/.test(cleanPath)) return unifiedLoginPath(target);
  if (/^\/(?:tr\/sifremi-unuttum|en\/forgot-password)$/.test(cleanPath)) return forgotPasswordPath(target);
  if (/^\/(?:tr\/sifre-degistir|en\/change-password)$/.test(cleanPath)) return changePasswordPath(target);
  if (/^\/(?:tr\/ogrenci\/kayit|en\/student\/register)$/.test(cleanPath)) return studentRegisterPath(target);
  if (/^\/(?:tr\/odeme\/sonuc|en\/payment\/result)$/.test(cleanPath)) return paymentResultPath(target);
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
