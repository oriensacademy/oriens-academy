"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldQuestion,
  User,
  XCircle,
} from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { getPaymentCopy } from "@/content/payment";
import { getPaymentStatus } from "@/lib/payments/client";
import type { VerifiedPaymentStatus } from "@/lib/payments/types";
import { localizedPath } from "@/lib/routes";
import { useCart } from "@/lib/cart/cart-context";
import { useAccount } from "@/lib/auth/account-context";

export function PaymentResultPage() {
  const locale = useLocale();
  const pathname = usePathname();
  const copy = getPaymentCopy(locale);
  const { clearCart } = useCart();
  const { accountType } = useAccount();
  const isTr = locale === "tr";

  const isSuccessUrl = pathname.includes("/basarili") || pathname.includes("/success");
  const isFailedUrl = pathname.includes("/basarisiz") || pathname.includes("/failed");

  const [payment, setPayment] = useState<VerifiedPaymentStatus | null>(null);
  const [loading, setLoading] = useState(!isSuccessUrl && !isFailedUrl);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") ?? "";
    const token = params.get("token") ?? "";

    if (reference && token) {
      getPaymentStatus(reference, token)
        .then((res) => {
          if (!active) return;
          setPayment(res);
          if (res?.status === "paid") {
            clearCart();
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      if (isSuccessUrl) {
        clearCart();
      }
    }

    return () => {
      active = false;
    };
  }, [isSuccessUrl, clearCart]);

  const labels = isTr
    ? {
        pending: "Ödeme Bekleniyor",
        requires_action: "Doğrulama Gerekli",
        processing: "Ödeme İşleniyor",
        paid: "Ödeme Başarılı",
        failed: "Ödeme Başarısız",
        cancelled: "Ödeme İptal Edildi",
        refunded: "Ödeme İade Edildi",
      }
    : {
        pending: "Payment Pending",
        requires_action: "Verification Required",
        processing: "Payment Processing",
        paid: "Payment Successful",
        failed: "Payment Failed",
        cancelled: "Payment Cancelled",
        refunded: "Payment Refunded",
      };

  const isSuccessState = isSuccessUrl || payment?.status === "paid";
  const isFailedState = isFailedUrl || payment?.status === "failed" || payment?.status === "cancelled";

  const Icon = isSuccessState
    ? CheckCircle2
    : isFailedState
      ? XCircle
      : payment
        ? Clock3
        : ShieldQuestion;

  return (
    <section className="min-h-[75vh] bg-background pt-32 pb-24">
      <div className="public-container">
        <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-surface p-7 text-center shadow-editorial sm:p-10">
          <div
            className={`mx-auto flex size-16 items-center justify-center rounded-full ${
              isSuccessState
                ? "bg-emerald-100 text-emerald-800"
                : isFailedState
                  ? "bg-rose-100 text-rose-800"
                  : "bg-surface-muted text-primary"
            }`}
          >
            <Icon className="size-8" />
          </div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {copy.eyebrow}
          </p>

          <h1 className="mt-3 font-heading text-3xl text-ink sm:text-4xl">
            {isSuccessState
              ? isTr
                ? "Ödeme İşleminiz Alındı"
                : "Payment Received"
              : isFailedState
                ? isTr
                  ? "Ödeme Tamamlanamadı"
                  : "Payment Could Not Be Completed"
                : copy.resultTitle}
          </h1>

          {loading ? (
            <p className="mt-5 text-sm text-muted-foreground">{copy.verifying}</p>
          ) : isSuccessState ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {isTr
                  ? "Ödemenizin doğrulanması tamamlandığında paketiniz hesabınıza otomatik olarak tanımlanacaktır."
                  : "Once your payment is verified, your package will be automatically activated in your account."}
              </p>

              {payment && (
                <dl className="mx-auto mt-6 max-w-md divide-y divide-border rounded-2xl border border-border bg-surface-muted/50 p-4 text-left text-xs sm:text-sm">
                  <div className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted-foreground">{isTr ? "Durum" : "Status"}</dt>
                    <dd className="font-semibold text-emerald-800">{labels[payment.status]}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted-foreground">{isTr ? "Referans" : "Reference"}</dt>
                    <dd className="font-mono font-semibold text-ink">{payment.reference}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted-foreground">{copy.package}</dt>
                    <dd className="font-semibold text-ink">{payment.packageId}</dd>
                  </div>
                </dl>
              )}

              <div className="mt-8 flex justify-center">
                <Link
                  href={accountType === "admin" ? "/admin" : localizedPath("studentAccount", locale)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-forest"
                >
                  <User className="size-4" />
                  {accountType === "admin" ? (isTr ? "Yönetim Paneline Git" : "Go to Admin") : (isTr ? "Hesabıma Git" : "Go to My Account")}
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          ) : isFailedState ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {isTr
                  ? "Ödeme işleminiz sırasında bir hata oluştu veya işlem onaylanmadı. Kart bilgilerinizi ve limitinizi kontrol ederek tekrar deneyebilirsiniz."
                  : "An error occurred during payment processing or the transaction was not approved. Please check your card details and try again."}
              </p>

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href={localizedPath("payment", locale)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-forest"
                >
                  <RefreshCw className="size-4" />
                  {isTr ? "Tekrar Dene" : "Try Again"}
                </Link>
                <Link
                  href={localizedPath("pricing", locale)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border px-6 text-sm font-semibold text-ink transition-colors hover:bg-surface-muted"
                >
                  {isTr ? "Paketleri İncele" : "View Packages"}
                </Link>
              </div>
            </div>
          ) : payment ? (
            <div className="mt-6">
              <p className="font-heading text-2xl text-ink">{labels[payment.status]}</p>
              <dl className="mx-auto mt-6 max-w-md divide-y divide-border border-y border-border text-left text-sm">
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-muted-foreground">{isTr ? "Referans" : "Reference"}</dt>
                  <dd className="font-mono font-semibold text-ink">{payment.reference}</dd>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-muted-foreground">{copy.package}</dt>
                  <dd className="font-semibold text-ink">{payment.packageId}</dd>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-muted-foreground">{isTr ? "Tutar" : "Amount"}</dt>
                  <dd className="font-semibold text-ink">
                    {new Intl.NumberFormat(isTr ? "tr-TR" : "en-GB", {
                      style: "currency",
                      currency: payment.currency,
                    }).format(payment.amount)}
                  </dd>
                </div>
              </dl>
              <div className="mt-8 flex justify-center">
                <Link
                  href={accountType === "admin" ? "/admin" : localizedPath("studentAccount", locale)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-forest"
                >
                  <User className="size-4" />
                  {accountType === "admin" ? (isTr ? "Yönetim Paneline Git" : "Go to Admin") : (isTr ? "Hesabıma Git" : "Go to My Account")}
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm leading-6 text-amber-950">
              <div className="flex gap-2">
                <AlertCircle className="mt-1 size-4 shrink-0" />
                <p>{copy.verificationFailed}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
