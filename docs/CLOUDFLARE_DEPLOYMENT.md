# Cloudflare Pages Production Deployment Guide

This document details the production deployment, DNS configuration, and edge settings for Oriens Academy on **Cloudflare Pages**.

---

## 1. High-Level Production Specification

| Property | Value |
|---|---|
| **Production Domains** | `https://oriens-academy.com` / `https://www.oriens-academy.com` |
| **Preview / Internal Domain** | `https://oriens-academy-official.pages.dev` |
| **Platform** | Cloudflare Pages (Project: `oriens-academy-official`) |
| **Cloudflare Account** | `oriensacademy@gmail.com` (`a21b53a617eb5d46106a2ffdecbfef61`) |
| **Architecture** | Next.js 16 static export (`out/`) + Supabase Edge Functions + Google Mail + Cloudflare Turnstile |
| **Deployment Branch** | `main` |

---

## 2. Deployment Workflow

### Build & Deploy Command

```bash
# 1. Verify code and dependencies
npm run lint

# 2. Compile static export
npm run build

# 3. Deploy to Cloudflare Pages production
npx wrangler pages deploy out --project-name oriens-academy-official --branch main
```

---

## 3. Headers and Redirects

Cloudflare Pages natively handles HTTP headers and redirects through files in the output directory:

- **Redirects (`public/_redirects`)**:
  Redirects root `/` to Turkish locale `/tr/` with HTTP `302`.
- **Headers (`public/_headers`)**:
  Configures security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`), cache policies for static assets (`/_next/static/*` immutable), and standard TTLs for favicon, robots, and sitemaps.

---

## 4. Custom Domains & DNS Configuration

Cloudflare Pages manages custom domains with automatic SSL:

1. `oriens-academy.com` -> Pages Custom Domain (Active with Google Trust Services SSL)
2. `www.oriens-academy.com` -> Pages Custom Domain (Active with Google Trust Services SSL)

Authoritative DNS nameservers:
- `buck.ns.cloudflare.com`
- `lily.ns.cloudflare.com`

---

## 5. Backend & CORS Integration

All public interactive forms (consultation booking, contact requests, and password reset) communicate directly with **Supabase Edge Functions**.

Allowed CORS and Turnstile origins in `supabase/functions/_shared/`:
- `https://oriens-academy.com`
- `https://www.oriens-academy.com`
- `https://oriens-academy-official.pages.dev`
- `http://localhost:*` / `http://127.0.0.1:*`
