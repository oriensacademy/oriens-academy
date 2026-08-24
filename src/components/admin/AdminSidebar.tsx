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
  ClipboardList,
} from "lucide-react";

export interface NavItem {
  label: string;
  labelEn: string;
  href: string;
  icon: typeof LayoutDashboard;
  enabled: boolean;
  badge?: string;
  group: "GENEL" | "ÖĞRENCİ YÖNETİMİ" | "FİNANS" | "İÇERİK" | "SİSTEM";
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    labelEn: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    enabled: true,
    group: "GENEL",
  },
  {
    label: "Öğrenciler",
    labelEn: "Students",
    href: "/admin/ogrenciler",
    icon: Users,
    enabled: true,
    group: "ÖĞRENCİ YÖNETİMİ",
  },
  {
    label: "Ders & Randevular",
    labelEn: "Lessons & Appointments",
    href: "/admin/randevular",
    icon: CalendarCheck,
    enabled: true,
    group: "ÖĞRENCİ YÖNETİMİ",
  },
  {
    label: "Ödev İşlemleri",
    labelEn: "Homework & Assessments",
    href: "/admin/odevler",
    icon: ClipboardList,
    enabled: true,
    group: "ÖĞRENCİ YÖNETİMİ",
  },
  {
    label: "İletişim & Destek",
    labelEn: "Communication & Support",
    href: "/admin/iletisim-destek",
    icon: MessageSquare,
    enabled: true,
    group: "ÖĞRENCİ YÖNETİMİ",
  },
  {
    label: "Fiyatlandırma",
    labelEn: "Pricing",
    href: "/admin/fiyatlandirma",
    icon: CreditCard,
    enabled: true,
    group: "FİNANS",
  },
  {
    label: "İndirim Kuponları",
    labelEn: "Coupons",
    href: "/admin/indirim-kuponlari",
    icon: FileText,
    enabled: true,
    group: "FİNANS",
  },
  {
    label: "Ödemeler",
    labelEn: "Payments",
    href: "/admin/odemeler",
    icon: WalletCards,
    enabled: true,
    group: "FİNANS",
  },
  {
    label: "Mali Akış",
    labelEn: "Financial Flow",
    href: "/admin/mali-akis",
    icon: TrendingUp,
    enabled: true,
    group: "FİNANS",
  },
  {
    label: "İçerik",
    labelEn: "Content",
    href: "/admin/icerik",
    icon: FileText,
    enabled: true,
    group: "İÇERİK",
  },
  {
    label: "Bildirimler",
    labelEn: "Notifications",
    href: "/admin/bildirimler",
    icon: Bell,
    enabled: true,
    group: "İÇERİK",
  },
  {
    label: "Denetim Logları",
    labelEn: "Audit Logs",
    href: "/admin/denetim",
    icon: FileCheck,
    enabled: true,
    group: "SİSTEM",
  },
  {
    label: "Ayarlar",
    labelEn: "Settings",
    href: "/admin/ayarlar",
    icon: Settings,
    enabled: true,
    group: "SİSTEM",
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
      className={`flex flex-col border-r border-border bg-white text-ink ${className}`}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
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
        {(["GENEL", "ÖĞRENCİ YÖNETİMİ", "FİNANS", "İÇERİK", "SİSTEM"] as const).map((group) => (
          <div key={group} className="mb-3 last:mb-0">
            <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">{group}</p>
            <div className="space-y-0.5">
        {ADMIN_NAV_ITEMS.filter((item) => item.group === group).map((item) => {
          const Icon = item.icon;
          const isActive =
            normalizedPathname === item.href ||
            (item.href !== "/admin" &&
              normalizedPathname.startsWith(`${item.href}/`));

          if (!item.enabled) {
            return (
              <div
                key={item.href}
                className="group flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium text-muted-foreground cursor-not-allowed opacity-60 transition-colors"
                title={`${item.label} (${item.badge || "Yakında"})`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="size-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Lock className="size-3 text-muted-foreground" />
                  {item.badge && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
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
                  ? "border-border bg-muted font-semibold text-ink"
                  : "border-transparent font-medium text-muted-foreground hover:bg-surface-muted hover:text-ink"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`size-4 ${
                    isActive ? "text-ink" : "text-muted-foreground"
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {isActive && (
                <div className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-primary" />
              )}
            </Link>
          );
        })}
            </div>
          </div>
        ))}
      </nav>

    </aside>
  );
}
