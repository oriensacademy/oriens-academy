"use client";

import { useHomeContent } from "@/content/locale-context";
import { TestimonialsSection, type Testimonial } from "@/components/testimonials-section";

export function ResultsTestimonials() {
  const { resultsTestimonials } = useHomeContent();
  const testimonialItems: Testimonial[] = resultsTestimonials.testimonials.map((t) => ({
    quote: t.quote,
    name: t.name,
    role: t.context,
    company: "Oriens Academy",
  }));

  return (
    <section id="results" className="section-offset bg-surface-muted py-20 md:py-28 overflow-hidden">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        <TestimonialsSection
          items={testimonialItems}
          eyebrow={resultsTestimonials.eyebrow}
          title={resultsTestimonials.headline}
          description={resultsTestimonials.functionPlotCaption}
        />
      </div>
    </section>
  );
}

export default ResultsTestimonials;
