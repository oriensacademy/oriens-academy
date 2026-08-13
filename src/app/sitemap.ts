import type { MetadataRoute } from "next";
import { examRecords } from "@/content/exams";
import { locales } from "@/content/dictionaries";

export const dynamic = "force-static";

const BASE_URL = "https://oriens-academy.com";

const ROUTE_MAP: Array<{ tr: string; en: string }> = [
  { tr: "sinavlar", en: "exams" },
  { tr: "universite-destegi", en: "university-support" },
  { tr: "ucretler", en: "pricing" },
  { tr: "hakkimizda", en: "about" },
  { tr: "randevu", en: "booking" },
  { tr: "iletisim", en: "contact" },
  { tr: "privacy", en: "privacy" },
  { tr: "terms", en: "terms" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  // Home Pages
  for (const lang of locales) {
    entries.push({
      url: `${BASE_URL}/${lang}`,
      changeFrequency: "weekly",
      priority: 1.0,
      alternates: {
        languages: {
          tr: `${BASE_URL}/tr`,
          en: `${BASE_URL}/en`,
          "x-default": `${BASE_URL}/tr`,
        },
      },
    });
  }

  // Top-Level Hub Pages
  for (const route of ROUTE_MAP) {
    for (const lang of locales) {
      const segment = route[lang];
      entries.push({
        url: `${BASE_URL}/${lang}/${segment}`,
        changeFrequency: "weekly",
        priority: 0.8,
        alternates: {
          languages: {
            tr: `${BASE_URL}/tr/${route.tr}`,
            en: `${BASE_URL}/en/${route.en}`,
            "x-default": `${BASE_URL}/tr/${route.tr}`,
          },
        },
      });
    }
  }

  // Exam Detail Pages
  for (const exam of examRecords) {
    for (const lang of locales) {
      const hub = lang === "tr" ? "sinavlar" : "exams";
      const trHub = "sinavlar";
      const enHub = "exams";

      entries.push({
        url: `${BASE_URL}/${lang}/${hub}/${exam.slug}`,
        changeFrequency: "monthly",
        priority: 0.9,
        alternates: {
          languages: {
            tr: `${BASE_URL}/tr/${trHub}/${exam.slug}`,
            en: `${BASE_URL}/en/${enHub}/${exam.slug}`,
            "x-default": `${BASE_URL}/tr/${trHub}/${exam.slug}`,
          },
        },
      });
    }
  }

  return entries;
}
