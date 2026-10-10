"use client";

import { useEffect, type RefObject } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSiteContact } from "@/lib/contact-settings";

/** TR routes rendered as literal ports of the customer's reference HTML files. */
export const REFERENCE_ROUTES = ["/tr/giris/", "/tr/ucretler/", "/tr/hakkimizda/"] as const;

export function isReferenceRoute(pathname: string | null | undefined) {
  if (!pathname) return false;
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return (REFERENCE_ROUTES as readonly string[]).includes(normalized);
}

/** Renders the floating docks everywhere except the reference routes (their bodies carry their own). */
export function HideOnReferenceRoute({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return isReferenceRoute(pathname) ? null : <>{children}</>;
}

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:opsz,wght@14..32,400..700&display=swap";

/** The reference files load DM Serif Display + Inter from Google Fonts under their real family names. */
export function ReferenceFonts() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={FONT_HREF} precedence="default" />
    </>
  );
}

export type ReferenceContact = {
  WA_HREF: string;
  WA_INTL: string;
  WA_LOCAL: string;
  TEL_HREF: string;
  TEL_DISPLAY: string;
  MAIL_HREF: string;
  MAIL: string;
  IG_HREF: string;
  waText: (text: string) => string;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function localMobile(digits: string) {
  const local = digits.startsWith("90") ? `0${digits.slice(2)}` : digits;
  return local.length === 11 ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7, 9)} ${local.slice(9)}` : local;
}

/** Contact values from Settings > İletişim, formatted the way the reference files print them. */
export function useReferenceContact(): ReferenceContact {
  const contact = useSiteContact();
  const telDigits = contact.landlineDisplay.replace(/\D/g, "");
  const telIntl = telDigits.startsWith("0") ? `90${telDigits.slice(1)}` : telDigits;
  return {
    WA_HREF: `https://wa.me/${contact.whatsappDigits}`,
    WA_INTL: contact.whatsappDisplay,
    WA_LOCAL: localMobile(contact.whatsappDigits),
    TEL_HREF: `tel:+${telIntl}`,
    TEL_DISPLAY: contact.landlineDisplay,
    MAIL_HREF: `mailto:${contact.email}`,
    MAIL: contact.email,
    IG_HREF: contact.instagramHref,
    waText: (text: string) => `https://wa.me/${contact.whatsappDigits}?text=${encodeURIComponent(text)}`,
  };
}

export function fillContact(html: string, contact: ReferenceContact) {
  return html.replace(/\{\{([A-Z_]+)\}\}/g, (whole, key: string) => {
    const value = contact[key as Exclude<keyof ReferenceContact, "waText">];
    return typeof value === "string" ? escapeHtml(value) : whole;
  });
}

/** Reserves the fixed canonical Navbar's height (`h-[72px] md:h-20`) above a reference body. */
export function NavbarSpacer() {
  return <div aria-hidden="true" className="h-[72px] md:h-20" data-navbar-spacer="" />;
}

/** Static reference markup. `display: contents` keeps the fragment out of layout (sticky, grid). */
export function ReferenceHtml({ html }: { html: string }) {
  return <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Client-side navigation for the plain `<a href="/…">` links inside the static reference markup. */
export function useInternalLinkNavigation(scopeRef: RefObject<HTMLElement | null>) {
  const router = useRouter();
  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || !scope.contains(link)) return;
      if (link.target || link.hasAttribute("download") || link.dataset.native !== undefined) return;
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("/") || href.startsWith("//")) return;
      const url = new URL(href, window.location.href);
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
      event.preventDefault();
      router.push(href);
    };
    scope.addEventListener("click", onClick);
    return () => scope.removeEventListener("click", onClick);
  }, [router, scopeRef]);
}
