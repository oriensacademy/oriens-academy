# Oriens Academy - Cloudflare Turnstile Integration & Setup Guide

This document details the configuration required to activate Cloudflare Turnstile bot verification on Oriens Academy public forms (`create-booking` and `create-contact`).

---

## 1. Cloudflare Dashboard Widget Creation

1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left navigation bar, navigate to **Turnstile**.
3. Click **Add Widget**.
4. Configure widget details:
   - **Widget Name**: `Oriens Academy Production`
   - **Domain / Allowed Hostnames**:
     - `oriens-academy.com`
     - `www.oriens-academy.com`
   - **Widget Type**: Managed (recommended) or Non-Interactive.
5. Click **Create**.
6. Cloudflare will issue two credentials:
   - **Site Key** (Public)
   - **Secret Key** (Private)

---

## 2. Setting Environment Variables

### A. Frontend Site Key (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`)
Add the public Site Key to `.env.local` (for local development) and your Cloudflare Pages / Hosting environment variables:

```bash
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAA...your_site_key
```

> **Note**: If `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is not set during local development, the frontend automatically falls back to Cloudflare's official dummy test site key (`1x00000000000000000000AA`) with a developer notice.

### B. Supabase Edge Function Secret Key (`TURNSTILE_SECRET_KEY`)
Set the private Secret Key in Supabase Edge Function Secrets using the Supabase CLI:

```powershell
# Interactive secret configuration
$secretKey = Read-Host -Prompt "Enter TURNSTILE_SECRET_KEY" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretKey)
$plainSecret = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

npx supabase secrets set TURNSTILE_SECRET_KEY="$plainSecret"
```

---

## 3. Hostnames & Actions Matrix

| Protected Form | Action Name | Allowed Hostnames |
|---|---|---|
| Consultation Booking (`create-booking`) | `booking_submit` | `oriens-academy.com`, `www.oriens-academy.com` |
| Contact Form (`create-contact`) | `contact_submit` | `oriens-academy.com`, `www.oriens-academy.com` |

---

## 4. Security Rules & Fail-Closed Policy

- **Production Fail-Closed**: If `TURNSTILE_SECRET_KEY` is missing in production, Edge Functions return a `500 SERVER_CONFIG_ERROR` response rather than bypassing security.
- **Single-Use Tokens**: Turnstile tokens are valid for single use only. Token reuse returns `BOT_VERIFICATION_EXPIRED`.
- **Action & Hostname Verification**: The server verifies that the token's returned action matches `booking_submit` or `contact_submit`, and that the hostname matches authorized Oriens domains.
