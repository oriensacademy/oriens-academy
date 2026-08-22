"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { AccountWaveLoader } from "@/components/auth/AccountWaveLoader";
import { useLocale } from "@/content/locale-context";
import { useAccount } from "@/lib/auth/account-context";
import { destinationForAccount, safeReturnPath } from "@/lib/auth/account-routing";
import { changePasswordPath, forgotPasswordPath, localizedPath, studentRegisterPath } from "@/lib/routes";

export function UnifiedLoginPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accountType, user, isInitializing, signIn } = useAccount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigatedRef = useRef(false);
  const requested = safeReturnPath(searchParams.get("next"));

  useEffect(() => {
    if (isInitializing || navigatedRef.current || !["admin", "student"].includes(accountType)) return;
    navigatedRef.current = true;
    const destination = user?.user_metadata?.force_password_change === true
      ? changePasswordPath(locale)
      : destinationForAccount(accountType, locale, requested);
    router.replace(destination);
  }, [accountType, isInitializing, locale, requested, router, user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    const result = await signIn(email, password);
    if (result.error) {
      setSubmitting(false);
      setError(locale === "tr" ? "E-posta adresi veya şifre doğrulanamadı." : "The email address or password could not be verified.");
      return;
    }
    if (result.accountType === "unknown") {
      setSubmitting(false);
      setError(locale === "tr" ? "Bu hesap için aktif bir Oriens Academy profili bulunamadı." : "No active Oriens Academy profile was found for this account.");
      return;
    }
    navigatedRef.current = true;
    const destination = result.user?.user_metadata?.force_password_change === true
      ? changePasswordPath(locale)
      : destinationForAccount(result.accountType, locale, requested);
    router.replace(destination);
  }

  if (isInitializing || submitting || accountType === "admin" || accountType === "student") return <AccountWaveLoader />;

  return <section className="min-h-screen bg-background px-4 pt-28 pb-16 sm:pt-32"><div className="mx-auto w-full max-w-md">
    <Link href={localizedPath("home", locale)} className="mb-6 flex justify-center" aria-label="Oriens Academy"><Image src="/brand/oriens-logo-v2.png" alt="Oriens Academy" width={217} height={80} className="h-14 w-auto" priority /></Link>
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-editorial sm:p-8">
      <header className="mb-6 text-center"><h1 className="font-heading text-3xl text-ink">{locale === "tr" ? "Oturum Aç" : "Sign In"}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{locale === "tr" ? "Oriens Academy hesabınıza güvenle erişin." : "Securely access your Oriens Academy account."}</p></header>
      {error && <div role="alert" className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">{error}</div>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <label className="block text-xs font-semibold text-ink" htmlFor="account-email">{locale === "tr" ? "E-posta" : "Email"}<span className="relative mt-1.5 block"><Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"/><input id="account-email" type="email" required autoComplete="email" value={email} onChange={(event)=>setEmail(event.target.value)} className="min-h-12 w-full rounded-xl border border-input bg-background pr-3 pl-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></span></label>
        <label className="block text-xs font-semibold text-ink" htmlFor="account-password"><span className="flex items-center justify-between gap-3"><span>{locale === "tr" ? "Şifre" : "Password"}</span><Link href={forgotPasswordPath(locale)} className="font-medium text-primary hover:underline">{locale === "tr" ? "Şifremi Unuttum" : "Forgot Password"}</Link></span><span className="relative mt-1.5 block"><Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"/><input id="account-password" type={showPassword?"text":"password"} required autoComplete="current-password" value={password} onChange={(event)=>setPassword(event.target.value)} className="min-h-12 w-full rounded-xl border border-input bg-background pr-11 pl-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"/><button type="button" onClick={()=>setShowPassword((value)=>!value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground" aria-label={showPassword?(locale==="tr"?"Şifreyi gizle":"Hide password"):(locale==="tr"?"Şifreyi göster":"Show password")}>{showPassword?<EyeOff className="size-4"/>:<Eye className="size-4"/>}</button></span></label>
        <button type="submit" disabled={!email.trim()||!password} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45">{locale === "tr" ? "Oturum Aç" : "Sign In"}<ArrowRight className="size-4"/></button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">{locale === "tr" ? "Hesabınız yok mu?" : "Don't have an account?"} <Link href={studentRegisterPath(locale)} className="font-semibold text-ink underline decoration-primary underline-offset-4">{locale === "tr" ? "Kayıt Ol" : "Create Account"}</Link></p>
    </div>
  </div></section>;
}
