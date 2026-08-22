# Oriens Academy

Oriens Academy is a bilingual Turkish/English academic consultancy site with international-exam content, university-support guidance, consultation booking, contact lead capture, database-backed public content, and a protected operations panel.

## Architecture

- **Frontend/hosting:** Next.js 16 App Router, React 19, TypeScript and Tailwind CSS 4 hosted on **Cloudflare Pages** via Next.js static export (`out/`).
- **Backend:** hosted Supabase PostgreSQL, Auth, Row Level Security (RLS), RPCs and Edge Functions.
- **Email/security:** Google Mail (Google Workspace / Gmail API) transactional email and Cloudflare Turnstile.
- **Content:** localized TypeScript dictionaries plus selected Supabase-managed records.
- **Static Export:** The frontend is pre-rendered as a fast, secure static export. Dynamic backend logic and mutations are handled directly by Supabase and Supabase Edge Functions.

```text
Browser -> Cloudflare Pages (Static Assets / Edge CDN) -> public pages & admin UI
   |
   +-> Supabase public reads / RPCs (search, availability, public settings)
   +-> Supabase Edge Functions -> Turnstile verification -> PostgreSQL/RPC -> Google Mail
   +-> Supabase Auth + RLS (student & admin authenticated access)
```

See [Developer Handoff](docs/DEVELOPER_HANDOFF.md) for the detailed system model.

## Technology Stack

| Area | Implementation |
|---|---|
| Web | Next.js 16, React 19, TypeScript 5 |
| Styling | Tailwind CSS 4, shadcn-compatible local components, Base UI/Radix primitives |
| Motion | Motion for React, CSS motion, DotLottie |
| Data visualization | D3 geographic modules, Canvas, local GeoJSON |
| Backend | Supabase PostgreSQL, Auth, RLS, Edge Functions |
| Email / bot defense | Google Mail (Gmail API / OAuth) / Cloudflare Turnstile |
| Hosting / CDN | Cloudflare Pages |

## Project Structure

```text
src/app/                 App Router pages, TR/EN routes, student and admin routes
src/components/          Public, admin, motion and UI component source
src/content/             TR/EN content and exam metadata
src/data/                Destination, university and visual mappings
src/lib/                 Supabase, admin, search and admission-domain logic
public/                  Runtime brand, animation assets, _redirects and _headers
supabase/functions/      Edge Functions and shared email/security code
supabase/migrations/     Ordered PostgreSQL schema and policy history
scripts/                 Maintained ingestion, local setup and regression tooling
design-system/           Preserved approved/historical brand design sources
docs/                    Canonical handoff and supporting technical records
```

## Quick Start

Prerequisites: Node.js 20+, npm, and optionally Docker plus the Supabase CLI for local backend work.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000/tr/` or `/en/`. Configure only the variables required for the workflow being exercised. Never place service-role, Google Mail or Turnstile secrets in a `NEXT_PUBLIC_*` variable.

```bash
npm run lint
npm run build
npm audit --omit=dev
```

The package manager is npm (`package-lock.json`). Static output is generated in `out/`.

## Environment Variables

The safe, commented inventory is [.env.example](.env.example). Browser variables configure Supabase public access and Turnstile. Privileged variables belong in Supabase Edge Function secrets or local untracked files. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions.

## Public Routes and Internationalization

The locale prefix is mandatory. Turkish is the default redirect target (`public/_redirects`).

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

The implemented visual system uses an editorial ivory/sage palette, DM Serif Display headings, Inter body text and Manrope UI text. Runtime tokens are in `src/app/globals.css`; brand assets are in `public/brand`. The current implementation is documented in [Design System](docs/DESIGN_SYSTEM.md).

Motion includes the compass loader, route and locale transitions, reveal/stagger primitives, rotating hero text, phone and exam carousels, Lottie illustrations, counters and the D3/Canvas study-destination globe.

## Admin Panel

`/admin` is protected by Supabase Auth, a JWT `app_metadata.role = "admin"` check, an active `admin_profiles` row and RLS. Modules cover dashboard, appointments, students, contact requests, availability, pricing, testimonials/content, notification delivery, audit logs and settings. Credentials must be transferred separately through a secure channel.

## Supabase, RLS and Edge Functions

Schema changes are migration-only. Start/reset a local stack with:

```bash
npm run local:supabase:start
npm run local:reset
```

Deploy Edge Functions when authorized:

```bash
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
npx supabase functions deploy create-booking
npx supabase functions deploy create-contact
npx supabase functions deploy admin-password-reset
npx supabase functions deploy send-student-appointment
```

Public mutations do not write PII tables directly. `create-booking` and `create-contact` validate Turnstile and use server credentials; booking uses an atomic reservation RPC. `admin-password-reset` is Turnstile-, identity- and cooldown-protected.

## Transactional Email and Turnstile

Email templates live in `supabase/functions/_shared/email/templates.ts`; dispatch/logging is centralized in `supabase/functions/_shared/email/service.ts`. Transactional email is dispatched from the owner's Google Mail mailbox via the Google Gmail API (OAuth2) and logged to `notification_deliveries` with `provider: 'google_workspace'`.

Turnstile protects booking, contact/consultation, quick-contact and admin password-recovery submissions. Production fails closed when the secret is absent.

## Deployment

Deployments to Cloudflare Pages are performed from `out/`:

```bash
npm run build
npx wrangler pages deploy out --project-name oriens-academy --branch main
```

Host headers and redirects are governed by `public/_headers` and `public/_redirects`.

## Security and Handoff Notes

Never commit real `.env` files, database passwords, service-role keys, Google credentials, Turnstile secrets, private keys or administrator passwords. Public Supabase publishable keys and analytics IDs are browser identifiers, not authorization boundaries; RLS and server-side controls remain mandatory.
