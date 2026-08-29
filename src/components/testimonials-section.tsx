"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { GridPattern } from "@/components/ui/grid-pattern";
import { ChevronDown, ChevronUp, Quote } from "lucide-react";
import { useLocale } from "@/content/locale-context";

export type Testimonial = {
  name: string;
  role: string;
  image?: string;
  company?: string;
  quote: string;
  dateStr?: string;
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
  const locale = useLocale();
  const isTr = locale === "tr";
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({});

  const toggleExpand = (index: number) => {
    setExpandedIndices((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

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
        <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ name, role, company, quote, image, dateStr }, index) => {
            const isExpanded = !!expandedIndices[index];
            const isLong = quote.length > 160;

            return (
              <motion.article
                initial={{ filter: "blur(4px)", translateY: -8, opacity: 0 }}
                whileInView={{ filter: "blur(0px)", translateY: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.08 * (index % 6) + 0.05, duration: 0.55 }}
                key={`${name}-${index}`}
                className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-white/75 p-5 shadow-xs backdrop-blur-xs transition-all hover:border-[#819586]/60 hover:shadow-md"
              >
                <div className="pointer-events-none absolute top-0 left-1/2 -mt-2 -ml-20 h-full w-full [mask-image:linear-gradient(white,transparent)]">
                  <div className="absolute inset-0 bg-gradient-to-r from-foreground/5 to-foreground/2 [mask-image:radial-gradient(farthest-side_at_top,white,transparent)]">
                    <GridPattern width={25} height={25} x={-12} y={4} strokeDasharray="3" className="absolute inset-0 h-full w-full stroke-foreground/20 mix-blend-overlay" />
                  </div>
                </div>

                <div>
                  <div className="flex items-start gap-3">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={name} src={image} loading="lazy" className="size-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#E6EDE5] text-xs font-bold text-[#10271B]" aria-hidden="true">
                        {name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}
                      </span>
                    )}

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                      <span className="block text-[11px] font-medium text-muted-foreground truncate">
                        {role}{company ? ` · ${company}` : ""}
                      </span>
                      {dateStr && (
                        <span className="block text-[10px] text-muted-foreground/70">{dateStr}</span>
                      )}
                    </div>
                  </div>

                  <blockquote className="mt-4">
                    <p className={`text-xs leading-relaxed text-foreground font-sans ${isLong && !isExpanded ? "line-clamp-4" : ""}`}>
                      &quot;{quote}&quot;
                    </p>
                  </blockquote>
                </div>

                {isLong && (
                  <div className="mt-3 pt-2 border-t border-border/40">
                    <button
                      type="button"
                      onClick={() => toggleExpand(index)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#10271B] hover:text-[#819586] hover:underline"
                    >
                      <span>{isExpanded ? (isTr ? "Daha az göster" : "Show less") : (isTr ? "Devamını oku" : "Read more")}</span>
                      {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    </button>
                  </div>
                )}
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default TestimonialsSection;
