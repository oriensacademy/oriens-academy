"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, useAnimationFrame, useMotionValue, useReducedMotion } from "motion/react";
import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TestimonialItem {
  id: string;
  text: string;
  name: string;
  metadata?: string;
  image?: string;
}

export interface TestimonialsColumnsProps {
  className?: string;
  testimonials: TestimonialItem[];
  locale?: "tr" | "en";
}

function initials(name: string) {
  return name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toLocaleUpperCase("tr-TR");
}

function TestimonialCard({ item, focusable = true }: { item: TestimonialItem; focusable?: boolean }) {
  return (
    <article tabIndex={focusable ? 0 : undefined} className="rounded-2xl border border-border bg-white/90 p-5 outline-none transition-colors focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-ring/30 sm:p-6">
      <Quote className="size-5 text-warm-accent" aria-hidden="true" />
      <blockquote className="mt-4"><p className="whitespace-pre-wrap text-sm leading-7 text-ink/82">“{item.text}”</p></blockquote>
      <footer className="mt-5 flex items-center gap-3 border-t border-border/70 pt-4">
        {item.image ? (
          <Image src={item.image} alt="" width={40} height={40} unoptimized className="size-10 shrink-0 rounded-full border border-border object-cover" />
        ) : (
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-soft text-xs font-bold text-ink">{initials(item.name)}</span>
        )}
        <div className="min-w-0">
          <cite className="block not-italic text-sm font-semibold text-ink">{item.name}</cite>
          {item.metadata ? <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.metadata}</span> : null}
        </div>
      </footer>
    </article>
  );
}

function MovingColumn({ items, pixelsPerSecond, paused }: { items: TestimonialItem[]; pixelsPerSecond: number; paused: boolean }) {
  const groupRef = useRef<HTMLDivElement>(null);
  const [groupHeight, setGroupHeight] = useState(0);
  const y = useMotionValue(0);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const measure = () => setGroupHeight(group.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    return () => observer.disconnect();
  }, [items]);

  useAnimationFrame((_time, delta) => {
    if (paused || !groupHeight) return;
    let next = y.get() - (pixelsPerSecond * Math.min(delta, 64)) / 1000;
    while (next <= -groupHeight) next += groupHeight;
    y.set(next);
  });

  if (!items.length) return null;
  const cards = (suffix: string, measured = false) => (
    <div ref={measured ? groupRef : undefined} className="space-y-4 pb-4" aria-hidden={measured ? undefined : true}>
      {items.map((item) => <TestimonialCard key={`${item.id}-${suffix}`} item={item} focusable={measured} />)}
    </div>
  );

  return <div data-testid="testimonial-moving-column" className="min-w-0 overflow-hidden"><motion.div style={{ y }}>{cards("primary", true)}{cards("duplicate")}</motion.div></div>;
}

function split(items: TestimonialItem[], count: number) {
  return Array.from({ length: count }, (_, columnIndex) => items.filter((_, itemIndex) => itemIndex % count === columnIndex));
}

export function TestimonialsColumns({ className, testimonials }: TestimonialsColumnsProps) {
  const reducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const tablet = split(testimonials, 2);
  const desktop = split(testimonials, 3);

  if (!testimonials.length) return null;
  if (reducedMotion) {
    return <div data-testid="testimonials-static" data-reduced-motion="true" className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>{testimonials.map((item) => <TestimonialCard key={item.id} item={item} />)}</div>;
  }

  return (
    <div
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setPaused(true); }}
      onPointerLeave={(event) => { if (event.pointerType === "mouse") setPaused(false); }}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}
      data-testid="testimonials-columns"
      data-paused={paused ? "true" : "false"}
      className={cn("relative h-[720px] overflow-hidden", className)}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-surface-muted to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-surface-muted to-transparent" />
      <div data-layout="mobile" className="md:hidden"><MovingColumn items={testimonials} pixelsPerSecond={22} paused={paused} /></div>
      <div data-layout="tablet" className="hidden grid-cols-2 gap-4 md:grid lg:hidden">{tablet.map((items, index) => <MovingColumn key={index} items={items} pixelsPerSecond={index === 0 ? 20 : 24} paused={paused} />)}</div>
      <div data-layout="desktop" className="hidden grid-cols-3 gap-4 lg:grid">{desktop.map((items, index) => <MovingColumn key={index} items={items} pixelsPerSecond={[19, 23, 21][index]} paused={paused} />)}</div>
    </div>
  );
}

export const TestimonialsColumn = TestimonialsColumns;
export default TestimonialsColumns;
