"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCommonContent, useLocale } from "@/content/locale-context";
import { locales } from "@/content/dictionaries";
import { cn } from "@/lib/utils";
import { pathForLocale } from "@/lib/routes";
import { useLanguageTransition } from "@/components/brand/LanguageTransitionProvider";

/**
 * A real TR/EN switch: navigates to the equivalent page in the other
 * locale via actual `<Link>`s (crawlable, works with JS disabled), with
 * the active language derived from the current route rather than local
 * state. Locale-specific route slugs are mapped explicitly so equivalent
 * pages remain connected as the site grows.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const locale = useLocale();
  const { nav } = useCommonContent();
  const pathname = usePathname() ?? `/${locale}`;
  const { active: transitionActive, beginLanguageTransition } = useLanguageTransition();

  return (
    <div
      role="group"
      aria-label={nav.languageAriaLabel}
      className={cn(
        "inline-flex items-center rounded-full border border-border p-0.5 text-xs font-medium",
        className
      )}
    >
      {locales.map((target) => {
        const active = locale === target;
        const href = pathForLocale(pathname, target);
        return (
          <Link
            key={target}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={(event) => {
              if (
                active ||
                transitionActive ||
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) return;

              event.preventDefault();
              beginLanguageTransition(href);
            }}
            className={cn(
              "flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 py-2 uppercase transition-colors duration-200",
              active ? "bg-ink text-background" : "text-muted-foreground hover:text-ink"
            )}
          >
            {target}
          </Link>
        );
      })}
    </div>
  );
}
