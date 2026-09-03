import type { Locale } from "@/content/dictionaries";

export const SITE_URL = "https://oriens-academy.com";

export type LocalizedRouteId =
  | "home"
  | "exams"
  | "pricing"
  | "about"
  | "contact"
  | "universitySupport"
  | "blog"
  | "booking"
  | "assessment"
  | "examTest"
  | "payment"
  | "cart"
  | "studentAccount"
  | "login"
  | "forgotPassword"
  | "changePassword"
  | "resetPassword"
  | "privacy"
  | "terms"
  | "salesAgreement"
  | "preInformation"
  | "refundPolicy"
  | "kvkk"
  | "cookie";

const localizedSegments: Record<LocalizedRouteId, Record<Locale, string>> = {
  home: { tr: "", en: "" },
  exams: { tr: "sinavlar", en: "exams" },
  pricing: { tr: "ucretler", en: "pricing" },
  about: { tr: "hakkimizda", en: "about" },
  contact: { tr: "iletisim", en: "contact" },
  universitySupport: { tr: "universite-destegi", en: "university-support" },
  blog: { tr: "blog", en: "blog" },
  booking: { tr: "randevu", en: "booking" },
  assessment: { tr: "degerlendirme", en: "assessment" },
  examTest: { tr: "kendini-dene", en: "test-yourself" },
  payment: { tr: "odeme", en: "payment" },
  cart: { tr: "sepet", en: "cart" },
  studentAccount: { tr: "hesabim", en: "account" },
  login: { tr: "giris", en: "login" },
  forgotPassword: { tr: "sifremi-unuttum", en: "forgot-password" },
  changePassword: { tr: "sifre-degistir", en: "change-password" },
  resetPassword: { tr: "sifre-yenile", en: "reset-password" },
  privacy: { tr: "privacy", en: "privacy" },
  terms: { tr: "terms", en: "terms" },
  salesAgreement: { tr: "mesafeli-satis-sozlesmesi", en: "distance-sales-agreement" },
  preInformation: { tr: "on-bilgilendirme-formu", en: "pre-information-form" },
  refundPolicy: { tr: "iptal-ve-iade-kosullari", en: "cancellation-refund-policy" },
  kvkk: { tr: "kvkk-aydinlatma-metni", en: "kvkk-notice" },
  cookie: { tr: "cerez-politikasi", en: "cookie-policy" },
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

export function blogSegment(locale: Locale): string {
  return localizedSegments.blog[locale];
}

export function blogPath(locale: Locale): string {
  return localizedPath("blog", locale);
}

export function blogDetailPath(locale: Locale, slug: string): string {
  return `${localizedPath("blog", locale)}/${slug}`;
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

export function examTestSegment(locale: Locale): string {
  return localizedSegments.examTest[locale];
}

export function paymentSegment(locale: Locale): string {
  return localizedSegments.payment[locale];
}

export function studentAccountSegment(locale: Locale): string {
  return localizedSegments.studentAccount[locale];
}

export function unifiedLoginSegment(locale: Locale): string {
  return localizedSegments.login[locale];
}

export function unifiedLoginPath(locale: Locale): string {
  return localizedPath("login", locale);
}

export function forgotPasswordSegment(locale: Locale): string {
  return localizedSegments.forgotPassword[locale];
}

export function forgotPasswordPath(locale: Locale): string {
  return localizedPath("forgotPassword", locale);
}

export function changePasswordSegment(locale: Locale): string {
  return localizedSegments.changePassword[locale];
}

export function changePasswordPath(locale: Locale): string {
  return localizedPath("changePassword", locale);
}

export function resetPasswordSegment(locale: Locale): string {
  return localizedSegments.resetPassword[locale];
}

export function resetPasswordPath(locale: Locale): string {
  return localizedPath("resetPassword", locale);
}

export function studentAuthRootSegment(locale: Locale): string {
  return locale === "tr" ? "ogrenci" : "student";
}

export function studentLoginSegment(locale: Locale): string {
  return locale === "tr" ? "giris" : "login";
}

export function studentRegisterSegment(locale: Locale): string {
  return locale === "tr" ? "kayit" : "register";
}

export function studentLoginPath(locale: Locale): string {
  return `/${locale}/${studentAuthRootSegment(locale)}/${studentLoginSegment(locale)}`;
}

export function studentRegisterPath(locale: Locale): string {
  return `/${locale}/${studentAuthRootSegment(locale)}/${studentRegisterSegment(locale)}`;
}

export function paymentResultSegment(locale: Locale): string {
  return locale === "tr" ? "sonuc" : "result";
}

export function paymentSuccessSegment(locale: Locale): string {
  return locale === "tr" ? "basarili" : "success";
}

export function paymentFailedSegment(locale: Locale): string {
  return locale === "tr" ? "basarisiz" : "failed";
}

export function paymentSuccessPath(locale: Locale): string {
  return `${localizedPath("payment", locale)}/${paymentSuccessSegment(locale)}`;
}

export function paymentFailedPath(locale: Locale): string {
  return `${localizedPath("payment", locale)}/${paymentFailedSegment(locale)}`;
}

export function paymentResultPath(locale: Locale, reference?: string, token?: string): string {
  const path = `${localizedPath("payment", locale)}/${paymentResultSegment(locale)}`;
  if (!reference || !token) return path;
  return `${path}?reference=${encodeURIComponent(reference)}&token=${encodeURIComponent(token)}`;
}

export function privacySegment(locale: Locale): string {
  return localizedSegments.privacy[locale];
}

export function privacyPath(locale: Locale): string {
  return localizedPath("privacy", locale);
}

export function termsSegment(locale: Locale): string {
  return localizedSegments.terms[locale];
}

export function termsPath(locale: Locale): string {
  return localizedPath("terms", locale);
}

export function salesAgreementSegment(locale: Locale): string {
  return localizedSegments.salesAgreement[locale];
}

export function salesAgreementPath(locale: Locale): string {
  return localizedPath("salesAgreement", locale);
}

export function preInformationSegment(locale: Locale): string {
  return localizedSegments.preInformation[locale];
}

export function preInformationPath(locale: Locale): string {
  return localizedPath("preInformation", locale);
}

export function refundPolicySegment(locale: Locale): string {
  return localizedSegments.refundPolicy[locale];
}

export function refundPolicyPath(locale: Locale): string {
  return localizedPath("refundPolicy", locale);
}

export function kvkkSegment(locale: Locale): string {
  return localizedSegments.kvkk[locale];
}

export function kvkkPath(locale: Locale): string {
  return localizedPath("kvkk", locale);
}

export function cookiePolicySegment(locale: Locale): string {
  return localizedSegments.cookie[locale];
}

export function cookiePolicyPath(locale: Locale): string {
  return localizedPath("cookie", locale);
}

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
  if (
    target !== exams &&
    !Object.values(localizedSegments).some(
      (segments) => target === `/${locale}/${segments[locale]}`
    )
  ) {
    return false;
  }

  return target === exams ? current === target || current.startsWith(`${target}/`) : current === target;
}

const CANONICAL_EXAM_SLUGS: Record<string, string> = {
  ib: "ib",
  ap: "ap",
  igcse: "igcse",
  "a-level": "a-level",
  sat: "sat",
  act: "act",
  esat: "esat",
  tmua: "tmua",
  tara: "tara",
  ucat: "ucat",
  lnat: "lnat",
  imat: "imat",
  gamsat: "gamsat",
  mcat: "mcat",
  lsat: "lsat",
  gre: "gre",
  gmat: "gmat",
  ompt: "ompt",

  // Legacy normalization & aliases
  ukcat: "ucat",
  alevel: "a-level",
  "a level": "a-level",
  "a-levels": "a-level",
  "a levels": "a-level",
  "gce-a-level": "a-level",
  "gce a level": "a-level",
  "ib-diploma": "ib",
  "ib-dp": "ib",
  "advanced-placement": "ap",
  "gmat-focus": "gmat",
  "act-test": "act",
  ielts: "sinavlar-fallback",
  toefl: "sinavlar-fallback",
};

/**
 * Resolves any raw exam slug or alias to its canonical lowercase slug.
 * Returns null if the slug is not recognized as a standalone exam.
 */
export function resolveExamSlug(input?: string | null): string | null {
  if (!input) return null;
  const clean = input.trim().toLowerCase();
  const canonical = CANONICAL_EXAM_SLUGS[clean];
  if (canonical && canonical !== "sinavlar-fallback") return canonical;
  return null;
}

/**
 * Resolves a canonical exam URL. If valid, points to `/{locale}/{examsSegment}/{canonicalSlug}`.
 * If invalid or generic, falls back gracefully to `/{locale}/{examsSegment}`.
 */
export function resolveExamRoute(locale: Locale, input?: string | null): string {
  const resolved = resolveExamSlug(input);
  if (resolved) {
    return `${localizedPath("exams", locale)}/${resolved}`;
  }
  return localizedPath("exams", locale);
}

export function examDetailPath(locale: Locale, slug: string): string {
  return resolveExamRoute(locale, slug);
}

export function pathForLocale(pathname: string, target: Locale): string {
  const cleanPath = pathname.replace(/\/$/, "") || "/";
  if (/^\/(?:tr\/ogrenci\/giris|en\/student\/login|tr\/giris|en\/login)$/.test(cleanPath)) {
    return unifiedLoginPath(target);
  }
  if (/^\/(?:tr\/sifremi-unuttum|en\/forgot-password)$/.test(cleanPath)) {
    return forgotPasswordPath(target);
  }
  if (/^\/(?:tr\/sifre-degistir|en\/change-password)$/.test(cleanPath)) {
    return changePasswordPath(target);
  }
  if (/^\/(?:tr\/sifre-yenile|en\/reset-password)$/.test(cleanPath)) {
    return resetPasswordPath(target);
  }
  if (/^\/(?:tr\/ogrenci\/kayit|en\/student\/register)$/.test(cleanPath)) {
    return studentRegisterPath(target);
  }
  if (/^\/(?:tr\/odeme\/sonuc|en\/payment\/result)$/.test(cleanPath)) {
    return paymentResultPath(target);
  }
  const detailMatch = cleanPath.match(/^\/(?:tr\/sinavlar|en\/exams)\/([^/]+)$/);
  if (detailMatch) {
    const slug = detailMatch[1];
    const resolved = resolveExamSlug(slug);
    return resolved ? examDetailPath(target, resolved) : localizedPath("exams", target);
  }

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
