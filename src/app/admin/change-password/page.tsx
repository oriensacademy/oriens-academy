"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, AlertCircle, ShieldCheck } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { AdminAuthLoader } from "@/components/admin/AdminAuthLoader";

function isStrongPassword(value: string): boolean {
  return (
    value.length >= 8 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

/**
 * Forced password-change screen shown after signing in with a temporary
 * recovery password (user_metadata.force_password_change === true).
 */
export default function AdminChangePasswordPage() {
  const router = useRouter();
  const { status, user, refreshSession } = useAdminAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated" || status === "unauthorized") {
      router.replace("/admin/login");
    }
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated" || status === "unauthorized") {
    return <AdminAuthLoader />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    if (!isStrongPassword(newPassword)) {
      setErrorMsg("Yeni şifre en az 8 karakter olmalı; büyük harf, küçük harf, sayı ve sembol içermelidir.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { force_password_change: false },
    });

    if (error) {
      setLoading(false);
      setErrorMsg(error.message || "Şifre güncellenemedi.");
      return;
    }

    if (user?.id) {
      await supabase.from("audit_logs").insert({
        actor_user_id: user.id,
        action: "admin.password_change_completed",
        entity_type: "admin_auth",
        entity_id: user.id,
        metadata: { trigger: "forced_recovery_change" },
      });
    }

    await refreshSession();
    router.replace("/admin");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 antialiased">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Image src="/brand/oriens-logo-v2.png" alt="Oriens Academy" width={217} height={80} className="h-12 w-auto" priority />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#DDE5DC] bg-[#F6F8F3] p-3.5 text-xs text-[#10271B]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#819586]" />
            <span>Geçici şifreyle giriş yaptınız. Devam etmeden önce yeni bir şifre belirlemeniz gerekiyor.</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {errorMsg && (
              <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground">
                Yeni Şifre
              </label>
              <input
                id="new-password"
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="block w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground">
                Yeni Şifre (Tekrar)
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="block w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground">En az 8 karakter; büyük harf, küçük harf, sayı ve sembol kullanın.</p>

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus:outline-hidden focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <AdminWaveStatus label="Güncelleniyor…" /> : <span className="inline-flex items-center gap-2"><Lock className="size-3.5" />Şifreyi Belirle ve Devam Et</span>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
