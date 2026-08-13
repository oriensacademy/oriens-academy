import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LanguageTransitionProvider } from "@/components/brand/LanguageTransitionProvider";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { GoogleTagManager } from "@/components/analytics/GoogleTagManager";
import { JsonLd } from "@/components/seo/JsonLd";
import { LocaleProvider } from "@/content/locale-context";
import { getDictionary, isLocale, locales } from "@/content/dictionaries";

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const dynamicParams = false;

type LangParam = { lang: string };

const BASE_URL = "https://oriens-academy.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<LangParam>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const { site } = getDictionary(lang).common;

  return {
    metadataBase: new URL(BASE_URL),
    title: site.titleTag,
    description: site.description,
    alternates: {
      canonical: `/${lang}`,
      languages: {
        tr: "/tr",
        en: "/en",
        "x-default": "/tr",
      },
    },
    openGraph: {
      title: site.titleTag,
      description: site.description,
      url: `${BASE_URL}/${lang}`,
      siteName: "Oriens Academy",
      locale: lang === "tr" ? "tr_TR" : "en_US",
      type: "website",
    },
  };
}

import { PublicPageTransition } from "@/components/motion/PublicPageTransition";
import { Navbar } from "@/components/sections/Navbar";
import { QuickContactLead } from "@/components/contact/QuickContactLead";
import { SocialLinks } from "@/components/ui/social-links";

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
    <>
      <JsonLd />
      <GoogleTagManager />
      <GoogleAnalytics />
      <LocaleProvider locale={lang}>
        <LanguageTransitionProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-200 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-background"
          >
            {site.skipToContent}
          </a>
          <Navbar />
          <PublicPageTransition>{children}</PublicPageTransition>
          <SocialLinks />
          <QuickContactLead />
        </LanguageTransitionProvider>
      </LocaleProvider>
    </>
  );
}
