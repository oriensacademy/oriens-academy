"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { AccountWaveLoader } from "@/components/auth/AccountWaveLoader";
import { useLocale } from "@/content/locale-context";
import { forgotPasswordPath, unifiedLoginPath } from "@/lib/routes";
import { getSupabaseClient } from "@/lib/supabase/client";
import { recordAccountEvent } from "@/lib/auth/login-events";
import { localizeErrorMessage } from "@/lib/utils/error-messages";

const PASSWORD_RULES = [
  { test: (val: string) => val.length >= 8, tr: "En az 8 karakter", en: "At least 8 characters" },
  { test: (val: string) => /[A-Z]/.test(val) && /[a-z]/.test(val), tr: "Büyük ve küçük harf", en: "Upper and lowercase letters" },
  { test: (val: string) => /[0-9]/.test(val), tr: "En az bir rakam", en: "At least one number" },
  { test: (val: string) => /[^A-Za-z0-9]/.test(val), tr: "En az bir sembol", en: "At least one symbol" },
];

function isStrongPassword(val: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(val));
}

const svgProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function LockIcon() {
  return (
    <svg {...svgProps}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <path d="M12 14.5v2" />
    </svg>
  );
}

function ShieldCheckIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...svgProps} width={size} height={size}>
      <path d="M12 3 5 5.8v5.4c0 4.3 2.9 8.2 7 9.8 4.1-1.6 7-5.5 7-9.8V5.8z" />
      <path d="m9.2 12.2 2 2 3.8-4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg {...svgProps}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg {...svgProps}>
      <path d="M9.9 5.7A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4" />
      <path d="M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.9 0 3.5-.6 4.9-1.5" />
      <path d="M10 10a2.8 2.8 0 0 0 4 4" />
      <path d="m3 3 18 18" />
    </svg>
  );
}

function RuleMark({ ok }: { ok: boolean }) {
  return (
    <span
      className={`flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
        ok ? "border-primary bg-primary text-white" : "border-border bg-background text-transparent"
      }`}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

function PasswordField({
  label,
  icon,
  value,
  onChange,
  invalid,
  describedBy,
  disabled,
  isTr,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  isTr: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible ? (isTr ? "Şifreyi gizle" : "Hide password") : isTr ? "Şifreyi göster" : "Show password";
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-ink">
        {label}
      </label>
      <div className="group relative mt-1.5">
        <span
          className={`pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 transition-colors ${
            invalid ? "text-destructive" : "text-muted-foreground group-focus-within:text-primary"
          }`}
        >
          {icon}
        </span>
        <input
          id={id}
          type={visible ? "text" : "password"}
          required
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          placeholder="••••••••"
          className={`min-h-12 w-full rounded-xl border bg-background pr-12 pl-11 text-base text-ink outline-none transition-all placeholder:text-muted-foreground/60 hover:border-ink/25 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm ${
            invalid
              ? "border-destructive/60 hover:border-destructive/70 focus:border-destructive focus:ring-destructive/15"
              : "border-input focus:border-primary focus:ring-primary/15"
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          aria-controls={id}
          aria-pressed={visible}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-ink focus-visible:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset active:scale-95 disabled:cursor-not-allowed"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
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
  const rulesId = useId();
  const mismatchId = useId();
  const isTr = locale === "tr";
  // Tekrar alanı en az ilk alan kadar uzunsa uyuşmazlık gösterilir (yazarken uyarmaz).
  const mismatch = confirmPassword.length > 0 && confirmPassword.length >= password.length && confirmPassword !== password;

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
        // Sunucu mesajı İngilizce gelir; kullanıcıya her zaman yerelleştirilmiş metin gösterilir.
        setError(
          localizeErrorMessage(
            updateError,
            isTr ? "tr" : "en",
            isTr ? "Şifreniz güncellenemedi. Lütfen tekrar deneyin." : "Could not update your password. Please try again."
          )
        );
        return;
      }

      await recordAccountEvent("password_changed");
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
                <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                  <ShieldCheckIcon size={22} />
                </span>
                <h1 className="font-heading text-2xl font-bold text-ink sm:text-3xl">
                  {isTr ? "Şifrenizi Yenileyin" : "Reset Your Password"}
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {isTr
                    ? "Hesabınız için yeni ve güçlü bir şifre belirleyin."
                    : "Choose a new, strong password for your account."}
                </p>
              </header>

              {error && (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-xs leading-relaxed text-destructive sm:text-sm"
                >
                  <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">{error}</span>
                </div>
              )}

              <form onSubmit={submit} className="space-y-4" noValidate>
                <PasswordField
                  label={isTr ? "Yeni Şifre" : "New Password"}
                  icon={<LockIcon />}
                  value={password}
                  onChange={(value) => {
                    setPassword(value);
                    if (error) setError("");
                  }}
                  invalid={Boolean(error) && !isStrongPassword(password)}
                  describedBy={rulesId}
                  disabled={pending}
                  isTr={isTr}
                />

                <div>
                  <PasswordField
                    label={isTr ? "Yeni Şifre (Tekrar)" : "Confirm New Password"}
                    icon={<ShieldCheckIcon />}
                    value={confirmPassword}
                    onChange={(value) => {
                      setConfirmPassword(value);
                      if (error) setError("");
                    }}
                    invalid={mismatch}
                    describedBy={mismatch ? mismatchId : undefined}
                    disabled={pending}
                    isTr={isTr}
                  />
                  {mismatch && (
                    <p id={mismatchId} className="mt-1.5 text-xs text-destructive">
                      {isTr ? "Şifreler eşleşmiyor." : "Passwords do not match."}
                    </p>
                  )}
                </div>

                <ul
                  id={rulesId}
                  className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-xl border border-border bg-surface-muted/60 p-3.5 text-xs text-muted-foreground min-[400px]:grid-cols-2"
                >
                  {PASSWORD_RULES.map((rule) => {
                    const ok = rule.test(password);
                    return (
                      <li key={rule.en} className={`flex items-center gap-2 transition-colors ${ok ? "text-ink" : ""}`}>
                        <RuleMark ok={ok} />
                        <span>{isTr ? rule.tr : rule.en}</span>
                        {ok && <span className="sr-only">{isTr ? "(karşılandı)" : "(met)"}</span>}
                      </li>
                    );
                  })}
                </ul>

                <button
                  type="submit"
                  disabled={pending || !password || !confirmPassword}
                  aria-busy={pending}
                  className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {pending && (
                    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="2.5" />
                      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  )}
                  {pending ? (isTr ? "Güncelleniyor…" : "Updating…") : isTr ? "Şifreyi Güncelle" : "Update Password"}
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
