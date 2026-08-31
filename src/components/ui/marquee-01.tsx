"use client";

import Image from "next/image";
import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MarqueeTestimonial {
  id: string;
  text: string;
  name: string;
  metadata?: string;
  image?: string;
}

function initials(name: string) {
  return name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toLocaleUpperCase("tr-TR");
}

function Card({ item, duplicate = false }: { item: MarqueeTestimonial; duplicate?: boolean }) {
  return (
    <article tabIndex={duplicate ? -1 : 0} aria-hidden={duplicate || undefined} className="w-[min(82vw,25rem)] shrink-0 rounded-2xl border border-border bg-white/95 p-5 shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/35 sm:w-[23rem] sm:p-6">
      <Quote className="size-5 text-warm-accent" aria-hidden="true" />
      <blockquote className="mt-4"><p className="whitespace-pre-wrap text-sm leading-7 text-ink/82">“{item.text}”</p></blockquote>
      <footer className="mt-5 flex items-center gap-3 border-t border-border/70 pt-4">
        {item.image ? <Image src={item.image} alt="" width={40} height={40} unoptimized className="size-10 shrink-0 rounded-full border border-border object-cover" /> : <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-soft text-xs font-bold text-ink">{initials(item.name)}</span>}
        <div className="min-w-0"><cite className="block not-italic text-sm font-semibold text-ink">{item.name}</cite>{item.metadata ? <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.metadata}</span> : null}</div>
      </footer>
    </article>
  );
}

function Row({ items, reverse = false }: { items: MarqueeTestimonial[]; reverse?: boolean }) {
  if (!items.length) return null;
  return <div data-marquee-row data-reverse={reverse ? "true" : "false"} className="overflow-hidden">
    <div className={cn("oriens-marquee-track flex w-max py-2", reverse && "oriens-marquee-track-reverse")}>
      <div className="flex gap-4 pr-4">{items.map((item) => <Card key={item.id} item={item} />)}</div>
      <div className="flex gap-4 pr-4" aria-hidden="true">{items.map((item) => <Card key={`${item.id}-copy`} item={item} duplicate />)}</div>
    </div>
  </div>;
}

export function Marquee01({ testimonials, className }: { testimonials: MarqueeTestimonial[]; className?: string }) {
  if (!testimonials.length) return null;
  const midpoint = Math.ceil(testimonials.length / 2);
  const first = testimonials.slice(0, midpoint);
  const second = testimonials.slice(midpoint);
  const secondRow = second.length ? second : first;
  return <div data-testid="testimonial-marquee" className={cn("oriens-marquee space-y-3", className)}>
    <Row items={first} />
    <Row items={secondRow} reverse />
  </div>;
}

export default Marquee01;
