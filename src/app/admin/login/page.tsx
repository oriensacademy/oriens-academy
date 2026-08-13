"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { adminSignIn } from "@/lib/supabase/auth";
import { Eye, EyeOff, Lock, Mail, AlertCircle, ShieldCheck } from "lucide-react";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";

export default function AdminLoginPage() {
  const { status, refreshSession } = useAdminAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Redirect if already authenticated as admin
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/admin");
    }
  }, [status, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { user, error } = await adminSignIn(email.trim(), password);

      if (error || !user) {
        if (error?.status === 403 || error?.name === "UnauthorizedError") {
          setErrorMessage(error.message || "Bu hesap yönetici yetkisine sahip değil.");
        } else {
          setErrorMessage("Geçersiz e-posta adresi veya şifre.");
        }
        setIsSubmitting(false);
        return;
      }

      // Refresh auth context state & navigate to /admin
      await refreshSession();
      router.replace("/admin");
    } catch (err) {
      console.error("[AdminLogin] Login error:", err);
      setErrorMessage("Giriş yapılırken beklenmeyen bir hata oluştu.");
      setIsSubmitting(false);
    }
  };

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 antialiased">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 shadow-sm">
          <Image src="/brand/oriens-logo-v2.png" alt="Oriens Academy" width={217} height={80} className="h-10 w-auto" priority />
          <AdminWaveStatus label="Doğrulanıyor…" className="mt-2 text-xs font-semibold text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 antialiased">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-6 flex justify-center">
          <Link href="/tr" className="inline-block">
            <Image src="/brand/oriens-logo-v2.png" alt="Oriens Academy" width={217} height={80} className="h-14 w-auto" priority />
          </Link>
        </div>

        {/* Login Form Container */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive font-sans"
            >
              <AlertCircle className="size-4 shrink-0 text-destructive mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email Field */}
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-semibold uppercase tracking-wider text-foreground font-ui"
              >
                E-posta
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
                  <Mail className="size-4" />
                </div>
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-posta adresiniz"
                  className="block w-full rounded-lg border border-input bg-card pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/15 font-sans"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-semibold uppercase tracking-wider text-foreground font-ui"
                >
                  Şifre
                </label>
                <Link
                  href="/admin/forgot-password"
                  className="text-xs font-medium text-primary hover:underline font-ui"
                >
                  Şifremi Unuttum
                </Link>
              </div>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
                  <Lock className="size-4" />
                </div>
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifreniz"
                  className="block w-full rounded-lg border border-input bg-card pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/15 font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label={showPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !email || !password}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold font-ui text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus:outline-hidden focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer uppercase tracking-wider mt-2"
            >
              {isSubmitting ? (
                <>
                  <AdminWaveStatus label="Giriş yapılıyor" className="text-primary-foreground" />
                </>
              ) : (
                <>
                  <ShieldCheck className="size-4 text-primary-foreground" />
                  <span>Giriş Yap</span>
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
