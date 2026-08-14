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
    { platform: "instagram", href: CONTACT.instagramHref, label: "Instagram", external: true },
    { platform: "whatsapp", href: CONTACT.whatsappHref, label: "WhatsApp", external: true },
    { platform: "phone", href: CONTACT.phoneHref, label: locale === "tr" ? "Telefon" : "Phone", value: CONTACT.phoneDisplay, external: false },
    { platform: "mail", href: CONTACT.emailHref, label: locale === "tr" ? "E-posta" : "Email", external: false },
  ];

  return <OwnerSocialLinks links={links} showOnMobile floatingButtonColor="bg-[#10271B]" />;
}

export default SocialLinks;
