import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExamDetailPage } from "@/components/exams/ExamDetailPage";
import { Footer } from "@/components/sections/Footer";
import { Navbar } from "@/components/sections/Navbar";
import { getDictionary, isLocale } from "@/content/dictionaries";
import { examBySlug, examRecords } from "@/content/exams";
import { examDetailPath, examHubSegment } from "@/lib/routes";

type Params = { lang: string; examHub: string; slug: string };

export function generateStaticParams({ params }: { params: { lang: string } }) {
  const { lang } = params;
  if (!isLocale(lang)) return [];
  return examRecords.map((exam) => ({
    examHub: examHubSegment(lang),
    slug: exam.slug,
  }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang, examHub, slug } = await params;
  if (!isLocale(lang) || examHub !== examHubSegment(lang)) return {};
  const exam = examBySlug(slug);
  if (!exam) return {};
  const detail = getDictionary(lang).exams.examDetailText[exam.code];

  return {
    title: detail.seoTitle,
    description: detail.seoDescription,
    alternates: {
      canonical: examDetailPath(lang, exam.slug),
      languages: {
        tr: examDetailPath("tr", exam.slug),
        en: examDetailPath("en", exam.slug),
      },
    },
  };
}

export default async function ExamPage({ params }: { params: Promise<Params> }) {
  const { lang, examHub, slug } = await params;
  if (!isLocale(lang) || examHub !== examHubSegment(lang)) notFound();
  const exam = examBySlug(slug);
  if (!exam) notFound();

  return (
    <>
      <Navbar />
      <main id="main-content">
        <ExamDetailPage exam={exam} />
      </main>
      <Footer />
    </>
  );
}
