import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExamHub } from "@/components/exams/ExamHub";
import { UniversitySupportPage } from "@/components/university/UniversitySupportPage";
import { PricingPage } from "@/components/pricing/PricingPage";
import { AboutPage } from "@/components/about/AboutPage";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { ContactPage } from "@/components/contact/ContactPage";
import { Footer } from "@/components/sections/Footer";
import { Navbar } from "@/components/sections/Navbar";
import { getDictionary, isLocale } from "@/content/dictionaries";
import { aboutSegment, bookingSegment, contactSegment, examHubSegment, localizedPath, pricingSegment, universitySupportSegment } from "@/lib/routes";

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
  if (!isExams && !isUniversitySupport && !isPricing && !isAbout && !isBooking && !isContact) return {};

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
            : "contact";

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
            : {
                title: lang === "tr" ? "İletişim | Oriens Academy" : "Contact Us | Oriens Academy",
                description:
                  lang === "tr"
                    ? "Oriens Academy ile iletişime geçin. Sınav hazırlığı ve üniversite ders desteği hakkında sorularınızı iletin."
                    : "Contact Oriens Academy for questions regarding exam preparation and university academic support.",
              };

  return {
    title: metadata.title,
    description: metadata.description,
    alternates: {
      canonical: localizedPath(route, lang),
      languages: { tr: localizedPath(route, "tr"), en: localizedPath(route, "en") },
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
  if (!isExams && !isUniversitySupport && !isPricing && !isAbout && !isBooking && !isContact) notFound();

  return (
    <>
      <Navbar />
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
        ) : (
          <ContactPage />
        )}
      </main>
      <Footer />
    </>
  );
}
