"use client";

import type { ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";

interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="admin-shell flex min-h-screen bg-[#F4F6F2] text-[#10271B] antialiased font-sans">
      {/* Desktop Sidebar (Fixed Left) */}
      <AdminSidebar className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col sticky top-0 h-screen" />

      {/* Main Layout Area */}
      <div className="flex flex-1 flex-col min-w-0">
        <AdminHeader />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
