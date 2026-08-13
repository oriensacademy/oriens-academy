"use client";

import type { ReactNode } from "react";
import { AdminAuthProvider } from "@/lib/admin/auth-context";

export function AdminClientLayout({ children }: { children: ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
