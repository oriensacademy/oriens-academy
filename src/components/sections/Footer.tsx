"use client";

import { Mail } from "lucide-react";
import { CompassMark } from "@/components/brand/CompassMark";
import { OriensWordmark } from "@/components/brand/OriensWordmark";
import { LanguageSwitch } from "./LanguageSwitch";
import { useCommonContent, useLocale } from "@/content/locale-context";
import { primaryNavigationPath } from "@/lib/routes";

export function Footer() {
  const { nav, footer } = useCommonContent();
  const locale = useLocale();
  const social = [{ label: footer.socialEmailLabel, href: "mailto:hello@oriens.academy", icon: Mail }];

  return (
    <footer className="border-t border-border py-12 md:py-16">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <a href={`/${locale}`} className="flex items-center gap-2.5" aria-label={nav.homeAriaLabel}>
              <CompassMark size={26} />
              <OriensWordmark size="sm" />
            </a>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{footer.tagline}</p>
          </div>

          <nav aria-label={nav.footerAriaLabel} className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-1">
            {nav.items.map((item) => (
              <a
                key={item.href}
                href={primaryNavigationPath(item.href, locale)}
                className="text-sm text-ink/75 transition-colors duration-200 hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex flex-col gap-4">
            <a
              href="mailto:hello@oriens.academy"
              className="text-sm text-ink/75 transition-colors duration-200 hover:text-ink"
            >
              hello@oriens.academy
            </a>
            <div className="flex items-center gap-4">
              {social.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="text-muted-foreground transition-colors duration-200 hover:text-ink"
                >
                  <s.icon className="size-[18px]" strokeWidth={1.5} aria-hidden="true" />
                </a>
              ))}
            </div>
            <LanguageSwitch />
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} Oriens Academy. {footer.copyright}
          </p>
          <div className="flex gap-6">
            {footer.legal.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="transition-colors duration-200 hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
