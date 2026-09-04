"use client";

import { usePathname } from "next/navigation";
import { SocialLinks as OwnerSocialLinks, type SocialLink } from "@/components/social-links";
import { CONTACT } from "@/config/contact";
import { useLocale } from "@/content/locale-context";

// The fixed mobile contact dock (bottom-6 right-6) is a viewport-corner
// overlay -- it stays in the same spot regardless of scroll position, so on
// the critical mobile conversion routes (register, cart, payment) it can sit
// directly on top of the last form field or CTA at small viewports, and on
// the student account area it collides with the fixed mobile bottom tab bar.
// The desktop side-dock is unaffected; contact info stays reachable from the
// footer/navbar on these pages either way.
const MOBILE_DOCK_HIDDEN_SEGMENTS = ["giris", "login", "sepet", "cart", "odeme", "payment", "hesabim", "account"];

export function SocialLinks() {
  const pathname = usePathname();
  const locale = useLocale();
  if (pathname?.startsWith("/admin")) return null;
  const segments = pathname?.split("/").filter(Boolean) ?? [];
  const showMobileDock = !segments.some((segment) => MOBILE_DOCK_HIDDEN_SEGMENTS.includes(segment));

  const links: SocialLink[] = [
    { platform: "instagram", href: CONTACT.instagramHref, label: "Instagram", value: "@oriens.academy", external: true },
    { platform: "whatsapp", href: CONTACT.whatsappHref, label: "WhatsApp", value: CONTACT.whatsappDisplay, external: true },
    { platform: "phone", href: CONTACT.landlineHref, label: locale === "tr" ? "Telefon" : "Phone", value: CONTACT.landlineDisplay, external: false },
    { platform: "mail", href: CONTACT.emailHref, label: locale === "tr" ? "E-posta" : "Email", value: CONTACT.email, external: false },
  ];

  return <OwnerSocialLinks links={links} showOnMobile={showMobileDock} floatingButtonColor="bg-[#10271B]" />;
}

export default SocialLinks;
