import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ExamDetailPage } from "@/components/exams/ExamDetailPage";
import { PaymentResultPage } from "@/components/payment/PaymentResultPage";
import { StudentAuthPage } from "@/components/student/StudentAuthPage";
import { Footer } from "@/components/sections/Footer";
import { getDictionary, isLocale } from "@/content/dictionaries";
import { examBySlug, examRecords } from "@/content/exams";
import { examDetailPath, examHubSegment, localizedPath, paymentResultPath, paymentResultSegment, paymentSegment, resolveExamSlug, studentAuthRootSegment, studentLoginSegment, studentRegisterPath, studentRegisterSegment, unifiedLoginPath } from "@/lib/routes";

type Params = { lang: string; examHub: string; slug: string };

const ALL_EXAM_STATIC_SLUGS = Array.from(new Set([
  ...examRecords.map((e) => e.slug),
  // Never emit case-only aliases (for example `sat` and `SAT`). On
  // case-insensitive build filesystems they target the same output file and
  // the alias redirect can overwrite the canonical static HTML.
  "ucat",
  "ib-diploma",
  "ib-dp",
  "advanced-placement",
  "gmat-focus",
  "ielts",
  "toefl",
]));

export function generateStaticParams({ params }: { params: { lang: string } }) {
  const { lang } = params;
  if (!isLocale(lang)) return [];
  return [
    ...ALL_EXAM_STATIC_SLUGS.map((slug) => ({
      examHub: examHubSegment(lang),
      slug,
    })),
    { examHub: paymentSegment(lang), slug: paymentResultSegment(lang) },
    { examHub: studentAuthRootSegment(lang), slug: studentLoginSegment(lang) },
    { examHub: studentAuthRootSegment(lang), slug: studentRegisterSegment(lang) },
  ];
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang, examHub, slug } = await params;
  if (!isLocale(lang)) return {};
  const isPaymentResult = examHub === paymentSegment(lang) && slug === paymentResultSegment(lang);
  if (isPaymentResult) {
    const title = lang === "tr" ? "Ödeme Sonucu | Oriens Academy" : "Payment Result | Oriens Academy";
    const description = lang === "tr" ? "Sunucu tarafında doğrulanan ödeme durumu." : "Server-verified payment status.";
    return { title, description, robots: { index: false, follow: false }, alternates: { canonical: paymentResultPath(lang), languages: { tr: paymentResultPath("tr"), en: paymentResultPath("en"), "x-default": paymentResultPath("tr") } } };
  }
  const isStudentLogin = examHub === studentAuthRootSegment(lang) && slug === studentLoginSegment(lang);
  const isStudentRegister = examHub === studentAuthRootSegment(lang) && slug === studentRegisterSegment(lang);
  if (isStudentLogin) {
    return { title: lang === "tr" ? "Oturum Aç | Oriens Academy" : "Sign In | Oriens Academy", robots: { index: false, follow: false }, alternates: { canonical: unifiedLoginPath(lang), languages: { tr: unifiedLoginPath("tr"), en: unifiedLoginPath("en") } } };
  }
  if (isStudentRegister) {
    return { title: lang === "tr" ? "Öğrenci Kaydı | Oriens Academy" : "Student Registration | Oriens Academy", robots: { index: false, follow: false }, alternates: { canonical: studentRegisterPath(lang), languages: { tr: studentRegisterPath("tr"), en: studentRegisterPath("en") } } };
  }
  if (examHub !== examHubSegment(lang)) return {};
  const canonicalSlug = resolveExamSlug(slug);
  const exam = canonicalSlug ? examBySlug(canonicalSlug) : null;
  if (!exam) return {};
  const detail = getDictionary(lang).exams.examDetailText[exam.code];
  if (!detail) return {};

  return {
    title: detail.seoTitle,
    description: detail.seoDescription,
    openGraph: {
      title: detail.seoTitle,
      description: detail.seoDescription,
      url: examDetailPath(lang, exam.slug),
      locale: lang === "tr" ? "tr_TR" : "en_GB",
      alternateLocale: lang === "tr" ? ["en_GB"] : ["tr_TR"],
      type: "website",
    },
    alternates: {
      canonical: examDetailPath(lang, exam.slug),
      languages: {
        tr: examDetailPath("tr", exam.slug),
        en: examDetailPath("en", exam.slug),
        "x-default": examDetailPath("tr", exam.slug),
      },
    },
  };
}

export default async function ExamPage({ params }: { params: Promise<Params> }) {
  const { lang, examHub, slug } = await params;
  if (!isLocale(lang)) notFound();
  if (examHub === paymentSegment(lang) && slug === paymentResultSegment(lang)) {
    return <><main id="main-content"><PaymentResultPage /></main><Footer /></>;
  }
  if (examHub === studentAuthRootSegment(lang) && slug === studentLoginSegment(lang)) redirect(unifiedLoginPath(lang));
  if (examHub === studentAuthRootSegment(lang) && slug === studentRegisterSegment(lang)) {
    return <><main id="main-content"><StudentAuthPage /></main><Footer /></>;
  }
  if (examHub !== examHubSegment(lang)) {
    redirect(`/${lang}`);
  }
  const canonicalSlug = resolveExamSlug(slug);
  if (!canonicalSlug) {
    redirect(localizedPath("exams", lang));
  }
  if (slug !== canonicalSlug) {
    redirect(examDetailPath(lang, canonicalSlug));
  }
  const exam = examBySlug(canonicalSlug);
  if (!exam) {
    redirect(localizedPath("exams", lang));
  }

  return (
    <>
      <main id="main-content">
        <ExamDetailPage exam={exam} />
      </main>
      <Footer />
    </>
  );
}
