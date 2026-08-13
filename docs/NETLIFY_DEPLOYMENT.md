# Netlify Production Deployment Guide

This document details the verified production hosting setup, CI/CD workflow, security boundaries, and custom domain procedures for **Oriens Academy**.

---

## 1. High-Level Production Architecture

```text
oriens-academy.com / oriens-v1.netlify.app
        │
        ▼
NETLIFY (Site ID: 2c0acef1-d0ec-4d17-8f1e-23bb373b7e5f)
Frontend / CDN / HTTPS
Next.js runtime through Netlify OpenNext (`trailingSlash: true`)
        │
        ▼
SUPABASE (Project Ref: mwbrlfmdpbkmdjroxhcc)
PostgreSQL (Database)
Auth (Admin Session Management)
RLS (Row Level Security)
Edge Functions (`booking-availability`, `create-booking`, `create-contact`)
        │
        ▼
RESEND
Transactional email (Triggered by Supabase Edge Functions)
```

- **Frontend / Runtime API**: Netlify serves static assets and provisions the Next.js runtime for SSR and Route Handlers.
- **Backend / Database**: Hosted on Supabase.
- **Email**: Handled by Resend via Supabase Edge Functions.

---

## 2. Netlify Next.js Runtime Configuration

Configured in [`netlify.toml`](file:///C:/Users/merto/Desktop/oriens-academy.com/netlify.toml) and [`next.config.ts`](file:///C:/Users/merto/Desktop/oriens-academy.com/next.config.ts):

| Setting | Value | Purpose |
|---|---|---|
| **Site Name** | `oriens-v1` | Linked Netlify production project |
| **Site ID** | `2c0acef1-d0ec-4d17-8f1e-23bb373b7e5f` | Netlify project API identifier |
| **Build Command** | `npm run build` | Next.js production build (`next build`) |
| **Runtime Adapter** | Netlify OpenNext | Provisions Route Handlers and other Next.js runtime output |
| **Node Version** | `20.18.0` | Stable Node.js major runtime |
| **Routing Mode** | `trailingSlash: true` | Preserves the established public URL format |

---

## 3. Verified Supabase CORS Integration

Supabase Edge Functions (`booking-availability`, `create-booking`, `create-contact`) use the shared CORS helper in [`supabase/functions/_shared/cors.ts`](file:///C:/Users/merto/Desktop/oriens-academy.com/supabase/functions/_shared/cors.ts):

### Allowed Origins Set:
- `https://oriens-academy.com`
- `https://www.oriens-academy.com`
- `https://oriens-v1.netlify.app`
- Local development (`http://localhost:*`, `http://127.0.0.1:*`)

### Verification Results:
- **Preflight `OPTIONS`**: Returns HTTP `204 No Content` with `Access-Control-Allow-Origin: https://oriens-v1.netlify.app`.
- **`GET /booking-availability`**: Returns HTTP `200 OK` with slot availability payload and valid CORS header.
- **`POST /create-booking` & `/create-contact`**: Accepts synthetic payloads from `oriens-v1.netlify.app` and returns HTTP `400 Bad Request` validation response with valid CORS header.
- **Unauthorized Origin (`https://example.invalid`)**: Rejection confirmed via HTTP `403 Forbidden` (`FORBIDDEN_ORIGIN`).

---

## 4. Environment Variables Strategy

### Public Netlify Environment Variables:
Configured in Netlify Site Settings:
```env
NEXT_PUBLIC_SUPABASE_URL=https://mwbrlfmdpbkmdjroxhcc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

### Server Secret Boundaries:
The following secrets reside **EXCLUSIVELY** inside Supabase Edge Function Secrets and are **NOT** present on Netlify:
- `SUPABASE_SERVICE_ROLE_KEY`
- Database credentials
- `RESEND_API_KEY`
- `TURNSTILE_SECRET_KEY`

---

## 5. Host-Level Redirect & 404 Routing

- **Root Language Redirect**: HTTP 302 redirect from `/` to `/tr/`.
- **404 Handling**: Next.js and the Netlify runtime handle unmapped routes. No SPA catch-all rewrite is configured.

---

## 6. Access Control & Deployment Status

- **Deployment Status**: Production build successfully deployed to `oriens-v1` via Netlify CLI.
- **Team SSO Protection**: Netlify Team Access Protection (`account_sso_login`) is active for the development subdomain. Logging into Netlify in browser grants access; protection clears automatically upon custom domain DNS cutover or Team Access settings update.

---

## 7. Remaining Phased Actions

### Phase 2: Resend Sender Domain & API Key Configuration (Next Phase)
- Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in Supabase Edge Function Secrets.
- Verify transactional email delivery for booking & contact pipelines.

### Phase 3: Custom Domain & DNS Cutover (Manual Human Approval Required)
- Add `oriens-academy.com` and `www.oriens-academy.com` in Netlify Domain Management.
- Point DNS A / CNAME records to Netlify.
- **DO NOT MODIFY** existing `MX`, `SPF`, `DKIM`, or `DMARC` records.
