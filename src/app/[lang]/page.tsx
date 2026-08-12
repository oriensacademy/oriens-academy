import { Navbar } from "@/components/sections/Navbar";
import { Hero } from "@/components/sections/Hero";
import { TrustResults } from "@/components/sections/TrustResults";
import { ExamPreparation } from "@/components/sections/ExamPreparation";
import { OriensMethod } from "@/components/sections/OriensMethod";
import { SignatureMathematics } from "@/components/sections/SignatureMathematics";
import { UniversitySupport } from "@/components/sections/UniversitySupport";
import { WhyOriens } from "@/components/sections/WhyOriens";
import { ResultsTestimonials } from "@/components/sections/ResultsTestimonials";
import { PricingPreview } from "@/components/sections/PricingPreview";
import { BookingCTA } from "@/components/sections/BookingCTA";
import { FAQSection } from "@/components/sections/FAQ";
import { Footer } from "@/components/sections/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        <Hero />
        <TrustResults />
        <ExamPreparation />
        <OriensMethod />
        <SignatureMathematics />
        <UniversitySupport />
        <WhyOriens />
        <ResultsTestimonials />
        <PricingPreview />
        <BookingCTA />
        <FAQSection />
      </main>
      <Footer />
    </>
  );
}
