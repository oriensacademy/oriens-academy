"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminAuthProvider } from "@/lib/admin/auth-context";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";

const AUTH_FLOW_ROUTES = new Set([
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
  "/admin/change-password",
]);

export function AdminClientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const normalizedPathname = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
  const isAuthFlow = AUTH_FLOW_ROUTES.has(normalizedPathname);

  return (
    <AdminAuthProvider>
      {isAuthFlow ? (
        children
      ) : (
        <AdminGuard>
          <AdminShell>
            <div className="animate-[admin-content-in_160ms_ease-out]">{children}</div>
          </AdminShell>
        </AdminGuard>
      )}
    </AdminAuthProvider>
  );
}
