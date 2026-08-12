import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { notFound } from "next/navigation";
import { CompassLoader } from "@/components/brand/CompassLoader";
import { LanguageTransitionProvider } from "@/components/brand/LanguageTransitionProvider";
import { LocaleProvider } from "@/content/locale-context";
import { getDictionary, isLocale, locales } from "@/content/dictionaries";
import "../globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

/**
 * This is the app's real root layout — it's nested inside `[lang]` (per
 * Next.js's documented internationalization pattern) so it can render a
 * correct, build-time-static `<html lang>` per locale. The bare `app/
 * page.tsx` sibling (outside `[lang]`) is a separate, self-contained
 * static redirect to `/tr/` and has its own minimal root layout — see
 * that file for why.
 */
export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const dynamicParams = false;

type LangParam = { lang: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<LangParam>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const { site } = getDictionary(lang).common;

  return {
    title: site.titleTag,
    description: site.description,
    alternates: {
      canonical: `/${lang}`,
      languages: {
        tr: "/tr",
        en: "/en",
      },
    },
  };
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<LangParam>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const { site } = getDictionary(lang).common;

  return (
    <html
      lang={lang}
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${newsreader.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <LocaleProvider locale={lang}>
          <CompassLoader>
            <LanguageTransitionProvider>
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-200 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-background"
              >
                {site.skipToContent}
              </a>
              {children}
            </LanguageTransitionProvider>
          </CompassLoader>
        </LocaleProvider>
      </body>
    </html>
  );
}
