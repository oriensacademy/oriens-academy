"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { CompassMark } from "@/components/brand/CompassMark";
import { OriensWordmark } from "@/components/brand/OriensWordmark";
import { LanguageSwitch } from "./LanguageSwitch";
import { ButtonLink } from "@/components/ui/button";
import { useScrolled } from "@/lib/use-scrolled";
import { useCommonContent, useLocale } from "@/content/locale-context";
import { cn } from "@/lib/utils";
import { isPrimaryNavigationActive, primaryNavigationPath } from "@/lib/routes";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function Navbar() {
  const { nav } = useCommonContent();
  const locale = useLocale();
  const pathname = usePathname();
  const scrolled = useScrolled(80);
  const [open, setOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) menuTriggerRef.current?.focus();
      wasOpenRef.current = false;
      return;
    }

    wasOpenRef.current = true;
    const previousOverflow = document.body.style.overflow;
    const background = [headerRef.current, document.querySelector("main"), document.querySelector("footer")]
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
      .map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute("aria-hidden"),
      }));

    document.body.style.overflow = "hidden";
    background.forEach(({ element }) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    requestAnimationFrame(() => closeButtonRef.current?.focus());

    wasOpenRef.current = open;
    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const overlay = overlayRef.current;
      if (!overlay) return;
      const focusable = Array.from(overlay.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => !element.hidden && element.getAttribute("aria-hidden") !== "true"
      );
      if (focusable.length === 0) {
        event.preventDefault();
        overlay.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!overlay.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <header
        ref={headerRef}
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200",
          scrolled ? "border-border bg-surface" : "border-transparent bg-transparent"
        )}
      >
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-6 md:h-18 md:px-12">
          <a href={`/${locale}`} className="flex min-h-11 items-center gap-2.5" aria-label={nav.homeAriaLabel}>
            <CompassMark size={31} interactive />
            <OriensWordmark />
          </a>

          <nav aria-label={nav.primaryAriaLabel} className="hidden xl:block">
            <ul className="flex items-center gap-6 2xl:gap-8">
              {nav.items.map((item) => {
                const active = isPrimaryNavigationActive(item.href, pathname, locale);
                return <li key={item.href}>
                  <a
                    href={primaryNavigationPath(item.href, locale)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "text-sm text-ink/80 decoration-brand-accent underline-offset-[6px] transition-colors duration-200 hover:text-ink hover:underline",
                      active ? "font-semibold underline decoration-2" : "font-medium"
                    )}
                  >
                    {item.label}
                  </a>
                </li>
              })}
            </ul>
          </nav>

          <div className="hidden items-center gap-4 xl:flex">
            <LanguageSwitch />
            <ButtonLink href={`/${locale}#booking`} directional size="lg" className="h-11 px-5 text-[13px]">
              {nav.ctaBook}
              <ArrowRight data-directional-arrow className="size-4" aria-hidden="true" />
            </ButtonLink>
          </div>

          <button
            ref={menuTriggerRef}
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-md text-ink xl:hidden"
            aria-label={nav.openMenu}
            aria-expanded={open}
          >
            <Menu className="size-6" aria-hidden="true" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={overlayRef}
            tabIndex={-1}
            className="fixed inset-0 z-[90] flex flex-col bg-background xl:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={nav.menuDialogLabel}
          >
            <div className="flex h-16 items-center justify-between px-6">
              <span className="flex items-center gap-2.5">
                <CompassMark size={28} />
                <OriensWordmark />
              </span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-md text-ink"
                aria-label={nav.closeMenu}
              >
                <X className="size-6" aria-hidden="true" />
              </button>
            </div>

            <ButtonLink
              href={`/${locale}#booking`}
              onClick={() => setOpen(false)}
              directional
              size="lg"
              className="mx-6 mt-4 h-12 text-base"
            >
              {nav.ctaBook}
              <ArrowRight data-directional-arrow className="size-4" aria-hidden="true" />
            </ButtonLink>

            <nav aria-label={nav.primaryAriaLabel} className="mt-10 flex-1 px-6">
              <ul className="flex flex-col gap-1">
                {nav.items.map((item) => {
                  const active = isPrimaryNavigationActive(item.href, pathname, locale);
                  return <li key={item.href} className="border-b border-border">
                    <a
                      href={primaryNavigationPath(item.href, locale)}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "py-4 font-heading text-2xl text-ink decoration-brand-accent underline-offset-[6px]",
                        active ? "inline-block font-semibold underline decoration-2" : "block font-medium"
                      )}
                    >
                      {item.label}
                    </a>
                  </li>
                })}
              </ul>
            </nav>

            <div className="flex items-center justify-between px-6 py-8">
              <LanguageSwitch />
              <CompassMark size={22} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
