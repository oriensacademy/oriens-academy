import { Building2, CreditCard } from "lucide-react";
import type { Locale } from "@/content/dictionaries";
import type { PaymentMethod } from "@/lib/payments/types";
import { getPaymentCopy } from "@/content/payment";

export function PaymentMethodSelector({ locale, value, onChange }: { locale: Locale; value: PaymentMethod; onChange: (method: PaymentMethod) => void }) {
  const copy = getPaymentCopy(locale);
  return <div role="radiogroup" aria-label={locale === "tr" ? "Ödeme yöntemi" : "Payment method"} className="grid gap-3 sm:grid-cols-2">
    {([{ id: "card", label: copy.card, icon: CreditCard }, { id: "bank_transfer", label: copy.transfer, icon: Building2 }] as const).map((method) => <button key={method.id} type="button" role="radio" aria-checked={value === method.id} onClick={() => onChange(method.id)} className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 text-left text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${value === method.id ? "border-primary bg-sage-soft text-ink" : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-ink"}`}><method.icon className="size-5" aria-hidden="true" />{method.label}</button>)}
  </div>;
}
