"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Wave } from "@/components/ui/wave";
import { AlertCircle, CheckCircle2, ChevronRight, Lock, ScrollText, Settings, ShieldCheck } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <div className="max-w-[1440px] space-y-6">
      <header className="border-b border-border pb-5">
        <div className="flex items-center gap-2">
          <Settings className="size-6 text-[#819586]" />
          <h1 className="text-xl font-bold tracking-tight text-[#10271B]">Ayarlar</h1>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Yönetici hesap güvenliğini ve sistem kayıtlarını yönetin.</p>
      </header>

      <Link href="/admin/denetim/" className="group flex items-center justify-between rounded-xl border border-border bg-white p-5 shadow-xs transition-colors hover:bg-surface-muted">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-forest/10 text-primary"><ScrollText className="size-5" /></span>
          <span>
            <span className="block text-sm font-bold text-foreground">Denetim Logları</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">Yönetici işlemlerinin zaman damgalı sistem geçmişini görüntüleyin.</span>
          </span>
        </div>
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>

      <AccountSecuritySection />
    </div>
  );
}

function AccountSecuritySection() {
  const { user } = useAdminAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [securityMsg, setSecurityMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentPassword || !newPassword || passLoading) return;
    if (newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setSecurityMsg({ type: "error", text: "Yeni şifre en az 8 karakter; büyük harf, küçük harf, sayı ve sembol içermelidir." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityMsg({ type: "error", text: "Şifreler eşleşmiyor." });
      return;
    }

    setPassLoading(true);
    setSecurityMsg(null);
    try {
      const supabase = getSupabaseClient();
      if (!user?.email) {
        setSecurityMsg({ type: "error", text: "Yönetici oturumu doğrulanamadı." });
        return;
      }
      const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (reauthError) {
        setSecurityMsg({ type: "error", text: "Mevcut şifre doğrulanamadı." });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setSecurityMsg({ type: "error", text: error.message || "Şifre güncellenemedi." });
        return;
      }
      await supabase.from("audit_logs").insert({ actor_user_id: user.id, action: "admin.password_change_completed", entity_type: "admin_auth", entity_id: user.id, metadata: { trigger: "voluntary_settings_change" } });
      setSecurityMsg({ type: "success", text: "Şifreniz başarıyla değiştirildi." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setSecurityMsg({ type: "error", text: "Bir hata oluştu." });
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <section className="space-y-6 rounded-xl border border-border bg-white p-6 shadow-xs">
      <div className="border-b border-border pb-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><ShieldCheck className="size-4 text-[#819586]" /><span>Hesap Güvenliği</span></h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Yönetici hesabınızın giriş şifresini güvenli olarak değiştirin.</p>
      </div>

      {securityMsg && (
        <div role={securityMsg.type === "error" ? "alert" : "status"} className={`flex items-center gap-2 rounded-lg border p-3 text-xs ${securityMsg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {securityMsg.type === "success" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
          <span>{securityMsg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-2 rounded-lg border border-border bg-background-soft/50 p-4">
          <div className="text-xs font-bold text-foreground">Yönetici E-postası</div>
          <div className="break-all text-xs text-muted-foreground">{user?.email}</div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">E-posta değişikliği bu panelden yapılmaz.</p>
        </div>
        <form onSubmit={handleUpdatePassword} className="space-y-3 rounded-lg border border-border bg-background-soft/50 p-4">
          <div className="text-xs font-bold text-foreground">Şifre Değiştir</div>
          <input type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Mevcut Şifre" className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground" />
          <input type="password" required autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Yeni Şifre" className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground" />
          <input type="password" required autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Yeni Şifre Tekrarı" className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">En az 8 karakter; büyük harf, küçük harf, sayı ve sembol kullanın.</p>
          <button type="submit" disabled={passLoading || !currentPassword || !newPassword || !confirmPassword} className="inline-flex items-center gap-1.5 rounded-lg bg-[#10271B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0D2A1C] disabled:cursor-not-allowed disabled:opacity-40">
            {passLoading ? <Wave className="h-3.5 w-7 text-white" aria-label="Şifre güncelleniyor" /> : <Lock className="size-3.5" />}
            <span>Şifreyi Güncelle</span>
          </button>
        </form>
      </div>
    </section>
  );
}
