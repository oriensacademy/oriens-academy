"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Lock, AlertCircle } from "lucide-react";
import { AccountWaveLoader } from "@/components/auth/AccountWaveLoader";
import { useLocale } from "@/content/locale-context";
import { forgotPasswordPath, unifiedLoginPath } from "@/lib/routes";
import { getSupabaseClient } from "@/lib/supabase/client";

function isStrongPassword(val: string): boolean {
  return (
    val.length >= 8 &&
    /[a-z]/.test(val) &&
    /[A-Z]/.test(val) &&
    /[0-9]/.test(val) &&
    /[^A-Za-z0-9]/.test(val)
  );
}

function checkInitialRecoveryTokens(): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  return (
    hash.includes("type=recovery") ||
    search.includes("type=recovery") ||
    hash.includes("access_token=") ||
    search.includes("code=")
  );
}

export function ResetPasswordPage() {
  const locale = useLocale();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(checkInitialRecoveryTokens);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseClient();

    // 2. Listen to Supabase auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        setHasRecoverySession(true);
        setIsCheckingSession(false);
      }
    });

    // 3. Fallback active session check
    async function checkCurrentSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session) {
          setHasRecoverySession(true);
        }
      } catch (err) {
        console.warn("[ResetPasswordPage] Session check warning:", err);
      } finally {
        if (mounted) {
          // Give brief delay for hash exchange if token was in URL
          const hasUrlToken =
            typeof window !== "undefined" &&
            (window.location.hash.includes("access_token=") ||
              window.location.search.includes("code="));

          if (!hasUrlToken) {
            setIsCheckingSession(false);
          } else {
            setTimeout(() => {
              if (mounted) setIsCheckingSession(false);
            }, 1200);
          }
        }
      }
    }

    checkCurrentSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;

    if (!isStrongPassword(password)) {
      setError(
        locale === "tr"
          ? "Şifre en az 8 karakter uzunluğunda olmalı; büyük harf, küçük harf, rakam ve özel sembol içermelidir."
          : "Password must be at least 8 characters long and include an uppercase letter, lowercase letter, number, and special character."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        locale === "tr"
          ? "Girdiğiniz şifreler birbiriyle eşleşmiyor."
          : "Passwords do not match."
      );
      return;
    }

    setPending(true);
    setError("");

    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: {
          force_password_change: false,
        },
      });

      if (updateError) {
        setError(
          updateError.message ||
            (locale === "tr"
              ? "Şifreniz güncellenemedi. Lütfen tekrar deneyin."
              : "Could not update your password. Please try again.")
        );
        return;
      }

      setSuccess(true);
    } catch {
      setError(
        locale === "tr"
          ? "Bağlantı sırasında bir sorun oluştu. Lütfen tekrar deneyin."
          : "A connection error occurred. Please try again."
      );
    } finally {
      setPending(false);
    }
  }

  if (isCheckingSession) return <AccountWaveLoader />;

  return (
    <section className="min-h-screen bg-background px-4 pt-28 pb-16 sm:pt-32">
      <div className="mx-auto w-full max-w-md">
        <Link href={unifiedLoginPath(locale)} className="mb-6 flex justify-center">
          <Image
            src="/brand/oriens-logo-v2.png"
            alt="Oriens Academy"
            width={217}
            height={80}
            className="h-14 w-auto"
            priority
          />
        </Link>

        <div className="rounded-3xl border border-border bg-surface p-5 shadow-editorial sm:p-8">
          {success ? (
            <div role="status" className="py-4 text-center">
              <CheckCircle2 className="mx-auto size-12 text-primary" />
              <h2 className="mt-4 font-heading text-xl font-bold text-ink">
                {locale === "tr"
                  ? "Şifreniz Başarıyla Güncellendi"
                  : "Password Successfully Updated"}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {locale === "tr"
                  ? "Yeni şifreniz kaydedildi. Artık yeni şifrenizle hesabınıza güvenle giriş yapabilirsiniz."
                  : "Your new password has been saved. You can now sign in to your account with your updated credentials."}
              </p>
              <Link
                href={unifiedLoginPath(locale)}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-forest transition-colors shadow-xs"
              >
                <ArrowLeft className="size-4" />
                {locale === "tr" ? "Oturum Açın" : "Sign In"}
              </Link>
            </div>
          ) : !hasRecoverySession ? (
            <div role="alert" className="py-4 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-900">
                <AlertCircle className="size-6" />
              </div>
              <h2 className="mt-4 font-heading text-xl font-bold text-ink">
                {locale === "tr" ? "Bağlantı Geçersiz" : "Link Invalid or Expired"}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {locale === "tr"
                  ? "Bu şifre sıfırlama bağlantısının süresi dolmuş veya geçersiz. Lütfen yeni bir şifre sıfırlama bağlantısı talep edin."
                  : "This password reset link is invalid or has expired. Please request a new password reset link."}
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                <Link
                  href={forgotPasswordPath(locale)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-forest transition-colors shadow-xs"
                >
                  {locale === "tr"
                    ? "Yeni Şifre Sıfırlama Bağlantısı İste"
                    : "Request New Password Reset Link"}
                </Link>
                <Link
                  href={unifiedLoginPath(locale)}
                  className="inline-flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground hover:text-ink transition-colors pt-2"
                >
                  <ArrowLeft className="size-3.5" />
                  {locale === "tr" ? "Giriş Sayfasına Dön" : "Return to Sign In"}
                </Link>
              </div>
            </div>
          ) : (
            <>
              <header className="mb-6 text-center">
                <h1 className="font-heading text-3xl font-bold text-ink">
                  {locale === "tr" ? "Şifrenizi Yenileyin" : "Reset Your Password"}
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {locale === "tr"
                    ? "Hesabınız için yeni ve güçlü bir şifre belirleyin."
                    : "Choose a new, strong password for your account."}
                </p>
              </header>

              {error && (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive leading-relaxed"
                >
                  {error}
                </div>
              )}

              <form onSubmit={submit} className="space-y-4">
                <label className="block text-xs font-semibold text-ink">
                  {locale === "tr" ? "Yeni Şifre" : "New Password"}
                  <span className="relative mt-1.5 block">
                    <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      className="min-h-12 w-full rounded-xl border border-input bg-background pr-3 pl-10 text-xs sm:text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
                    />
                  </span>
                </label>

                <label className="block text-xs font-semibold text-ink">
                  {locale === "tr" ? "Yeni Şifre (Tekrar)" : "Confirm New Password"}
                  <span className="relative mt-1.5 block">
                    <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="••••••••"
                      className="min-h-12 w-full rounded-xl border border-input bg-background pr-3 pl-10 text-xs sm:text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
                    />
                  </span>
                </label>

                <p className="text-[11px] text-muted-foreground leading-relaxed bg-surface-muted/60 p-3 rounded-xl border border-border">
                  🔒{" "}
                  {locale === "tr"
                    ? "Şifreniz en az 8 karakter, büyük harf, küçük harf, rakam ve sembol içermelidir."
                    : "Password must be at least 8 characters and include uppercase, lowercase, numbers, and symbols."}
                </p>

                <button
                  type="submit"
                  disabled={pending || !password || !confirmPassword}
                  className="min-h-12 w-full rounded-xl bg-ink px-5 text-xs sm:text-sm font-semibold text-white hover:bg-forest transition-colors shadow-xs disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
                >
                  {pending
                    ? locale === "tr"
                      ? "Güncelleniyor…"
                      : "Updating…"
                    : locale === "tr"
                      ? "Şifreyi Güncelle"
                      : "Update Password"}
                </button>
              </form>

              <div className="mt-5 text-center">
                <Link
                  href={unifiedLoginPath(locale)}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-ink transition-colors"
                >
                  <ArrowLeft className="size-4" />
                  {locale === "tr" ? "Giriş Sayfasına Dön" : "Return to Sign In"}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
