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
        "relative inline-grid grid-cols-2 items-center rounded-full border border-[#D8E0D8] bg-white p-1 text-xs font-semibold font-ui shadow-[0_2px_8px_rgba(16,39,27,0.04)]",
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
              "relative z-10 flex h-8 min-w-10 items-center justify-center rounded-full px-2.5 text-[11px] font-bold tracking-wider uppercase transition-colors duration-200 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#819586] focus-visible:ring-offset-2",
              active ? "text-[#10281E]" : "text-[#667085] hover:text-[#10281E]"
            )}
          >
            {active && (
              <motion.div
                layoutId="activeLangPill"
                className="absolute inset-0 -z-10 rounded-full bg-[#E9EFE9] shadow-xs"
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
            {transitionActive && !active ? (
              <Wave className="h-4 w-7 text-[#819586] motion-reduce:hidden" aria-label={target === "tr" ? "Dil yükleniyor" : "Loading language"} />
            ) : (
              <span>{target.toUpperCase()}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export default LanguageSwitch;
