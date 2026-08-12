"use client";

import { Reveal } from "@/components/motion/Reveal";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { useHomeContent } from "@/content/locale-context";
import { cn } from "@/lib/utils";

export function PricingPreview() {
  const { pricingPreview } = useHomeContent();
  return (
    <section id="pricing" className="section-offset py-20 md:py-28">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        <div className="max-w-2xl">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.24em] text-brand-accent uppercase">
              {pricingPreview.eyebrow}
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 text-[clamp(1.75rem,2.5vw+1rem,2.75rem)] leading-[1.15] font-medium text-ink">
              {pricingPreview.headline}
            </h2>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-5 text-lg leading-relaxed text-ink/75">{pricingPreview.body}</p>
          </Reveal>
        </div>

        <StaggerGroup className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {pricingPreview.tiers.map((tier) => (
            <StaggerItem key={tier.id}>
              <div
                className={cn(
                  "flex h-full flex-col rounded-lg border bg-surface p-7",
                  tier.featured ? "border-2 border-brand-accent" : "border-border"
                )}
              >
                {tier.featured && (
                  <span className="mb-4 inline-block w-fit rounded-sm bg-brand-accent px-2.5 py-1 text-[11px] font-medium tracking-[0.06em] text-brand-accent-foreground uppercase">
                    {pricingPreview.featuredTag}
                  </span>
                )}
                <h3 className="font-heading text-2xl text-ink">{tier.name}</h3>
                <p className="mt-2 text-sm text-ink/70">{tier.description}</p>

                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="font-heading text-3xl text-ink">{tier.price}</span>
                  {tier.cadence && (
                    <span className="text-sm text-muted-foreground">{tier.cadence}</span>
                  )}
                </div>

                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-ink/80">
                      <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-secondary" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <ButtonLink
                  href="#booking"
                  directional
                  variant={tier.featured ? "default" : "outline"}
                  size="lg"
                  className="mt-8 h-11 w-full"
                >
                  {pricingPreview.ctaLabel}
                  <ArrowRight data-directional-arrow className="size-4" aria-hidden="true" />
                </ButtonLink>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
