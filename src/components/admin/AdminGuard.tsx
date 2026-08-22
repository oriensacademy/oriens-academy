"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAccount } from "@/lib/auth/account-context";
import { loginPathWithReturn } from "@/lib/auth/account-routing";
import { changePasswordPath, localizedPath } from "@/lib/routes";
import { AdminAuthLoader } from "@/components/admin/AdminAuthLoader";

interface AdminGuardProps {
  children: ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { accountType, user, studentProfile, isInitializing } = useAccount();
  const router = useRouter();
  const pathname = usePathname();
  const navigatedRef = useRef(false);
  const mustChangePassword = user?.user_metadata?.force_password_change === true;
  const studentLocale = studentProfile?.preferred_language === "en" ? "en" : "tr";

  useEffect(() => {
    if (isInitializing || navigatedRef.current) return;
    if (accountType === "unauthenticated" || accountType === "unknown") {
      navigatedRef.current = true;
      router.replace(loginPathWithReturn("tr", pathname));
    } else if (accountType === "student") {
      navigatedRef.current = true;
      router.replace(localizedPath("studentAccount", studentLocale));
    } else if (accountType === "admin" && mustChangePassword) {
      navigatedRef.current = true;
      router.replace(changePasswordPath("tr"));
    }
  }, [accountType, isInitializing, mustChangePassword, pathname, router, studentLocale]);

  if (isInitializing || accountType !== "admin" || mustChangePassword) {
    return <AdminAuthLoader />;
  }

  return <>{children}</>;
}
