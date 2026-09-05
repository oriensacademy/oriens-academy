"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { requestPurchaseEmailVerification, verifyPurchaseEmailVerification } from "@/lib/payments/email-verification";
import { requestEmailChange, verifyEmailChangeOtp } from "@/lib/student/auth";
import { localizeErrorMessage } from "@/lib/utils/error-messages";

interface EmailOtpGateProps {
  email: string;
  locale: "tr" | "en";
  mode?: "signup" | "email_change";
  onVerified: () => void;
  onChangeEmail?: () => void;
  onLogout?: () => void;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

export function EmailOtpGate({ email, locale, mode = "signup", onVerified, onChangeEmail, onLogout }: EmailOtpGateProps) {
  const isTr = locale === "tr";
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const sentOnceRef = useRef(false);

  // The gate is a conditional render inside the portal/login screens, so any
  // parent reload unmounts and remounts it. A per-mount guard therefore fired a
  // fresh code request on every refresh, which superseded the challenge the user
  // was still holding -- their correct code then reported as wrong and burned an
  // attempt. Scope the "already sent" marker to the session and the identity
  // instead, so a remount reuses the code already in the user's inbox.
  const autoSendKey = `oriens_otp_sent:${mode}:${email.trim().toLowerCase()}`;

  function clearAutoSendMarker() {
    try {
      window.sessionStorage.removeItem(autoSendKey);
    } catch {
      // Non-fatal.
    }
  }

  async function sendCode(silent: boolean) {
    if (!email || sending) return;
    setSending(true);
    if (!silent) {
      setError("");
      setInfo("");
    }
    try {
      const res = mode === "email_change"
        ? await requestEmailChange(email, locale)
        : await requestPurchaseEmailVerification(email, locale);

      if (!res.success) {
        if (res.error_code === "RESEND_COOLDOWN" && res.resend_available_at) {
          const seconds = Math.max(0, Math.round((new Date(res.resend_available_at).getTime() - Date.now()) / 1000));
          setResendCooldown(seconds);
        } else if (!silent) {
          setError(localizeErrorMessage(res.message, locale, isTr ? "Doğrulama kodu gönderilemedi." : "The verification code could not be sent."));
        }
        return;
      }
      setResendCooldown(60);
      try {
        window.sessionStorage.setItem(autoSendKey, "1");
      } catch {
        // Non-fatal.
      }
      if (!silent) setInfo(isTr ? "Yeni bir kod gönderildi." : "A new code has been sent.");
    } catch {
      if (!silent) setError(isTr ? "Doğrulama kodu gönderilemedi. Lütfen tekrar deneyin." : "The verification code could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (sentOnceRef.current) return;
    sentOnceRef.current = true;
    let alreadySent = false;
    try {
      alreadySent = window.sessionStorage.getItem(autoSendKey) === "1";
    } catch {
      // Private mode / storage blocked: fall back to sending once per mount.
    }
    if (alreadySent) {
      setInfo(
        isTr
          ? "Doğrulama kodu e-posta adresinize gönderildi. Gelen kutunuzu kontrol edin."
          : "A verification code was sent to your email address. Please check your inbox."
      );
      return;
    }
    try {
      window.sessionStorage.setItem(autoSendKey, "1");
    } catch {
      // Non-fatal.
    }
    void sendCode(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSendKey]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code) || verifying) return;
    setVerifying(true);
    setError("");
    try {
      const res = mode === "email_change"
        ? await verifyEmailChangeOtp(code, locale)
        : await verifyPurchaseEmailVerification(email, code, locale);

      if (!res.success) {
        // The account is already verified server-side (e.g. this tab is stale):
        // that is a success for the user, not an error to stare at.
        if (res.error_code === "ALREADY_VERIFIED") {
          clearAutoSendMarker();
          onVerified();
          return;
        }
        setError(localizeErrorMessage(res.message, locale, isTr ? "Doğrulama başarısız oldu." : "Verification failed."));
        return;
      }
      clearAutoSendMarker();
      onVerified();
    } catch {
      setError(isTr ? "Doğrulama başarısız oldu. Lütfen tekrar deneyin." : "Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <section className="min-h-screen bg-background px-3 pt-28 pb-16 sm:px-4 sm:pt-36">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-3xl border border-border bg-surface p-5 text-center shadow-editorial sm:p-8">
          <Mail className="mx-auto size-10 text-primary" />
          <h1 className="mt-4 font-heading text-2xl text-ink">
            {isTr ? "E-posta Adresinizi Doğrulayın" : "Verify Your Email Address"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {isTr
              ? `${maskEmail(email)} adresine gönderilen 6 haneli kodu girin.`
              : `Enter the 6-digit code sent to ${maskEmail(email)}.`}
          </p>

          {error ? (
            <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </p>
          ) : null}
          {info ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{info}</p>
          ) : null}

          <form onSubmit={handleVerify} className="mt-6 space-y-4">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              aria-label={isTr ? "6 haneli doğrulama kodu" : "6-digit verification code"}
              className="mx-auto block min-h-14 w-48 rounded-xl border border-input bg-background text-center text-2xl font-mono font-bold tracking-[0.4em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <button
              type="submit"
              disabled={code.length !== 6 || verifying}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45"
            >
              {verifying ? (isTr ? "Doğrulanıyor..." : "Verifying...") : (isTr ? "Doğrula" : "Verify")}
            </button>
          </form>

          <div className="mt-5 flex flex-col items-center gap-2 text-xs">
            <button
              type="button"
              disabled={sending || resendCooldown > 0}
              onClick={() => void sendCode(false)}
              className="font-semibold text-primary underline decoration-primary underline-offset-4 disabled:opacity-45 disabled:no-underline"
            >
              {resendCooldown > 0
                ? (isTr ? `Kodu Tekrar Gönder (${resendCooldown}sn)` : `Resend Code (${resendCooldown}s)`)
                : (isTr ? "Kodu Tekrar Gönder" : "Resend Code")}
            </button>
            {onChangeEmail ? (
              <button
                type="button"
                onClick={onChangeEmail}
                className="text-muted-foreground underline decoration-dotted underline-offset-4"
              >
                {isTr ? "E-posta adresini değiştir" : "Change email address"}
              </button>
            ) : null}
            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="text-muted-foreground underline decoration-dotted underline-offset-4"
              >
                {isTr ? "Çıkış yap" : "Log out"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
