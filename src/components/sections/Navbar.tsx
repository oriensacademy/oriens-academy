"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Menu, ShoppingBag, UserRound, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { CompassMark } from "@/components/brand/CompassMark";
import { LanguageSwitch } from "./LanguageSwitch";
import { ButtonLink } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { useScrolled } from "@/lib/use-scrolled";
import { useCommonContent, useLocale } from "@/content/locale-context";
import { cn } from "@/lib/utils";
import { isPrimaryNavigationActive, localizedPath } from "@/lib/routes";
import { useAccount } from "@/lib/auth/account-context";
import { useCart } from "@/lib/cart/cart-context";
import { usePublicSettings } from "@/lib/settings/public-settings-context";
import { unifiedLoginPath } from "@/lib/routes";
import { Wave } from "@/components/ui/wave";
import { publicNavigation } from "@/lib/public-navigation";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { LogoutConfirmationModal } from "@/components/auth/LogoutConfirmationModal";
import { lockBodyScroll } from "@/lib/dom/body-scroll-lock";

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
  const { accountType, isInitializing, signOut } = useAccount();
  const router = useRouter();
  const { cartCount } = useCart();
  const { showPricing } = usePublicSettings();
  const scrolled = useScrolled(80);
  const [open, setOpen] = useState(false);
  const [mobileLogoutOpen, setMobileLogoutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const isStudent = accountType === "student";
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const headerTabs = useMemo(
    () => publicNavigation(locale, showPricing).filter((item) => item.id !== "contact").map((item) => ({ id: item.href, label: item.label })),
    [locale, showPricing],
  );
  const accountHref = accountType === "admin" ? "/admin" : accountType === "student" ? localizedPath("studentAccount", locale) : unifiedLoginPath(locale);
  const accountLabel = accountType === "student" ? (locale === "tr" ? "Hesabım" : "My Account") : accountType === "admin" ? (locale === "tr" ? "Hesap" : "Account") : (locale === "tr" ? "Giriş Yap" : "Sign In");
  const mobileItems = useMemo(() => [
    ...publicNavigation(locale, showPricing),
    ...(showPricing && (cartCount > 0 || isStudent) ? [{ href: localizedPath("cart", locale), label: locale === "tr" ? `Sepetim (${cartCount})` : `My Cart (${cartCount})` }] : []),
    ...(!isStudent ? [{ href: accountHref, label: accountLabel }] : []),
  ], [accountHref, accountLabel, cartCount, isStudent, locale, showPricing]);
  const activeTab = headerTabs.find((tab) =>
    isPrimaryNavigationActive(tab.id, pathname, locale),
  )?.id;

  const isCartActive = pathname === localizedPath("cart", locale) || pathname.startsWith(`/${locale}/sepet`) || pathname.startsWith(`/${locale}/cart`);
  const isAccountActive =
    (accountType === "admin" && pathname.startsWith("/admin")) ||
    (accountType === "student" && (
      pathname === localizedPath("studentAccount", locale) ||
      pathname.startsWith(`/${locale}/hesabim`) ||
      pathname.startsWith(`/${locale}/account`)
    ));

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) menuTriggerRef.current?.focus();
      wasOpenRef.current = false;
      return;
    }

    wasOpenRef.current = true;
    const unlockBodyScroll = lockBodyScroll();
    const background = [headerRef.current, document.querySelector("main"), document.querySelector("footer")]
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
      .map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute("aria-hidden"),
      }));

    background.forEach(({ element }) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    requestAnimationFrame(() => closeButtonRef.current?.focus());

    wasOpenRef.current = open;
    return () => {
      unlockBodyScroll();
      background.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
    };
  }, [open]);

  async function confirmMobileLogout() {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    router.replace(localizedPath("home", locale));
  }

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
          scrolled ? "border-border/80 bg-background/90 backdrop-blur-md shadow-[0_2px_12px_rgba(16,39,27,0.04)]" : "border-transparent bg-transparent"
        )}
      >
        <div className="mx-auto flex h-[72px] max-w-[1360px] items-center px-[clamp(24px,5vw,72px)] md:h-20">
          <Link href={localizedPath("home", locale)} className="relative z-10 flex min-h-11 shrink-0 items-center" aria-label={nav.homeAriaLabel}>
            <Image
              src="/brand/oriens-logo-v2.png"
              alt="Oriens Academy"
              width={217}
              height={80}
              className="h-auto w-[116px] object-contain md:w-[155px]"
              priority
            />
          </Link>

          <nav aria-label={nav.primaryAriaLabel} className="ml-12 hidden xl:block 2xl:ml-16">
            <Tabs
              tabs={headerTabs}
              activeTab={activeTab}
            />
          </nav>

          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <div className="flex items-center gap-3">
              <LanguageSwitch />
              {showPricing && (cartCount > 0 || isStudent) && (
                <Link
                  href={localizedPath("cart", locale)}
                  aria-current={isCartActive ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-11 min-w-11 items-center justify-center rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isCartActive
                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/25 shadow-xs"
                      : "border-border text-ink hover:bg-surface-muted"
                  )}
                  aria-label={locale === "tr" ? `Sepetim (${cartCount})` : `My Cart (${cartCount})`}
                >
                  <ShoppingBag className="size-4" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shadow-xs">
                      {cartCount}
                    </span>
                  )}
                </Link>
              )}
              {isInitializing ? (
                <span className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border" aria-label="Oriens Academy">
                  <Wave className="h-4 w-8 text-primary" aria-label="Oriens Academy" />
                </span>
              ) : isStudent ? (
                <AccountMenu locale={locale} active={isAccountActive} />
              ) : (
                <Link
                  href={accountHref}
                  aria-current={isAccountActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 min-w-fit shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border px-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isAccountActive
                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/25 shadow-xs"
                      : "border-border text-ink hover:bg-surface-muted",
                    accountType === "admin" && "size-11 px-0"
                  )}
                  aria-label={accountLabel}
                >
                  <UserRound className="size-4" />
                  {accountType !== "admin" && <span className="hidden sm:inline">{accountLabel}</span>}
                </Link>
              )}
              <ButtonLink href={`/${locale}#consultation-form`} directional size="lg" className="hidden h-11 px-5 text-[13px] xl:flex">
                {nav.ctaBook}
                <ArrowRight data-directional-arrow className="size-4" aria-hidden="true" />
              </ButtonLink>
            </div>
          </div>

          <button
            ref={menuTriggerRef}
            type="button"
            onClick={() => setOpen(true)}
            className="ml-1 flex h-11 w-11 items-center justify-center rounded-md text-ink xl:hidden"
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
            className="fixed inset-y-0 right-0 z-[90] flex w-[min(88vw,380px)] flex-col border-l border-border bg-background shadow-[-20px_0_60px_rgba(16,39,27,0.16)] xl:hidden"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={nav.menuDialogLabel}
          >
            <div className="flex h-16 items-center justify-between px-6">
              <Link href={localizedPath("home", locale)} onClick={() => setOpen(false)} className="flex items-center" aria-label={nav.homeAriaLabel}>
                <Image
                  src="/brand/oriens-logo-v2.png"
                  alt="Oriens Academy"
                  width={174}
                  height={64}
                  className="h-auto w-[116px] object-contain"
                />
              </Link>
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
              href={`/${locale}#consultation-form`}
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
                {mobileItems.map((item) => {
                  const active = isPrimaryNavigationActive(item.href, pathname, locale);
                  return <li key={item.href} className="border-b border-border">
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "py-4 font-heading text-2xl text-ink decoration-brand-accent underline-offset-[6px]",
                        active ? "inline-block font-semibold underline decoration-2" : "block font-medium"
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                })}
                {isStudent && <AccountMenu locale={locale} mobile onNavigate={() => setOpen(false)} onRequestLogout={() => { setOpen(false); setMobileLogoutOpen(true); }} />}
              </ul>
            </nav>

            <div className="flex items-center justify-between px-6 py-8">
              <LanguageSwitch />
              <CompassMark size={22} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <LogoutConfirmationModal open={mobileLogoutOpen} signingOut={signingOut} locale={locale} returnFocusRef={menuTriggerRef} onCancel={() => setMobileLogoutOpen(false)} onConfirm={confirmMobileLogout} />
    </>
  );
}
