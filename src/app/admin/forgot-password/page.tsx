"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  TurnstileWidget,
  type TurnstileWidgetRef,
} from "@/components/security/TurnstileWidget";

const NEUTRAL_MESSAGE =
  "E-posta adresi yönetici hesabıyla eşleşiyorsa yeni giriş bilgileri gönderildi.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const handleVerify = useCallback((token: string) => setTurnstileToken(token), []);
  const handleTurnstileReset = useCallback(() => setTurnstileToken(""), []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!email.trim()) {
      setErrorMsg("Lütfen e-posta adresinizi girin.");
      return;
    }
    if (!turnstileToken) {
      setErrorMsg("Lütfen güvenlik doğrulamasını tamamlayın.");
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.functions.invoke("admin-password-reset", {
        body: { email: email.trim(), locale: "tr", turnstileToken },
      });
      if (error) {
        setErrorMsg("İstek şu anda işlenemedi. Lütfen daha sonra tekrar deneyin.");
        setTurnstileToken("");
        turnstileRef.current?.reset();
        return;
      }
      setIsSuccess(true);
    } catch {
      setErrorMsg("İstek şu anda işlenemedi. Lütfen daha sonra tekrar deneyin.");
      setTurnstileToken("");
      turnstileRef.current?.reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 antialiased">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link href="/admin/login" className="inline-block">
            <Image src="/brand/oriens-logo-v2.png" alt="Oriens Academy" width={217} height={80} className="h-12 w-auto" priority />
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {isSuccess ? (
            <div className="space-y-4 py-3 text-center" role="status">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="size-6" />
              </div>
              <p className="text-sm leading-relaxed text-foreground">{NEUTRAL_MESSAGE}</p>
              <div className="pt-3">
                <Link href="/admin/login" className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline">
                  <ArrowLeft className="size-3.5" />
                  <span>Giriş Sayfasına Dön</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {errorMsg && (
                <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label htmlFor="reset-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground">
                  Yönetici E-posta
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
                    <Mail className="size-4" />
                  </div>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="E-posta adresiniz"
                    className="block w-full rounded-xl border border-input bg-background py-2.5 pr-3 pl-10 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <TurnstileWidget
                ref={turnstileRef}
                action="admin_password_reset"
                locale="tr"
                onVerify={handleVerify}
                onExpire={handleTurnstileReset}
                onError={handleTurnstileReset}
                className="items-center"
              />

              <button
                type="submit"
                disabled={isSubmitting || !email.trim() || !turnstileToken}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus:outline-hidden focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? <AdminWaveStatus label="Gönderiliyor…" /> : <span>Yeni Giriş Şifresi Gönder</span>}
              </button>

              <div className="pt-2 text-center">
                <Link href="/admin/login" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                  <ArrowLeft className="size-3.5" />
                  <span>Giriş Sayfasına Dön</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
