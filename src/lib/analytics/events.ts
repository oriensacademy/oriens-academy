/**
 * Privacy-safe Google Analytics 4 & GTM Event Helpers.
 * Transmits ONLY non-PII operational event signals (language, exam code).
 * Zero names, email addresses, phone numbers, messages, or user IDs are transmitted.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackContactSuccess(params: { locale: string; subjectCategory?: string }) {
  if (typeof window === "undefined") return;

  // 1. Push to dataLayer for GTM triggers
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "contact_submit_success",
    contact_locale: params.locale,
    contact_category: params.subjectCategory || "general",
  });

  // 2. Direct gtag event if active
  if (typeof window.gtag === "function") {
    window.gtag("event", "contact_submit_success", {
      event_category: "engagement",
      event_label: params.locale,
    });
  }
}

export function trackBookingSuccess(params: { locale: string; examCode?: string }) {
  if (typeof window === "undefined") return;

  // 1. Push to dataLayer for GTM triggers
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "booking_submit_success",
    booking_locale: params.locale,
    booking_exam_code: params.examCode || "custom",
  });

  // 2. Direct gtag event if active
  if (typeof window.gtag === "function") {
    window.gtag("event", "booking_submit_success", {
      event_category: "conversion",
      event_label: params.examCode || "custom",
    });
  }
}
