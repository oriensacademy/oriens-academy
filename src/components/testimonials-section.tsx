"use client";

import { TestimonialsColumns } from "@/components/ui/testimonials-columns-1";

export type Testimonial = { id: string; name: string; role?: string; image?: string; company?: string; quote: string; dateStr?: string };

export function TestimonialsSection({ items, eyebrow, title, description }: { items: Testimonial[]; eyebrow?: string; title: string; description: string }) {
  return (
    <section data-testimonials-section className="relative w-full">
      <div className="mx-auto max-w-3xl text-center">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-accent">{eyebrow}</p> : null}
        <h2 className="mt-4 font-heading text-3xl text-ink md:text-4xl lg:text-5xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">{description}</p>
      </div>
      <TestimonialsColumns className="mt-10" testimonials={items.map((item) => ({ id: item.id, text: item.quote, name: item.name, image: item.image, metadata: [item.role, item.company, item.dateStr].filter(Boolean).join(" · ") || undefined }))} />
    </section>
  );
}

export default TestimonialsSection;
