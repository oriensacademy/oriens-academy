"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export interface CircularTestimonial {
  quote: string;
  name: string;
  designation: string;
  src?: string | null;
}

interface Colors {
  name?: string;
  designation?: string;
  testimony?: string;
  arrowBackground?: string;
  arrowForeground?: string;
  arrowHoverBackground?: string;
}

interface FontSizes {
  name?: string;
  designation?: string;
  quote?: string;
}

interface CircularTestimonialsProps {
  testimonials: CircularTestimonial[];
  autoplay?: boolean;
  colors?: Colors;
  fontSizes?: FontSizes;
  locale?: "tr" | "en";
}

function calculateGap(width: number) {
  if (width < 480) return Math.max(40, width * 0.16);
  if (width < 768) return Math.max(52, width * 0.18);
  const minWidth = 1024;
  const maxWidth = 1456;
  const minGap = 60;
  const maxGap = 86;
  if (width <= minWidth) return minGap;
  if (width >= maxWidth) return Math.max(minGap, maxGap + 0.06018 * (width - maxWidth));
  return minGap + (maxGap - minGap) * ((width - minWidth) / (maxWidth - minWidth));
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase()).join("");
}

export function CircularTestimonials({
  testimonials,
  autoplay = true,
  colors = {},
  fontSizes = {},
  locale = "tr",
}: CircularTestimonialsProps) {
  const reducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredArrow, setHoveredArrow] = useState<"prev" | "next" | null>(null);
  const [containerWidth, setContainerWidth] = useState(720);
  const [failedImages, setFailedImages] = useState<Set<number>>(() => new Set());
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const testimonialsLength = testimonials.length;
  const safeActiveIndex = testimonialsLength > 0 ? activeIndex % testimonialsLength : 0;
  const activeTestimonial = testimonials[safeActiveIndex];

  useEffect(() => {
    const node = imageContainerRef.current;
    if (!node) return;
    const updateWidth = () => setContainerWidth(node.offsetWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!autoplay || reducedMotion || testimonialsLength < 2) return;
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % testimonialsLength);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [activeIndex, autoplay, reducedMotion, testimonialsLength]);

  const handleNext = useCallback(() => {
    if (testimonialsLength > 1) setActiveIndex((current) => (current + 1) % testimonialsLength);
  }, [testimonialsLength]);

  const handlePrev = useCallback(() => {
    if (testimonialsLength > 1) setActiveIndex((current) => (current - 1 + testimonialsLength) % testimonialsLength);
  }, [testimonialsLength]);

  const styles = useMemo(() => testimonials.map((_, index): React.CSSProperties => {
    const gap = calculateGap(containerWidth);
    const rise = Math.min(gap * 0.68, containerWidth < 480 ? 34 : 58);
    const isActive = index === safeActiveIndex;
    const isLeft = (safeActiveIndex - 1 + testimonialsLength) % testimonialsLength === index;
    const isRight = (safeActiveIndex + 1) % testimonialsLength === index;
    const transition = reducedMotion ? "none" : "transform 420ms cubic-bezier(.22,.75,.25,1), opacity 320ms ease";
    if (isActive) return { zIndex: 3, opacity: 1, pointerEvents: "auto", transform: "translateX(0) translateY(0) scale(1)", transition };
    if (isLeft) return { zIndex: 2, opacity: 0.82, pointerEvents: "auto", transform: `translateX(-${gap}px) translateY(-${rise}px) scale(.84) rotate(-3deg)`, transition };
    if (isRight) return { zIndex: 2, opacity: 0.82, pointerEvents: "auto", transform: `translateX(${gap}px) translateY(-${rise}px) scale(.84) rotate(3deg)`, transition };
    return { zIndex: 1, opacity: 0, pointerEvents: "none", transform: "scale(.8)", transition };
  }), [containerWidth, reducedMotion, safeActiveIndex, testimonials, testimonialsLength]);

  if (!testimonialsLength || !activeTestimonial) return null;

  return (
    <div
      className="testimonial-container"
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label={locale === "tr" ? "Doğrulanmış öğrenci deneyimleri" : "Verified student experiences"}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") { event.preventDefault(); handlePrev(); }
        if (event.key === "ArrowRight") { event.preventDefault(); handleNext(); }
      }}
    >
      <div className="testimonial-grid">
        <div className="image-container" ref={imageContainerRef} aria-hidden="true">
          {testimonials.map((testimonial, index) => {
            const showFallback = !testimonial.src || failedImages.has(index);
            return (
              <div key={`${testimonial.name}-${index}`} className="testimonial-image" style={styles[index]}>
                {showFallback ? (
                  <div className="avatar-fallback"><span>{initials(testimonial.name) || "OA"}</span><small>ORIENS ACADEMY</small></div>
                ) : (
                  // Supabase stores owner-managed URLs that can use multiple providers.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={testimonial.src ?? ""} alt="" onError={() => setFailedImages((current) => new Set(current).add(index))} />
                )}
              </div>
            );
          })}
        </div>

        <div className="testimonial-content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={safeActiveIndex} initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }} transition={{ duration: reducedMotion ? 0.12 : 0.3 }}>
              <h3 className="name" style={{ color: colors.name ?? "#10271B", fontSize: fontSizes.name ?? "1.5rem" }}>{activeTestimonial.name}</h3>
              <p className="designation" style={{ color: colors.designation ?? "#68756C", fontSize: fontSizes.designation ?? ".925rem" }}>{activeTestimonial.designation}</p>
              <p className="quote" style={{ color: colors.testimony ?? "#34483D", fontSize: fontSizes.quote ?? "1.125rem" }}>
                {activeTestimonial.quote.split(" ").map((word, index) => (
                  <React.Fragment key={`${word}-${index}`}>
                    <motion.span initial={reducedMotion ? { opacity: 0 } : { filter: "blur(8px)", opacity: 0, y: 4 }} animate={{ filter: "blur(0px)", opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.1 : 0.22, delay: reducedMotion ? 0 : 0.025 * index }}>{word}</motion.span>{" "}
                  </React.Fragment>
                ))}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="arrow-buttons">
            <button type="button" onClick={handlePrev} disabled={testimonialsLength < 2} onMouseEnter={() => setHoveredArrow("prev")} onMouseLeave={() => setHoveredArrow(null)} aria-label={locale === "tr" ? "Önceki öğrenci yorumu" : "Previous testimonial"} style={{ backgroundColor: hoveredArrow === "prev" ? colors.arrowHoverBackground ?? "#819586" : colors.arrowBackground ?? "#10271B", color: colors.arrowForeground ?? "#FFFFFF" }}><FaArrowLeft aria-hidden="true" /></button>
            <span className="counter" aria-live="polite">{safeActiveIndex + 1} / {testimonialsLength}</span>
            <button type="button" onClick={handleNext} disabled={testimonialsLength < 2} onMouseEnter={() => setHoveredArrow("next")} onMouseLeave={() => setHoveredArrow(null)} aria-label={locale === "tr" ? "Sonraki öğrenci yorumu" : "Next testimonial"} style={{ backgroundColor: hoveredArrow === "next" ? colors.arrowHoverBackground ?? "#819586" : colors.arrowBackground ?? "#10271B", color: colors.arrowForeground ?? "#FFFFFF" }}><FaArrowRight aria-hidden="true" /></button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .testimonial-container{width:100%;outline:none}.testimonial-container:focus-visible{border-radius:1rem;box-shadow:0 0 0 3px rgba(129,149,134,.35)}.testimonial-grid{display:grid;gap:3rem;align-items:center}.image-container{position:relative;width:100%;height:21rem;perspective:1000px;overflow:visible}.testimonial-image{position:absolute;inset:0 14%;width:72%;height:100%;overflow:hidden;border:1px solid #DDE4DC;border-radius:1.5rem;background:#E9EFE9;box-shadow:0 18px 45px rgba(16,39,27,.14)}.testimonial-image img{width:100%;height:100%;object-fit:cover}.avatar-fallback{display:flex;width:100%;height:100%;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(145deg,#E9EFE9,#D8E2D8);color:#10271B}.avatar-fallback span{font-family:var(--font-heading),serif;font-size:clamp(3rem,8vw,5rem)}.avatar-fallback small{margin-top:.75rem;font-size:.62rem;letter-spacing:.22em}.testimonial-content{display:flex;min-width:0;flex-direction:column;justify-content:space-between}.name{font-weight:600;margin:0 0 .25rem}.designation{margin:0 0 1.5rem}.quote{line-height:1.75;margin:0}.quote span{display:inline-block}.arrow-buttons{display:flex;align-items:center;gap:.8rem;padding-top:2rem}.arrow-buttons button{display:flex;width:2.75rem;height:2.75rem;align-items:center;justify-content:center;border:0;border-radius:999px;cursor:pointer;transition:background-color .25s,transform .2s}.arrow-buttons button:hover{transform:translateY(-2px)}.arrow-buttons button:focus-visible{outline:2px solid #819586;outline-offset:3px}.arrow-buttons button:disabled{cursor:not-allowed;opacity:.45}.counter{min-width:3.5rem;text-align:center;font-size:.75rem;color:#68756C}@media(min-width:768px){.testimonial-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:5rem}.arrow-buttons{padding-top:2.5rem}}@media(max-width:767px){.testimonial-grid{gap:2rem}.image-container{height:18rem}.testimonial-image{inset:0 12%;width:76%}}@media(max-width:389px){.image-container{height:16rem}.testimonial-image{border-radius:1.2rem}.quote{font-size:1rem!important}}@media(prefers-reduced-motion:reduce){.arrow-buttons button{transition:none}.arrow-buttons button:hover{transform:none}}
      `}</style>
    </div>
  );
}

export default CircularTestimonials;
