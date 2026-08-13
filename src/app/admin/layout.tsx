import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminClientLayout } from "./AdminClientLayout";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <AdminClientLayout>{children}</AdminClientLayout>;
}
