"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useAccount } from "@/lib/auth/account-context";
import { localizedPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function AccountMenu({ locale, mobile = false, active = false, onNavigate, onRequestLogout }: { locale: "tr" | "en"; mobile?: boolean; active?: boolean; onNavigate?: () => void; onRequestLogout?: () => void }) {
  const { signOut } = useAccount();
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
      <li className="border-b border-border"><Link href={accountHref} onClick={onNavigate} className="block py-4 text-[1.375rem] font-medium leading-[1.2] tracking-[-0.018em] text-ink">{accountLabel}</Link></li>
      <li className="border-b border-border"><button type="button" onClick={() => onRequestLogout ? onRequestLogout() : void confirmLogout()} disabled={signingOut} className="flex w-full items-center gap-2 py-4 text-left text-[1.375rem] font-medium leading-[1.2] tracking-[-0.018em] text-ink"><LogOut className="size-5" />{logoutLabel}</button></li>
    </>;
  }

  return <>
    <div ref={rootRef} className="relative">
      <button ref={triggerRef} type="button" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open} className={cn("flex min-h-11 items-center justify-center gap-1.5 sm:gap-2 rounded-full border border-primary-hover bg-primary-hover px-2.5 sm:px-3 text-sm font-semibold text-primary-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", active ? "ring-1 ring-primary/25 xl:border-primary xl:bg-primary/10 xl:text-primary" : "xl:border-border xl:bg-transparent xl:text-ink xl:hover:bg-surface-muted")}>
        <UserRound className="size-[18px] stroke-[2.25] text-primary-foreground xl:size-4 xl:stroke-2 xl:text-current" /><span className="hidden sm:inline">{accountLabel}</span><ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div role="menu" className="absolute right-0 top-full mt-2 min-w-44 rounded-xl border border-border bg-background p-1.5 shadow-xl">
        <Link role="menuitem" href={accountHref} onClick={() => setOpen(false)} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink hover:bg-surface-muted"><UserRound className="size-4" />{accountLabel}</Link>
        <button role="menuitem" type="button" onClick={() => { setOpen(false); void confirmLogout(); }} disabled={signingOut} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-red-700 hover:bg-red-50"><LogOut className="size-4" />{logoutLabel}</button>
      </div>}
    </div>
  </>;
}
