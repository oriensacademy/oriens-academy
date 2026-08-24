"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, Phone, User as UserIcon } from "lucide-react";
import { AccountWaveLoader } from "@/components/auth/AccountWaveLoader";
import { AuthSwitch } from "@/components/ui/auth-switch";
import { StudentOnboardingPersonalization } from "@/components/student/StudentOnboardingPersonalization";
import { useLocale } from "@/content/locale-context";
import { useAccount } from "@/lib/auth/account-context";
import { destinationForAccount, safeReturnPath } from "@/lib/auth/account-routing";
import { changePasswordPath, forgotPasswordPath, localizedPath } from "@/lib/routes";
import { registerStudent, validateStudentPhone } from "@/lib/student/auth";
import { claimAnonymousExamResult } from "@/lib/student/exam-history";

export function UnifiedLoginPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accountType, user, isInitializing, signIn } = useAccount();
  const isTr = locale === "tr";

  const [mode, setMode] = useState<"login" | "register">(() => {
    if (typeof window === "undefined") return "login";
    try {
      if (sessionStorage.getItem("oriens.pendingSignupEmail")) return "register";
    } catch {
      // safe fallback
    }
    return window.location.pathname.includes("kayit") || window.location.pathname.includes("register")
      ? "register"
      : "login";
  });
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return sessionStorage.getItem("oriens.pendingSignupEmail") || "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Register fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const navigatedRef = useRef(false);
  const requested = safeReturnPath(searchParams.get("next"));

  // Check URL query for register mode
  useEffect(() => {
    if (searchParams.get("mode") === "register") {
      queueMicrotask(() => setMode("register"));
    }
  }, [searchParams]);

  const tryClaimPendingResult = async () => {
    try {
      if (typeof window !== "undefined") {
        const pendingClaimToken = sessionStorage.getItem("oriens.pendingExamClaimToken");
        if (pendingClaimToken) {
          await claimAnonymousExamResult(pendingClaimToken);
          sessionStorage.removeItem("oriens.pendingExamClaimToken");
          sessionStorage.removeItem("oriens.pendingSignupEmail");
        }
      }
    } catch {
      // safe fallback
    }
  };

  useEffect(() => {
    if (isInitializing || navigatedRef.current || !["admin", "student"].includes(accountType)) return;
    if (showOnboarding) return;

    navigatedRef.current = true;
    const destination = user?.user_metadata?.force_password_change === true
      ? changePasswordPath(locale)
      : destinationForAccount(accountType, locale, requested);
    router.replace(destination);
  }, [accountType, isInitializing, locale, requested, router, showOnboarding, user]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    const result = await signIn(email, password);
    if (result.error) {
      setSubmitting(false);
      setError(isTr ? "E-posta adresi veya şifre doğrulanamadı." : "The email address or password could not be verified.");
      return;
    }
    if (result.accountType === "unknown") {
      setSubmitting(false);
      setError(isTr ? "Bu hesap için aktif bir Oriens Academy profili bulunamadı." : "No active Oriens Academy profile was found for this account.");
      return;
    }

    await tryClaimPendingResult();

    navigatedRef.current = true;
    const destination = result.user?.user_metadata?.force_password_change === true
      ? changePasswordPath(locale)
      : destinationForAccount(result.accountType, locale, requested);
    router.replace(destination);
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError("");

    if (!termsAccepted) {
      setError(isTr ? "Lütfen gizlilik politikasını ve kullanım koşullarını onaylayın." : "Please accept the privacy policy and terms of service.");
      return;
    }
    const phoneCheck = validateStudentPhone(phone, isTr);
    if (!phoneCheck.valid) {
      setError(phoneCheck.error || (isTr ? "Lütfen geçerli bir telefon numarası girin." : "Please enter a valid phone number."));
      return;
    }
    if (password !== confirmPassword) {
      setError(isTr ? "Girilen şifreler birbiriyle eşleşmiyor." : "The passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError(isTr ? "Şifreniz en az 6 karakter olmalıdır." : "Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const regResult = await registerStudent({
        fullName,
        email,
        phone,
        password,
        locale,
      });

      if (regResult.error) {
        setSubmitting(false);
        setError(
          regResult.error.message.includes("User already registered")
            ? isTr
              ? "Bu e-posta adresi ile kayıtlı bir hesap zaten mevcut. Lütfen giriş yapın."
              : "An account with this email already exists. Please log in."
            : regResult.error.message || (isTr ? "Kayıt işlemi gerçekleştirilemedi." : "Registration could not be completed.")
        );
        return;
      }

      await tryClaimPendingResult();

      // If signUp returned an active session directly
      if (regResult.data?.session && regResult.data?.user) {
        setSubmitting(false);
        setRegisteredUserId(regResult.data.user.id);
        setShowOnboarding(true);
        return;
      }

      // Attempt immediate sign-in with credentials
      const loginResult = await signIn(email, password);
      setSubmitting(false);

      if (loginResult.user) {
        setRegisteredUserId(loginResult.user.id);
        setShowOnboarding(true);
      } else if (regResult.data?.user && !regResult.data.session) {
        // If email confirmation is enabled on Supabase project and blocking immediate session
        setRegisteredUserId(regResult.data.user.id);
        setError(
          isTr
            ? "Hesabınız başarıyla oluşturuldu! Lütfen e-postanıza gönderilen onay bağlantısını tıklayarak giriş yapınız."
            : "Account created successfully! Please check your email to confirm your account and sign in."
        );
      } else {
        // Fallback for dev mode
        setRegisteredUserId("new-student-id");
        setShowOnboarding(true);
      }
    } catch (err: unknown) {
      setSubmitting(false);
      const msg = err instanceof Error ? err.message : "";
      setError(msg || (isTr ? "Kayıt sırasında bir hata oluştu." : "An error occurred during registration."));
    }
  }

  const handleOnboardingComplete = () => {
    navigatedRef.current = true;
    const destination = destinationForAccount("student", locale, requested);
    router.replace(destination);
  };

  if (isInitializing || (accountType !== "unauthenticated" && !showOnboarding)) {
    return <AccountWaveLoader />;
  }

  if (showOnboarding) {
    return (
      <section className="min-h-screen bg-background px-4 pt-28 pb-16 sm:pt-36">
        <StudentOnboardingPersonalization
          studentId={registeredUserId || user?.id || ""}
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingComplete}
        />
      </section>
    );
  }

  const isFromCheckout = searchParams.get("source") === "checkout" || (requested && (requested.includes("payment") || requested.includes("cart") || requested.includes("odeme") || requested.includes("sepet")));

  return (
    <section className="min-h-screen bg-background px-4 pt-28 pb-16 sm:pt-36">
      <div className="mx-auto w-full max-w-md">
        {/* Single clean card without redundant secondary logo */}
        <div className="rounded-3xl border border-border bg-surface p-6 shadow-editorial sm:p-8">
          {isFromCheckout && (
            <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
              <p className="text-xs font-semibold text-primary sm:text-sm">
                {isTr
                  ? "Satın alma işlemine devam etmek için oturum açın veya hesap oluşturun."
                  : "Please sign in or create an account to proceed with your purchase."}
              </p>
            </div>
          )}

          <AuthSwitch
            activeTab={mode}
            onChange={(tab) => {
              setMode(tab);
              setError("");
            }}
            loginLabel={isTr ? "Oturum Aç" : "Sign In"}
            registerLabel={isTr ? "Kayıt Ol" : "Create Account"}
            className="mb-6"
          />

          <header className="mb-6 text-center">
            <h1 className="font-heading text-2xl text-ink sm:text-3xl">
              {mode === "login"
                ? isTr
                  ? "Oturum Aç"
                  : "Sign In"
                : isTr
                ? "Öğrenci Hesabı Oluştur"
                : "Create Student Account"}
            </h1>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              {mode === "login"
                ? isTr
                  ? "Oriens Academy hesabınıza güvenle erişin."
                  : "Securely access your Oriens Academy account."
                : isTr
                ? "Derslerinizi, ödevlerinizi ve eğitim paketlerinizi tek panelden yönetin."
                : "Manage your lessons, homework, and packages in one unified portal."}
            </p>
          </header>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === "login" ? (
            /* Login Form */
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <label className="block text-xs font-semibold text-ink" htmlFor="account-email">
                {isTr ? "E-posta" : "Email"}
                <span className="relative mt-1.5 block">
                  <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="account-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="min-h-12 w-full rounded-xl border border-input bg-background pr-3 pl-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </span>
              </label>

              <label className="block text-xs font-semibold text-ink" htmlFor="account-password">
                <span className="flex items-center justify-between gap-3">
                  <span>{isTr ? "Şifre" : "Password"}</span>
                  <Link
                    href={forgotPasswordPath(locale)}
                    className="font-medium text-primary hover:underline text-xs"
                  >
                    {isTr ? "Şifremi Unuttum" : "Forgot Password"}
                  </Link>
                </span>
                <span className="relative mt-1.5 block">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="account-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="min-h-12 w-full rounded-xl border border-input bg-background pr-11 pl-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-ink"
                    aria-label={
                      showPassword
                        ? isTr
                          ? "Şifreyi gizle"
                          : "Hide password"
                        : isTr
                        ? "Şifreyi göster"
                        : "Show password"
                    }
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </span>
              </label>

              <button
                type="submit"
                disabled={!email.trim() || !password || submitting}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45"
              >
                {submitting ? (
                  <span>{isTr ? "Giriş yapılıyor..." : "Signing in..."}</span>
                ) : (
                  <>
                    <span>{isTr ? "Oturum Aç" : "Sign In"}</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                {isTr ? "Hesabınız yok mu?" : "Don't have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                  className="font-semibold text-ink underline decoration-primary underline-offset-4"
                >
                  {isTr ? "Kayıt Ol" : "Create Account"}
                </button>
              </p>
            </form>
          ) : (
            /* Minimal Initial Registration Form */
            <form onSubmit={handleRegister} className="space-y-3.5" noValidate>
              <label className="block text-xs font-semibold text-ink" htmlFor="register-name">
                {isTr ? "Ad Soyad" : "Full Name"}
                <span className="relative mt-1 block">
                  <UserIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="register-name"
                    type="text"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={isTr ? "Adınız Soyadınız" : "Your full name"}
                    className="min-h-11 w-full rounded-xl border border-input bg-background pr-3 pl-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </span>
              </label>

              <label className="block text-xs font-semibold text-ink" htmlFor="register-email">
                {isTr ? "E-posta" : "Email"}
                <span className="relative mt-1 block">
                  <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="register-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={isTr ? "E-posta adresiniz" : "Your email address"}
                    className="min-h-11 w-full rounded-xl border border-input bg-background pr-3 pl-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </span>
              </label>

              <label className="block text-xs font-semibold text-ink" htmlFor="register-phone">
                {isTr ? "Telefon" : "Phone"}
                <span className="relative mt-1 block">
                  <Phone className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="register-phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-input bg-background pr-3 pl-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </span>
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-ink" htmlFor="register-password">
                  {isTr ? "Şifre" : "Password"}
                  <span className="relative mt-1 block">
                    <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="register-password"
                      type="password"
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="min-h-11 w-full rounded-xl border border-input bg-background pr-3 pl-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </span>
                </label>

                <label className="block text-xs font-semibold text-ink" htmlFor="register-confirm">
                  {isTr ? "Şifre Tekrar" : "Confirm Password"}
                  <span className="relative mt-1 block">
                    <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="register-confirm"
                      type="password"
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="min-h-11 w-full rounded-xl border border-input bg-background pr-3 pl-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </span>
                </label>
              </div>

              {/* Terms & Privacy */}
              <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-[11px] leading-4 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-input text-primary focus:ring-primary"
                />
                <span>
                  <Link
                    href={localizedPath("privacy", locale)}
                    target="_blank"
                    className="font-semibold text-ink underline"
                  >
                    {isTr ? "Gizlilik Politikası" : "Privacy Policy"}
                  </Link>{" "}
                  {isTr ? "ve" : "and"}{" "}
                  <Link
                    href={localizedPath("terms", locale)}
                    target="_blank"
                    className="font-semibold text-ink underline"
                  >
                    {isTr ? "Kullanım Koşulları" : "Terms of Service"}
                  </Link>
                  {isTr ? "'nı kabul ediyorum." : "."}
                </span>
              </label>

              <button
                type="submit"
                disabled={!fullName.trim() || !email.trim() || !password || !confirmPassword || !termsAccepted || submitting}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45"
              >
                {submitting ? (
                  <span>{isTr ? "Hesap oluşturuluyor..." : "Creating account..."}</span>
                ) : (
                  <>
                    <span>{isTr ? "Kayıt Ol ve Devam Et" : "Create Account & Continue"}</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                {isTr ? "Zaten bir hesabınız var mı?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                  className="font-semibold text-ink underline decoration-primary underline-offset-4"
                >
                  {isTr ? "Oturum Aç" : "Sign In"}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
