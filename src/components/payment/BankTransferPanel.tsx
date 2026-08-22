"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Locale } from "@/content/dictionaries";
import type { BankTransferDetails } from "@/lib/payments/types";
import { getPaymentCopy } from "@/content/payment";

export function BankTransferPanel({ locale, details }: { locale: Locale; details: BankTransferDetails | null }) {
  const copy = getPaymentCopy(locale);
  const [notice, setNotice] = useState("");
  async function copyText(value: string, message: string) { await navigator.clipboard.writeText(value); setNotice(message); window.setTimeout(() => setNotice(""), 2200); }
  if (!details) return <div className="rounded-xl border border-border bg-surface-muted p-5 text-sm text-muted-foreground">{copy.transferMissing}</div>;
  return <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
    <dl className="divide-y divide-border">{[[copy.accountHolder, details.accountHolder], [copy.bank, details.bankName], [copy.iban, details.iban]].map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]"><dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="break-all text-sm font-semibold text-ink">{value}</dd></div>)}</dl>
    <div className="mt-5 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => copyText(details.iban, copy.copied)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border-strong px-4 text-sm font-semibold text-ink hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Copy className="size-4" />{copy.copyIban}</button><button type="button" onClick={() => copyText(`${details.accountHolder}\n${details.bankName}\n${details.iban}`, copy.accountCopied)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border-strong px-4 text-sm font-semibold text-ink hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Copy className="size-4" />{copy.copyAccount}</button></div>
    <div role="status" aria-live="polite" className="mt-3 min-h-5 text-xs font-semibold text-primary">{notice && <span className="inline-flex items-center gap-1"><Check className="size-3.5" />{notice}</span>}</div>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">{copy.referenceNotice}</p>
  </div>;
}
