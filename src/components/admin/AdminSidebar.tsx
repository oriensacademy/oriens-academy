"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  MessageSquare,
  Users,
  CreditCard,
  FileText,
  Bell,
  Settings,
  Lock,
  FileCheck,
  WalletCards,
  TrendingUp,
} from "lucide-react";

export interface NavItem {
  label: string;
  labelEn: string;
  href: string;
  icon: typeof LayoutDashboard;
  enabled: boolean;
  badge?: string;
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    labelEn: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    enabled: true,
  },
  {
    label: "Randevular",
    labelEn: "Bookings",
    href: "/admin/randevular",
    icon: CalendarCheck,
    enabled: true,
  },
  {
    label: "Öğrenciler",
    labelEn: "Students",
    href: "/admin/ogrenciler",
    icon: Users,
    enabled: true,
  },
  {
    label: "İletişim",
    labelEn: "Contacts",
    href: "/admin/iletisim",
    icon: MessageSquare,
    enabled: true,
  },
  {
    label: "Fiyatlandırma",
    labelEn: "Pricing",
    href: "/admin/fiyatlandirma",
    icon: CreditCard,
    enabled: true,
  },
  {
    label: "İndirim Kuponları",
    labelEn: "Coupons",
    href: "/admin/indirim-kuponlari",
    icon: FileText,
    enabled: true,
  },
  {
    label: "Ödemeler",
    labelEn: "Payments",
    href: "/admin/odemeler",
    icon: WalletCards,
    enabled: true,
  },
  {
    label: "Mali Akış",
    labelEn: "Financial Flow",
    href: "/admin/mali-akis",
    icon: TrendingUp,
    enabled: true,
  },
  {
    label: "İçerik",
    labelEn: "Content",
    href: "/admin/icerik",
    icon: FileText,
    enabled: true,
  },
  {
    label: "Bildirimler",
    labelEn: "Notifications",
    href: "/admin/bildirimler",
    icon: Bell,
    enabled: true,
  },
  {
    label: "Denetim Logları",
    labelEn: "Audit Logs",
    href: "/admin/denetim",
    icon: FileCheck,
    enabled: true,
  },
  {
    label: "Ayarlar",
    labelEn: "Settings",
    href: "/admin/ayarlar",
    icon: Settings,
    enabled: true,
  },
];

interface AdminSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function AdminSidebar({ className = "", onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();
  const normalizedPathname =
    pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;

  return (
    <aside
      className={`flex flex-col border-r border-[#DDE4DC] bg-white text-[#10271B] ${className}`}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-[#DDE4DC] px-6">
        <Image
          src="/brand/oriens-logo-v2.png"
          alt="Oriens Academy"
          width={217}
          height={80}
          className="h-9 w-auto object-contain"
        />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            normalizedPathname === item.href ||
            (item.href !== "/admin" &&
              normalizedPathname.startsWith(`${item.href}/`));

          if (!item.enabled) {
            return (
              <div
                key={item.href}
                className="group flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium text-[#68756C] cursor-not-allowed opacity-60 transition-colors"
                title={`${item.label} (${item.badge || "Yakında"})`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="size-4 text-[#68756C]" />
                  <span>{item.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Lock className="size-3 text-[#68756C]" />
                  {item.badge && (
                    <span className="rounded bg-[#EFF2ED] px-1.5 py-0.5 text-[10px] font-normal text-[#68756C]">
                      {item.badge}
                    </span>
                  )}
                </div>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-ui transition-[background-color,border-color,color] duration-200 ${
                isActive
                  ? "border-[#D6DED5] bg-[#EEF2EC] font-semibold text-[#10271B]"
                  : "border-transparent font-medium text-[#68756C] hover:bg-[#F2F5EF] hover:text-[#10271B]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`size-4 ${
                    isActive ? "text-[#10271B]" : "text-[#68756C]"
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {isActive && (
                <div className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-[#819586]" />
              )}
            </Link>
          );
        })}
      </nav>

    </aside>
  );
}
