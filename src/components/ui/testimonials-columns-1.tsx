"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Quote, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TestimonialItem {
  id: string;
  text: string;
  name: string;
  role?: string;
  image?: string;
}

export interface TestimonialCarouselProps {
  className?: string;
  testimonials: TestimonialItem[];
  locale?: "tr" | "en";
}

function ProfileImage({ item, large = false }: { item: TestimonialItem; large?: boolean }) {
  const size = large ? 64 : 48;
  if (item.image) {
    return <Image src={item.image} alt="" width={size} height={size} unoptimized className={cn("shrink-0 rounded-full border border-border object-cover", large ? "size-16" : "size-12")} />;
  }
  return <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center rounded-full bg-[#10271B] font-bold text-white", large ? "size-16 text-xl" : "size-12 text-sm")}>{item.name.charAt(0).toUpperCase()}</span>;
}

function TestimonialCard({ item, onOpen, readMore }: { item: TestimonialItem; onOpen: () => void; readMore: string }) {
  return (
    <article className="flex min-h-[310px] snap-start flex-col justify-between rounded-2xl border border-[#DDE4DC] bg-white p-6 shadow-[0_12px_35px_rgba(16,39,27,.06)] sm:min-h-[340px] sm:p-8">
      <div>
        <Quote className="size-6 text-[#819586]" aria-hidden="true" />
        <p className="mt-5 line-clamp-6 font-heading text-xl leading-[1.45] text-[#10271B] sm:text-2xl">“{item.text}”</p>
      </div>
      <div className="mt-8 flex items-end justify-between gap-4 border-t border-[#DDE4DC] pt-5">
        <div className="flex min-w-0 items-center gap-3"><ProfileImage item={item} /><div className="min-w-0"><p className="truncate text-sm font-bold text-[#10271B]">{item.name}</p>{item.role && <p className="mt-0.5 truncate text-xs text-[#68756C]">{item.role}</p>}</div></div>
        <button type="button" onClick={onOpen} className="shrink-0 rounded-full border border-[#DDE4DC] px-3 py-2 text-xs font-bold text-[#10271B] outline-none transition-colors hover:bg-[#E9EFE9] focus-visible:ring-2 focus-visible:ring-[#819586] focus-visible:ring-offset-2">{readMore}</button>
      </div>
    </article>
  );
}

export function TestimonialCarousel({ className, testimonials, locale = "tr" }: TestimonialCarouselProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<TestimonialItem | null>(null);
  const reducedMotion = useReducedMotion();
  const isTr = locale === "tr";

  if (testimonials.length === 0) return null;

  function move(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector<HTMLElement>("article");
    rail.scrollBy({ left: direction * ((card?.offsetWidth ?? 320) + 24), behavior: reducedMotion ? "auto" : "smooth" });
  }

  return (
    <div className={cn("relative", className)}>
      <div ref={railRef} className="grid snap-x snap-mandatory auto-cols-[min(88%,390px)] grid-flow-col gap-6 overflow-x-auto pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:auto-cols-[min(70%,430px)] lg:auto-cols-[calc((100%-3rem)/3)]">
        {testimonials.map((item) => <TestimonialCard key={item.id} item={item} onOpen={() => setSelected(item)} readMore={isTr ? "Devamını oku" : "Read more"} />)}
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        <button type="button" onClick={() => move(-1)} aria-label={isTr ? "Önceki öğrenci yorumu" : "Previous testimonial"} className="flex size-11 items-center justify-center rounded-full border border-[#DDE4DC] bg-white text-[#10271B] outline-none hover:bg-[#E9EFE9] focus-visible:ring-2 focus-visible:ring-[#819586]"><ArrowLeft className="size-4" aria-hidden="true" /></button>
        <button type="button" onClick={() => move(1)} aria-label={isTr ? "Sonraki öğrenci yorumu" : "Next testimonial"} className="flex size-11 items-center justify-center rounded-full bg-[#10271B] text-white outline-none hover:bg-[#819586] focus-visible:ring-2 focus-visible:ring-[#819586] focus-visible:ring-offset-2"><ArrowRight className="size-4" aria-hidden="true" /></button>
      </div>

      <AnimatePresence>
        {selected && <motion.div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#10271B]/45 p-4" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null); }} role="presentation">
          <motion.div role="dialog" aria-modal="true" aria-labelledby="testimonial-dialog-title" initial={reducedMotion ? false : { opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .99 }} transition={{ duration: reducedMotion ? 0 : .22 }} className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#DDE4DC] bg-white p-7 shadow-2xl sm:p-10">
            <button type="button" autoFocus onClick={() => setSelected(null)} aria-label={isTr ? "Yorumu kapat" : "Close testimonial"} className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full border border-[#DDE4DC] text-[#10271B] outline-none hover:bg-[#E9EFE9] focus-visible:ring-2 focus-visible:ring-[#819586]"><X className="size-4" /></button>
            <Quote className="size-7 text-[#C5B58A]" aria-hidden="true" />
            <p className="mt-6 pr-8 font-heading text-2xl leading-[1.5] text-[#10271B] sm:text-3xl">“{selected.text}”</p>
            <div className="mt-8 flex items-center gap-4 border-t border-[#DDE4DC] pt-6"><ProfileImage item={selected} large /><div><h3 id="testimonial-dialog-title" className="font-bold text-[#10271B]">{selected.name}</h3>{selected.role && <p className="mt-1 text-sm text-[#68756C]">{selected.role}</p>}</div></div>
          </motion.div>
        </motion.div>}
      </AnimatePresence>
    </div>
  );
}

export const TestimonialsColumn = TestimonialCarousel;
export default TestimonialCarousel;
