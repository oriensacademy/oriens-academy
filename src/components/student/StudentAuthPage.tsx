"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, GraduationCap } from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { getStudentCopy } from "@/content/student-portal";
import { localizedPath, unifiedLoginPath } from "@/lib/routes";
import { registerStudent } from "@/lib/student/auth";
import { TurnstileWidget, type TurnstileWidgetRef } from "@/components/security/TurnstileWidget";

export function StudentAuthPage() {
  const locale = useLocale(); const copy = getStudentCopy(locale); const router = useRouter();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", confirm: "", school: "", targetExam: "", targetCountry: "" });
  const [terms, setTerms] = useState(false); const [captchaToken, setCaptchaToken] = useState("");
  const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const captchaRef = useRef<TurnstileWidgetRef>(null);
  const resetCaptcha = useCallback(() => setCaptchaToken(""), []);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setSuccess("");
    if (!terms || !captchaToken || form.password !== form.confirm || form.password.length < 8) {
      setError(locale === "tr" ? "Koşulları kabul edin; şifreler eşleşmeli ve en az 8 karakter olmalıdır." : "Accept the terms; passwords must match and contain at least 8 characters."); return;
    }
    setPending(true);
    const result = await registerStudent({ fullName: form.fullName, email: form.email, phone: form.phone, password: form.password, locale, school: form.school, targetExam: form.targetExam, targetCountry: form.targetCountry, captchaToken });
    setPending(false); setCaptchaToken(""); captchaRef.current?.reset();
    if (result.error) { setError(copy.genericError); return; }
    if (result.data.session) { setSuccess(copy.accountCreated); window.setTimeout(() => router.replace(localizedPath("studentAccount", locale)), 900); }
    else setSuccess(copy.registrationReceived);
  }

  return <section className="min-h-screen bg-background pt-28 pb-20 md:pt-36"><div className="public-container"><div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-border bg-surface shadow-editorial lg:grid-cols-[.8fr_1.2fr]">
    <aside className="bg-forest p-7 text-white sm:p-10"><GraduationCap className="size-8 text-warm-accent" /><p className="mt-8 text-xs font-semibold uppercase tracking-[.2em] text-white/65">Oriens Academy</p><h1 className="mt-3 font-heading text-4xl">{copy.register}</h1><p className="mt-4 max-w-sm text-sm leading-7 text-white/72">{locale === "tr" ? "Derslerinizi, paket kullanımınızı, randevularınızı ve ödevlerinizi tek güvenli alanda takip edin." : "Track your lessons, package usage, appointments and homework in one secure account."}</p></aside>
    <div className="p-6 sm:p-10"><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label={copy.fullName} value={form.fullName} onChange={(value) => update("fullName", value)} required autoComplete="name" /><Field label={copy.phone} value={form.phone} onChange={(value) => update("phone", value)} required autoComplete="tel" />
      <Field label={copy.email} value={form.email} onChange={(value) => update("email", value)} type="email" required autoComplete="email" />
      <Field label={copy.password} value={form.password} onChange={(value) => update("password", value)} type="password" required autoComplete="new-password" />
      <Field label={copy.passwordAgain} value={form.confirm} onChange={(value) => update("confirm", value)} type="password" required autoComplete="new-password" /><Field label={copy.school} value={form.school} onChange={(value) => update("school", value)} /><Field label={copy.targetExam} value={form.targetExam} onChange={(value) => update("targetExam", value)} /><Field label={copy.targetCountry} value={form.targetCountry} onChange={(value) => update("targetCountry", value)} wide />
      <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-muted-foreground sm:col-span-2"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} className="mt-0.5 size-4" /><span>{copy.terms} <Link href={localizedPath("privacy",locale)} className="font-semibold underline">{locale==="tr"?"Gizlilik":"Privacy"}</Link> · <Link href={localizedPath("terms",locale)} className="font-semibold underline">{locale==="tr"?"Koşullar":"Terms"}</Link></span></label>
      <div className="sm:col-span-2"><TurnstileWidget ref={captchaRef} action="student_register" locale={locale} onVerify={setCaptchaToken} onExpire={resetCaptcha} onError={resetCaptcha} /></div>
      {error && <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 sm:col-span-2"><AlertCircle className="size-4 shrink-0" />{error}</div>}
      {success && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 sm:col-span-2">{success}</div>}
      <button disabled={pending || !terms || !captchaToken} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-semibold text-white hover:bg-forest disabled:opacity-45 sm:col-span-2">{copy.registerAction}<ArrowRight className="size-4" /></button>
    </form><p className="mt-6 text-center text-sm text-muted-foreground">{copy.hasAccount} <Link href={unifiedLoginPath(locale)} className="font-semibold text-ink underline decoration-primary underline-offset-4">{copy.loginAction}</Link></p></div>
  </div></div></section>;
}

function Field({ label, value, onChange, type = "text", required, autoComplete, wide }: { label:string;value:string;onChange:(value:string)=>void;type?:string;required?:boolean;autoComplete?:string;wide?:boolean }) { return <label className={`text-xs font-semibold text-ink ${wide?"sm:col-span-2":""}`}>{label}<input type={type} required={required} autoComplete={autoComplete} value={value} onChange={(event)=>onChange(event.target.value)} className="mt-1.5 min-h-12 w-full rounded-lg border border-input bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>; }
