"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/content/locale-context";
import { cn } from "@/lib/utils";

export interface NavHeaderPosition {
  left: number;
  width: number;
  opacity: number;
  [key: string]: number;
}

export interface NavItem {
  label: string;
  href: string;
}

export interface NavHeaderProps {
  items?: NavItem[];
  className?: string;
}

export function NavHeader({ items, className }: NavHeaderProps) {
  const locale = useLocale();
  const pathname = usePathname();

  const defaultItems: NavItem[] =
    locale === "tr"
      ? [
          { label: "Sınavlar", href: "/tr/sinavlar" },
          { label: "Üniversite Desteği", href: "/tr/universite-destegi" },
          { label: "Ücretler", href: "/tr/ucretler" },
          { label: "Hakkımızda", href: "/tr/hakkimizda" },
        ]
      : [
          { label: "Exams", href: "/en/exams" },
          { label: "University Support", href: "/en/university-support" },
          { label: "Pricing", href: "/en/pricing" },
          { label: "About", href: "/en/about" },
        ];

  const navItems = items || defaultItems;

  const [position, setPosition] = useState<NavHeaderPosition>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  return (
    <ul
      className={cn(
        "relative flex items-center w-fit rounded-full border border-border bg-card/90 backdrop-blur-md p-1.5 shadow-[0_2px_10px_rgba(16,39,27,0.05)] font-ui",
        className
      )}
      onMouseLeave={() =>
        setPosition((pv) => ({
          ...pv,
          opacity: 0,
        }))
      }
    >
      {navItems.map((item) => {
        const active = pathname === item.href || (item.href !== `/${locale}` && pathname?.startsWith(item.href));

        return (
          <Tab
            key={item.href}
            href={item.href}
            active={active}
            setPosition={setPosition}
          >
            {item.label}
          </Tab>
        );
      })}

      <Cursor position={position} />
    </ul>
  );
}

interface TabProps {
  children: React.ReactNode;
  href: string;
  active: boolean;
  setPosition: React.Dispatch<React.SetStateAction<NavHeaderPosition>>;
}

const Tab = ({ children, href, active, setPosition }: TabProps) => {
  const ref = useRef<HTMLLIElement>(null);

  return (
    <li
      ref={ref}
      onMouseEnter={() => {
        if (!ref.current) return;
        const { width } = ref.current.getBoundingClientRect();
        setPosition({
          width,
          opacity: 1,
          left: ref.current.offsetLeft,
        });
      }}
      className="relative z-10 block cursor-pointer select-none"
    >
      <Link
        href={href}
        className={cn(
          "block px-4 py-2 text-[13px] font-semibold tracking-wide transition-colors duration-200",
          active ? "text-foreground font-bold" : "text-[#25382D] hover:text-foreground"
        )}
      >
        {children}
      </Link>
    </li>
  );
};

interface CursorProps {
  position: NavHeaderPosition;
}

const Cursor = ({ position }: CursorProps) => {
  return (
    <motion.li
      animate={position}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="absolute z-0 h-8 rounded-full bg-sage-soft border border-border/60"
    />
  );
};

export default NavHeader;
