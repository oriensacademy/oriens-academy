"use client";

import { CompassMark } from "@/components/brand/CompassMark";
import { RouteLine } from "@/components/brand/RouteLine";

type GuidanceRouteVisualProps = {
  ariaLabel: string;
  steps: string[];
  compact?: boolean;
};

export function GuidanceRouteVisual({ ariaLabel, steps, compact = false }: GuidanceRouteVisualProps) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="relative min-w-0 overflow-hidden border-y border-border bg-surface px-5 py-8 sm:px-8 sm:py-10"
    >
      <div className="absolute inset-0 opacity-55" aria-hidden="true">
        <div className="absolute inset-y-0 left-1/4 border-l border-dashed border-border" />
        <div className="absolute inset-y-0 left-3/4 border-l border-dashed border-border" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
      </div>
      <div className={compact ? "relative h-48 sm:h-64" : "relative h-56 sm:h-[300px]"}>
        <RouteLine
          d="M28 240 C92 232 95 132 166 145 C238 159 236 63 365 54"
          start={{ x: 28, y: 240 }}
          end={{ x: 365, y: 54 }}
          viewBox="0 0 400 290"
          className="absolute inset-0 h-full w-full"
          strokeWidth={1.8}
          dashed={false}
          duration={1.05}
        />
        <div className="absolute top-[39%] left-[36%] -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
          <CompassMark size={compact ? 68 : 82} rotation={28} animated animationDelay={0.16} />
        </div>
      </div>
      <ol className="relative grid grid-cols-2 border-t border-border sm:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step} className="flex min-h-14 items-center gap-2 border-b border-border py-3 pr-3 text-[10px] font-medium tracking-[0.1em] text-secondary uppercase odd:pl-3 sm:border-b-0 sm:border-r sm:pl-3 sm:first:pl-0 sm:last:border-r-0">
            <span className="text-brand-accent">{String(index + 1).padStart(2, "0")}</span>{step}
          </li>
        ))}
      </ol>
    </div>
  );
}
