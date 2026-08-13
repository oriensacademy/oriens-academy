"use client";

import Script from "next/script";

export const GTM_CONTAINER_ID = "GTM-T43G7G8N";

/**
 * Global Google Tag Manager (GTM) Container Integration component.
 * Container ID: GTM-T43G7G8N
 * Static-export compatible via Next.js next/script.
 */
export function GoogleTagManager() {
  return (
    <>
      {/* GTM inline initialization script */}
      <Script
        id="gtm-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${GTM_CONTAINER_ID}');
          `,
        }}
      />

      {/* GTM noscript fallback for JavaScript-disabled environments */}
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${GTM_CONTAINER_ID}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
          title="Google Tag Manager"
        />
      </noscript>
    </>
  );
}
