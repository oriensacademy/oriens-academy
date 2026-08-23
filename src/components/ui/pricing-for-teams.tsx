"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PricingCardProps {
  planName: string;
  price: string;
  currency?: string;
  priceFrequency?: string;
  description?: string;
  features?: string[];
  ctaText: string;
  href: string;
  isFeatured?: boolean;
  featuredLabel?: string;
  className?: string;
}

export function PricingCard({
  planName,
  price,
  currency = "TL",
  priceFrequency,
  description,
  features,
  ctaText,
  href,
  isFeatured = false,
  featuredLabel = "Featured",
  className,
}: PricingCardProps) {
  const isInternal = href.startsWith("/");

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between h-full p-8 bg-surface rounded-2xl shadow-sm transition-all duration-300 hover:shadow-md border",
        isFeatured ? "border-primary ring-1 ring-primary/30" : "border-border",
        className
      )}
    >
      {isFeatured && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground shadow-sm font-ui">
          {featuredLabel}
        </div>
      )}

      <div className="flex-grow">
        <h3 className="text-2xl font-serif font-semibold text-ink">
          {planName}
        </h3>

        {description && (
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed font-sans">
            {description}
          </p>
        )}

        <div className="mt-6 flex items-baseline gap-1.5">
          <span className="text-4xl sm:text-5xl font-bold tracking-tight text-ink font-sans tabular-nums">
            {price}
          </span>
          {currency && (
            <span className="text-lg font-bold text-ink font-sans">
              {currency}
            </span>
          )}
          {priceFrequency && (
            <span className="ml-1 text-sm font-medium text-muted-foreground font-sans">
              {priceFrequency}
            </span>
          )}
        </div>

        {features && features.length > 0 && (
          <ul className="mt-8 space-y-3.5 border-t border-border pt-6">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary mt-0.5" />
                <span className="ml-3 text-sm text-ink font-sans leading-snug">
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        {isInternal ? (
          <Link
            href={href}
            className={cn(
              "inline-flex items-center justify-center w-full px-5 py-3 text-sm font-medium font-ui rounded-xl text-center transition-colors duration-200 shadow-sm",
              isFeatured
                ? "bg-primary text-primary-foreground hover:bg-secondary"
                : "bg-ink text-surface hover:bg-secondary"
            )}
          >
            {ctaText}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        ) : (
          <a
            href={href}
            className={cn(
              "inline-flex items-center justify-center w-full px-5 py-3 text-sm font-medium font-ui rounded-xl text-center transition-colors duration-200 shadow-sm",
              isFeatured
                ? "bg-primary text-primary-foreground hover:bg-secondary"
                : "bg-ink text-surface hover:bg-secondary"
            )}
          >
            {ctaText}
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}

export default PricingCard;
