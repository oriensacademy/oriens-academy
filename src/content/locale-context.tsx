"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { getDictionary, type Dictionary, type Locale } from "./dictionaries";

const LocaleContext = createContext<{ locale: Locale; dict: Dictionary } | null>(null);

/**
 * Provides the resolved locale + dictionary to the client component tree.
 * Mounted once in `app/[lang]/layout.tsx`. Every section component reads
 * its copy through `useCommonContent()` / `useHomeContent()` below instead
 * of importing a fixed-language module directly — this is what lets the
 * exact same components render either language.
 */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, dict: getDictionary(locale) }), [locale]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocaleContext() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale/useCommonContent/useHomeContent must be used within <LocaleProvider>");
  }
  return ctx;
}

export function useLocale() {
  return useLocaleContext().locale;
}

export function useCommonContent() {
  return useLocaleContext().dict.common;
}

export function useHomeContent() {
  return useLocaleContext().dict.home;
}

export function useExamsContent() {
  return useLocaleContext().dict.exams;
}

export function useUniversitySupportContent() {
  return useLocaleContext().dict.universitySupport;
}

export function usePricingContent() {
  return useLocaleContext().dict.pricing;
}

export function useAboutContent() {
  return useLocaleContext().dict.about;
}
