import type { Locale } from "@/content/dictionaries";

export const LOCALE_COOKIE_NAME = "oriens_locale";
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function persistLocalePreference(locale: Locale) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}
