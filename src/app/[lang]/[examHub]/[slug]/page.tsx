import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExamDetailPage } from "@/components/exams/ExamDetailPage";
import { PaymentResultPage } from "@/components/payment/PaymentResultPage";
import { StudentAuthPage } from "@/components/student/StudentAuthPage";
import { Footer } from "@/components/sections/Footer";
import { getDictionary, isLocale } from "@/content/dictionaries";
import { examBySlug, examRecords } from "@/content/exams";
import { examDetailPath, examHubSegment, paymentResultPath, paymentResultSegment, paymentSegment, studentAuthRootSegment, studentLoginPath, studentLoginSegment, studentRegisterPath, studentRegisterSegment } from "@/lib/routes";

type Params = { lang: string; examHub: string; slug: string };

export function generateStaticParams({ params }: { params: { lang: string } }) {
  const { lang } = params;
  if (!isLocale(lang)) return [];
  return [...examRecords.map((exam) => ({
    examHub: examHubSegment(lang),
    slug: exam.slug,
  })), { examHub: paymentSegment(lang), slug: paymentResultSegment(lang) }, { examHub: studentAuthRootSegment(lang), slug: studentLoginSegment(lang) }, { examHub: studentAuthRootSegment(lang), slug: studentRegisterSegment(lang) }];
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
  if (isStudentLogin || isStudentRegister) {
    const title = isStudentLogin ? (lang === "tr" ? "Öğrenci Girişi | Oriens Academy" : "Student Login | Oriens Academy") : (lang === "tr" ? "Öğrenci Kaydı | Oriens Academy" : "Student Registration | Oriens Academy");
    const canonical = isStudentLogin ? studentLoginPath(lang) : studentRegisterPath(lang);
    return { title, robots: { index: false, follow: false }, alternates: { canonical, languages: { tr: isStudentLogin ? studentLoginPath("tr") : studentRegisterPath("tr"), en: isStudentLogin ? studentLoginPath("en") : studentRegisterPath("en") } } };
  }
  if (examHub !== examHubSegment(lang)) return {};
  const exam = examBySlug(slug);
  if (!exam) return {};
  const detail = getDictionary(lang).exams.examDetailText[exam.code];

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
  if (examHub === studentAuthRootSegment(lang) && (slug === studentLoginSegment(lang) || slug === studentRegisterSegment(lang))) {
    return <><main id="main-content"><StudentAuthPage mode={slug === studentLoginSegment(lang) ? "login" : "register"} /></main><Footer /></>;
  }
  if (examHub !== examHubSegment(lang)) notFound();
  const exam = examBySlug(slug);
  if (!exam) notFound();

  return (
    <>
      <main id="main-content">
        <ExamDetailPage exam={exam} />
      </main>
      <Footer />
    </>
  );
}
