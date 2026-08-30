"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AcademicIcon, type AcademicIconType } from "@/components/academic/AcademicIcon";
import { cn } from "@/lib/utils";

export interface ExamOverviewCard {
  id: string;
  eyebrow?: string;
  title: string;
  value?: string;
  description: string;
  bullets?: string[];
  iconType?: AcademicIconType;
  visual?: "overview" | "facts" | "content" | "preparation" | "audience" | "context";
  accent?: "primary" | "secondary" | "accent" | "muted";
  href?: string;
  linkLabel?: string;
  footerCode?: string;
}

interface ThreeDExamCarouselProps {
  examCode: string;
  cards: ExamOverviewCard[];
  locale: "tr" | "en";
}

const iconByVisual = {
  overview: "target",
  facts: "analysis",
  content: "reading",
  preparation: "planning",
  audience: "critical-reasoning",
  context: "university",
} as const;

function useResponsiveFace() {
  const [metrics, setMetrics] = useState({ width: 250, height: 304 });
  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      setMetrics(width < 640 ? { width: 250, height: 304 } : width < 1024 ? { width: 294, height: 350 } : { width: 340, height: 390 });
    };
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);
  return metrics;
}

function ExamCard({ card, examCode }: { card: ExamOverviewCard; examCode: string }) {
  const iconType = card.iconType ?? iconByVisual[card.visual ?? "overview"];
  return (
    <article className={cn(
      "relative flex h-full flex-col overflow-hidden rounded-[26px] border p-6 text-left shadow-[0_20px_55px_rgba(16,39,27,0.14)]",
      card.accent === "primary" && "border-[#294536] bg-[#10281E] text-white",
      card.accent === "secondary" && "border-[#A8B8A9] bg-[#E8EFE6] text-[#10281E]",
      card.accent === "accent" && "border-[#D6C58E] bg-[#F7F0DD] text-[#10281E]",
      (!card.accent || card.accent === "muted") && "border-[#D9E0D8] bg-[#FCFBF7] text-[#10281E]",
    )}>
      <div className="pointer-events-none absolute -right-16 -bottom-20 size-56 rounded-full border border-current/10" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-6 -bottom-10 size-36 rounded-full border border-current/10" aria-hidden="true" />
      <div className="flex items-start justify-between gap-4">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-65">{card.eyebrow ?? `${examCode} overview`}</span>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-current/15 bg-white/8"><AcademicIcon type={iconType} size={19} /></span>
      </div>
      {card.value && <p className="mt-7 font-heading text-[clamp(2.3rem,4vw,3.8rem)] leading-none tracking-[-0.035em]">{card.value}</p>}
      <h3 className={cn("mt-7 font-heading text-2xl leading-[1.04] tracking-[-0.02em]", card.value && "mt-4")}>{card.title}</h3>
      <p className="mt-3 line-clamp-4 text-[13px] leading-[1.65] opacity-72">{card.description}</p>
      {card.bullets && card.bullets.length > 0 && <ul className="mt-auto flex flex-wrap gap-2 pt-5">{card.bullets.map((bullet) => <li key={bullet} className="rounded-full border border-current/15 bg-white/10 px-2.5 py-1.5 text-[10px] font-semibold leading-none">{bullet}</li>)}</ul>}
      <span className="mt-auto pt-5 text-[9px] font-bold uppercase tracking-[0.18em] opacity-45">Oriens Academy · {card.footerCode ?? examCode}</span>
    </article>
  );
}

function ExamDetailSurface({ card, examCode, locale, closeRef, titleId, descriptionId, onClose }: {
  card: ExamOverviewCard;
  examCode: string;
  locale: "tr" | "en";
  closeRef: React.RefObject<HTMLButtonElement | null>;
  titleId: string;
  descriptionId: string;
  onClose: () => void;
}) {
  const iconType = card.iconType ?? iconByVisual[card.visual ?? "overview"];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-carousel-detail
      className="relative max-h-[88vh] w-full max-w-[800px] overflow-y-auto overflow-x-hidden rounded-[24px] border border-[#D9E0D8] bg-[#FCFBF7] p-6 text-[#10281E] shadow-[0_28px_90px_rgba(16,40,30,0.24)] sm:max-h-[85vh] sm:p-9"
    >
      <button ref={closeRef} type="button" onClick={onClose} className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-full border border-[#D9E0D8] bg-white text-[#10281E] outline-none transition-colors hover:bg-[#F1F4EE] focus-visible:ring-2 focus-visible:ring-[#819586] focus-visible:ring-offset-2" aria-label={locale === "tr" ? "Detayı kapat" : "Close details"}>
        <X className="size-4" />
      </button>

      <div className="flex items-center gap-3 pr-12">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[#D9E0D8] bg-white text-[#294536]"><AcademicIcon type={iconType} size={20} /></span>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E7E73]">{card.eyebrow ?? `${examCode} overview`}</span>
      </div>
      {card.value && <p className="mt-7 font-heading text-[clamp(2rem,5vw,2.625rem)] leading-tight tracking-[-0.025em] text-[#294536]">{card.value}</p>}
      <h2 id={titleId} className={cn("mt-7 max-w-[18ch] font-heading text-[clamp(1.75rem,4vw,2.625rem)] leading-[1.08] tracking-[-0.025em] text-[#10281E]", card.value && "mt-3")}>{card.title}</h2>
      <p id={descriptionId} className="mt-5 max-w-[68ch] text-base leading-[1.75] text-[#3E5145] sm:text-lg">{card.description}</p>
      {card.bullets && card.bullets.length > 0 && (
        <ul className="mt-7 flex flex-wrap gap-2 border-t border-[#D9E0D8] pt-6">
          {card.bullets.map((bullet) => <li key={bullet} className="rounded-full border border-[#CBD6CC] bg-white px-3 py-2 text-xs font-semibold leading-tight text-[#294536]">{bullet}</li>)}
        </ul>
      )}
      <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.18em] text-[#819086]">Oriens Academy · {card.footerCode ?? examCode}</p>
    </div>
  );
}

export function ThreeDExamCarousel({ examCode, cards, locale }: ThreeDExamCarouselProps) {
  const reducedMotion = useReducedMotion();
  const { width: faceWidth, height: faceHeight } = useResponsiveFace();
  const sectionRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selected, setSelected] = useState<ExamOverviewCard | null>(null);
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const rotation = useMotionValue(0);
  const angle = 360 / cards.length;
  const radius = Math.max(faceWidth * 1.12, (faceWidth / 2) / Math.tan(Math.PI / cards.length));

  useMotionValueEvent(rotation, "change", (value) => {
    const index = ((Math.round(-value / angle) % cards.length) + cards.length) % cards.length;
    setActiveIndex(index);
  });

  const moveTo = useCallback((target: number, spring = true) => {
    animate(rotation, target, spring && !reducedMotion
      ? { type: "spring", stiffness: 130, damping: 24, mass: 0.75 }
      : { duration: reducedMotion ? 0 : 0.25, ease: [0.32, 0.72, 0, 1] });
  }, [reducedMotion, rotation]);

  const scheduleIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (reducedMotion || !visible || selected) return;
    idleTimerRef.current = setTimeout(() => moveTo(rotation.get() - angle, false), 5200);
  }, [angle, moveTo, reducedMotion, rotation, selected, visible]);

  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.18 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    scheduleIdle();
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, [activeIndex, scheduleIdle]);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
        requestAnimationFrame(() => openerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKey); };
  }, [selected]);

  const closeDetail = () => {
    setSelected(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  };

  const step = (direction: -1 | 1) => {
    moveTo(rotation.get() - direction * angle);
    scheduleIdle();
  };

  const faces = useMemo(() => cards.map((card, index) => ({ card, transform: `rotateY(${index * angle}deg) translateZ(${radius}px)` })), [angle, cards, radius]);

  return (
    <div ref={sectionRef} data-exam-carousel data-exam-code={examCode} data-active-card={activeIndex + 1} className="relative w-full overflow-hidden bg-[radial-gradient(circle_at_50%_42%,rgba(197,181,138,0.2),transparent_36%),linear-gradient(180deg,var(--surface-muted),var(--background))]">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[8vw] bg-gradient-to-r from-background/95 to-transparent" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-[8vw] bg-gradient-to-l from-background/95 to-transparent" aria-hidden="true" />
      <motion.div
        className="relative flex h-[400px] touch-pan-y items-center justify-center outline-none sm:h-[490px] lg:h-[580px]"
        style={{ perspective: faceWidth < 280 ? "1050px" : "1450px" }}
        role="region"
        aria-roledescription="carousel"
        aria-label={locale === "tr" ? `${examCode} sınav bilgi kartları` : `${examCode} exam overview cards`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
          if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
        }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0}
        dragMomentum={false}
        onDragStart={() => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); }}
        onDrag={(_, info) => rotation.set(rotation.get() + info.delta.x * 0.22)}
        onDragEnd={(_, info) => {
          const projected = rotation.get() + Math.max(-48, Math.min(48, info.velocity.x * 0.025));
          moveTo(Math.round(projected / angle) * angle);
          scheduleIdle();
        }}
      >
        <motion.div className="absolute left-1/2 top-1/2" style={{ width: faceWidth, height: faceHeight, marginLeft: -faceWidth / 2, marginTop: -faceHeight / 2, transformStyle: "preserve-3d", rotateY: rotation, z: -radius, willChange: visible && !reducedMotion ? "transform" : "auto" }}>
          {faces.map(({ card, transform }, index) => {
            const className = "absolute inset-0 cursor-grab rounded-[26px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[#819586] focus-visible:ring-offset-4 active:cursor-grabbing";
            const style = { transform, backfaceVisibility: "hidden" as const, pointerEvents: index === activeIndex ? "auto" as const : "none" as const };
            const label = card.linkLabel ?? `${index + 1}/${cards.length}: ${card.title}`;

            return card.href ? (
              <Link key={card.id} href={card.href} className={className} style={style} tabIndex={index === activeIndex ? 0 : -1} aria-label={label}>
                <ExamCard card={card} examCode={examCode} />
              </Link>
            ) : (
              <motion.button key={card.id} type="button" onClick={(event) => { openerRef.current = event.currentTarget; setSelected(card); }} className={className} style={style} tabIndex={index === activeIndex ? 0 : -1} aria-label={label} aria-haspopup="dialog">
                <ExamCard card={card} examCode={examCode} />
              </motion.button>
            );
          })}
        </motion.div>
      </motion.div>

      <div className="absolute inset-x-0 bottom-5 z-30 flex items-center justify-center gap-3">
        <button type="button" onClick={() => step(-1)} className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-ink shadow-md outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-[#819586]" aria-label="Previous exam"><ChevronLeft className="size-4" /></button>
        <span className="min-w-16 rounded-full border border-border bg-card px-3 py-2 text-center text-[10px] font-bold tabular-nums tracking-[0.14em] text-muted-foreground" aria-live="polite">{String(activeIndex + 1).padStart(2, "0")} / {String(cards.length).padStart(2, "0")}</span>
        <button type="button" onClick={() => step(1)} className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-ink shadow-md outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-[#819586]" aria-label="Next exam"><ChevronRight className="size-4" /></button>
      </div>

      {selected && createPortal(
        <AnimatePresence>
          <motion.div ref={dialogRef} className="fixed inset-0 z-[120] flex items-center justify-center bg-[#10281E]/45 p-3 backdrop-blur-sm sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }} onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetail(); }}>
            <ExamDetailSurface card={selected} examCode={examCode} locale={locale} closeRef={closeRef} titleId={dialogTitleId} descriptionId={dialogDescriptionId} onClose={closeDetail} />
          </motion.div>
        </AnimatePresence>,
        document.body,
      )}

      <div className="sr-only"><h3>{locale === "tr" ? "Sınav bilgileri özeti" : "Exam facts summary"}</h3>{cards.map((card) => <article key={card.id}><h4>{card.title}</h4>{card.value && <p>{card.value}</p>}<p>{card.description}</p>{card.bullets && <ul>{card.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</article>)}</div>
    </div>
  );
}

export default ThreeDExamCarousel;
