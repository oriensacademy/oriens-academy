"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  LogOut,
  Menu,
  Shield,
  X,
  Bell,
  CheckCheck,
  MessageSquare,
  Headphones,
  CreditCard,
  AlertCircle,
  ClipboardList,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { useAdminNotifications } from "@/lib/admin/admin-notifications-context";
import { AdminSidebar } from "./AdminSidebar";
import { LogoutConfirmationModal } from "./LogoutConfirmationModal";

function formatAdminDate(value: Date) {
  return value.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    weekday: "short",
  });
}

function formatAdminTime(value: Date) {
  return value.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatTimeAgo(timestamp: string) {
  try {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Az önce";
    if (diffMins < 60) return `${diffMins} dk önce`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} sa önce`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} gün önce`;
  } catch {
    return "—";
  }
}

export function AdminHeader() {
  const { user, profile, signOut } = useAdminAuth();
  const { notifications, counts, markAllRead } = useAdminNotifications();
  const router = useRouter();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState<Date | null>(null);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const notificationsDropdownRef = useRef<HTMLDivElement>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const initialTick = window.setTimeout(() => setCurrentDateTime(new Date()), 0);
    const interval = window.setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(interval);
    };
  }, []);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    if (!notificationsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        notificationsDropdownRef.current &&
        !notificationsDropdownRef.current.contains(e.target as Node) &&
        bellButtonRef.current &&
        !bellButtonRef.current.contains(e.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [notificationsOpen]);

  const closeLogoutModal = useCallback(() => {
    setLogoutModalOpen(false);
  }, []);

  const confirmSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    router.replace("/tr/");
  };

  const displayName = profile?.display_name || "Oriens Academy Yöneticisi";
  const email = user?.email || "admin@oriens-academy.com";

  return (
    <>
      <header className="sticky top-0 z-30 flex min-h-16 w-full items-center justify-between gap-3 border-b border-[#DDE4DC] bg-white px-3 py-2 shadow-xs sm:px-4 md:px-6 font-ui">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#DDE4DC] text-[#10271B] transition-colors duration-200 hover:bg-[#F2F5EF] lg:hidden"
            aria-label="Yönetim menüsünü aç veya kapat"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>

          <Image
            src="/brand/oriens-logo-v2.png"
            alt="Oriens Academy"
            width={217}
            height={80}
            className="hidden h-8 w-auto object-contain sm:block lg:hidden"
          />

          <div className="flex min-w-0 items-center gap-2 text-[#68756C]">
            <Calendar className="hidden size-3.5 shrink-0 text-[#819586] md:block" aria-hidden="true" />
            <div className="min-w-0 text-xs font-semibold leading-tight tabular-nums">
              <span className="hidden whitespace-nowrap md:block">
                {currentDateTime ? formatAdminDate(currentDateTime) : "—"}
              </span>
              <span className="whitespace-nowrap text-[#10271B] md:text-[#68756C]">
                {currentDateTime ? formatAdminTime(currentDateTime) : "--:--:--"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Notification Center Dropdown Trigger */}
          <div className="relative">
            <button
              ref={bellButtonRef}
              type="button"
              onClick={() => setNotificationsOpen((open) => !open)}
              className="relative flex size-9 items-center justify-center rounded-lg border border-[#DDE4DC] bg-white text-[#10271B] transition-colors duration-200 hover:bg-[#F2F5EF]"
              aria-label="Bildirimler"
              aria-expanded={notificationsOpen}
            >
              <Bell className="size-4 text-[#10271B]" />
              {counts.totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 flex min-w-4 h-4 items-center justify-center rounded-full bg-[#C5B58A] px-1 text-[9px] font-extrabold text-[#10271B] shadow-xs animate-pulse">
                  {counts.totalUnread > 99 ? "99+" : counts.totalUnread}
                </span>
              )}
            </button>

            {/* Notification Center Popover */}
            {notificationsOpen && (
              <div
                ref={notificationsDropdownRef}
                className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-96 rounded-2xl border border-[#DDE5DC] bg-white shadow-2xl z-50 overflow-hidden animate-[admin-content-in_160ms_ease-out]"
              >
                {/* Popover Header */}
                <div className="flex items-center justify-between border-b border-[#DDE5DC] bg-[#F8FAF7] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-[#172033]">Bildirim Merkezi</span>
                    {counts.totalUnread > 0 && (
                      <span className="rounded-full bg-[#C5B58A]/30 px-2 py-0.5 text-[10px] font-bold text-[#10271B]">
                        {counts.totalUnread} Yeni
                      </span>
                    )}
                  </div>
                  {counts.totalUnread > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAllRead()}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#819586] hover:text-[#10271B] transition-colors"
                    >
                      <CheckCheck className="size-3.5" />
                      <span>Tümünü Okundu Say</span>
                    </button>
                  )}
                </div>

                {/* Notifications List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-[#F2F5EF]">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#667085]">
                      <Bell className="size-6 mx-auto mb-2 text-[#819586]/50" />
                      <p className="font-semibold text-[#172033]">Yeni bildirim yok</p>
                      <p className="text-[11px] mt-0.5">Tüm bildirim ve talepler güncel.</p>
                    </div>
                  ) : (
                    notifications.slice(0, 8).map((item) => {
                      const Icon =
                        item.type === "contact"
                          ? MessageSquare
                          : item.type === "support"
                          ? Headphones
                          : item.type === "payment"
                          ? CreditCard
                          : item.type === "homework"
                          ? ClipboardList
                          : AlertCircle;

                      const iconBg =
                        item.type === "contact"
                          ? "bg-blue-50 text-blue-700"
                          : item.type === "support"
                          ? "bg-purple-50 text-purple-700"
                          : item.type === "payment"
                          ? "bg-amber-50 text-amber-700"
                          : item.type === "homework"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700";

                      return (
                        <Link
                          key={item.id}
                          href={item.link}
                          onClick={() => setNotificationsOpen(false)}
                          className="flex items-start gap-3 p-3 transition-colors hover:bg-[#F8FAF7]"
                        >
                          <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg mt-0.5 ${iconBg}`}>
                            <Icon className="size-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-[#172033]">
                              {item.title}
                            </p>
                            <p className="truncate text-[11px] text-[#667085] mt-0.5">
                              {item.subtitle}
                            </p>
                            <span className="text-[10px] text-[#819586] tabular-nums mt-1 inline-block">
                              {formatTimeAgo(item.timestamp)}
                            </span>
                          </div>
                          <ChevronRight className="size-3.5 text-[#819586] shrink-0 mt-1" />
                        </Link>
                      );
                    })
                  )}
                </div>

                {/* Popover Footer */}
                <div className="border-t border-[#DDE5DC] bg-[#F8FAF7] p-2.5 text-center">
                  <Link
                    href="/admin/bildirimler/"
                    onClick={() => setNotificationsOpen(false)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#10271B] hover:underline"
                  >
                    <span>Tüm Bildirimleri Görüntüle</span>
                    <ExternalLink className="size-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Admin Profile Pill */}
          <div className="flex items-center gap-2 rounded-xl border border-[#DDE5DC] bg-[#F8FAF7] px-2 py-1.5 sm:px-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#EEF2EC] text-[#10271B]">
              <Shield className="size-4" aria-hidden="true" />
            </span>
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-40 truncate text-xs font-semibold leading-4 text-[#172033] lg:max-w-52">{displayName}</p>
              <p className="hidden max-w-56 break-all text-[10px] leading-4 text-[#667085] md:block">{email}</p>
            </div>
            <span className="rounded-full bg-[#EEF2EC] px-2 py-0.5 text-[10px] font-semibold text-[#10271B]">
              Yönetici
            </span>
          </div>

          <button
            type="button"
            onClick={() => setLogoutModalOpen(true)}
            className="flex size-9 items-center justify-center rounded-lg border border-[#DDE4DC] bg-white text-[#10271B] transition-colors duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-700 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3"
            title="Çıkış Yap"
          >
            <LogOut className="size-3.5" />
            <span className="hidden text-xs font-semibold lg:inline">Çıkış Yap</span>
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="fixed inset-0 bg-[#10271B]/40 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Yönetim menüsünü kapat"
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl">
            <AdminSidebar className="h-full w-full" onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <LogoutConfirmationModal
        open={logoutModalOpen}
        signingOut={signingOut}
        onCancel={closeLogoutModal}
        onConfirm={confirmSignOut}
      />
    </>
  );
}

export default AdminHeader;
