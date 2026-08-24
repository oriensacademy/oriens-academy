# Google Services Setup

Google tags are mounted once from `src/components/analytics/GoogleTags.tsx`. The existing GTM and GA4 browser IDs remain the compatibility defaults; environment variables can override them per environment. When GTM is present, it owns GA4 and Ads tags. Standalone GA4 is loaded only when GTM is absent, which prevents duplicate page views.

## Google Search Console

1. Add `https://oriens-academy.com` as a Search Console property.
2. Choose the HTML meta-tag verification method and copy only the verification token.
3. Set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=<token>` in the deployment environment.
4. Build and deploy the static export.
5. Verify the property in Search Console, then submit `https://oriens-academy.com/sitemap.xml`.

When the variable is absent, no verification meta tag is rendered. Existing `robots.txt`, sitemap, canonical and hreflang metadata remain the source of truth.

## Google Tag Manager and GA4

- `NEXT_PUBLIC_GTM_ID=GTM-...` configures the container.
- `NEXT_PUBLIC_GA4_ID=G-...` configures standalone GA4 only when GTM is disabled/absent.
- If GTM is active, configure the GA4 tag and SPA/history behavior inside that one container. Do not add a second hard-coded `gtag.js` snippet.
- Consent Mode v2 defaults all analytics and advertising storage to denied. The existing consent UI updates those signals after the visitor chooses.

## Google Ads

1. Supply `NEXT_PUBLIC_GOOGLE_ADS_ID=AW-...`.
2. Supply only the real conversion labels issued by Google Ads:
   - `NEXT_PUBLIC_GOOGLE_ADS_CONSULTATION_LABEL`
   - `NEXT_PUBLIC_GOOGLE_ADS_REGISTRATION_LABEL`
   - `NEXT_PUBLIC_GOOGLE_ADS_CHECKOUT_LABEL`
   - `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL`
3. Map real completed business events to `trackGoogleAdsConversion` in `src/lib/analytics/google-ads.ts`.
4. In GTM mode, trigger the Ads conversion tag from the `google_ads_conversion` dataLayer event. In standalone mode, the helper uses `gtag` directly.

The helper is a safe no-op unless the AW ID and a matching label are configured. A payment-page visit must never be treated as a purchase; fire `purchase_completed` only after server-verified payment completion. Do not put OAuth secrets, account credentials or recovery codes in public variables or documentation.
