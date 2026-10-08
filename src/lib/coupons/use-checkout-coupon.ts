"use client";

import { useEffect, useState } from "react";
import { couponRuleFromQuote, type CouponRuleSnapshot } from "@/lib/payments/pricing";
import { quoteCheckoutCoupon } from "./client";
import type { CouponQuoteResult } from "./types";

export type CheckoutCouponStatus = "none" | "loading" | "valid" | "invalid";

export interface CheckoutCouponState {
  status: CheckoutCouponStatus;
  rule: CouponRuleSnapshot | null;
  error: string | null;
}

/**
 * Sepetteki kuponu, ekranda gösterilen paket kümesi (ve seçili öğrenci) için
 * sunucuya yeniden sorar. Kupon kuralı yalnız bu sorgudan gelir; paket
 * eklenip çıkarıldığında, doğrudan paket ödemesinde veya öğrenci
 * değiştiğinde paytr-create-token'ın göreceği kuralın aynısı kullanılır.
 */
export function useCheckoutCoupon(
  code: string | null | undefined,
  packageIds: string[],
  studentUserId: string | null | undefined,
  locale: "tr" | "en"
): CheckoutCouponState {
  const cleanCode = code?.trim().toUpperCase() || "";
  const idsKey = [...packageIds].sort().join(",");
  const student = studentUserId || "";
  const key = cleanCode && idsKey ? `${cleanCode}|${idsKey}|${student}|${locale}` : "";
  const [resolved, setResolved] = useState<{ key: string; result: CouponQuoteResult } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void quoteCheckoutCoupon(cleanCode, idsKey.split(","), student || undefined, locale).then((result) => {
      if (!cancelled) setResolved({ key, result });
    });
    return () => {
      cancelled = true;
    };
  }, [cleanCode, idsKey, key, locale, student]);

  if (!key) return { status: "none", rule: null, error: null };
  if (resolved?.key !== key) return { status: "loading", rule: null, error: null };
  const rule = couponRuleFromQuote(resolved.result);
  if (rule) return { status: "valid", rule, error: null };
  return {
    status: "invalid",
    rule: null,
    error: resolved.result.valid ? null : resolved.result.message,
  };
}
