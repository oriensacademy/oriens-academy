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
import { useAccount } from "@/lib/auth/account-context";
import { formatCurrency } from "@/lib/format/currency";
import { packageDisplayName } from "@/lib/packages/display";

const MAX_POLL_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 2500;

export function PaymentResultPage() {
  const locale = useLocale();
  const pathname = usePathname();
  const copy = getPaymentCopy(locale);
  const { accountType } = useAccount();
  const isTr = locale === "tr";
  const money = (value: number, currency: string) => formatCurrency(value, { currency, locale });

  const isSuccessUrl = pathname.includes("/basarili") || pathname.includes("/success");

  const [payment, setPayment] = useState<VerifiedPaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollAttempt, setPollAttempt] = useState(0);
  const [isPendingGrace, setIsPendingGrace] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // If mounted inside an iframe (PayTR fallback navigation), break out to top window immediately
  useEffect(() => {
    if (typeof window !== "undefined" && window.top && window.top !== window.self) {
      window.top.location.href = window.location.href;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const reference = (params.get("reference") ?? "").trim();
    const token = (params.get("token") ?? "").trim();

    if (!reference || !token) {
      const timer = setTimeout(() => {
        if (active) {
          setLoading(false);
          setVerificationError(
            isTr
              ? "Ödeme referansı veya doğrulama anahtarı eksik. Satın alma durumunuzu görmek için lütfen hesabınızı inceleyiniz."
              : "Payment reference or verification token is missing. Please review your account to check your purchase status."
          );
        }
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }

    const clientEvent = pollAttempt === 0
      ? (isSuccessUrl ? "payment_success_return_reached" : "payment_failure_return_reached")
      : undefined;

    void getPaymentStatus(reference, token, clientEvent)
      .then((res) => {
        if (!active) return;

        if (!res) {
          // Status API returned an error or non-200
          if (pollAttempt < MAX_POLL_ATTEMPTS) {
            timerRef.current = setTimeout(() => {
              if (active) setPollAttempt((v) => v + 1);
            }, POLL_INTERVAL_MS);
          } else {
            setLoading(false);
            setVerificationError(
              isTr
                ? "Ödeme durumu şu anda doğrulanamıyor. Lütfen tekrar kontrol edin."
                : "Payment status could not be verified at this moment. Please try checking again."
            );
          }
          return;
        }

        setPayment(res);
        setVerificationError(null);

        // 1. Authoritative Success: Paid status verified by server callback
        if (res.status === "paid") {
          setLoading(false);
          setIsPendingGrace(false);
          return;
        }

        // 2. Final Terminal Inactive States
        if (["failed", "cancelled", "refunded"].includes(res.status)) {
          setLoading(false);
          setIsPendingGrace(false);
          return;
        }

        // 3. Pending / Processing: Bounded retry window (~20 seconds total)
        if (pollAttempt < MAX_POLL_ATTEMPTS) {
          timerRef.current = setTimeout(() => {
            if (active) setPollAttempt((v) => v + 1);
          }, POLL_INTERVAL_MS);
        } else {
          // Bounded polling complete but status still pending: neutral waiting state
          setLoading(false);
          setIsPendingGrace(true);
        }
      })
      .catch(() => {
        if (!active) return;
        if (pollAttempt < MAX_POLL_ATTEMPTS) {
          timerRef.current = setTimeout(() => {
            if (active) setPollAttempt((v) => v + 1);
          }, POLL_INTERVAL_MS);
        } else {
          setLoading(false);
          setVerificationError(
            isTr
              ? "Ödeme durumu kontrol edilirken bağlantı hatası oluştu. Lütfen durumu yeniden kontrol ediniz."
              : "A connection error occurred while checking payment status. Please recheck status."
          );
        }
      });

    return () => {
      active = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [pollAttempt, isTr, isSuccessUrl]);

  const handleManualCheck = () => {
    setLoading(true);
    setIsPendingGrace(false);
    setVerificationError(null);
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
    (payment?.status === "cancelled" && !isSuccessUrl);
  const isPendingConfirmation = loading && !isConfirmedPaid && !isConfirmedFailed && !verificationError;

  const Icon = isConfirmedPaid
    ? CheckCircle2
    : isConfirmedFailed
      ? XCircle
      : isPendingGrace || isPendingConfirmation
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
                : isPendingGrace
                  ? isTr
                    ? "Ödeme Onayı Bekleniyor"
                    : "Waiting for Payment Confirmation"
                  : isPendingConfirmation
                    ? isTr
                      ? "Ödemeniz Doğrulanıyor"
                      : "Payment Verification in Progress"
                    : isTr
                      ? "Ödeme Durumu Doğrulanamadı"
                      : "Payment Status Verification Error"}
          </h1>

          {isPendingConfirmation ? (
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
                    <dd className="text-right font-semibold text-ink">{packageDisplayName({ packageId: payment.packageId, lessonCount: payment.lessonCount }, locale)}</dd>
                  </div>
                  {payment.couponCode && Number(payment.discountAmount) > 0 ? (
                    <>
                      <div className="flex justify-between gap-4 py-2.5">
                        <dt className="text-muted-foreground">{isTr ? "Kupon" : "Coupon"}</dt>
                        <dd className="font-mono font-semibold text-emerald-800">{payment.couponCode}</dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2.5">
                        <dt className="text-muted-foreground">{isTr ? "Kupon İndirimi" : "Coupon Discount"}</dt>
                        <dd className="font-semibold text-emerald-800">-{money(Number(payment.discountAmount), payment.currency)}</dd>
                      </div>
                    </>
                  ) : null}
                  <div className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted-foreground">{isTr ? "Ödenen Tutar" : "Amount Paid"}</dt>
                    <dd className="font-bold text-ink">{money(payment.amount, payment.currency)}</dd>
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
                {payment?.statusReason ||
                  (payment?.status === "cancelled"
                    ? isTr
                      ? "Ödeme oturumu zaman aşımına uğramış veya işlem iptal edilmiştir. Paketiniz için yeniden ödeme başlatabilirsiniz."
                      : "The payment session timed out or was cancelled. You can start a new payment for your package."
                    : isTr
                      ? "Ödeme işleminiz sırasında bir hata oluştu veya işlem onaylanmadı. Kart bilgilerinizi ve limitinizi kontrol ederek tekrar deneyebilirsiniz."
                      : "An error occurred during payment processing or the transaction was not approved. Please check your card details and try again.")}
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
          ) : isPendingGrace ? (
            /* Pending Callback / Polling Limit Grace State - NEVER EQUATED TO FAILURE */
            <div className="mt-4 space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {isTr
                  ? "Ödeme bildiriminiz bankadan teyit ediliyor. Bu işlem birkaç dakika sürebilir. Paketiniz onaylandığında hesabınıza otomatik tanımlanacaktır."
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
            /* Verification / Network Error State - NEVER EQUATED TO PAYMENT FAILURE */
            <div className="mt-4 space-y-4">
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm leading-6 text-amber-950">
                <div className="flex gap-2">
                  <AlertCircle className="mt-1 size-4 shrink-0" />
                  <p>
                    {verificationError ||
                      (isTr
                        ? "Ödeme durumu şu anda doğrulanamıyor. Lütfen tekrar kontrol edin veya internet bağlantınızı kontrol ediniz."
                        : "Payment status cannot be verified right now. Please recheck or check your connection.")}
                  </p>
                </div>
              </div>

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
                  {isTr ? "Hesabıma Git" : "Go to My Account"}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
