"use client";

import { useEffect, useState } from "react";
import { useHomeContent, useLocale } from "@/content/locale-context";
import { TestimonialsSection, type Testimonial } from "@/components/testimonials-section";
import { getPublicTestimonials } from "@/lib/admin/content";

export function ResultsTestimonials() {
  const locale = useLocale();
  const { resultsTestimonials } = useHomeContent();
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    getPublicTestimonials(locale).then(({ data: rows, error }) => {
      if (!active) return;
      setLoadError(Boolean(error));
      if (!error && rows.length > 0) {
        setItems(
          rows.map((r) => ({
            id: r.id,
            quote: r.quote,
            name: r.name,
            role: r.context || r.exam_code?.toUpperCase() || undefined,
            image: r.profile_image_url || undefined,
            dateStr: r.created_at ? new Date(r.created_at).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", { month: "short", year: "numeric" }) : undefined,
          }))
        );
      } else setItems([]);
    });
    return () => {
      active = false;
    };
  }, [locale]);

  return (
    <section id="results" className="section-offset bg-surface-muted py-20 md:py-28 overflow-hidden">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        {loadError ? (
          <div role="status" className="rounded-2xl border border-border bg-white p-8 text-center text-sm text-muted-foreground">
            {locale === "tr" ? "Öğrenci yorumları şu anda yüklenemiyor. Lütfen daha sonra tekrar deneyin." : "Student reviews are temporarily unavailable. Please try again later."}
          </div>
        ) : items.length > 0 ? (
          <TestimonialsSection items={items} eyebrow={resultsTestimonials.eyebrow} title={resultsTestimonials.headline} description={resultsTestimonials.functionPlotCaption} />
        ) : null}
      </div>
    </section>
  );
}

export default ResultsTestimonials;
