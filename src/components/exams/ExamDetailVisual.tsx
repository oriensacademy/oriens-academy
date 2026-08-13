"use client";

import { motion, useReducedMotion } from "motion/react";
import { AnimatedParabola } from "@/components/math/AnimatedParabola";
import { FunctionPlot } from "@/components/math/FunctionPlot";
import { VectorAnimation } from "@/components/math/VectorAnimation";
import type { ExamCode, ExamVisualVariant } from "@/content/exams";

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

const signaturePaths: Record<ExamCode, string> = {
  IB: "M8 34 C19 8 45 8 56 34 C45 58 19 58 8 34Z M15 34H49 M32 12V56",
  AP: "M8 51H56 M14 47V35 M25 47V25 M36 47V16 M47 47V8",
  SAT: "M8 12H56V54H8Z M24 12V54 M40 12V54 M8 26H56 M8 40H56",
  ESAT: "M8 48L23 19L34 42L45 12L56 48 M13 48H51",
  TARA: "M8 16H33 M33 16L25 9 M33 16L25 23 M33 16V47 M33 47H56",
  TMUA: "M8 49L25 18L39 40L56 12 M25 18L56 49",
  IGCSE: "M9 12H27V30H9Z M37 12H55V30H37Z M9 38H27V56H9Z M37 38H55V56H37Z",
  GRE: "M8 50C18 50 18 37 28 37S38 24 47 24H56 M50 18L56 24L50 30",
  GMAT: "M8 50V36H20V25H33V15H46V8H56 M8 50H56",
  UKCAT: "M8 33H21L27 19L37 47L43 33H56",
  IMAT: "M32 8V56 M8 32H56 M16 16L48 48 M48 16L16 48",
  OMPT: "M8 48C18 14 45 14 56 48 M8 48H56 M32 16V48",
};

function ExamSignature({ code, reduced }: { code: ExamCode; reduced: boolean }) {
  return <div className="absolute top-4 right-4 z-10 rounded-xl border border-border bg-background/85 p-2.5 backdrop-blur-sm" aria-hidden="true"><svg viewBox="0 0 64 64" className="size-12 fill-none"><motion.path d={signaturePaths[code]} stroke="var(--brand-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : 0.75, ease: [0.22, 1, 0.36, 1] }} /></svg><span className="mt-1 block text-center text-[8px] font-bold tracking-[0.18em] text-secondary">{code}</span></div>;
}

export function ExamDetailVisual({ variant, label, code }: { variant: ExamVisualVariant; label: string; code: ExamCode }) {
  const reduced = !!useReducedMotion();
  return (
    <div role="img" aria-label={label} className="relative mx-auto w-full max-w-[560px]">
      <span className="sr-only">{label}</span>
      <ExamSignature code={code} reduced={reduced} />
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
