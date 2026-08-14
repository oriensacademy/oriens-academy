"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";

interface AdminGuardProps {
  children: ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { status, user } = useAdminAuth();
  const router = useRouter();
  const mustChangePassword = user?.user_metadata?.force_password_change === true;

  useEffect(() => {
    if (status === "unauthenticated" || status === "unauthorized") {
      router.replace("/admin/login");
    } else if (status === "authenticated" && mustChangePassword) {
      router.replace("/admin/change-password");
    }
  }, [status, mustChangePassword, router]);

  if (status === "loading" || status === "unauthenticated" || status === "unauthorized" || (status === "authenticated" && mustChangePassword)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F5] px-6 text-center antialiased">
        <div className="rounded-xl border border-border bg-white p-8 text-[#819586] shadow-sm">
          <AdminWaveStatus label="Doğrulanıyor… / Verifying authorization…" className="text-sm font-medium" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
