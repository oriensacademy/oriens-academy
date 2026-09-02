"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAccount } from "@/lib/auth/account-context";
import type { AdminAuthContextValue, AdminAuthStatus } from "./types";

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const status: AdminAuthStatus = account.isInitializing
    ? "loading"
    : account.accountType === "admin"
      ? "authenticated"
      : account.accountType === "unauthenticated"
        ? "unauthenticated"
        : "unauthorized";

  return <AdminAuthContext.Provider value={{
    status,
    user: account.user,
    session: account.session,
    profile: account.adminProfile,
    error: account.accountType === "unknown" ? "Etkin bir Oriens Academy yönetici profili bulunamadı." : null,
    signOut: account.signOut,
    refreshSession: account.refreshAccount,
  }}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return context;
}
