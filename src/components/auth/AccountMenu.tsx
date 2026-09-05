"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { LogoutConfirmationModal } from "@/components/auth/LogoutConfirmationModal";
import { useAccount } from "@/lib/auth/account-context";
import { localizedPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function AccountMenu({ locale, mobile = false, active = false, onNavigate, onRequestLogout }: { locale: "tr" | "en"; mobile?: boolean; active?: boolean; onNavigate?: () => void; onRequestLogout?: () => void }) {
  const { signOut } = useAccount();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const accountHref = localizedPath("studentAccount", locale);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", keydown);
    };
  }, [open]);

  async function confirmLogout() {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    router.replace(localizedPath("home", locale));
  }

  const logoutLabel = locale === "tr" ? "Çıkış Yap" : "Sign Out";
  const accountLabel = locale === "tr" ? "Hesabım" : "My Account";

  if (mobile) {
    return <>
      <li className="border-b border-border"><Link href={accountHref} onClick={onNavigate} className="block py-4 font-heading text-2xl font-medium text-ink">{accountLabel}</Link></li>
      <li className="border-b border-border"><button type="button" onClick={() => onRequestLogout ? onRequestLogout() : setConfirming(true)} className="flex w-full items-center gap-2 py-4 text-left font-heading text-2xl font-medium text-ink"><LogOut className="size-5" />{logoutLabel}</button></li>
      {!onRequestLogout && <li className="contents"><LogoutConfirmationModal open={confirming} signingOut={signingOut} locale={locale} onCancel={() => setConfirming(false)} onConfirm={confirmLogout} /></li>}
    </>;
  }

  return <>
    <div ref={rootRef} className="relative">
      <button ref={triggerRef} type="button" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open} className={cn("flex min-h-11 items-center justify-center gap-1.5 sm:gap-2 rounded-full border px-2.5 sm:px-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", active ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/25" : "border-border text-ink hover:bg-surface-muted")}>
        <UserRound className="size-4" /><span className="hidden sm:inline">{accountLabel}</span><ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div role="menu" className="absolute right-0 top-full mt-2 min-w-44 rounded-xl border border-border bg-background p-1.5 shadow-xl">
        <Link role="menuitem" href={accountHref} onClick={() => setOpen(false)} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink hover:bg-surface-muted"><UserRound className="size-4" />{accountLabel}</Link>
        <button role="menuitem" type="button" onClick={() => { setOpen(false); setConfirming(true); }} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-red-700 hover:bg-red-50"><LogOut className="size-4" />{logoutLabel}</button>
      </div>}
    </div>
    <LogoutConfirmationModal open={confirming} signingOut={signingOut} locale={locale} onCancel={() => setConfirming(false)} onConfirm={confirmLogout} />
  </>;
}
