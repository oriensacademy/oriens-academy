"use client";

import { motion, useReducedMotion } from "motion/react";
import { CoordinateSystem } from "@/components/math/CoordinateSystem";
import { plotPath, toPixel, type PlotDomain } from "@/components/math/utils";

const domain: PlotDomain = {
  xMin: -2.4,
  xMax: 3,
  yMin: -2,
  yMax: 2.6,
  width: 620,
  height: 420,
  padding: 34,
};

const fn = (x: number) => 0.35 * x * x - 1;
const focusX = 1.2;
const focusY = fn(focusX);
const slope = 0.7 * focusX;
const tangent = (x: number) => focusY + slope * (x - focusX);

type AcademicDepthVisualProps = {
  ariaLabel: string;
  labels: { function: string; tangent: string; point: string };
  note?: string;
  compact?: boolean;
};

export function AcademicDepthVisual({ ariaLabel, labels, note, compact = false }: AcademicDepthVisualProps) {
  const reducedMotion = useReducedMotion();
  const skip = !!reducedMotion;
  const point = toPixel(focusX, focusY, domain);
  const guide = toPixel(focusX, 0, domain);
  const functionLabel = toPixel(-1.8, fn(-1.8), domain);
  const tangentLabel = toPixel(2.25, tangent(2.25), domain);

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="relative w-full min-w-0 max-w-full overflow-hidden border border-border bg-surface p-4 sm:p-6"
    >
      <div className="mb-4 flex min-h-6 items-center justify-between gap-4 border-b border-border pb-3">
        <span className="font-heading text-sm text-secondary">f(x) = 0.35x² − 1</span>
        <span className="hidden text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase sm:block">
          {note}
        </span>
      </div>
      <CoordinateSystem domain={domain} className={compact ? "max-h-[20rem]" : "max-h-[28rem]"}>
        <motion.path
          d={plotPath(fn, domain)}
          fill="none"
          stroke="var(--secondary)"
          strokeWidth={2.4}
          strokeLinecap="round"
          initial={{ pathLength: skip ? 1 : 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: skip ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.path
          d={plotPath(tangent, domain, 2)}
          fill="none"
          stroke="var(--brand-accent)"
          strokeWidth={2}
          strokeLinecap="round"
          initial={{ pathLength: skip ? 1 : 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: skip ? 0 : 0.75, delay: skip ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.line
          x1={point.x}
          y1={point.y}
          x2={guide.x}
          y2={guide.y}
          stroke="var(--brand-accent)"
          strokeWidth={1}
          strokeDasharray="5 5"
          initial={{ opacity: skip ? 1 : 0 }}
          whileInView={{ opacity: 0.8 }}
          viewport={{ once: true }}
          transition={{ duration: skip ? 0 : 0.35, delay: skip ? 0 : 0.65 }}
        />
        <motion.circle
          cx={point.x}
          cy={point.y}
          r={5}
          fill="var(--surface)"
          stroke="var(--brand-accent)"
          strokeWidth={2.5}
          initial={{ opacity: skip ? 1 : 0, scale: skip ? 1 : 0 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: skip ? 0 : 0.35, delay: skip ? 0 : 0.7 }}
        />
        {!compact && (
          <>
            <text x={functionLabel.x - 8} y={functionLabel.y - 12} fill="var(--secondary)" fontSize="13">{labels.function}</text>
            <text x={tangentLabel.x - 8} y={tangentLabel.y - 10} fill="var(--brand-accent)" fontSize="13">{labels.tangent}</text>
            <text x={point.x + 12} y={point.y + 22} fill="var(--ink)" fontSize="12">x₀ = 1.2 · {labels.point}</text>
          </>
        )}
      </CoordinateSystem>
      <div className="mt-4 grid grid-cols-2 border-t border-border pt-4 text-xs text-muted-foreground sm:grid-cols-3">
        <span>f′(x) = 0.7x</span>
        <span>x₀ = 1.2</span>
        <span className="hidden text-right sm:block">f′(x₀) = 0.84</span>
      </div>
    </div>
  );
}
