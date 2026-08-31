# Oriens Academy payment infrastructure

Status: **PENDING BANK CREDENTIALS** (22 August 2026)

The browser does not collect or submit raw card numbers, CVV/CVC values, magnetic-stripe data, card passwords or 3D Secure passwords. Card payment remains disabled until an official bank Virtual POS contract, integration guide, supported network list and sandbox credentials are available.

## Flow

1. The browser sends package, payer, consent and Turnstile data to `create-payment`.
2. The Edge Function reads the enabled package and amount from PostgreSQL; client amounts are ignored.
3. A future bank adapter must create a hosted or tokenised payment session and redirect to the bank's 3D Secure flow.
4. `payment-callback` accepts a result only after the provider adapter verifies the bank signature.
5. Only a verified `paid` callback invokes the server-only package activation function.
6. The result page posts a random status credential to `payment-status`; URL state alone cannot produce a successful result.

The provider boundary is in `supabase/functions/_shared/payments`. The current pending provider performs no bank network request and can never report success. Do not add credentials to site settings or browser environment variables; provider secrets belong in Supabase Edge Function secrets.

## Bank transfer

Account holder, bank name and IBAN use the existing `site_settings` architecture and are editable under Admin → Ayarlar → Ödeme Bilgileri. Public details render only when all three real values are configured. A transfer creates a pending transaction and never activates a package automatically.

## Card network artwork

The owner-supplied payment infrastructure artwork is stored at `public/images/payment/odeme_altyapi.png` and rendered responsively in the footer without stretching.

## HTTPS audit

Checked from the local development workstation on 22 August 2026:

- Production URL: `https://oriens-academy.com/`
- HTTPS response: active; redirects to `/tr/`
- TLS protocol negotiated: TLS 1.3
- Certificate subject: `CN=oriens-academy.com`
- Issuer: Let's Encrypt `YE2`
- Validity: 24 July 2026 through 22 October 2026 (UTC)
- HSTS: `max-age=31536000`
- `https://www.oriens-academy.com/`: redirects to the canonical HTTPS domain

No current TLS/certificate blocker was observed. Bank acceptance is still contingent on the bank confirming callback URLs, allowed domains, cipher/TLS policy and any merchant onboarding requirements.
