import { googleAdsSendTo, googleTagConfig } from "@/lib/analytics/config";

export type GoogleAdsConversion = {
  sendTo: string | null | undefined;
  value?: number;
  currency?: string;
  transactionId?: string;
};

/** Safe no-op unless both the configured AW ID and a matching conversion label exist. */
export function trackGoogleAdsConversion({ sendTo, value, currency, transactionId }: GoogleAdsConversion) {
  if (typeof window === "undefined") return false;
  const destination = googleAdsSendTo(sendTo);
  if (!destination) return false;

  const payload = {
    send_to: destination,
    ...(typeof value === "number" ? { value } : {}),
    ...(currency ? { currency } : {}),
    ...(transactionId ? { transaction_id: transactionId } : {}),
  };

  if (googleTagConfig.gtmId) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "google_ads_conversion", ...payload });
    return true;
  }
  if (typeof window.gtag === "function") {
    window.gtag("event", "conversion", payload);
    return true;
  }
  return false;
}
