"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";

interface AdminGuardProps {
  children: ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { status } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated" || status === "unauthorized") {
      router.replace("/admin/login");
    }
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated" || status === "unauthorized") {
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
