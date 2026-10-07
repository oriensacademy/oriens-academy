"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar, findAdminNavLocation } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { UnsavedChangesGuard } from "./UnsavedChangesGuard";
import { useAdminMenuStyle } from "@/lib/admin/menu-style";
import styles from "./admin-frame.module.css";

// Referans modülleri kendi .page dolgusunu (32px 32px 56px) taşır; <main>
// dolgusu bunlara ikinci kez eklenmemeli. Diğer (eski) sayfalar dolguyu korur.
const REFERENCE_PAGE_ROUTES = new Set([
  "/admin", "/admin/ogrenciler", "/admin/odemeler", "/admin/mali-akis", "/admin/fiyatlandirma",
  "/admin/indirim-kuponlari", "/admin/iletisim", "/admin/degerlendirmeler", "/admin/blog",
  "/admin/bildirimler", "/admin/denetim", "/admin/ayarlar",
]);

interface AdminShellProps {
  children: ReactNode;
}

// Referans çerçeve (.app > .sb + .main > .tb): 280 px menü, daraltma düğmesiyle
// 84 px (.mini). ≤1340 px'te menü CSS ile zorla 84 px ikon moduna geçer.
export function AdminShell({ children }: AdminShellProps) {
  const [mini, setMini] = useState(false);
  const menuStyle = useAdminMenuStyle();
  const pathname = usePathname();
  const normalized = pathname && pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname ?? "/";
  const isStudentDetail = normalized === "/admin/ogrenciler/detay";
  const unpadded = isStudentDetail || REFERENCE_PAGE_ROUTES.has(normalized);

  // Sekme başlığı: "<Sayfa> · Oriens Admin" (öğrenci detayı kendi başlığını yazar)
  useEffect(() => {
    if (isStudentDetail) return;
    const { item } = findAdminNavLocation(normalized);
    const page = normalized === "/admin"
      ? "Genel Bakış"
      : normalized.startsWith("/admin/blog/editor")
        ? "Blog Yazısı"
        : item?.label;
    if (page) document.title = `${page} · Oriens Admin`;
  }, [normalized, isStudentDetail]);

  return (
    <div className={`admin-shell ${styles.root}${mini ? ` ${styles.mini}` : ""}`} id="app" data-sb={menuStyle || undefined}>
      <AdminSidebar mini={mini} onToggleMini={() => setMini((value) => !value)} />
      <div className="main">
        <AdminHeader />
        <main className={unpadded ? "min-w-0 flex-1 p-0" : "min-w-0 flex-1 px-4 pt-6 pb-12 min-[1001px]:px-8 min-[1001px]:pt-8 min-[1001px]:pb-14"}>
          {children}
        </main>
      </div>
      <UnsavedChangesGuard />
    </div>
  );
}
