"use client";

import { useEffect, useRef, useState } from "react";
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
  const { removeItemsFromCart } = useCart();
  const { accountType } = useAccount();
  const isTr = locale === "tr";

  const isSuccessUrl = pathname.includes("/basarili") || pathname.includes("/success");
  const isFailedUrl = pathname.includes("/basarisiz") || pathname.includes("/failed");

  const [payment, setPayment] = useState<VerifiedPaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollAttempt, setPollAttempt] = useState(0);
  const [isPendingReview, setIsPendingReview] = useState(false);
  const cartCleanedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") ?? "";
    const token = params.get("token") ?? "";

    if (!reference || !token) {
      const timer = setTimeout(() => {
        if (active) setLoading(false);
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }

    void getPaymentStatus(reference, token)
      .then((res) => {
        if (!active) return;
        setPayment(res);

        // 1. Authoritative Success: Paid status verified by server callback
        if (res?.status === "paid") {
          setLoading(false);
          setIsPendingReview(false);
          if (!cartCleanedRef.current) {
            cartCleanedRef.current = true;
            const purchasedIds =
              res.packageIds && res.packageIds.length > 0 ? res.packageIds : [res.packageId];
            removeItemsFromCart(purchasedIds);
          }
          return;
        }

        // 2. Final Inactive States
        if (res && ["failed", "cancelled", "refunded"].includes(res.status)) {
          setLoading(false);
          setIsPendingReview(false);
          return;
        }

        // 3. Pending / Processing: Bounded retry (max 5 attempts, ~2s interval)
        if (pollAttempt < 5) {
          timerRef.current = setTimeout(() => {
            if (active) setPollAttempt((v) => v + 1);
          }, 2000);
        } else {
          // Bounded polling complete but status still pending: allow manual check
          setLoading(false);
          setIsPendingReview(true);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [pollAttempt, removeItemsFromCart]);

  const handleManualCheck = () => {
    setLoading(true);
    setIsPendingReview(false);
    setPollAttempt(0);
  };

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

  const getStatusDisplayLabel = (status: string, reason?: string | null) => {
    if (status === "cancelled") {
      if (reason === "timeout" || reason === "stale_pending_ttl") {
        return isTr ? "Zaman Aşımı" : "Timeout";
      }
      if (reason === "abandoned") {
        return isTr ? "Vazgeçildi" : "Abandoned";
      }
      return isTr ? "Ödeme İptal Edildi" : "Payment Cancelled";
    }
    return labels[status as keyof typeof labels] || status;
  };

  const isConfirmedPaid = payment?.status === "paid";
  const isConfirmedFailed =
    payment?.status === "failed" ||
    (payment?.status === "cancelled" && !isSuccessUrl) ||
    isFailedUrl;

  const Icon = isConfirmedPaid
    ? CheckCircle2
    : isConfirmedFailed
      ? XCircle
      : isPendingReview || loading
        ? Clock3
        : ShieldQuestion;

  return (
    <section className="min-h-[75vh] bg-background pt-32 pb-24">
      <div className="public-container">
        <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-surface p-7 text-center shadow-editorial sm:p-10">
          <div
            className={`mx-auto flex size-16 items-center justify-center rounded-full ${
              isConfirmedPaid
                ? "bg-emerald-100 text-emerald-800"
                : isConfirmedFailed
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
            {isConfirmedPaid
              ? isTr
                ? "Ödeme İşleminiz Alındı"
                : "Payment Received"
              : isConfirmedFailed
                ? isTr
                  ? "Ödeme Tamamlanamadı"
                  : "Payment Could Not Be Completed"
                : isPendingReview
                  ? isTr
                    ? "Ödemeniz Doğrulanıyor"
                    : "Payment Verification in Progress"
                  : copy.resultTitle}
          </h1>

          {loading ? (
            <div className="mt-5 space-y-3">
              <p className="text-sm text-muted-foreground">{copy.verifying}</p>
              <div className="mx-auto size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : isConfirmedPaid ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {isTr
                  ? "Ödemeniz başarıyla doğrulanmıştır. Satın aldığınız paket hesabınıza tanımlanmıştır."
                  : "Your payment has been successfully verified. Your package is now available in your account."}
              </p>

              {payment && (
                <dl className="mx-auto mt-6 max-w-md divide-y divide-border rounded-2xl border border-border bg-surface-muted/50 p-4 text-left text-xs sm:text-sm">
                  <div className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted-foreground">{isTr ? "Durum" : "Status"}</dt>
                    <dd className="font-semibold text-emerald-800">{getStatusDisplayLabel(payment.status, payment.statusReason)}</dd>
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
                  href={accountType === "admin" ? "/admin/" : localizedPath("studentAccount", locale)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-forest"
                >
                  <User className="size-4" />
                  {accountType === "admin"
                    ? isTr
                      ? "Yönetim Paneline Git"
                      : "Go to Admin"
                    : isTr
                      ? "Hesabıma Git"
                      : "Go to My Account"}
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          ) : isConfirmedFailed ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {payment?.status === "cancelled"
                  ? isTr
                    ? "Ödeme oturumu zaman aşımına uğramış veya işlem iptal edilmiştir. Sepetiniz korunmaktadır."
                    : "The payment session timed out or was cancelled. Your cart items are preserved."
                  : isTr
                    ? "Ödeme işleminiz sırasında bir hata oluştu veya işlem onaylanmadı. Kart bilgilerinizi ve limitinizi kontrol ederek tekrar deneyebilirsiniz."
                    : "An error occurred during payment processing or the transaction was not approved. Please check your card details and try again."}
              </p>

              {payment && (
                <div className="mt-2 text-xs font-semibold text-rose-800">
                  {isTr ? "İşlem Durumu" : "Transaction Status"}: {getStatusDisplayLabel(payment.status, payment.statusReason)}
                </div>
              )}

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
          ) : isPendingReview ? (
            /* Pending Callback / Polling Limit Grace State */
            <div className="mt-4 space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {isTr
                  ? "Ödeme bildiriminiz bankadan teyit ediliyor. Bu işlem birkaç saniye sürebilir. Paketiniz onaylandığında hesabınıza otomatik tanımlanacaktır."
                  : "Your payment confirmation is being verified by the bank. This may take a few moments. Once confirmed, your package will be credited automatically."}
              </p>

              {payment && (
                <dl className="mx-auto mt-6 max-w-md divide-y divide-border rounded-2xl border border-border bg-surface-muted/50 p-4 text-left text-xs sm:text-sm">
                  <div className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted-foreground">{isTr ? "Durum" : "Status"}</dt>
                    <dd className="font-semibold text-amber-800">{getStatusDisplayLabel(payment.status, payment.statusReason)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted-foreground">{isTr ? "Referans" : "Reference"}</dt>
                    <dd className="font-mono font-semibold text-ink">{payment.reference}</dd>
                  </div>
                </dl>
              )}

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleManualCheck}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-forest"
                >
                  <RefreshCw className="size-4" />
                  {isTr ? "Durumu Yeniden Kontrol Et" : "Recheck Status"}
                </button>
                <Link
                  href={accountType === "admin" ? "/admin/" : localizedPath("studentAccount", locale)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border px-6 text-sm font-semibold text-ink transition-colors hover:bg-surface-muted"
                >
                  <User className="size-4" />
                  {isTr ? "Hesabıma Dön" : "Return to Account"}
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
