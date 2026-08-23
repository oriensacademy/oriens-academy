"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wave } from "@/components/ui/wave";
import { useCommonContent, useLocale } from "@/content/locale-context";
import { locales } from "@/content/dictionaries";
import { cn } from "@/lib/utils";
import { pathForLocale } from "@/lib/routes";
import { useLanguageTransition } from "@/components/brand/LanguageTransitionProvider";

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
        "relative inline-flex h-9 w-[86px] shrink-0 items-center justify-between rounded-full border border-[#DDE5DC] bg-white p-0.5 text-xs font-semibold font-ui shadow-[0_2px_8px_rgba(16,39,27,0.04)] select-none",
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
            scroll={false}
            aria-current={active ? "page" : undefined}
            onClick={(event) => {
              if (active || transitionActive || event.defaultPrevented) {
                event.preventDefault();
                return;
              }
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              beginLanguageTransition(href);
            }}
            className={cn(
              "relative z-10 flex h-7.5 w-[39px] items-center justify-center rounded-full text-[11px] font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#819586]",
              active
                ? "bg-[#EEF2EC] text-[#10281E] shadow-[0_1px_3px_rgba(16,39,27,0.08)]"
                : "text-[#667085] hover:text-[#10281E] hover:bg-[#F7F9F6]"
            )}
          >
            <span className={cn("transition-opacity duration-150", transitionActive && "opacity-0")}>
              {target.toUpperCase()}
            </span>
          </Link>
        );
      })}
      {transitionActive && (
        <span className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-full bg-white/70" aria-live="polite">
          <Wave className="h-3.5 w-6 text-[#819586]" aria-label={locale === "tr" ? "Dil yükleniyor" : "Loading language"} />
        </span>
      )}
    </div>
  );
}

export default LanguageSwitch;
