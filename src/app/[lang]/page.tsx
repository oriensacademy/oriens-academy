import { Hero } from "@/components/sections/Hero";
import { TrustResults } from "@/components/sections/TrustResults";
import { ExamPreparation } from "@/components/sections/ExamPreparation";
import { StudyDestinationSection } from "@/components/discovery/StudyDestinationSection";
import { StudentQuestions } from "@/components/sections/StudentQuestions";
import { ResultsTestimonials } from "@/components/sections/ResultsTestimonials";
import { StudentJourney } from "@/components/sections/StudentJourney";
import { BookingCTA } from "@/components/sections/BookingCTA";
import { Footer } from "@/components/sections/Footer";

export default function Home() {
  return (
    <>
      <main id="main-content">
        <Hero />
        <TrustResults />
        <ExamPreparation />
        <StudyDestinationSection compact />
        <StudentQuestions />
        <StudentJourney />
        <ResultsTestimonials />
        <BookingCTA />
      </main>
      <Footer />
    </>
  );
}
