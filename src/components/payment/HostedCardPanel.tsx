"use client";

import { useState } from "react";
import Image from "next/image";
import { LockKeyhole, RotateCcw } from "lucide-react";
import type { Locale } from "@/content/dictionaries";
import { getPaymentCopy } from "@/content/payment";
import { pendingBankCapabilities } from "@/lib/payments/bank-provider";

export function HostedCardPanel({ locale }: { locale: Locale }) {
  const copy = getPaymentCopy(locale);
  const [flipped, setFlipped] = useState(false);
  return <div className="space-y-5">
    <div className="mx-auto [perspective:1000px] max-w-md">
      <button type="button" onClick={() => setFlipped((value) => !value)} aria-label={locale === "tr" ? "Kart ön ve arka yüzünü göster" : "Show front or back of card"} className="block aspect-[1.586/1] w-full rounded-[22px] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4">
        <span className={`relative block size-full transition-transform duration-500 motion-reduce:transition-none [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""}`}>
          <span className="absolute inset-0 flex flex-col justify-between rounded-[22px] border border-primary/35 bg-forest p-6 text-left text-white shadow-editorial [backface-visibility:hidden]"><span className="flex items-center justify-between"><span className="font-heading text-xl">Oriens Academy</span><LockKeyhole className="size-5 text-warm-accent" /></span><span className="font-ui text-xl tracking-[0.14em]">•••• •••• •••• ••••</span><span className="flex justify-between text-[10px] uppercase tracking-wider text-white/70"><span>{copy.cardHolder}</span><span>{copy.expiry}</span></span></span>
          <span className="absolute inset-0 rounded-[22px] border border-primary/35 bg-forest p-6 text-left text-white shadow-editorial [backface-visibility:hidden] [transform:rotateY(180deg)]"><span className="mt-5 block h-10 bg-white/15" /><span className="mt-6 flex items-center justify-end gap-3"><span className="text-xs text-white/70">{copy.cvv}</span><span className="rounded bg-surface px-4 py-2 text-sm text-ink">•••</span></span><RotateCcw className="absolute bottom-5 left-6 size-4 text-white/60" /></span>
        </span>
      </button>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">{[copy.cardNumber, copy.cardHolder, copy.expiry, copy.cvv].map((label) => <div key={label} className="rounded-lg border border-border bg-surface-muted p-3"><div className="text-xs font-semibold text-ink">{label}</div><div className="mt-1 text-[11px] leading-4 text-muted-foreground">{copy.hostedField}</div></div>)}</div>
    {pendingBankCapabilities.configured && pendingBankCapabilities.supportedNetworks.length > 0 && <div className="flex items-center justify-end"><Image src="/payments/supported-card-networks.png" alt={locale === "tr" ? "Desteklenen kart ağları" : "Supported card networks"} width={1224} height={307} className="h-8 w-auto object-contain" /></div>}
    <div className={`rounded-xl p-4 text-sm leading-6 ${pendingBankCapabilities.configured ? "border border-border bg-surface-muted text-ink" : "border border-amber-300 bg-amber-50 text-amber-950"}`}>{!pendingBankCapabilities.configured && <p className="font-semibold">{copy.cardPending}</p>}<p className="mt-2 text-xs">{copy.secureText}</p><p className="mt-2 font-mono text-[10px]">{pendingBankCapabilities.configured ? "BANK PROVIDER CONFIGURED" : "PENDING BANK CREDENTIALS"} · 3D Secure: {pendingBankCapabilities.threeDSecure ? "ACTIVE" : "PENDING"}</p></div>
  </div>;
}
