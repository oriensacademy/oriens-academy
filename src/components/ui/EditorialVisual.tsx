"use client";

import React from "react";
import Image from "next/image";
import { CompassMark } from "@/components/brand/CompassMark";
import { cn } from "@/lib/utils";

export interface EditorialVisualProps {
  imageSrc?: string;
  imageAlt?: string;
  badge?: string;
  title?: string;
  subtitle?: string;
  aspectRatio?: "square" | "video" | "portrait" | "wide";
  variant?: "compass" | "card" | "frame";
  className?: string;
  children?: React.ReactNode;
}

export function EditorialVisual({
  imageSrc,
  imageAlt = "Oriens Academic Visual",
  badge,
  title,
  subtitle,
  aspectRatio = "wide",
  variant = "card",
  className,
  children,
}: EditorialVisualProps) {
  const aspectClasses = {
    square: "aspect-square",
    video: "aspect-video",
    portrait: "aspect-[3/4]",
    wide: "aspect-[16/9] sm:aspect-[21/9]",
  };
  const variantClasses = {
    compass: "bg-sage-soft/55",
    card: "bg-surface-muted/60",
    frame: "bg-card ring-1 ring-border/60",
  };

  return (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden rounded-2xl border border-border p-6 sm:p-8 shadow-xs",
        variantClasses[variant],
        aspectClasses[aspectRatio],
        className
      )}
    >
      {/* Decorative Grid Lines */}
      <div className="absolute inset-0 opacity-40 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-y-0 left-1/3 border-l border-dashed border-border" />
        <div className="absolute inset-y-0 right-1/3 border-r border-dashed border-border" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
      </div>

      {imageSrc ? (
        <div className="relative w-full h-full rounded-xl overflow-hidden">
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            className="object-cover"
          />
        </div>
      ) : children ? (
        <div className="relative z-10 flex flex-col justify-center h-full">
          {children}
        </div>
      ) : (
        /* Prepared Academic Editorial Visual Slot */
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center space-y-3">
          <div className="size-16 rounded-2xl bg-surface border border-border flex items-center justify-center shadow-xs">
            <CompassMark size={36} interactive />
          </div>

          {badge && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary font-ui">
              {badge}
            </span>
          )}

          {title && (
            <h4 className="text-xl md:text-2xl font-serif font-bold text-ink max-w-md leading-tight">
              {title}
            </h4>
          )}

          {subtitle && (
            <p className="text-xs md:text-sm text-muted-foreground font-sans max-w-sm leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default EditorialVisual;
