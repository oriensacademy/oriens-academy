"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminNotifications } from "@/lib/admin/admin-notifications-context";
import { ensureTrailingSlash } from "@/lib/routes";

// Sol menü — referans: Oriens/src/markup/oriens-admin.body.html (.sb) ve
// INTEGRATION.md §5.2. Sınıflar admin-frame.module.css içindeki :global()
// kurallarıyla çizilir; kök .root/.mini/data-sb AdminShell'dedir.

export type AdminNavGroupKey = "ogrenci" | "finans" | "web" | "ayar";

const svg = (children: ReactNode, size = 16) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const ADMIN_GROUP_ICONS: Record<AdminNavGroupKey, ReactNode> = {
  ogrenci: <><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c3 2 9 2 12 0v-5" /></>,
  finans: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>,
  web: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11" /></>,
  ayar: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>,
};

export interface AdminNavItem {
  label: string;
  href: string;
  icon: ReactNode;
  /** Bu yol ile başlayan sayfalar da bu alt sayfayı etkin yapar. */
  match?: string[];
  badge?: "pendingPayments";
}

export interface AdminNavGroup {
  key: AdminNavGroupKey;
  label: string;
  tone: "t-green" | "t-gold" | "t-blue" | "t-grey";
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    key: "ogrenci",
    label: "Öğrenci Yönetimi",
    tone: "t-green",
    items: [
      { label: "Öğrenciler", href: "/admin/ogrenciler", icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></> },
    ],
  },
  {
    key: "finans",
    label: "Finans",
    tone: "t-gold",
    items: [
      { label: "Fiyatlandırma", href: "/admin/fiyatlandirma", icon: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></> },
      { label: "İndirim Kuponları", href: "/admin/indirim-kuponlari", icon: <><circle cx="12" cy="12" r="9" /><path d="m9 15 6-6M9.5 9.5h.01M14.5 14.5h.01" /></> },
      { label: "Ödemeler", href: "/admin/odemeler", icon: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 14h3" /></>, badge: "pendingPayments" },
      { label: "Gelir İstatistikleri", href: "/admin/mali-akis", icon: <><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></> },
    ],
  },
  {
    key: "web",
    label: "Web Sitesi Yönetimi",
    tone: "t-blue",
    items: [
      { label: "Blog", href: "/admin/blog", icon: <><path d="M4 22h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" /><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z" /></> },
      { label: "Değerlendirmeler", href: "/admin/degerlendirmeler", icon: <><path d="M11 6h10M11 12h10M11 18h10" /><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" /></> },
      { label: "İletişim Talepleri", href: "/admin/iletisim-destek", match: ["/admin/iletisim"], icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
    ],
  },
  {
    key: "ayar",
    label: "Ayarlar",
    tone: "t-grey",
    items: [
      { label: "E-posta Geçmişi", href: "/admin/bildirimler", icon: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></> },
      { label: "Denetim Kayıtları", href: "/admin/denetim", icon: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></> },
      { label: "Ayarlar", href: "/admin/ayarlar", icon: <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" /> },
    ],
  },
];

function normalizePath(value: string | null) {
  if (!value) return "/";
  return value !== "/" ? value.replace(/\/+$/, "") : value;
}

function pathMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findAdminNavLocation(pathname: string): { group: AdminNavGroupKey | null; item: AdminNavItem | null } {
  for (const group of ADMIN_NAV_GROUPS) {
    for (const item of group.items) {
      if (pathMatches(pathname, item.href) || item.match?.some((m) => pathMatches(pathname, m))) {
        return { group: group.key, item };
      }
    }
  }
  return { group: null, item: null };
}

/** Referansta mini mod veya ≤1340 px'te grup tıklaması akordeonu çalıştırmaz. */
const NARROW_QUERY = "(max-width:1340px)";

interface AdminSidebarProps {
  mini: boolean;
  onToggleMini: () => void;
}

export function AdminSidebar({ mini, onToggleMini }: AdminSidebarProps) {
  const pathname = normalizePath(usePathname());
  const { counts } = useAdminNotifications();
  const location = findAdminNavLocation(pathname);
  // Sayfa değişince ilgili grup açılır; kullanıcı akordeonla başka grubu açabilir.
  const [openOverride, setOpenOverride] = useState<{ path: string; group: AdminNavGroupKey | null } | null>(null);
  const openGroup = openOverride && openOverride.path === pathname ? openOverride.group : location.group;

  const badgeFor = (item: AdminNavItem) => (item.badge === "pendingPayments" ? counts.pendingPayments : 0);

  const onGroupClick = (key: AdminNavGroupKey) => {
    if (mini || window.matchMedia(NARROW_QUERY).matches) return;
    setOpenOverride({ path: pathname, group: openGroup === key ? null : key });
  };

  return (
    <aside className="sb" id="sb" aria-label="Ana menü">
      <div className="sb-top">
        <Link className="logo" href={ensureTrailingSlash("/admin")} title="Genel Bakış" aria-label="Oriens Academy">
          <span className="logo-w">oriens</span>
          <span className="logo-s">ACADEMY</span>
          <span className="logo-m" aria-hidden="true">o</span>
        </Link>
        <button
          type="button"
          className="sb-collapse"
          id="sb-collapse"
          onClick={onToggleMini}
          aria-label={mini ? "Menüyü genişlet" : "Menüyü daralt"}
          title="Menüyü daralt"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 3v18M15 10l-2 2 2 2" /></svg>
        </button>
      </div>
      <nav className="sb-nav">
        {ADMIN_NAV_GROUPS.map((group) => {
          const active = location.group === group.key;
          const open = openGroup === group.key;
          const groupBadge = group.items.reduce((sum, item) => sum + badgeFor(item), 0);
          return (
            <div key={group.key} className={`sb-group${open ? " open" : ""}`} data-group={group.key}>
              <span className="sb-wm" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ADMIN_GROUP_ICONS[group.key]}</svg>
              </span>
              <button
                type="button"
                className={`sb-item${active ? " active" : ""}`}
                aria-expanded={open}
                aria-controls={`sbg-${group.key}`}
                title={group.label}
                onClick={() => onGroupClick(group.key)}
              >
                <span className={`sb-ico ${group.tone}`}>{svg(ADMIN_GROUP_ICONS[group.key], 20)}</span>
                <span className="sb-lab">{group.label}</span>
                {groupBadge > 0 ? <span className="sb-dot" aria-label={`${groupBadge} yeni`}>{groupBadge}</span> : null}
                <svg className="sb-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              <div className="sb-subs" id={`sbg-${group.key}`} role="group" aria-label={group.label}>
                <span className="sb-flyhead">{group.label}</span>
                {group.items.map((item) => {
                  const current = active && location.item?.href === item.href;
                  const badge = badgeFor(item);
                  return (
                    <Link
                      key={item.href}
                      className={`sb-sub${current ? " active" : ""}`}
                      href={ensureTrailingSlash(item.href)}
                      aria-current={current ? "page" : undefined}
                    >
                      <span className="sb-sico">{svg(item.icon)}</span>
                      <span>{item.label}</span>
                      {badge > 0 ? <b className="sb-badge">{badge}</b> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
