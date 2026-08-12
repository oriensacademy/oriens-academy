"use client";

import { motion, useReducedMotion } from "motion/react";
import { AnimatedParabola } from "@/components/math/AnimatedParabola";
import { FunctionPlot } from "@/components/math/FunctionPlot";
import { VectorAnimation } from "@/components/math/VectorAnimation";
import type { ExamVisualVariant } from "@/content/exams";

const domain = { xMin: -4, xMax: 4, yMin: -3, yMax: 4, width: 520, height: 310, padding: 28 };

function RouteVisual() {
  const reduced = useReducedMotion();
  return (
    <svg viewBox="0 0 520 310" className="h-auto w-full" fill="none" aria-hidden="true">
      <g stroke="var(--border)">{[72, 156, 240, 324, 408].map((x) => <line key={x} x1={x} y1="22" x2={x} y2="288" />)}</g>
      <motion.path d="M34 254 C118 254 112 176 198 176 S288 226 346 144 S430 62 486 62" stroke="var(--secondary)" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 7" initial={{ pathLength: reduced ? 1 : 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: reduced ? 0 : 1.05, ease: [0.22, 1, 0.36, 1] }} />
      {[[34,254],[198,176],[346,144]].map(([x,y], index) => <circle key={index} cx={x} cy={y} r="4" fill="var(--background)" stroke="var(--ink)" strokeWidth="1.5" />)}
      <circle cx="486" cy="62" r="7" fill="var(--brand-accent)" />
    </svg>
  );
}

function GeometryVisual() {
  const reduced = useReducedMotion();
  return (
    <svg viewBox="0 0 520 310" className="h-auto w-full" fill="none" aria-hidden="true">
      <circle cx="260" cy="155" r="112" stroke="var(--border)" />
      <circle cx="260" cy="155" r="74" stroke="var(--secondary)" strokeWidth="1.5" />
      {[0, 60, 120].map((degree) => <line key={degree} x1="260" y1="31" x2="260" y2="279" stroke="var(--border)" style={{ transformOrigin: "260px 155px", rotate: `${degree}deg` }} />)}
      <motion.path d="M188 210 L260 81 L354 197 Z" stroke="var(--brand-accent)" strokeWidth="2" initial={{ pathLength: reduced ? 1 : 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: reduced ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }} />
      <circle cx="260" cy="155" r="4" fill="var(--ink)" />
    </svg>
  );
}

export function ExamDetailVisual({ variant, label }: { variant: ExamVisualVariant; label: string }) {
  return (
    <div role="img" aria-label={label} className="relative mx-auto w-full max-w-[560px]">
      <span className="sr-only">{label}</span>
      {variant === "coordinate" && <AnimatedParabola domain={domain} showVertex />}
      {variant === "vector" && <VectorAnimation domain={domain} from={{ x: -2.6, y: -1.5 }} to={{ x: 2.8, y: 2.4 }} />}
      {variant === "function" && <FunctionPlot domain={{ xMin: 0, xMax: 10, yMin: 0, yMax: 5, width: 520, height: 310, padding: 28 }} />}
      {variant === "geometry" && <GeometryVisual />}
      {variant === "route" && <RouteVisual />}
      {variant === "coordinate" && <span className="absolute right-6 bottom-5 text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">f(x) → target</span>}
      {variant !== "coordinate" && variant !== "vector" && variant !== "function" && <span className="absolute right-6 bottom-5 text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">origin → direction</span>}
      {variant === "vector" && <span className="absolute right-6 bottom-5 text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">v → destination</span>}
      {variant === "function" && <span className="absolute right-6 bottom-5 text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">progress / time</span>}
    </div>
  );
}
