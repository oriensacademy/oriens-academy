"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Calendar, LogOut, Menu, Shield, X } from "lucide-react";
import { useAdminAuth } from "@/lib/admin/auth-context";
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

export function AdminHeader() {
  const { user, profile, signOut } = useAdminAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState<Date | null>(null);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const initialTick = window.setTimeout(() => setCurrentDateTime(new Date()), 0);
    const interval = window.setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(interval);
    };
  }, []);

  const closeLogoutModal = useCallback(() => {
    setLogoutModalOpen(false);
  }, []);

  const confirmSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    router.replace("/tr");
  };

  const displayName = profile?.display_name || "Oriens Academy Admin";
  const email = user?.email || "oriensacademy@gmail.com";

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
          <div className="flex items-center gap-2 rounded-xl border border-[#DDE5DC] bg-[#F8FAF7] px-2 py-1.5 sm:px-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#EEF2EC] text-[#10271B]">
              <Shield className="size-4" aria-hidden="true" />
            </span>
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-40 truncate text-xs font-semibold leading-4 text-[#172033] lg:max-w-52">{displayName}</p>
              <p className="hidden max-w-56 break-all text-[10px] leading-4 text-[#667085] md:block">{email}</p>
            </div>
            <span className="rounded-full bg-[#EEF2EC] px-2 py-0.5 text-[10px] font-semibold text-[#10271B]">
              Admin
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
