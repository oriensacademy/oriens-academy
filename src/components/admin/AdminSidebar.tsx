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
  WalletCards,
  TrendingUp,
  ListChecks,
  Newspaper,
} from "lucide-react";
import { useAdminNotifications } from "@/lib/admin/admin-notifications-context";
import { ensureTrailingSlash } from "@/lib/routes";

export interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  enabled: boolean;
  badge?: string;
  group: "GENEL" | "ÖĞRENCİ YÖNETİMİ" | "FİNANS" | "İÇERİK" | "SİSTEM";
}

const GROUP_LABELS: Record<NavItem["group"], string> = {
  GENEL: "GENEL",
  "ÖĞRENCİ YÖNETİMİ": "ÖĞRENCİ YÖNETİMİ",
  FİNANS: "FİNANS",
  İÇERİK: "BİLDİRİMLER",
  SİSTEM: "SİSTEM",
};

export const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: "Gösterge Paneli",
    href: "/admin",
    icon: LayoutDashboard,
    enabled: true,
    group: "GENEL",
  },
  {
    label: "Blog",
    href: "/admin/blog",
    icon: Newspaper,
    enabled: true,
    group: "GENEL",
  },
  {
    label: "Kullanıcılar",
    href: "/admin/ogrenciler",
    icon: Users,
    enabled: true,
    group: "ÖĞRENCİ YÖNETİMİ",
  },
  {
    label: "Ders & Randevular",
    href: "/admin/randevular",
    icon: CalendarCheck,
    enabled: true,
    group: "ÖĞRENCİ YÖNETİMİ",
  },
  {
    label: "Değerlendirmeler",
    href: "/admin/degerlendirmeler",
    icon: ListChecks,
    enabled: true,
    group: "ÖĞRENCİ YÖNETİMİ",
  },
  {
    label: "İletişim Talepleri",
    href: "/admin/iletisim-destek",
    icon: MessageSquare,
    enabled: true,
    group: "ÖĞRENCİ YÖNETİMİ",
  },
  {
    label: "Fiyatlandırma",
    href: "/admin/fiyatlandirma",
    icon: CreditCard,
    enabled: true,
    group: "FİNANS",
  },
  {
    label: "İndirim Kuponları",
    href: "/admin/indirim-kuponlari",
    icon: FileText,
    enabled: true,
    group: "FİNANS",
  },
  {
    label: "Ödemeler",
    href: "/admin/odemeler",
    icon: WalletCards,
    enabled: true,
    group: "FİNANS",
  },
  {
    label: "Mali Akış",
    href: "/admin/mali-akis",
    icon: TrendingUp,
    enabled: true,
    group: "FİNANS",
  },
  {
    label: "Bildirimler",
    href: "/admin/bildirimler",
    icon: Bell,
    enabled: true,
    group: "İÇERİK",
  },
  {
    label: "Ayarlar",
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
  const { counts } = useAdminNotifications();
  const normalizedPathname =
    pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;

  const getItemBadge = (href: string) => {
    if (href === "/admin/iletisim-destek" && counts.communicationSupport > 0) {
      return counts.communicationSupport;
    }
    if (href === "/admin/odemeler" && counts.payments > 0) {
      return counts.payments;
    }
    if (href === "/admin/bildirimler" && counts.notifications > 0) {
      return counts.notifications;
    }
    return 0;
  };

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
            <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">{GROUP_LABELS[group]}</p>
            <div className="space-y-0.5">
        {ADMIN_NAV_ITEMS.filter((item) => item.group === group).map((item) => {
          const Icon = item.icon;
          const normalizedHref = item.href !== "/" ? item.href.replace(/\/+$/, "") : item.href;
          const isActive =
            normalizedPathname === normalizedHref ||
            (normalizedHref !== "/admin" && normalizedPathname.startsWith(`${normalizedHref}/`));
          const dynamicBadge = getItemBadge(item.href);

          return (
            <Link
              key={item.href}
              href={ensureTrailingSlash(item.href)}
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
              <div className="flex items-center gap-1.5">
                {dynamicBadge > 0 && (
                  <span className="flex min-w-5 h-5 items-center justify-center rounded-full bg-[#C5B58A] px-1.5 text-[10px] font-extrabold text-[#10271B] shadow-2xs">
                    {dynamicBadge > 99 ? "99+" : dynamicBadge}
                  </span>
                )}
                {item.badge && !dynamicBadge && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                    {item.badge}
                  </span>
                )}
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
