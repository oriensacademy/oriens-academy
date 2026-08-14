"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "motion/react";
import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "relative flex flex-col justify-between h-full w-full overflow-hidden rounded-[20px] p-8 shadow-editorial transition-all duration-300 hover:shadow-editorial-hover border border-[#DDE4DC] bg-card",
  {
    variants: {
      gradient: {
        navy: "bg-gradient-to-br from-[#F2F5EF] to-[#E8EEE8]",
        blue: "bg-gradient-to-br from-[#F7F8F3] to-[#EEF1E8]",
        indigo: "bg-gradient-to-br from-[#F4F6F1] to-[#E5EBE4]",
        gold: "bg-gradient-to-br from-[#FAF9F4] to-[#EEEBDD]",
      },
    },
    defaultVariants: {
      gradient: "navy",
    },
  }
);

export interface GradientCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  badgeText: string;
  badgeColor?: string;
  title: string;
  description: string;
  ctaText: string;
  ctaHref: string;
  imageUrl?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const GradientCard = React.forwardRef<HTMLDivElement, GradientCardProps>(
  (
    {
      className,
      gradient,
      badgeText,
      badgeColor = "var(--primary)",
      title,
      description,
      ctaText,
      ctaHref,
      imageUrl,
      icon: IconComponent = BookOpen,
      ...props
    },
    ref
  ) => {
    const cardAnimation = {
      rest: { scale: 1, y: 0 },
      hover: { scale: 1.02, y: -4 },
    };

    const imageAnimation = {
      rest: { scale: 1, rotate: 0 },
      hover: { scale: 1.08, rotate: 2 },
    };

    const isInternal = ctaHref.startsWith("/");

    return (
      <motion.div
        variants={cardAnimation}
        initial="rest"
        whileHover="hover"
        animate="rest"
        className="h-full"
        ref={ref}
      >
        <div className={cn(cardVariants({ gradient }), className)} {...props}>
          {/* Decorative graphic background */}
          {imageUrl ? (
            <motion.img
              src={imageUrl}
              alt={`${title} background graphic`}
              variants={imageAnimation}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 15,
              }}
              className="absolute -right-1/4 -bottom-1/4 w-3/4 opacity-40 pointer-events-none"
            />
          ) : (
            <motion.div
              variants={imageAnimation}
              className="absolute -right-8 -bottom-8 opacity-15 pointer-events-none text-primary"
            >
              <IconComponent className="size-48 stroke-1" />
            </motion.div>
          )}

          <div className="z-10 flex flex-col h-full">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-surface/80 border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wider text-ink backdrop-blur-sm w-fit font-ui">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: badgeColor }}
              />
              {badgeText}
            </div>

            <div className="flex-grow">
              <h3 className="text-2xl font-serif font-semibold text-ink mb-2 leading-tight">
                {title}
              </h3>

              <p className="text-sm text-muted-foreground max-w-xs font-sans leading-relaxed">
                {description}
              </p>
            </div>

            {isInternal ? (
              <Link
                href={ctaHref}
                className="group mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink hover:text-primary font-ui transition-colors"
              >
                {ctaText}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            ) : (
              <a
                href={ctaHref}
                className="group mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink hover:text-primary font-ui transition-colors"
              >
                {ctaText}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </a>
            )}
          </div>
        </div>
      </motion.div>
    );
  }
);

GradientCard.displayName = "GradientCard";

export { GradientCard, cardVariants };
