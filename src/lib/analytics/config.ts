function publicId(value: string | undefined, pattern: RegExp) {
  const normalized = value?.trim() || "";
  return pattern.test(normalized) ? normalized : null;
}

export const googleTagConfig = {
  // Preserve the currently active IDs while allowing environment-specific overrides.
  gtmId: publicId(process.env.NEXT_PUBLIC_GTM_ID, /^GTM-[A-Z0-9]+$/) || "GTM-5Z8NXLW7",
  ga4Id: publicId(process.env.NEXT_PUBLIC_GA4_ID, /^G-[A-Z0-9]+$/) || "G-GHH772JLM4",
  googleAdsId: publicId(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID, /^AW-\d+$/),
} as const;

export const googleAdsConversionLabels = {
  consultationSubmitted: process.env.NEXT_PUBLIC_GOOGLE_ADS_CONSULTATION_LABEL?.trim() || null,
  studentRegistered: process.env.NEXT_PUBLIC_GOOGLE_ADS_REGISTRATION_LABEL?.trim() || null,
  checkoutStarted: process.env.NEXT_PUBLIC_GOOGLE_ADS_CHECKOUT_LABEL?.trim() || null,
  purchaseCompleted: process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL?.trim() || null,
} as const;

export function googleAdsSendTo(label: string | null | undefined) {
  if (!googleTagConfig.googleAdsId || !label) return null;
  if (label.startsWith("AW-")) {
    return label.startsWith(`${googleTagConfig.googleAdsId}/`) ? label : null;
  }
  return `${googleTagConfig.googleAdsId}/${label}`;
}
