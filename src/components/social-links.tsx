"use client";

import * as React from "react";
import { Phone, Share2, X } from "lucide-react";
import {
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaGithub,
  FaDribbble,
  FaXTwitter,
  FaGlobe,
  FaEnvelope,
  FaWhatsapp,
} from "react-icons/fa6";

export type Platform =
  | "linkedin"
  | "instagram"
  | "github"
  | "mail"
  | "facebook"
  | "x"
  | "dribbble"
  | "website"
  | "whatsapp"
  | "phone";

export interface SocialLink {
  platform: Platform;
  href: string;
  label?: string;
  /** Secondary line shown alongside the label, e.g. a phone number. */
  value?: string;
  external?: boolean;
}

export interface SocialLinksProps {
  links: SocialLink[];
  showOnMobile?: boolean;
  /**
   * Custom Tailwind color class or raw CSS color
   * Example: "bg-slate-700" | "#00ff00" | "rgb(0,255,0)"
   */
  floatingButtonColor?: string;
}

interface PlatformStyle {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  gradient: string;
  hoverGradient: string;
}

const PLATFORM_STYLES: Record<Platform, PlatformStyle> = {
  linkedin: {
    label: "LinkedIn",
    icon: FaLinkedin,
    gradient: "from-blue-600 to-blue-400",
    hoverGradient: "from-blue-500 to-blue-300",
  },
  instagram: {
    label: "Instagram",
    icon: FaInstagram,
    gradient: "from-pink-600 via-purple-600 to-orange-500",
    hoverGradient: "from-pink-500 via-purple-500 to-orange-400",
  },
  github: {
  label: "GitHub",
  icon: FaGithub,
  gradient:
    "from-zinc-800 to-zinc-600 dark:from-[hsl(var(--muted-foreground))] dark:to-[hsl(var(--foreground))]",
  hoverGradient:
    "from-zinc-700 to-zinc-500 dark:from-[hsl(var(--muted-foreground))] dark:to-[hsl(var(--foreground)/0.8)]",
},

  mail: {
    label: "Mail",
    icon: FaEnvelope,
    gradient: "from-cyan-600 to-blue-500",
    hoverGradient: "from-cyan-500 to-blue-400",
  },
  facebook: {
    label: "Facebook",
    icon: FaFacebook,
    gradient: "from-blue-700 to-blue-500",
    hoverGradient: "from-blue-600 to-blue-400",
  },
  x: {
    label: "X",
    icon: FaXTwitter,
    gradient: "from-[hsl(var(--foreground))] to-[hsl(var(--muted-foreground))]",
    hoverGradient:
      "from-[hsl(var(--muted-foreground))] to-[hsl(var(--muted)/0.7)]",
  },
  dribbble: {
    label: "Dribbble",
    icon: FaDribbble,
    gradient: "from-pink-600 to-pink-400",
    hoverGradient: "from-pink-500 to-pink-300",
  },
  website: {
    label: "Website",
    icon: FaGlobe,
    gradient: "from-emerald-600 to-teal-500",
    hoverGradient: "from-emerald-500 to-teal-400",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: FaWhatsapp,
    gradient: "from-[#10271B] to-[#819586]",
    hoverGradient: "from-[#819586] to-[#A7B7A8]",
  },
  phone: {
    label: "Phone",
    icon: Phone,
    gradient: "from-[#10271B] to-[#607867]",
    hoverGradient: "from-[#607867] to-[#819586]",
  },
};

export const SocialLinks: React.FC<SocialLinksProps> = ({
  links,
  showOnMobile = true,
  floatingButtonColor = "bg-muted",
}) => {
  const [mobileDockOpen, setMobileDockOpen] = React.useState(false);

  return (
    <>
      {/* ===== Desktop View ===== */}
      <div
        data-owner-component="wasifgee0012/social-links"
        data-social-links-desktop
        className={`${
          showOnMobile ? "hidden lg:flex" : "hidden md:flex"
        } flex-col fixed top-[35%] left-0 z-40`}
      >
        <ul className="space-y-2.5">
          {links.map(({ platform, href, label, value, external = true }) => {
            const style = PLATFORM_STYLES[platform];
            if (!style) return null;
            const Icon = style.icon;
            const closedWidth = value ? "w-56" : "w-44";
            const closedOffset = value ? "ml-[-160px]" : "ml-[-128px]";

            return (
              <li
                key={platform}
                className="group"
              >
                <a
                  href={href}
                  data-social-platform={platform}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noreferrer" : undefined}
                  aria-label={value ? `${label ?? style.label}: ${value}` : (label ?? style.label)}
                  className={`relative ${closedOffset} flex h-12 ${closedWidth} items-center justify-between overflow-hidden rounded-r-xl border border-[rgba(16,39,27,0.12)] bg-[#10271B] px-3.5 text-white shadow-[0_6px_18px_rgba(16,39,27,0.14)] transition-[margin,transform,background-color,box-shadow] duration-200 ease-out group-hover:ml-[-8px] group-hover:translate-x-[3px] group-hover:bg-[#819586] group-hover:shadow-[0_8px_22px_rgba(16,39,27,0.18)]`}
                >
                  {/* Label */}
                  {value ? (
                    <span className="relative z-10 flex flex-col leading-tight">
                      <span className="text-[10px] font-semibold tracking-wide text-white/75 uppercase">
                        {label ?? style.label}
                      </span>
                      <span className="text-sm font-semibold tracking-wide whitespace-nowrap text-white">
                        {value}
                      </span>
                    </span>
                  ) : (
                    <span className="relative z-10 text-sm font-semibold tracking-wide text-white">
                      {label ?? style.label}
                    </span>
                  )}

                  {/* Icon */}
                  <Icon
                    size={20}
                    className="relative z-10 shrink-0 text-white transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ===== Mobile Floating Dock ===== */}
      {showOnMobile && (
        <div data-owner-component="wasifgee0012/social-links" data-social-links-mobile className="lg:hidden fixed bottom-6 right-6 z-50">
          {mobileDockOpen && (
            <div
              className="fixed inset-0 bg-background/60 backdrop-blur-sm"
              onClick={() => setMobileDockOpen(false)}
            />
          )}

          <div className="relative">
            {/* Floating Icons */}
            <div
              className={`absolute bottom-20 right-0 flex flex-col-reverse gap-3 transition-all duration-500 ${
                mobileDockOpen
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8 pointer-events-none"
              }`}
            >
              {links.map(({ platform, href, label, external = true }, index) => {
                const style = PLATFORM_STYLES[platform];
                if (!style) return null;
                const Icon = style.icon;
                return (
                  <a
                    key={platform}
                    href={href}
                    data-social-platform={platform}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noreferrer" : undefined}
                    aria-label={label ?? style.label}
                    className="group relative ml-auto"
                    style={{
                      transitionDelay: mobileDockOpen ? `${index * 50}ms` : "0ms",
                    }}
                  >
                    <div
                      className="flex size-12 items-center justify-center rounded-full border border-[rgba(16,39,27,0.12)] bg-[#10271B] text-white shadow-[0_6px_18px_rgba(16,39,27,0.16)] transition-[transform,background-color] duration-200 hover:scale-[1.03] hover:bg-[#819586]"
                    >
                      <Icon size={20} className="text-white" />
                    </div>

                    {/* Tooltip */}
                    <div className="absolute top-1/2 -translate-y-1/2 right-16
                                    bg-popover text-popover-foreground
                                    text-xs font-medium px-3 py-1.5 rounded-md shadow-md
                                    opacity-0 group-hover:opacity-100 transition-opacity">
                      {label ?? style.label}
                      <div className="absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-2 bg-popover rotate-45" />
                    </div>
                  </a>
                );
              })}
            </div>

            {/* Floating Button */}
            <button
              onClick={() => setMobileDockOpen(!mobileDockOpen)}
              className={`relative flex items-center justify-center w-16 h-16 rounded-full shadow-2xl active:scale-95
                         transition-all duration-300 border border-border overflow-hidden ${floatingButtonColor}`}
              aria-label="Toggle social links"
            >
              <div className="relative z-10">
                {mobileDockOpen ? (
                  <X size={24} className="text-white" />
                ) : (
                  <Share2 size={24} className="text-white" />
                )}
              </div>
              <div className="absolute inset-0 bg-[hsl(var(--muted))] opacity-10" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default SocialLinks;
