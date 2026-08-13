"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LegacyResetPasswordPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/forgot-password");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Link href="/admin/forgot-password" className="text-sm font-semibold text-primary hover:underline">
        Yeni şifre talebi sayfasına git
      </Link>
    </main>
  );
}
