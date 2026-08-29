"use client";

import { useEffect, useState } from "react";
import { useHomeContent, useLocale } from "@/content/locale-context";
import { TestimonialsSection, type Testimonial } from "@/components/testimonials-section";
import { getPublicTestimonials } from "@/lib/admin/content";

export function ResultsTestimonials() {
  const locale = useLocale();
  const { resultsTestimonials } = useHomeContent();
  const [items, setItems] = useState<Testimonial[]>(() =>
    resultsTestimonials.testimonials.map((t) => ({
      quote: t.quote,
      name: t.name,
      role: t.context,
    }))
  );

  useEffect(() => {
    let active = true;
    getPublicTestimonials(locale).then((rows) => {
      if (active && rows && rows.length > 0) {
        // Show featured items first
        const featuredRows = rows.filter((r) => r.featured);
        const displayRows = featuredRows.length >= 6 ? featuredRows.slice(0, 9) : rows.slice(0, 9);
        setItems(
          displayRows.map((r) => ({
            quote: r.quote,
            name: r.name,
            role: r.context || r.exam_code?.toUpperCase() || (locale === "tr" ? "Öğrenci Değerlendirmesi" : "Student Review"),
            image: r.profile_image_url || undefined,
            dateStr: r.created_at ? new Date(r.created_at).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", { month: "short", year: "numeric" }) : undefined,
          }))
        );
      }
    });
    return () => {
      active = false;
    };
  }, [locale]);

  return (
    <section id="results" className="section-offset bg-surface-muted py-20 md:py-28 overflow-hidden">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        <TestimonialsSection
          items={items}
          eyebrow={resultsTestimonials.eyebrow}
          title={resultsTestimonials.headline}
          description={resultsTestimonials.functionPlotCaption}
        />
      </div>
    </section>
  );
}

export default ResultsTestimonials;
