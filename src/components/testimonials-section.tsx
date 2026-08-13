"use client";

import { motion } from "framer-motion";
import { GridPattern } from "@/components/ui/grid-pattern";

export type Testimonial = {
  name: string;
  role: string;
  image?: string;
  company: string;
  quote: string;
};

export function TestimonialsSection({
  items,
  eyebrow,
  title,
  description,
}: {
  items: Testimonial[];
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <section data-testimonials-section className="relative w-full px-4 pt-10 pb-20">
      <div aria-hidden className="absolute inset-0 isolate z-0 contain-strict">
        <div className="absolute top-0 left-0 h-320 w-140 -translate-y-87.5 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,rgba(16,39,27,.06)_0,rgba(16,39,27,.02)_50%,rgba(16,39,27,.01)_80%)]" />
      </div>
      <div className="relative mx-auto max-w-5xl space-y-8">
        <div className="flex max-w-3xl flex-col gap-2">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#819586]">{eyebrow}</p>}
          <h2 className="font-heading text-3xl tracking-wide text-balance md:text-4xl lg:text-5xl">{title}</h2>
          <p className="text-sm text-muted-foreground md:text-base lg:text-lg">{description}</p>
        </div>
        <div className="relative grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ name, role, company, quote, image }, index) => (
            <motion.article
              initial={{ filter: "blur(4px)", translateY: -8, opacity: 0 }}
              whileInView={{ filter: "blur(0px)", translateY: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * index + 0.1, duration: 0.65 }}
              key={`${name}-${index}`}
              className="relative grid grid-cols-[auto_1fr] gap-x-3 overflow-hidden border border-dashed border-foreground/25 bg-white/45 p-4"
            >
              <div className="pointer-events-none absolute top-0 left-1/2 -mt-2 -ml-20 h-full w-full [mask-image:linear-gradient(white,transparent)]">
                <div className="absolute inset-0 bg-gradient-to-r from-foreground/5 to-foreground/2 [mask-image:radial-gradient(farthest-side_at_top,white,transparent)]">
                  <GridPattern width={25} height={25} x={-12} y={4} strokeDasharray="3" className="absolute inset-0 h-full w-full stroke-foreground/20 mix-blend-overlay" />
                </div>
              </div>
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={name} src={image} loading="lazy" className="size-9 rounded-full object-cover" />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-full bg-[#E6EDE5] text-xs font-bold text-[#10271B]" aria-hidden="true">
                  {name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}
                </span>
              )}
              <div className="relative">
                <div className="-mt-0.5 -space-y-0.5">
                  <p className="text-sm md:text-base">{name}</p>
                  <span className="block text-[11px] font-light tracking-tight text-muted-foreground">{role}{company ? ` · ${company}` : ""}</span>
                </div>
                <blockquote className="mt-3"><p className="text-sm font-light tracking-wide text-foreground">{quote}</p></blockquote>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TestimonialsSection;
