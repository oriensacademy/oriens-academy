"use client";

import { usePathname } from "next/navigation";
import { SocialLinks as OwnerSocialLinks, type SocialLink } from "@/components/social-links";
import { CONTACT } from "@/config/contact";
import { useLocale } from "@/content/locale-context";

export function SocialLinks() {
  const pathname = usePathname();
  const locale = useLocale();
  if (pathname?.startsWith("/admin")) return null;

  const links: SocialLink[] = [
    { platform: "instagram", href: CONTACT.instagramHref, label: "Instagram", value: "@oriens.academy", external: true },
    { platform: "whatsapp", href: CONTACT.whatsappHref, label: "WhatsApp", value: CONTACT.whatsappDisplay, external: true },
    { platform: "phone", href: CONTACT.landlineHref, label: locale === "tr" ? "Telefon" : "Phone", value: CONTACT.landlineDisplay, external: false },
    { platform: "mail", href: CONTACT.emailHref, label: locale === "tr" ? "E-posta" : "Email", value: CONTACT.email, external: false },
  ];

  return <OwnerSocialLinks links={links} showOnMobile floatingButtonColor="bg-[#10271B]" />;
}

export default SocialLinks;
