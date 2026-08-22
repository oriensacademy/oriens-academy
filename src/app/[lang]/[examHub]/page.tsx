import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExamHub } from "@/components/exams/ExamHub";
import { UniversitySupportPage } from "@/components/university/UniversitySupportPage";
import { PricingPage } from "@/components/pricing/PricingPage";
import { AboutPage } from "@/components/about/AboutPage";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { ContactPage } from "@/components/contact/ContactPage";
import { AssessmentPage } from "@/components/assessment/AssessmentPage";
import { LegalPage } from "@/components/legal/LegalPage";
import { ExamTestPage } from "@/components/exam-test/ExamTestPage";
import { PaymentPage } from "@/components/payment/PaymentPage";
import { StudentPortal } from "@/components/student/StudentPortal";
import { Footer } from "@/components/sections/Footer";
import { getDictionary, isLocale } from "@/content/dictionaries";
import { aboutSegment, assessmentSegment, bookingSegment, contactSegment, examHubSegment, examTestSegment, localizedPath, paymentSegment, pricingSegment, privacySegment, studentAccountSegment, termsSegment, universitySupportSegment } from "@/lib/routes";

type Params = { lang: string; examHub: string };

export function generateStaticParams({ params }: { params: { lang: string } }) {
  return isLocale(params.lang)
    ? [
        { examHub: examHubSegment(params.lang) },
        { examHub: universitySupportSegment(params.lang) },
        { examHub: pricingSegment(params.lang) },
        { examHub: aboutSegment(params.lang) },
        { examHub: bookingSegment(params.lang) },
        { examHub: contactSegment(params.lang) },
        { examHub: assessmentSegment(params.lang) },
        { examHub: examTestSegment(params.lang) },
        { examHub: paymentSegment(params.lang) },
        { examHub: studentAccountSegment(params.lang) },
        { examHub: privacySegment(params.lang) },
        { examHub: termsSegment(params.lang) },
      ]
    : [];
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang, examHub } = await params;
  if (!isLocale(lang)) return {};

  const isExams = examHub === examHubSegment(lang);
  const isUniversitySupport = examHub === universitySupportSegment(lang);
  const isPricing = examHub === pricingSegment(lang);
  const isAbout = examHub === aboutSegment(lang);
  const isBooking = examHub === bookingSegment(lang);
  const isContact = examHub === contactSegment(lang);
  const isAssessment = examHub === assessmentSegment(lang);
  const isExamTest = examHub === examTestSegment(lang);
  const isPayment = examHub === paymentSegment(lang);
  const isStudentAccount = examHub === studentAccountSegment(lang);
  const isPrivacy = examHub === privacySegment(lang);
  const isTerms = examHub === termsSegment(lang);
  if (!isExams && !isUniversitySupport && !isPricing && !isAbout && !isBooking && !isContact && !isAssessment && !isExamTest && !isPayment && !isStudentAccount && !isPrivacy && !isTerms) return {};
  if (isStudentAccount) {
    const title = lang === "tr" ? "Hesabım | Oriens Academy" : "My Account | Oriens Academy";
    return { title, robots: { index: false, follow: false }, alternates: { canonical: localizedPath("studentAccount", lang), languages: { tr: localizedPath("studentAccount", "tr"), en: localizedPath("studentAccount", "en") } } };
  }

  const route = isExams
    ? "exams"
    : isUniversitySupport
      ? "universitySupport"
      : isPricing
        ? "pricing"
        : isAbout
          ? "about"
          : isBooking
            ? "booking"
            : isContact
              ? "contact"
              : isAssessment ? "assessment" : isExamTest ? "examTest" : isPayment ? "payment" : isPrivacy ? "privacy" : "terms";

  const dict = getDictionary(lang);
  const metadata = isExams
    ? dict.exams.metadata
    : isUniversitySupport
      ? dict.universitySupport.metadata
      : isPricing
        ? dict.pricing.metadata
        : isAbout
          ? dict.about.metadata
          : isBooking
            ? {
                title: lang === "tr" ? "Randevu Al | Oriens Academy" : "Book a Consultation | Oriens Academy",
                description:
                  lang === "tr"
                    ? "Oriens Academy ücretsiz akademik Danışmanlık ve ilk görüşme randevusu planlayın."
                    : "Schedule a complimentary initial academic consultation with Oriens Academy.",
              }
            : isContact
              ? {
                  title: lang === "tr" ? "İletişim | Oriens Academy" : "Contact Us | Oriens Academy",
                  description:
                    lang === "tr"
                      ? "Oriens Academy ile iletişime geçin."
                      : "Contact Oriens Academy.",
                }
              : isAssessment ? {
                  title: lang === "tr" ? "Ön Değerlendirme | Oriens Academy" : "Academic Assessment | Oriens Academy",
                  description:
                    lang === "tr"
                      ? "Oriens Academy ön değerlendirme formu."
                      : "Oriens Academy academic assessment form.",
                } : isExamTest ? {
                  title: lang === "tr" ? "Kendini Dene | Oriens Academy" : "Test Yourself | Oriens Academy",
                  description: lang === "tr" ? "Oriens Academy örnek interaktif sınav değerlendirmesi." : "Oriens Academy sample interactive exam assessment.",
                } : isPayment ? {
                  title: lang === "tr" ? "Güvenli Ödeme | Oriens Academy" : "Secure Payment | Oriens Academy",
                  description: lang === "tr" ? "Oriens Academy paket ödeme yöntemleri." : "Oriens Academy package payment methods.",
                } : {
                  title: isPrivacy ? (lang === "tr" ? "Gizlilik Politikası | Oriens Academy" : "Privacy Policy | Oriens Academy") : (lang === "tr" ? "Kullanım Koşulları | Oriens Academy" : "Terms of Service | Oriens Academy"),
                  description: isPrivacy ? (lang === "tr" ? "Oriens Academy gizlilik politikası." : "Oriens Academy privacy policy.") : (lang === "tr" ? "Oriens Academy kullanım koşulları." : "Oriens Academy terms of service."),
                };

  return {
    title: metadata.title,
    description: metadata.description,
    openGraph: {
      title: metadata.title,
      description: metadata.description,
      url: localizedPath(route, lang),
      locale: lang === "tr" ? "tr_TR" : "en_GB",
      alternateLocale: lang === "tr" ? ["en_GB"] : ["tr_TR"],
      type: "website",
    },
    alternates: {
      canonical: localizedPath(route, lang),
      languages: {
        tr: localizedPath(route, "tr"),
        en: localizedPath(route, "en"),
        "x-default": localizedPath(route, "tr"),
      },
    },
  };
}

export default async function TopLevelHubPage({ params }: { params: Promise<Params> }) {
  const { lang, examHub } = await params;
  if (!isLocale(lang)) notFound();

  const isExams = examHub === examHubSegment(lang);
  const isUniversitySupport = examHub === universitySupportSegment(lang);
  const isPricing = examHub === pricingSegment(lang);
  const isAbout = examHub === aboutSegment(lang);
  const isBooking = examHub === bookingSegment(lang);
  const isContact = examHub === contactSegment(lang);
  const isAssessment = examHub === assessmentSegment(lang);
  const isExamTest = examHub === examTestSegment(lang);
  const isPayment = examHub === paymentSegment(lang);
  const isStudentAccount = examHub === studentAccountSegment(lang);
  const isPrivacy = examHub === privacySegment(lang);
  const isTerms = examHub === termsSegment(lang);
  if (!isExams && !isUniversitySupport && !isPricing && !isAbout && !isBooking && !isContact && !isAssessment && !isExamTest && !isPayment && !isStudentAccount && !isPrivacy && !isTerms) notFound();

  return (
    <>
      <main id="main-content">
        {isExams ? (
          <ExamHub />
        ) : isUniversitySupport ? (
          <UniversitySupportPage />
        ) : isPricing ? (
          <PricingPage />
        ) : isAbout ? (
          <AboutPage />
        ) : isBooking ? (
          <BookingFlow />
        ) : isContact ? (
          <ContactPage />
        ) : isAssessment ? (
          <AssessmentPage />
        ) : isExamTest ? (
          <ExamTestPage />
        ) : isPayment ? (
          <PaymentPage />
        ) : isStudentAccount ? (
          <StudentPortal />
        ) : (
          <LegalPage kind={isPrivacy ? "privacy" : "terms"} />
        )}
      </main>
      <Footer />
    </>
  );
}
