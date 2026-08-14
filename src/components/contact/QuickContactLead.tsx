"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Send, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLocale } from "@/content/locale-context";
import { submitContact } from "@/lib/contact/api";
import { TurnstileWidget, type TurnstileWidgetRef } from "@/components/security/TurnstileWidget";
import { Wave } from "@/components/ui/wave";

const DISMISS_KEY = "oriens-quick-contact-dismissed";

export function QuickContactLead() {
  const locale = useLocale();
  const isTr = locale === "tr";
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [doneMessage, setDoneMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const handleTurnstileVerify = useCallback((newToken: string) => setToken(newToken), []);
  const handleTurnstileReset = useCallback(() => setToken(""), []);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY)) return;
    let finished = false;
    const show = () => {
      if (finished || sessionStorage.getItem(DISMISS_KEY)) return;
      finished = true;
      setVisible(true);
      window.clearTimeout(timer);
      window.removeEventListener("scroll", checkScroll);
    };
    const checkScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable > 0 && window.scrollY / scrollable >= 0.45) show();
    };
    const timer = window.setTimeout(show, 45000);
    window.addEventListener("scroll", checkScroll, { passive: true });
    checkScroll();
    return () => {
      finished = true;
      window.clearTimeout(timer);
      window.removeEventListener("scroll", checkScroll);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    sessionStorage.setItem(DISMISS_KEY, "1");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !consent || !token) {
      setMessage(isTr ? "E-posta, gizlilik onayı ve güvenlik doğrulaması gereklidir." : "Email, privacy consent and security verification are required.");
      return;
    }
    startTransition(async () => {
      const result = await submitContact({ fullName: isTr ? "Hızlı İletişim Talebi" : "Quick Contact Request", email: email.trim().toLowerCase(), message: "", locale, privacyConsent: true, turnstileToken: token, source: "quick_contact" });
      if (result.success) {
        setDoneMessage(result.message);
        setDone(true);
        sessionStorage.setItem(DISMISS_KEY, "1");
      } else {
        setMessage(result.message);
        setToken("");
        turnstileRef.current?.reset();
      }
    });
  }

  return <AnimatePresence>{visible && <motion.aside initial={reducedMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: reducedMotion ? 0 : .24 }} className="fixed right-6 bottom-6 z-[45] hidden w-[340px] overflow-hidden rounded-2xl border border-[#DDE4DC] bg-white p-5 pb-6 text-left shadow-[0_22px_60px_rgba(16,39,27,.18)] lg:block" aria-label={isTr ? "Hızlı iletişim" : "Quick contact"}>
    <button type="button" onClick={dismiss} aria-label={isTr ? "Hızlı iletişimi kapat" : "Dismiss quick contact"} className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full text-[#68756C] hover:bg-[#E9EFE9]"><X className="size-4" /></button>
    {done ? <div role="status" className="py-4 text-center"><span className="mx-auto flex size-10 items-center justify-center rounded-full bg-[#E9EFE9] text-[#10271B]"><Check className="size-5" /></span><p className="mt-3 font-heading text-xl text-[#10271B]">{isTr ? "Talebiniz alındı" : "Request received"}</p><p className="mt-2 text-xs leading-relaxed text-[#68756C]">{doneMessage}</p><button type="button" onClick={dismiss} className="mt-4 text-xs font-bold text-[#68756C] underline underline-offset-4">{isTr ? "Kapat" : "Close"}</button></div> : <form onSubmit={submit} className="w-full text-left">
      <p className="pr-8 text-xs font-bold tracking-[.18em] text-[#819586] uppercase">{isTr ? "Size ulaşalım" : "Let us contact you"}</p>
      <h2 className="mt-2 pr-8 font-heading text-[26px] leading-[1.04] tracking-[-0.015em] text-[#10271B]">{isTr ? <>Akademik rotanızı<br />konuşalım.</> : <>Let&apos;s discuss your<br />academic route.</>}</h2>
      <p className="mt-3 w-full text-xs leading-[1.55] text-[#68756C]">{isTr ? "E-posta adresinizi bırakın, ekibimiz sizinle iletişime geçsin." : "Leave your email and our team will get in touch."}</p>
      <div className="mt-4 flex w-full items-stretch gap-2"><input data-locale-field="quick-contact-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-label={isTr ? "E-posta adresi" : "Email address"} placeholder={isTr ? "E-posta adresiniz" : "Your email"} className="h-11 min-w-0 flex-1 rounded-lg border border-[#DDE4DC] px-3 text-sm outline-none focus:border-[#819586]" /><button disabled={pending} className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#10271B] text-white disabled:opacity-50" aria-label={pending ? isTr ? "Gönderiliyor" : "Sending" : isTr ? "Bana ulaşın" : "Contact me"}>{pending ? <Wave className="h-4 w-7 text-white" aria-label={isTr ? "Gönderiliyor" : "Sending"} /> : <Send className="size-4" />}</button></div>
      <label className="mt-3 flex w-full min-w-0 cursor-pointer items-start gap-2.5 text-[12px] leading-[1.55] text-[#68756C]"><input data-locale-field="quick-contact-consent" type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-[2px] size-4 shrink-0" /><span className="min-w-0 flex-1">{isTr ? "İletişim için verilerimin işlenmesini kabul ediyorum." : "I consent to processing my details for contact."} <Link href={`/${locale}/privacy`} className="whitespace-nowrap font-bold underline underline-offset-2">{isTr ? "Gizlilik" : "Privacy"}</Link></span></label>
      <TurnstileWidget ref={turnstileRef} action="quick_contact_submit" locale={locale} onVerify={handleTurnstileVerify} onExpire={handleTurnstileReset} onError={handleTurnstileReset} className="origin-top-left scale-[.82]" />
      {message && <p role="alert" className="mt-2 text-[11px] text-red-700">{message}</p>}
    </form>}
  </motion.aside>}</AnimatePresence>;
}

export default QuickContactLead;
