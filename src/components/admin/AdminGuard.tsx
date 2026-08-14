"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { AdminAuthLoader } from "@/components/admin/AdminAuthLoader";

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
    return <AdminAuthLoader />;
  }

  return <>{children}</>;
}
