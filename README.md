# Oriens Academy

Oriens Academy is a bilingual Turkish/English academic consultancy site with international-exam content, university-support guidance, consultation booking, contact lead capture, database-backed public content, and a protected operations panel.

## Architecture

- **Frontend/runtime:** Next.js 15 App Router, React 19, TypeScript and Tailwind CSS 4 on Netlify's Next.js runtime.
- **Backend:** hosted Supabase PostgreSQL, Auth, Row Level Security (RLS), RPCs and Edge Functions.
- **Email/security:** Resend transactional email and Cloudflare Turnstile.
- **Content:** localized TypeScript dictionaries plus selected Supabase-managed records.
- **Important:** this is not configured as a static export. Dynamic Next.js route handlers provide search and eligibility APIs.

```text
Browser -> Netlify Next.js runtime -> public pages / Next route handlers
   |                                  |
   +-> Supabase public reads          +-> Supabase data/search
   +-> Supabase Edge Functions -> Turnstile -> PostgreSQL/RPC -> Resend
   +-> Supabase Auth + RLS (admin only)
```

See [Developer Handoff](docs/DEVELOPER_HANDOFF.md) for the detailed system model.

## Technology Stack

| Area | Implementation |
|---|---|
| Web | Next.js 15.5, React 19, TypeScript 5 |
| Styling | Tailwind CSS 4, shadcn-compatible local components, Base UI/Radix primitives |
| Motion | Motion for React, CSS motion, DotLottie |
| Data visualization | D3 geographic modules, Canvas, local GeoJSON |
| Backend | Supabase PostgreSQL, Auth, RLS, Edge Functions |
| Email / bot defense | Resend / Cloudflare Turnstile |
| Hosting | Netlify Next.js runtime |

## Project Structure

```text
src/app/                 App Router pages, admin routes and runtime APIs
src/components/          Public, admin, motion and UI component source
src/content/             TR/EN content and exam metadata
src/data/                Destination, university and visual mappings
src/lib/                 Supabase, admin, search and admission-domain logic
public/                  Runtime brand, animation and map assets
supabase/functions/      Edge Functions and shared email/security code
supabase/migrations/     Ordered PostgreSQL schema and policy history
scripts/                 Maintained ingestion, local setup and regression tooling
design-system/           Preserved approved/historical brand design sources
docs/                    Canonical handoff and supporting technical records
```

## Quick Start

Prerequisites: Node.js 20 (Netlify pins `20.18.0`), npm, and optionally Docker plus the Supabase CLI for local backend work.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000/tr/` or `/en/`. Configure only the variables required for the workflow being exercised. Never place service-role, Resend or Turnstile secrets in a `NEXT_PUBLIC_*` variable.

```bash
npm run lint
npm run build
npm audit --omit=dev
```

The package manager is npm (`package-lock.json`). `npm run start` serves a completed Next.js build.

## Environment Variables

The safe, commented inventory is [.env.example](.env.example). Browser variables configure Supabase public access and Turnstile. Privileged variables belong in Netlify server configuration, local untracked files, or Supabase Edge Function secrets. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions.

## Public Routes and Internationalization

The locale prefix is mandatory. Turkish is the default redirect target.

| Purpose | Turkish | English |
|---|---|---|
| Home | `/tr/` | `/en/` |
| Exams | `/tr/sinavlar/` | `/en/exams/` |
| Exam detail | `/tr/sinavlar/{slug}/` | `/en/exams/{slug}/` |
| University support | `/tr/universite-destegi/` | `/en/university-support/` |
| Pricing | `/tr/ucretler/` | `/en/pricing/` |
| About | `/tr/hakkimizda/` | `/en/about/` |
| Booking | `/tr/randevu/` | `/en/booking/` |
| Contact | `/tr/iletisim/` | `/en/contact/` |
| Assessment | `/tr/degerlendirme/` | `/en/assessment/` |
| Privacy / terms | `/tr/privacy/`, `/tr/terms/` | `/en/privacy/`, `/en/terms/` |

Localized content is in `src/content/tr`, `src/content/en`, and shared records in `src/content`. The locale switcher preserves the equivalent page and exam slug. Supported exams are IB, AP, SAT, ESAT, TARA, TMUA, IGCSE, GRE, GMAT, UKCAT, IMAT and OMPT.

## UI, Brand and Interactive Components

The implemented visual system uses an editorial ivory/sage palette, DM Serif Display headings, Inter body text and Manrope UI text. Runtime tokens are in `src/app/globals.css`; brand assets are in `public/brand`. The current implementation is documented in [Design System](docs/DESIGN_SYSTEM.md). Historical approved direction remains preserved under `design-system/oriens-academy`.

Motion includes the compass loader, route and locale transitions, reveal/stagger primitives, rotating hero text, phone and exam carousels, Lottie illustrations, counters and the D3/Canvas study-destination globe. See [Component References](docs/COMPONENT_REFERENCES.md) for restoration commands.

## Admin Panel

`/admin` is protected by Supabase Auth, a JWT `app_metadata.role = "admin"` check, an active `admin_profiles` row and RLS. Modules cover dashboard, appointments, students, contact requests, availability, pricing, testimonials/content, notification delivery, audit logs and settings. Credentials must be transferred separately through a secure channel.

The auth provider is stable at the admin layout level. Internal navigation uses Next.js links; silent token refresh must not unmount open modals or reset filters. Local setup is documented in `docs/LOCAL_ADMIN_SETUP.md`.

## Supabase, RLS and Edge Functions

Schema changes are migration-only. Start/reset a local stack with:

```bash
npm run local:supabase:start
npm run local:reset
```

Set explicit local administrator variables before `npm run local:admin:setup`. Link and deploy only when separately authorized:

```bash
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
npx supabase functions deploy <FUNCTION_NAME>
```

Public mutations do not write PII tables directly. `create-booking` and `create-contact` validate Turnstile and use server credentials; booking uses an atomic reservation RPC. `booking-availability` returns a reduced future-slot DTO. `admin-password-reset` is Turnstile-, identity- and cooldown-protected. Detailed entities and boundaries are in [Developer Handoff](docs/DEVELOPER_HANDOFF.md).

## Transactional Email and Turnstile

Email templates live in `supabase/functions/_shared/email/templates.ts`; dispatch/logging is in `email/service.ts`. Admin notifications include useful request data while student acknowledgements remain minimal. Delivery attempts are recorded in `notification_deliveries`, and provider failure does not roll back the originating request.

Turnstile protects booking, contact/consultation, quick-contact and admin password-recovery submissions. Production fails closed when the secret is absent. Configuration details remain in `docs/TURNSTILE_SETUP.md`.

## Analytics and SEO

GA4 and GTM are mounted only in the localized public layout; admin routes exclude them. Consent Mode v2 defaults storage to denied, and custom success events omit names, email, phone, messages and user IDs. Public identifiers are intentionally client-visible in the analytics components.

SEO uses localized metadata, canonical URLs, TR/EN hreflang plus `x-default`, JSON-LD, generated robots and sitemap routes. Admin routes are `noindex` and disallowed in robots rules.

## Deployment

Netlify runs `npm run build` using Node `20.18.0`. `netlify.toml` redirects `/` to `/tr/`, applies security/cache headers and uses the Netlify Next.js runtime. There is no `output: "export"`; the ignored `out/` directory is not a deployment source.

Do not push, deploy, alter DNS or run remote migrations without explicit release authorization. See `docs/NETLIFY_DEPLOYMENT.md` and [Developer Handoff](docs/DEVELOPER_HANDOFF.md).

## Operational Maintenance

Use the admin panel for routine appointments, leads, pricing, testimonials, delivery failures, audit records and site settings. Use Supabase for schema/function health and Netlify for build/runtime health. See [Maintenance](docs/MAINTENANCE.md).

## Troubleshooting

- Missing Supabase variables cause the browser client to fail immediately by design.
- A form failing only in production commonly indicates Turnstile hostname/action or Edge Function secret configuration.
- A stored request with failed email status should be investigated in `notification_deliveries`; do not resubmit the visitor record blindly.
- Search APIs require the Netlify/Next runtime and database availability; they are not static files.
- If an admin session authenticates but the UI rejects it, verify both JWT app metadata and the active admin profile.

## Security and Handoff Notes

Never commit real `.env` files, database passwords, service-role keys, Resend keys, Turnstile secrets, private keys or administrator passwords. Public Supabase publishable keys and analytics IDs are browser identifiers, not authorization boundaries; RLS and server-side controls remain mandatory.

Transfer administrator credentials and access to Supabase, Netlify, the domain registrar/DNS provider, Resend, Cloudflare, GA/GTM and Search Console separately through secure channels. No credentials belong in this repository.
