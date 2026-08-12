import * as trCommon from "./tr/common";
import * as trHome from "./tr/home";
import * as enCommon from "./en/common";
import * as enHome from "./en/home";
import * as trExams from "./tr/exams";
import * as enExams from "./en/exams";
import { universitySupport as trUniversitySupport } from "./tr/university-support";
import { universitySupport as enUniversitySupport } from "./en/university-support";
import { pricing as trPricing } from "./tr/pricing";
import { pricing as enPricing } from "./en/pricing";
import { about as trAbout } from "./tr/about";
import { about as enAbout } from "./en/about";

export const locales = ["tr", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "tr";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

const dictionaries = {
  tr: { common: trCommon, home: trHome, exams: trExams, universitySupport: trUniversitySupport, pricing: trPricing, about: trAbout },
  en: { common: enCommon, home: enHome, exams: enExams, universitySupport: enUniversitySupport, pricing: enPricing, about: enAbout },
} as const;

export type Dictionary = (typeof dictionaries)[Locale];

/** Small, static, build-time dictionary lookup — no dynamic import needed for just two locales. */
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
