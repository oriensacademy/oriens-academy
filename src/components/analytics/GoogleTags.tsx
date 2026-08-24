"use client";

import { Suspense, useEffect } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { googleTagConfig } from "@/lib/analytics/config";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function StandaloneGa4PageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (googleTagConfig.gtmId || !googleTagConfig.ga4Id || typeof window.gtag !== "function") return;
    const query = searchParams?.toString();
    window.gtag("event", "page_view", {
      page_path: `${pathname}${query ? `?${query}` : ""}`,
      send_to: googleTagConfig.ga4Id,
    });
  }, [pathname, searchParams]);

  return null;
}

/**
 * Single Google tag entry point.
 * GTM owns GA4/Ads when a container is configured; standalone gtag is used
 * only when GTM is absent, preventing duplicate page-view collection.
 */
export function GoogleTags() {
  const { gtmId, ga4Id, googleAdsId } = googleTagConfig;
  const standaloneIds = gtmId ? [] : [ga4Id, googleAdsId].filter(Boolean) as string[];
  const loaderId = standaloneIds[0] || null;

  if (!gtmId && !loaderId) return null;

  return (
    <>
      <Script
        id="oriens-google-tags-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
            window.gtag('consent', 'default', {
              analytics_storage: 'denied',
              ad_storage: 'denied',
              ad_user_data: 'denied',
              ad_personalization: 'denied',
              wait_for_update: 500
            });
            window.gtag('js', new Date());
            ${!gtmId && ga4Id ? `window.gtag('config', '${ga4Id}', { send_page_view: false });` : ""}
            ${!gtmId && googleAdsId ? `window.gtag('config', '${googleAdsId}');` : ""}
          `,
        }}
      />

      {!gtmId && loaderId && (
        <>
          <Script id="oriens-google-tag-loader" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${loaderId}`} />
          <Suspense fallback={null}><StandaloneGa4PageViews /></Suspense>
        </>
      )}
    </>
  );
}
