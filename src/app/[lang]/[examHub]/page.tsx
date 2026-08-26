import type { Metadata } from "next";
import { Suspense } from "react";
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
import { CartPage } from "@/components/cart/CartPage";
import { StudentPortal } from "@/components/student/StudentPortal";
import { UnifiedLoginPage } from "@/components/auth/UnifiedLoginPage";
import { ForgotPasswordPage } from "@/components/auth/ForgotPasswordPage";
import { AccountPasswordChangePage } from "@/components/auth/AccountPasswordChangePage";
import { AccountWaveLoader } from "@/components/auth/AccountWaveLoader";
import { Footer } from "@/components/sections/Footer";
import { getDictionary, isLocale } from "@/content/dictionaries";
import {
  aboutSegment,
  assessmentSegment,
  bookingSegment,
  cartSegment,
  changePasswordSegment,
  contactSegment,
  cookiePolicySegment,
  examHubSegment,
  examTestSegment,
  forgotPasswordSegment,
  kvkkSegment,
  localizedPath,
  type LocalizedRouteId,
  paymentSegment,
  preInformationSegment,
  pricingSegment,
  privacySegment,
  refundPolicySegment,
  salesAgreementSegment,
  studentAccountSegment,
  termsSegment,
  unifiedLoginSegment,
  universitySupportSegment,
} from "@/lib/routes";

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
        { examHub: cartSegment(params.lang) },
        { examHub: studentAccountSegment(params.lang) },
        { examHub: unifiedLoginSegment(params.lang) },
        { examHub: forgotPasswordSegment(params.lang) },
        { examHub: changePasswordSegment(params.lang) },
        { examHub: privacySegment(params.lang) },
        { examHub: termsSegment(params.lang) },
        { examHub: salesAgreementSegment(params.lang) },
        { examHub: preInformationSegment(params.lang) },
        { examHub: refundPolicySegment(params.lang) },
        { examHub: kvkkSegment(params.lang) },
        { examHub: cookiePolicySegment(params.lang) },
      ]
    : [];
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
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
  const isCart = examHub === cartSegment(lang);
  const isStudentAccount = examHub === studentAccountSegment(lang);
  const isLogin = examHub === unifiedLoginSegment(lang);
  const isForgotPassword = examHub === forgotPasswordSegment(lang);
  const isChangePassword = examHub === changePasswordSegment(lang);
  const isPrivacy = examHub === privacySegment(lang);
  const isTerms = examHub === termsSegment(lang);
  const isSalesAgreement = examHub === salesAgreementSegment(lang);
  const isPreInformation = examHub === preInformationSegment(lang);
  const isRefundPolicy = examHub === refundPolicySegment(lang);
  const isKvkk = examHub === kvkkSegment(lang);
  const isCookie = examHub === cookiePolicySegment(lang);

  if (
    !isExams &&
    !isUniversitySupport &&
    !isPricing &&
    !isAbout &&
    !isBooking &&
    !isContact &&
    !isAssessment &&
    !isExamTest &&
    !isPayment &&
    !isCart &&
    !isStudentAccount &&
    !isLogin &&
    !isForgotPassword &&
    !isChangePassword &&
    !isPrivacy &&
    !isTerms &&
    !isSalesAgreement &&
    !isPreInformation &&
    !isRefundPolicy &&
    !isKvkk &&
    !isCookie
  ) {
    return {};
  }

  if (isLogin || isForgotPassword || isChangePassword) {
    const route = isLogin ? "login" : isForgotPassword ? "forgotPassword" : "changePassword";
    const title = isLogin
      ? lang === "tr"
        ? "Oturum Aç | Oriens Academy"
        : "Sign In | Oriens Academy"
      : isForgotPassword
        ? lang === "tr"
          ? "Şifremi Unuttum | Oriens Academy"
          : "Forgot Password | Oriens Academy"
        : lang === "tr"
          ? "Şifre Değiştir | Oriens Academy"
          : "Change Password | Oriens Academy";
    return {
      title,
      robots: { index: false, follow: false },
      alternates: {
        canonical: localizedPath(route, lang),
        languages: { tr: localizedPath(route, "tr"), en: localizedPath(route, "en") },
      },
    };
  }

  if (isStudentAccount) {
    const title = lang === "tr" ? "Hesabım | Oriens Academy" : "My Account | Oriens Academy";
    return {
      title,
      robots: { index: false, follow: false },
      alternates: {
        canonical: localizedPath("studentAccount", lang),
        languages: { tr: localizedPath("studentAccount", "tr"), en: localizedPath("studentAccount", "en") },
      },
    };
  }

  if (isCart) {
    const title = lang === "tr" ? "Sepetim | Oriens Academy" : "My Cart | Oriens Academy";
    return {
      title,
      robots: { index: false, follow: false },
      alternates: {
        canonical: localizedPath("cart", lang),
        languages: { tr: localizedPath("cart", "tr"), en: localizedPath("cart", "en") },
      },
    };
  }

  const route: LocalizedRouteId = isExams
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
              : isAssessment
                ? "assessment"
                : isExamTest
                  ? "examTest"
                  : isPayment
                    ? "payment"
                    : isSalesAgreement
                      ? "salesAgreement"
                      : isPreInformation
                        ? "preInformation"
                        : isRefundPolicy
                          ? "refundPolicy"
                          : isKvkk
                            ? "kvkk"
                            : isCookie
                              ? "cookie"
                              : isPrivacy
                                ? "privacy"
                                : "terms";

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
              : isAssessment
                ? {
                    title: lang === "tr" ? "Ön Değerlendirme | Oriens Academy" : "Academic Assessment | Oriens Academy",
                    description:
                      lang === "tr"
                        ? "Oriens Academy ön değerlendirme formu."
                        : "Oriens Academy academic assessment form.",
                  }
                : isExamTest
                  ? {
                      title: lang === "tr" ? "Kendini Dene | Oriens Academy" : "Test Yourself | Oriens Academy",
                      description:
                        lang === "tr"
                          ? "Oriens Academy örnek interaktif sınav değerlendirmesi."
                          : "Oriens Academy sample interactive exam assessment.",
                    }
                  : isPayment
                    ? {
                        title: lang === "tr" ? "Güvenli Ödeme | Oriens Academy" : "Secure Payment | Oriens Academy",
                        description:
                          lang === "tr"
                            ? "Oriens Academy paket ödeme yöntemleri."
                            : "Oriens Academy package payment methods.",
                      }
                    : isSalesAgreement
                      ? {
                          title: lang === "tr" ? "Mesafeli Satış Sözleşmesi | Oriens Academy" : "Distance Sales Agreement | Oriens Academy",
                          description: lang === "tr" ? "Oriens Academy mesafeli satış sözleşmesi, tüketici hakları ve eğitim hizmeti şartları." : "Oriens Academy distance sales agreement and consumer terms.",
                        }
                      : isPreInformation
                        ? {
                            title: lang === "tr" ? "Ön Bilgilendirme Formu | Oriens Academy" : "Pre-Information Form | Oriens Academy",
                            description: lang === "tr" ? "Oriens Academy sipariş öncesi ön bilgilendirme formu ve hizmet detayları." : "Oriens Academy pre-order information notice.",
                          }
                        : isRefundPolicy
                          ? {
                              title: lang === "tr" ? "İptal ve İade Koşulları | Oriens Academy" : "Cancellation & Refund Policy | Oriens Academy",
                              description: lang === "tr" ? "Oriens Academy ders paketi iptal, iade ve cayma hakkı esasları." : "Oriens Academy cancellation and refund policy.",
                            }
                          : isKvkk
                            ? {
                                title: lang === "tr" ? "KVKK Aydınlatma Metni | Oriens Academy" : "Personal Data (KVKK) Notice | Oriens Academy",
                                description: lang === "tr" ? "Oriens Academy 6698 sayılı KVKK kapsamında kişisel verilerin korunması aydınlatma metni." : "Oriens Academy personal data protection notice.",
                              }
                            : isCookie
                              ? {
                                  title: lang === "tr" ? "Çerez Politikası | Oriens Academy" : "Cookie Policy | Oriens Academy",
                                  description: lang === "tr" ? "Oriens Academy web sitesi çerez kullanım ve gizlilik tercihleri bilgilendirmesi." : "Oriens Academy cookie policy and privacy preferences.",
                                }
                              : {
                                  title: isPrivacy
                                    ? lang === "tr"
                                      ? "Gizlilik Politikası | Oriens Academy"
                                      : "Privacy Policy | Oriens Academy"
                                    : lang === "tr"
                                      ? "Kullanım Koşulları | Oriens Academy"
                                      : "Terms of Service | Oriens Academy",
                                  description: isPrivacy
                                    ? lang === "tr"
                                      ? "Oriens Academy gizlilik politikası."
                                      : "Oriens Academy privacy policy."
                                    : lang === "tr"
                                      ? "Oriens Academy kullanım koşulları."
                                      : "Oriens Academy terms of service.",
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
      },
    },
  };
}

export default async function TopLevelHubPage({
  params,
}: {
  params: Promise<Params>;
}) {
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
  const isCart = examHub === cartSegment(lang);
  const isStudentAccount = examHub === studentAccountSegment(lang);
  const isLogin = examHub === unifiedLoginSegment(lang);
  const isForgotPassword = examHub === forgotPasswordSegment(lang);
  const isChangePassword = examHub === changePasswordSegment(lang);
  const isPrivacy = examHub === privacySegment(lang);
  const isTerms = examHub === termsSegment(lang);
  const isSalesAgreement = examHub === salesAgreementSegment(lang);
  const isPreInformation = examHub === preInformationSegment(lang);
  const isRefundPolicy = examHub === refundPolicySegment(lang);
  const isKvkk = examHub === kvkkSegment(lang);
  const isCookie = examHub === cookiePolicySegment(lang);

  if (
    !isExams &&
    !isUniversitySupport &&
    !isPricing &&
    !isAbout &&
    !isBooking &&
    !isContact &&
    !isAssessment &&
    !isExamTest &&
    !isPayment &&
    !isCart &&
    !isStudentAccount &&
    !isLogin &&
    !isForgotPassword &&
    !isChangePassword &&
    !isPrivacy &&
    !isTerms &&
    !isSalesAgreement &&
    !isPreInformation &&
    !isRefundPolicy &&
    !isKvkk &&
    !isCookie
  ) {
    notFound();
  }

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
        ) : isCart ? (
          <CartPage />
        ) : isStudentAccount ? (
          <StudentPortal />
        ) : isLogin ? (
          <Suspense fallback={<AccountWaveLoader />}>
            <UnifiedLoginPage />
          </Suspense>
        ) : isForgotPassword ? (
          <ForgotPasswordPage />
        ) : isChangePassword ? (
          <AccountPasswordChangePage />
        ) : isSalesAgreement ? (
          <LegalPage kind="salesAgreement" />
        ) : isPreInformation ? (
          <LegalPage kind="preInformation" />
        ) : isRefundPolicy ? (
          <LegalPage kind="refundPolicy" />
        ) : isKvkk ? (
          <LegalPage kind="kvkk" />
        ) : isCookie ? (
          <LegalPage kind="cookie" />
        ) : isPrivacy ? (
          <LegalPage kind="privacy" />
        ) : (
          <LegalPage kind="terms" />
        )}
      </main>
      <Footer />
    </>
  );
}
