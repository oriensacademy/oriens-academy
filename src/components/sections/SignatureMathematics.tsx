"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Reveal } from "@/components/motion/Reveal";
import { EquationReveal } from "@/components/math/EquationReveal";
import { CoordinateSystem } from "@/components/math/CoordinateSystem";
import { derivative, plotPath, toPixel, type PlotDomain } from "@/components/math/utils";
import { useHomeContent } from "@/content/locale-context";

const domain: PlotDomain = {
  xMin: -4,
  xMax: 4,
  yMin: -2,
  yMax: 6,
  width: 380,
  height: 320,
  padding: 32,
};

const fn = (x: number) => 0.15 * x * x * x - 0.6 * x + 1.5;

export function SignatureMathematics() {
  const { signatureMathematics } = useHomeContent();
  const [x0, setX0] = useState(1.2);
  const prefersReducedMotion = useReducedMotion();
  const skip = !!prefersReducedMotion;

  const curvePath = plotPath(fn, domain, 120);
  const slope = derivative(fn, x0);
  const y0 = fn(x0);

  const tangentX1 = Math.max(domain.xMin, x0 - 2);
  const tangentX2 = Math.min(domain.xMax, x0 + 2);
  const p1 = toPixel(tangentX1, y0 + slope * (tangentX1 - x0), domain);
  const p2 = toPixel(tangentX2, y0 + slope * (tangentX2 - x0), domain);
  const point = toPixel(x0, y0, domain);

  return (
    <section className="section-offset border-t border-border bg-surface-muted py-20 md:py-28">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-14 px-6 md:px-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <Reveal>
            <p className="text-xs font-medium tracking-[0.24em] text-brand-accent uppercase">
              {signatureMathematics.eyebrow}
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 text-[clamp(1.75rem,2.5vw+1rem,2.75rem)] leading-[1.15] font-medium text-ink">
              {signatureMathematics.headline}
            </h2>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink/75">
              {signatureMathematics.body}
            </p>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="mt-10 max-w-sm">
              <label htmlFor="tangent-x" className="text-sm font-medium text-ink">
                {signatureMathematics.sliderLabel}
              </label>
              <input
                id="tangent-x"
                type="range"
                min={-3.4}
                max={3.4}
                step={0.05}
                value={x0}
                onChange={(e) => setX0(Number(e.target.value))}
                className="mt-3 h-11 w-full cursor-pointer accent-[var(--brand-accent)]"
                aria-describedby="tangent-readout"
              />

              <dl id="tangent-readout" className="mt-6 grid grid-cols-3 gap-4 border-t border-border pt-5">
                <div>
                  <dt className="text-xs text-muted-foreground uppercase">
                    {signatureMathematics.readout.point}
                  </dt>
                  <dd className="mt-1">
                    <EquationReveal latex={`x_0 = ${x0.toFixed(2)}`} className="text-base" />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground uppercase">
                    {signatureMathematics.readout.value}
                  </dt>
                  <dd className="mt-1">
                    <EquationReveal latex={`f(x_0) = ${y0.toFixed(2)}`} className="text-base" />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground uppercase">
                    {signatureMathematics.readout.slope}
                  </dt>
                  <dd className="mt-1">
                    <EquationReveal latex={`f'(x_0) = ${slope.toFixed(2)}`} className="text-base" />
                  </dd>
                </div>
              </dl>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="mx-auto w-full max-w-[420px]">
          <div className="border border-border bg-surface p-6">
            <CoordinateSystem domain={domain}>
              <path
                d={curvePath}
                fill="none"
                stroke="var(--secondary)"
                strokeWidth={2}
                strokeLinecap="round"
              />
              <motion.line
                initial={false}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="var(--brand-accent)"
                strokeWidth={2}
                strokeLinecap="round"
                animate={{ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }}
                transition={{ duration: skip ? 0 : 0.25, ease: "easeOut" }}
              />
              <motion.circle
                initial={false}
                r={4.5}
                fill="var(--surface)"
                stroke="var(--brand-accent)"
                strokeWidth={2}
                animate={{ cx: point.x, cy: point.y }}
                transition={{ duration: skip ? 0 : 0.25, ease: "easeOut" }}
              />
            </CoordinateSystem>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
