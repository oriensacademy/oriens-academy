"use client";

import { useState, useEffect } from "react";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { AdminSidebar } from "./AdminSidebar";
import Image from "next/image";
import { LogOut, Menu, X, Shield, Calendar } from "lucide-react";
import { Wave } from "@/components/ui/wave";

export function AdminHeader() {
  const { user, profile, signOut } = useAdminAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentDateString, setCurrentDateString] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const now = new Date();
      setCurrentDateString(
        now.toLocaleDateString("tr-TR", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      );
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#DDE4DC] bg-white px-4 md:px-6 shadow-xs font-ui">
        {/* Left side: Mobile menu toggle + Page title info */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex size-9 items-center justify-center rounded-lg border border-[#DDE4DC] text-[#10271B] hover:bg-[#F2F5EF] lg:hidden"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>

          <div className="flex items-center gap-2 lg:hidden">
            <Image
              src="/brand/oriens-logo-v2.png"
              alt="Oriens Academy"
              width={217}
              height={80}
              className="h-8 w-auto object-contain"
            />
          </div>

          <div className="hidden items-center gap-2 text-xs font-semibold text-[#68756C] md:flex">
            <Calendar className="size-3.5 text-[#819586]" />
            <span>{currentDateString}</span>
          </div>
        </div>

        {/* Right side: Admin user badge + Logout action */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-[#DDE4DC] bg-[#F6F8F3] px-3.5 py-1 text-xs">
            <Shield className="size-3.5 text-[#819586]" />
            <span className="font-semibold text-[#10271B] max-w-[150px] truncate md:max-w-none">
              {profile?.display_name || user?.email || "Administrator"}
            </span>
            <span className="hidden rounded bg-[#E8EEE8] px-1.5 py-0.5 text-[10px] font-bold text-[#10271B] sm:inline border border-[#DDE4DC]">
              Admin
            </span>
          </div>

          <button
            type="button"
            onClick={async () => { setSigningOut(true); await signOut(); }}
            disabled={signingOut}
            className="flex items-center gap-1.5 rounded-lg border border-[#DDE4DC] bg-white px-3 py-1.5 text-xs font-semibold text-[#10271B] transition-colors hover:bg-[#F2F5EF] hover:text-red-600 cursor-pointer"
            title="Oturumu Kapat / Sign Out"
          >
            {signingOut ? <Wave className="h-3.5 w-7 text-[#819586]" aria-label="Çıkış yapılıyor" /> : <LogOut className="size-3.5" />}
            <span className="hidden sm:inline">{signingOut ? "Çıkış yapılıyor" : "Çıkış Yap"}</span>
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-[#10271B]/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl">
            <AdminSidebar
              className="h-full w-full"
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default AdminHeader;
