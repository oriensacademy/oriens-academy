import type { Metadata } from "next";
import { isLocale } from "@/content/dictionaries";
import { localizedPath } from "@/lib/routes";
import { BlogListPage } from "@/components/blog/BlogListPage";

type Params = { lang: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const title = lang === "tr" ? "Blog | Oriens Academy" : "Blog | Oriens Academy";
  const description =
    lang === "tr"
      ? "Uluslararası sınav hazırlığı ve üniversite kabul süreçleri üzerine Oriens Academy blog yazıları."
      : "Oriens Academy blog articles on international exam preparation and university admissions.";
  return {
    title,
    description,
    alternates: {
      canonical: localizedPath("blog", lang),
      languages: { tr: localizedPath("blog", "tr"), en: localizedPath("blog", "en") },
    },
  };
}

export default function BlogPage() {
  return <BlogListPage />;
}
