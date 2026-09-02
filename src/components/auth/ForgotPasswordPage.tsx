"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { AccountWaveLoader } from "@/components/auth/AccountWaveLoader";
import { TurnstileWidget, type TurnstileWidgetRef } from "@/components/security/TurnstileWidget";
import { useLocale } from "@/content/locale-context";
import { requestPasswordRecovery } from "@/lib/auth/password-recovery";
import { unifiedLoginPath } from "@/lib/routes";

export function ForgotPasswordPage() {
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const captchaRef = useRef<TurnstileWidgetRef>(null);

  const reset = useCallback(() => setToken(""), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || !email.trim()) return;

    if (!token) {
      setError(
        locale === "tr"
          ? "Güvenlik doğrulaması tamamlanamadı. Lütfen tekrar deneyin."
          : "Security verification could not be completed. Please try again."
      );
      return;
    }

    setPending(true);
    setError("");

    try {
      const res = await requestPasswordRecovery({
        email: email.trim().toLowerCase(),
        locale,
        turnstileToken: token,
      });

      if (!res.success) {
        setError(
          res.error ||
            (locale === "tr"
              ? "Şifre sıfırlama bağlantısı şu anda gönderilemedi. Lütfen daha sonra tekrar deneyin."
              : "Could not send the password reset link at this time. Please try again later.")
        );
        setToken("");
        captchaRef.current?.reset();
        return;
      }

      setSuccess(true);
    } catch {
      setError(
        locale === "tr"
          ? "Bağlantı sırasında bir sorun oluştu. Lütfen tekrar deneyin."
          : "A connection error occurred. Please try again."
      );
      setToken("");
      captchaRef.current?.reset();
    } finally {
      setPending(false);
    }
  }

  if (pending) return <AccountWaveLoader />;

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
                {locale === "tr" ? "Bağlantı Gönderildi" : "Link Sent"}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {locale === "tr"
                  ? "E-posta adresi aktif bir Oriens Academy hesabıyla eşleşiyorsa güvenli şifre sıfırlama bağlantısı gönderildi. Lütfen gelen kutunuzu (ve gerekiyorsa spam klasörünü) kontrol edin."
                  : "If the email matches an active Oriens Academy account, a secure password reset link has been sent. Please check your inbox (and spam folder if needed)."}
              </p>
              <Link
                href={unifiedLoginPath(locale)}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-xs font-semibold text-white hover:bg-forest transition-colors shadow-xs"
              >
                <ArrowLeft className="size-4" />
                {locale === "tr" ? "Oturum Aç sayfasına dön" : "Return to Sign In"}
              </Link>
            </div>
          ) : (
            <>
              <header className="mb-6 text-center">
                <h1 className="font-heading text-3xl font-bold text-ink">
                  {locale === "tr" ? "Şifremi Unuttum" : "Forgot Password"}
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {locale === "tr"
                    ? "Hesabınıza bağlı e-posta adresini girin; size güvenli bir şifre sıfırlama bağlantısı iletelim."
                    : "Enter the email address associated with your account, and we will send you a secure password reset link."}
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
                <label htmlFor="recovery-email" className="block text-xs font-semibold text-ink">
                  {locale === "tr" ? "E-posta Adresi" : "Email Address"}
                  <span className="relative mt-1.5 block">
                    <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="recovery-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="min-h-12 w-full rounded-xl border border-input bg-background pr-3 pl-10 text-xs sm:text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
                    />
                  </span>
                </label>

                <TurnstileWidget
                  ref={captchaRef}
                  action="password_recovery"
                  locale={locale}
                  onVerify={setToken}
                  onExpire={reset}
                  onError={reset}
                  className="items-center"
                />

                <button
                  type="submit"
                  disabled={!email.trim() || !token}
                  className="min-h-12 w-full rounded-xl bg-ink px-5 text-xs sm:text-sm font-semibold text-white hover:bg-forest transition-colors shadow-xs disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
                >
                  {locale === "tr"
                    ? "Şifre Sıfırlama Bağlantısı Gönder"
                    : "Send Password Reset Link"}
                </button>
              </form>

              <div className="mt-5 text-center">
                <Link
                  href={unifiedLoginPath(locale)}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-ink transition-colors"
                >
                  <ArrowLeft className="size-4" />
                  {locale === "tr" ? "Oturum Aç sayfasına dön" : "Return to Sign In"}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
