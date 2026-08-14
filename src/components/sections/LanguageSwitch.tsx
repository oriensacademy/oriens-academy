"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
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
        "relative inline-grid h-10 w-24 shrink-0 grid-cols-2 items-center overflow-hidden rounded-full border border-[#DDE5DC] bg-white p-1 text-xs font-semibold font-ui shadow-[0_2px_8px_rgba(16,39,27,0.04)]",
        className
      )}
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute top-1 left-1 z-0 h-8 w-[calc(50%_-_4px)] rounded-full bg-[#EEF2EC] shadow-[0_1px_3px_rgba(16,39,27,0.08)]"
        animate={{ x: locale === "tr" ? "0%" : "100%" }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      />
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
              "relative z-10 flex h-8 w-full items-center justify-center rounded-full text-[11px] font-bold tracking-wider uppercase transition-colors duration-200 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#819586] focus-visible:ring-inset",
              active ? "text-[#10281E]" : "text-[#667085] hover:text-[#10281E]"
            )}
          >
            <span className={cn("transition-opacity duration-150", transitionActive && "opacity-0")}>
              {target.toUpperCase()}
            </span>
          </Link>
        );
      })}
      {transitionActive && (
        <span className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" aria-live="polite">
          <Wave className="h-4 w-7 text-[#819586]" aria-label={locale === "tr" ? "Dil yükleniyor" : "Loading language"} />
        </span>
      )}
    </div>
  );
}

export default LanguageSwitch;
