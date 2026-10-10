"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import "./generated/reference-login.css";
import { LOGIN_FOOTER_HTML } from "./generated/markup";
import { NavbarSpacer, ReferenceFonts, ReferenceHtml, fillContact, useInternalLinkNavigation, useReferenceContact } from "./reference-shared";
import { TurnstileWidget, type TurnstileWidgetRef } from "@/components/security/TurnstileWidget";
import { useAccount } from "@/lib/auth/account-context";
import { destinationForAccount, safeReturnPath } from "@/lib/auth/account-routing";
import { requestPasswordRecovery } from "@/lib/auth/password-recovery";
import { requestPurchaseEmailVerification, verifyPurchaseEmailVerification } from "@/lib/payments/email-verification";
import { changePasswordPath } from "@/lib/routes";
import { registerStudent, requestEmailChange, verifyEmailChangeOtp } from "@/lib/student/auth";
import { claimAnonymousExamResult } from "@/lib/student/exam-history";
import { getSupabaseClient } from "@/lib/supabase/client";
import { localizeErrorMessage } from "@/lib/utils/error-messages";

type View = "login" | "forgot" | "forgot-sent" | "reg" | "otp";
type Alert = { kind: "err" | "ok"; text: string } | null;

const LOGIN_HREF = "/tr/giris/";
const REGISTER_HREF = "/tr/giris/?mode=register";
const TITLES: Partial<Record<View, string>> = { login: "Giriş Yap | Oriens Academy", reg: "Kayıt Ol | Oriens Academy" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_SECONDS = 60;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

/** Reference `authMessage`, without revealing whether an account exists. */
function authMessage(error: { message?: string; status?: number; code?: string } | null | undefined) {
  const message = error?.message || "";
  if (error?.status === 429 || /rate|too many/i.test(message)) return "Çok fazla deneme yaptınız. Lütfen birkaç dakika sonra tekrar deneyin.";
  if (/network|fetch/i.test(message)) return "Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.";
  return "E-posta veya şifre hatalı.";
}

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
);
const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
);
const StateMailIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
);
const Eye = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
);
const EyeOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
);

function Msg({ id, errors, style }: { id: string; errors: Record<string, string>; style?: React.CSSProperties }) {
  return <p className={errors[id] ? "msg on" : "msg"} id={`${id}-msg`} style={style}>{errors[id] || ""}</p>;
}

function AlertBox({ alert }: { alert: Alert }) {
  return (
    <div className={alert ? `alert on${alert.kind === "ok" ? " ok" : ""}` : "alert"} data-alert role="alert">
      {alert?.text}
    </div>
  );
}

function SubmitButton({ busy, label, busyLabel, id, disabled }: { busy: boolean; label: string; busyLabel: string; id?: string; disabled?: boolean }) {
  return (
    <button className="btn-p submit" type="submit" id={id} aria-busy={busy ? "true" : undefined} disabled={busy || disabled}>
      <span>{busy ? busyLabel : label}</span>
      <ArrowIcon />
    </button>
  );
}

export function ReferenceLoginPage() {
  const router = useRouter();
  const contact = useReferenceContact();
  const { accountType, user, isInitializing, signIn, signOut } = useAccount();
  const scopeRef = useRef<HTMLDivElement>(null);
  useInternalLinkNavigation(scopeRef);

  const [view, setView] = useState<View>("login");
  const [alert, setAlert] = useState<Alert>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [remember, setRemember] = useState(true);

  const [forgotEmail, setForgotEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef<TurnstileWidgetRef>(null);
  const [forgotCooldown, setForgotCooldown] = useState(0);

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [terms, setTerms] = useState(false);

  const [otpEmail, setOtpEmail] = useState("");
  const [otpMode, setOtpMode] = useState<"signup" | "email_change">("signup");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpSending, setOtpSending] = useState(false);
  const [otpInvalid, setOtpInvalid] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const otpFormRef = useRef<HTMLFormElement>(null);

  const navigatedRef = useRef(false);
  const isRegisteringRef = useRef(false);
  const viewRef = useRef<View>("login");

  const show = useCallback((next: View, opts: { url?: string | null; title?: string; focus?: boolean } = {}) => {
    viewRef.current = next;
    setView(next);
    setAlert(null);
    if (opts.url) {
      try {
        window.history.replaceState(window.history.state, "", opts.url);
      } catch {
        // Non-fatal.
      }
    }
    if (opts.title) document.title = opts.title;
    if (opts.focus === false) return;
    window.setTimeout(() => {
      const panel = scopeRef.current?.querySelector<HTMLElement>(`[data-panel="${next}"]`);
      const target = panel?.querySelector<HTMLElement>("input:not([type=checkbox])") || panel?.querySelector<HTMLElement>("h1");
      if (!target) return;
      if (target.tagName === "H1") target.tabIndex = -1;
      target.focus();
    }, 30);
  }, []);

  // Initial view from the URL (?mode=register, #sifre-sifirla) and the pending signup e-mail.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let pendingEmail = "";
    try {
      pendingEmail = sessionStorage.getItem("oriens.pendingSignupEmail") || "";
    } catch {
      // Non-fatal.
    }
    queueMicrotask(() => {
      setRequested(safeReturnPath(params.get("next")));
      if (params.get("mode") === "register" || pendingEmail) {
        if (pendingEmail) setRegEmail(pendingEmail);
        show("reg", { focus: false, title: TITLES.reg });
      } else if (window.location.hash === "#sifre-sifirla") {
        show("forgot", { focus: false });
      }
    });
  }, [show]);

  // Already signed in: same routing as the canonical login page.
  useEffect(() => {
    if (isInitializing || navigatedRef.current || isRegisteringRef.current || viewRef.current === "otp") return;
    if (!["admin", "student"].includes(accountType)) return;
    navigatedRef.current = true;
    const destination = user?.user_metadata?.force_password_change === true
      ? changePasswordPath("tr")
      : destinationForAccount(accountType, "tr", requested);
    router.replace(destination);
  }, [accountType, isInitializing, requested, router, user]);

  useEffect(() => {
    if (forgotCooldown <= 0) return;
    const timer = window.setInterval(() => setForgotCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [forgotCooldown]);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = window.setInterval(() => setOtpCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [otpCooldown]);

  function fieldErr(id: string, text: string) {
    setErrors((current) => ({ ...current, [id]: text }));
    return !text;
  }

  function clearErr(id: string) {
    if (errors[id]) setErrors((current) => ({ ...current, [id]: "" }));
  }

  function invalid(id: string) {
    return errors[id] === undefined ? undefined : errors[id] ? "true" : "false";
  }

  function focusFirstInvalid(ids: string[], results: boolean[]) {
    const index = results.findIndex((ok) => !ok);
    if (index >= 0) window.setTimeout(() => document.getElementById(ids[index])?.focus(), 0);
  }

  const onTabClick = (next: "login" | "reg") => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    show(next, { url: next === "login" ? LOGIN_HREF : REGISTER_HREF, title: TITLES[next] });
  };

  function onTabsKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const next = view === "reg" ? "login" : "reg";
    show(next, { url: next === "login" ? LOGIN_HREF : REGISTER_HREF, title: TITLES[next] });
    window.setTimeout(() => document.getElementById(next === "login" ? "t-login" : "t-reg")?.focus(), 0);
  }

  const tryClaimPendingResult = async () => {
    try {
      const claimToken = sessionStorage.getItem("oriens.pendingExamClaimToken");
      if (claimToken) {
        const res = await claimAnonymousExamResult(claimToken);
        if (res.success) {
          sessionStorage.removeItem("oriens.pendingExamClaimToken");
          sessionStorage.removeItem("oriens.pendingSignupEmail");
        }
      }
    } catch {
      // Non-fatal.
    }
  };

  function enterOtp(targetEmail: string, mode: "signup" | "email_change") {
    setOtpEmail(targetEmail.trim().toLowerCase());
    setOtpMode(mode);
    show("otp");
  }

  /* ---------- GİRİŞ ---------- */
  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const trimmed = email.trim();
    const results = [
      fieldErr("l-email", !trimmed ? "E-posta adresinizi yazın." : !EMAIL_RE.test(trimmed) ? "Geçerli bir e-posta adresi yazın." : ""),
      fieldErr("l-pass", !password ? "Şifrenizi yazın." : ""),
    ];
    if (results.includes(false)) {
      focusFirstInvalid(["l-email", "l-pass"], results);
      return;
    }
    setBusy(true);
    setAlert(null);
    let navigationStarted = false;
    try {
      const result = await signIn(trimmed, password);
      if (result.error) {
        setAlert({ kind: "err", text: authMessage(result.error) });
        setPassword("");
        document.getElementById("l-pass")?.focus();
        return;
      }
      if (result.accountType === "unknown") {
        setAlert({ kind: "err", text: "Bu hesap için aktif bir Oriens Academy profili bulunamadı." });
        return;
      }

      // Email verification / pending email change gate (guardian_accounts.email_verified_at).
      if (result.accountType === "student" && result.user) {
        const supabase = getSupabaseClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: challenge } = await (supabase as any)
          .from("email_change_challenges")
          .select("new_email")
          .eq("user_id", result.user.id)
          .is("verified_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const { data: guardian } = await supabase
          .from("guardian_accounts")
          .select("email, email_verified_at")
          .eq("user_id", result.user.id)
          .maybeSingle();
        if (challenge || (guardian && !guardian.email_verified_at)) {
          enterOtp(challenge?.new_email || guardian?.email || result.user.email || trimmed, challenge ? "email_change" : "signup");
          return;
        }
      }

      await tryClaimPendingResult();
      const destination = result.user?.user_metadata?.force_password_change === true
        ? changePasswordPath("tr")
        : destinationForAccount(result.accountType, "tr", requested);
      navigatedRef.current = true;
      navigationStarted = true;
      router.replace(destination);
      window.setTimeout(() => setBusy(false), 5000);
    } catch {
      setAlert({ kind: "err", text: "Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin." });
    } finally {
      if (!navigationStarted) setBusy(false);
    }
  }

  /* ---------- ŞİFRE SIFIRLAMA (Turnstile + request-password-recovery) ---------- */
  const resetCaptcha = useCallback(() => setCaptchaToken(""), []);

  async function sendRecovery(target: string) {
    if (!captchaToken) {
      setAlert({ kind: "err", text: "Güvenlik doğrulaması tamamlanamadı. Lütfen tekrar deneyin." });
      return false;
    }
    const res = await requestPasswordRecovery({ email: target.trim().toLowerCase(), locale: "tr", turnstileToken: captchaToken });
    setCaptchaToken("");
    captchaRef.current?.reset();
    if (!res.success) {
      setAlert({
        kind: "err",
        text: res.errorCode === "RATE_LIMIT"
          ? "Çok fazla deneme yaptınız. Lütfen birkaç dakika sonra tekrar deneyin."
          : res.error || "Şifre sıfırlama bağlantısı şu anda gönderilemedi. Lütfen daha sonra tekrar deneyin.",
      });
      return false;
    }
    return true;
  }

  async function handleForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const trimmed = forgotEmail.trim();
    if (!fieldErr("fg-email", !EMAIL_RE.test(trimmed) ? "Geçerli bir e-posta adresi yazın." : "")) {
      document.getElementById("fg-email")?.focus();
      return;
    }
    setBusy(true);
    setAlert(null);
    try {
      if (await sendRecovery(trimmed)) {
        setSentEmail(trimmed);
        show("forgot-sent");
        setForgotCooldown(RESEND_SECONDS);
      }
    } catch {
      setAlert({ kind: "err", text: "Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin." });
    } finally {
      setBusy(false);
    }
  }

  async function resendRecovery() {
    if (forgotCooldown > 0 || busy) return;
    setBusy(true);
    setAlert(null);
    try {
      if (await sendRecovery(sentEmail)) setForgotCooldown(RESEND_SECONDS);
    } catch {
      setAlert({ kind: "err", text: "Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin." });
    } finally {
      setBusy(false);
    }
  }

  /* ---------- KAYIT ---------- */
  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const name = regName.trim();
    const trimmed = regEmail.trim();
    const ids = ["r-name", "r-email", "r-pass", "r-kvkk"];
    const results = [
      fieldErr("r-name", name.split(/\s+/).filter(Boolean).length < 2 ? "Adınızı ve soyadınızı yazın." : ""),
      fieldErr("r-email", !EMAIL_RE.test(trimmed) ? "Geçerli bir e-posta adresi yazın." : ""),
      fieldErr("r-pass", regPassword.length < 6 ? "Şifre en az 6 karakter olmalı." : ""),
      fieldErr("r-kvkk", !terms ? "Devam etmek için koşulları kabul etmeniz gerekiyor." : ""),
    ];
    if (results.includes(false)) {
      focusFirstInvalid(ids, results);
      return;
    }
    setBusy(true);
    setAlert(null);
    isRegisteringRef.current = true;
    try {
      sessionStorage.setItem("oriens.newSignupOnboarding", "true");
    } catch {
      // Non-fatal.
    }
    const abandon = (text: string) => {
      isRegisteringRef.current = false;
      try {
        sessionStorage.removeItem("oriens.newSignupOnboarding");
      } catch {
        // Non-fatal.
      }
      setAlert({ kind: "err", text });
    };
    try {
      const regResult = await registerStudent({ fullName: name, email: trimmed, password: regPassword, locale: "tr" });
      if (regResult.error) {
        abandon(localizeErrorMessage(regResult.error, "tr", "Kayıt işlemi gerçekleştirilemedi."));
        return;
      }
      // Signup returns a session immediately; the portal stays locked until the e-mail OTP below is verified.
      if (regResult.data?.session) {
        enterOtp(trimmed, "signup");
        return;
      }
      const signInResult = await signIn(trimmed, regPassword);
      if (!signInResult.error && signInResult.accountType !== "unknown") {
        enterOtp(trimmed, "signup");
        return;
      }
      abandon("Hesabınız oluşturuldu ancak oturum başlatılamadı. Lütfen giriş yapmayı deneyin.");
    } catch (err: unknown) {
      abandon((err instanceof Error && err.message) || "Kayıt sırasında bir hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  /* ---------- E-POSTA DOĞRULAMA KODU (custom 6-digit OTP) ---------- */
  const otpAutoSendKey = `oriens_otp_sent:${otpMode}:${otpEmail}`;

  const sendOtp = useCallback(async (silent: boolean) => {
    if (!otpEmail) return;
    setOtpSending(true);
    if (!silent) setAlert(null);
    const clearMarker = () => {
      try {
        sessionStorage.removeItem(otpAutoSendKey);
      } catch {
        // Non-fatal.
      }
    };
    try {
      const res = otpMode === "email_change"
        ? await requestEmailChange(otpEmail, "tr")
        : await requestPurchaseEmailVerification(otpEmail, "tr");
      if (!res.success) {
        clearMarker();
        if (res.error_code === "RESEND_COOLDOWN" && res.resend_available_at) {
          setOtpCooldown(Math.max(0, Math.round((new Date(res.resend_available_at).getTime() - Date.now()) / 1000)));
        } else {
          setAlert({ kind: "err", text: localizeErrorMessage(res.message, "tr", "Doğrulama kodu gönderilemedi. Lütfen tekrar deneyin.") });
        }
        return;
      }
      setOtpCooldown(RESEND_SECONDS);
      try {
        sessionStorage.setItem(otpAutoSendKey, "1");
      } catch {
        // Non-fatal.
      }
      if (!silent) setAlert({ kind: "ok", text: "Yeni bir kod gönderildi." });
    } catch {
      clearMarker();
      setAlert({ kind: "err", text: "Doğrulama kodu gönderilemedi. Lütfen tekrar deneyin." });
    } finally {
      setOtpSending(false);
    }
  }, [otpAutoSendKey, otpEmail, otpMode]);

  // Same per-session auto-send guard as EmailOtpGate: a remount reuses the code already sent.
  useEffect(() => {
    if (view !== "otp" || !otpEmail) return;
    let alreadySent = false;
    try {
      alreadySent = sessionStorage.getItem(otpAutoSendKey) === "1";
    } catch {
      // Non-fatal.
    }
    if (!alreadySent) queueMicrotask(() => void sendOtp(true));
  }, [otpAutoSendKey, otpEmail, sendOtp, view]);

  function otpValues() {
    return otpRefs.current.map((input) => input?.value || "");
  }

  function onOtpInput(index: number) {
    const input = otpRefs.current[index];
    if (!input) return;
    input.value = input.value.replace(/\D/g, "").slice(-1);
    if (otpInvalid) setOtpInvalid(false);
    if (input.value) otpRefs.current[index + 1]?.focus();
    if (otpValues().every(Boolean)) otpFormRef.current?.requestSubmit();
  }

  function onOtpKeyDown(index: number, event: ReactKeyboardEvent<HTMLInputElement>) {
    const input = otpRefs.current[index];
    if (event.key === "Backspace" && !input?.value) otpRefs.current[index - 1]?.focus();
    if (event.key === "ArrowLeft") otpRefs.current[index - 1]?.focus();
    if (event.key === "ArrowRight") otpRefs.current[index + 1]?.focus();
  }

  function onOtpPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const digits = (event.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (digits.length < 2) return;
    event.preventDefault();
    digits.split("").forEach((digit, index) => {
      const input = otpRefs.current[index];
      if (input) input.value = digit;
    });
    (otpRefs.current[digits.length] || otpRefs.current[5])?.focus();
    if (digits.length === 6) otpFormRef.current?.requestSubmit();
  }

  async function handleOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const code = otpValues().join("");
    if (!/^\d{6}$/.test(code)) {
      fieldErr("otp", "6 haneli kodu girin.");
      otpRefs.current[Math.min(code.length, 5)]?.focus();
      return;
    }
    fieldErr("otp", "");
    setBusy(true);
    try {
      const res = otpMode === "email_change"
        ? await verifyEmailChangeOtp(code, "tr")
        : await verifyPurchaseEmailVerification(otpEmail, code, "tr");
      if (!res.success && res.error_code !== "ALREADY_VERIFIED") {
        fieldErr("otp", localizeErrorMessage(res.message, "tr", "Doğrulama başarısız oldu."));
        otpRefs.current.forEach((input) => {
          if (input) input.value = "";
        });
        setOtpInvalid(true);
        otpRefs.current[0]?.focus();
        return;
      }
      try {
        sessionStorage.removeItem(otpAutoSendKey);
      } catch {
        // Non-fatal.
      }
      setOtpInvalid(false);
      await tryClaimPendingResult();
      navigatedRef.current = true;
      router.replace(destinationForAccount("student", "tr", requested));
    } catch {
      fieldErr("otp", "Doğrulama başarısız oldu. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelOtp() {
    setBusy(true);
    try {
      await signOut();
    } finally {
      isRegisteringRef.current = false;
      navigatedRef.current = false;
      setPassword("");
      setBusy(false);
      show("login", { url: LOGIN_HREF, title: TITLES.login });
    }
  }

  const tabView = view === "reg" ? "reg" : "login";
  const otpCode = otpEmail ? maskEmail(otpEmail) : "";

  return (
    <>
    <NavbarSpacer />
    <div ref={scopeRef} className="reference-login-page">
      <ReferenceFonts />
      <main id="giris">
        <div className="wrap">
          <aside className="side" aria-label="Veli hesabı avantajları">
            <span className="ring" aria-hidden="true"></span><span className="ring r2" aria-hidden="true"></span>
            <p className="eb">Veli hesabı</p>
            <h2 className="s">Tüm ders süreciniz, tek ekranda.</h2>
            <p>Ders kayıtlarını, öğretmen raporlarını, kalan ders hakkınızı ve ödemelerinizi istediğiniz an hesabınızdan takip edin.</p>
            <ul className="feat">
              <li><span className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg></span><div><b>Ders kayıtları</b><span>Yapılan her dersin tarihi, süresi ve konusu</span></div></li>
              <li><span className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg></span><div><b>Ders raporları</b><span>Her dersten sonra öğretmen notu, ödev ve gelişim özeti</span></div></li>
              <li><span className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 19h16M6 15V9M11 15V5M16 15v-4" /></svg></span><div><b>Kalan ders hakkı</b><span>Paketinizde kaç ders kaldığı, anlık olarak</span></div></li>
              <li><span className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19M6 15h4" /></svg></span><div><b>Paket ve ödemeler</b><span>Yeni paket satın alma ve ödeme geçmişi</span></div></li>
            </ul>
            <p className="help">Giriş yapamıyor musunuz? <a href={contact.waText("Merhaba, hesabıma giriş yapamıyorum.")}>WhatsApp&apos;tan yazın</a></p>
          </aside>

          <section className="fs" aria-live="polite">
            <div className="tabs" role="tablist" aria-label="Hesap" id="tabs" hidden={view === "otp"} onKeyDown={onTabsKeyDown}>
              <a role="tab" id="t-login" href={LOGIN_HREF} aria-controls="p-login" aria-selected={tabView === "login"} tabIndex={tabView === "login" ? 0 : -1} data-view="login" onClick={onTabClick("login")}>Giriş Yap</a>
              <a role="tab" id="t-reg" href={REGISTER_HREF} aria-controls="p-reg" aria-selected={tabView === "reg"} tabIndex={tabView === "reg" ? 0 : -1} data-view="reg" onClick={onTabClick("reg")}>Kayıt Ol</a>
            </div>

            <div className="panel" id="p-login" role="tabpanel" aria-labelledby="t-login" data-panel="login" hidden={view !== "login"}>
              <h1 className="s">Hesabınıza giriş yapın</h1>
              <p className="lead">Oriens Academy hesabınıza güvenle erişin.</p>
              <AlertBox alert={view === "login" ? alert : null} />
              <form id="f-login" noValidate onSubmit={handleLogin}>
                <div className="field">
                  <label htmlFor="l-email">E-posta</label>
                  <div className="inp">
                    <MailIcon />
                    <input id="l-email" name="email" type="email" inputMode="email" autoComplete="username" placeholder="ornek@eposta.com" required aria-describedby="l-email-msg" aria-invalid={invalid("l-email")} value={email} onChange={(event) => { setEmail(event.target.value); clearErr("l-email"); }} />
                  </div>
                  <Msg errors={errors} id="l-email" />
                </div>
                <div className="field" id="pw-field">
                  <label htmlFor="l-pass">Şifre <a className="link" href="#sifre-sifirla" data-view="forgot" onClick={(event) => { event.preventDefault(); setForgotEmail(email); show("forgot"); }}>Şifremi unuttum</a></label>
                  <div className="inp">
                    <LockIcon />
                    <input id="l-pass" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Şifreniz" required aria-describedby="l-pass-msg l-caps" aria-invalid={invalid("l-pass")} value={password} onChange={(event) => { setPassword(event.target.value); clearErr("l-pass"); }} onKeyUp={(event) => setCapsLock(event.getModifierState?.("CapsLock") ?? false)} />
                    <button className="eye" type="button" aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"} aria-controls="l-pass" data-eye onClick={() => { setShowPassword((value) => !value); document.getElementById("l-pass")?.focus(); }}>{showPassword ? <EyeOff /> : <Eye />}</button>
                  </div>
                  <p className={capsLock ? "caps on" : "caps"} id="l-caps">Büyük harf kilidi açık.</p>
                  <Msg errors={errors} id="l-pass" />
                </div>
                <div className="row" id="remember-row">
                  <label className="chk"><input type="checkbox" name="remember" id="l-remember" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Beni hatırla</label>
                </div>
                <SubmitButton id="l-submit" busy={busy && view === "login"} label="Giriş Yap" busyLabel="Giriş yapılıyor…" />
              </form>
              <p className="alt">Hesabınız yok mu? <a href={REGISTER_HREF} data-view="reg" onClick={onTabClick("reg")}>Kayıt olun</a></p>
            </div>

            <div className="panel" data-panel="forgot" hidden={view !== "forgot"}>
              <h1 className="s">Şifrenizi sıfırlayın</h1>
              <p className="lead">Hesabınızın e-posta adresini yazın; şifrenizi yenilemeniz için bir bağlantı gönderelim.</p>
              <AlertBox alert={view === "forgot" ? alert : null} />
              <form id="f-forgot" noValidate onSubmit={handleForgot}>
                <div className="field">
                  <label htmlFor="fg-email">E-posta</label>
                  <div className="inp">
                    <MailIcon />
                    <input id="fg-email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="ornek@eposta.com" required aria-describedby="fg-email-msg" aria-invalid={invalid("fg-email")} value={forgotEmail} onChange={(event) => { setForgotEmail(event.target.value); clearErr("fg-email"); }} />
                  </div>
                  <Msg errors={errors} id="fg-email" />
                </div>
                {view === "forgot" ? (
                  <TurnstileWidget ref={captchaRef} action="password_recovery" locale="tr" onVerify={setCaptchaToken} onExpire={resetCaptcha} onError={resetCaptcha} />
                ) : null}
                <SubmitButton busy={busy && view === "forgot"} label="Sıfırlama bağlantısı gönder" busyLabel="Gönderiliyor…" />
              </form>
              <p className="alt"><a href={LOGIN_HREF} data-view="login" onClick={onTabClick("login")}>← Girişe dön</a></p>
            </div>

            <div className="panel" data-panel="forgot-sent" hidden={view !== "forgot-sent"}>
              <div className="state-ic"><StateMailIcon /></div>
              <h1 className="s">Bağlantı gönderildi</h1>
              <p className="lead">Bu adres kayıtlıysa <b data-echo-email>{sentEmail}</b> adresine şifre sıfırlama bağlantısı gönderdik. Bağlantı 1 saat geçerli.</p>
              <AlertBox alert={view === "forgot-sent" ? alert : null} />
              {view === "forgot-sent" ? (
                <TurnstileWidget ref={captchaRef} action="password_recovery" locale="tr" onVerify={setCaptchaToken} onExpire={resetCaptcha} onError={resetCaptcha} />
              ) : null}
              <button type="button" className="btn-g" data-resend="forgot" disabled={forgotCooldown > 0 || busy} onClick={() => void resendRecovery()}><span>Tekrar gönder</span> <span data-cd>{forgotCooldown > 0 ? `(${forgotCooldown} sn)` : ""}</span></button>
              <p className="alt"><a href={LOGIN_HREF} data-view="login" onClick={onTabClick("login")}>← Girişe dön</a></p>
            </div>

            <div className="panel" data-panel="otp" hidden={view !== "otp"}>
              <div className="state-ic"><StateMailIcon /></div>
              <h1 className="s">E-postanızı doğrulayın</h1>
              <p className="lead"><b data-echo-email>{otpCode}</b> adresine gönderilen 6 haneli kodu girin.</p>
              <p className="hint">E-posta gelmediyse gereksiz (spam) klasörüne bakın.</p>
              <AlertBox alert={view === "otp" ? alert : null} />
              <form id="f-otp" noValidate onSubmit={handleOtp} ref={otpFormRef}>
                <fieldset className="otp" aria-describedby="otp-msg">
                  <legend className="sr">6 haneli doğrulama kodu</legend>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <OtpSlot key={index} index={index}>
                      <input
                        ref={(node) => { otpRefs.current[index] = node; }}
                        inputMode="numeric"
                        autoComplete={index === 0 ? "one-time-code" : undefined}
                        maxLength={1}
                        aria-label={`${index + 1}. hane`}
                        pattern="[0-9]"
                        aria-invalid={otpInvalid ? "true" : undefined}
                        onInput={() => onOtpInput(index)}
                        onKeyDown={(event) => onOtpKeyDown(index, event)}
                        onPaste={onOtpPaste}
                      />
                    </OtpSlot>
                  ))}
                </fieldset>
                <Msg errors={errors} id="otp" />
                <SubmitButton busy={busy && view === "otp"} label="Doğrula ve devam et" busyLabel="Doğrulanıyor…" />
              </form>
              <button type="button" className="btn-g" data-resend="otp" disabled={otpCooldown > 0 || otpSending} onClick={() => void sendOtp(false)}><span>Tekrar gönder</span> <span data-cd>{otpCooldown > 0 ? `(${otpCooldown} sn)` : ""}</span></button>
              <p className="alt"><button type="button" id="otp-cancel" onClick={() => void cancelOtp()}>Farklı hesapla giriş yap</button></p>
            </div>

            <div className="panel" id="p-reg" role="tabpanel" aria-labelledby="t-reg" data-panel="reg" hidden={view !== "reg"}>
              <h1 className="s">Veli hesabı oluşturun</h1>
              <p className="lead">Paket satın almak ve dersleri takip etmek için hesabınızı oluşturun. Öğrenci bilgilerini sizin için biz ekliyoruz.</p>
              <AlertBox alert={view === "reg" ? alert : null} />
              <form id="f-reg" noValidate onSubmit={handleRegister}>
                <div className="field">
                  <label htmlFor="r-name">Ad Soyad <small>Veli</small></label>
                  <div className="inp">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
                    <input id="r-name" name="name" type="text" autoComplete="name" placeholder="Adınız Soyadınız" required aria-describedby="r-name-msg" aria-invalid={invalid("r-name")} value={regName} onChange={(event) => { setRegName(event.target.value); clearErr("r-name"); }} />
                  </div>
                  <Msg errors={errors} id="r-name" />
                </div>
                <div className="field">
                  <label htmlFor="r-email">E-posta</label>
                  <div className="inp">
                    <MailIcon />
                    <input id="r-email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="ornek@eposta.com" required aria-describedby="r-email-msg" aria-invalid={invalid("r-email")} value={regEmail} onChange={(event) => { setRegEmail(event.target.value); clearErr("r-email"); }} />
                  </div>
                  <Msg errors={errors} id="r-email" />
                </div>
                <div className="field">
                  <label htmlFor="r-pass">Şifre</label>
                  <div className="inp">
                    <LockIcon />
                    <input id="r-pass" name="password" type={showRegPassword ? "text" : "password"} autoComplete="new-password" placeholder="Şifreniz" required minLength={6} aria-describedby="r-pass-msg" aria-invalid={invalid("r-pass")} value={regPassword} onChange={(event) => { setRegPassword(event.target.value); clearErr("r-pass"); }} />
                    <button className="eye" type="button" aria-label={showRegPassword ? "Şifreyi gizle" : "Şifreyi göster"} aria-controls="r-pass" data-eye onClick={() => { setShowRegPassword((value) => !value); document.getElementById("r-pass")?.focus(); }}>{showRegPassword ? <EyeOff /> : <Eye />}</button>
                  </div>
                  <Msg errors={errors} id="r-pass" />
                </div>
                <label className="chk" style={{ margin: "6px 0 4px" }}><input type="checkbox" id="r-kvkk" required aria-describedby="r-kvkk-msg" aria-invalid={invalid("r-kvkk")} checked={terms} onChange={(event) => { setTerms(event.target.checked); clearErr("r-kvkk"); }} /> <span><a href="/tr/privacy/" target="_blank" rel="noopener">Gizlilik Politikası</a> ve <a href="/tr/terms/" target="_blank" rel="noopener">Kullanım Koşulları</a>&apos;nı kabul ediyorum.</span></label>
                <Msg errors={errors} id="r-kvkk" style={{ margin: "0 0 22px 28px" }} />
                <SubmitButton busy={busy && view === "reg"} label="Hesap Oluştur" busyLabel="Hesap oluşturuluyor…" />
              </form>
              <p className="alt">Zaten hesabınız var mı? <a href={LOGIN_HREF} data-view="login" onClick={onTabClick("login")}>Giriş yapın</a></p>
            </div>

            <p className="note"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>256-bit SSL ile korunan bağlantı</p>
          </section>
        </div>
      </main>
      <ReferenceHtml html={fillContact(LOGIN_FOOTER_HTML, contact)} />
    </div>
    </>
  );
}

function OtpSlot({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <>
      {index === 3 ? <span className="otp-sep" aria-hidden="true"></span> : null}
      {children}
    </>
  );
}
