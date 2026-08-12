# Oriens Academy - Backend Architecture (Phase 1)

This document details the backend foundation, database schema, Row Level Security (RLS) policies, authentication model, environment variable conventions, and migration workflows for Oriens Academy.

---

## 1. High-Level Architecture

Oriens Academy utilizes a decoupled, static-export-friendly backend architecture:

- **Frontend**: Next.js (React) exported as static HTML/CSS/JS (`output: "export"`). Deployed to standard static hosting. Localized routes: `/tr/randevu` and `/en/booking`.
- **Backend & Database**: Hosted Supabase (PostgreSQL, Supabase Auth, Row Level Security, Edge Functions).
- **Public Booking Pipeline (Phase 2 Implemented)**: Public booking requests and availability listing run through **Supabase Edge Functions** (`booking-availability` and `create-booking`) backed by an atomic Postgres transaction RPC (`public.reserve_booking_slot`).
- **Future Phase Integration**: Cloudflare Turnstile, Resend (email), and Telegram notifications will be attached in Phase 3.

- **No Node.js Server Runtime**: No Next.js API routes, Server Actions, or server-side rendering (SSR) are used. The frontend remains 100% static.

```
┌─────────────────────────────────────────────────────────────┐
│                    Oriens Academy Frontend                  │
│                     (Static Export Bundle)                  │
└──────────────┬───────────────────────────────▲──────────────┘
               │                               │
       Direct Browser Reads             Public Select Only
       (Admin Auth Session)           (Pricing / Testimonials)
               │                               │
               ▼                               │
┌──────────────────────────────────────────────┴──────────────┐
│                      Supabase Platform                      │
│                                                             │
│  ┌─────────────────────────┐   ┌──────────────────────────┐ │
│  │      Supabase Auth      │   │   PostgreSQL Database    │ │
│  │ (Email/Password Admin)  │   │  (Strict RLS Enabled)    │ │
│  └─────────────────────────┘   └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Environment Variables

| Variable Name | Environment | Description | Secrets Included? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser / Build | Supabase project URL (`https://<project-ref>.supabase.co`) | NO (Public) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser / Build | Supabase Publishable / Anon API key | NO (Public) |

> [!CAUTION]
> **SECRET KEY RULE**: Never include `SUPABASE_SECRET_KEY`, `service_role`, `sb_secret_*`, database passwords, or third-party API tokens inside `NEXT_PUBLIC_*` environment variables, frontend source files, or static build artifacts.

---

## 3. Database Schema Overview

The database structure is managed strictly via SQL migrations located in `supabase/migrations/`.

### Core Tables

1. **`admin_profiles`**
   - Stores supplementary display and role information for staff/admin users.
   - Primary key: `user_id` (references `auth.users(id)`).
   - *Note*: Authorization is checked via JWT `app_metadata`, not from editable profile rows.

2. **`pricing_packages`**
   - Drives package pricing details (e.g., `foundation`, `method`, `immersive`).
   - Fields: `id`, `price_amount`, `currency`, `billing_basis`, `active`, `featured`, `display_order`, timestamps.
   - Seeded with verified production pricing.

3. **`availability_slots`**
   - Stores available, booked, or blocked consultation/tutoring time slots.
   - Fields: `id`, `starts_at`, `ends_at`, `status`, timestamps, `created_by`.
   - Constraints enforce `ends_at > starts_at` and unique `(starts_at, ends_at)` pairs.

4. **`bookings`**
   - Contains customer booking requests and Personally Identifiable Information (PII).
   - Fields: `id`, `full_name`, `email`, `phone`, `exam_code`, `custom_exam`, `locale`, `notes`, `slot_id`, `status`, `source`, `privacy_consent`, `marketing_consent`, timestamps.
   - **RLS**: Absolutely ZERO public access.

5. **`contact_requests`**
   - Stores public contact inquiries and PII.
   - Fields: `id`, `full_name`, `email`, `phone`, `subject`, `message`, `locale`, `status`, `privacy_consent`, timestamps.
   - **RLS**: Absolutely ZERO public access.

6. **`site_settings`**
   - Key-value JSON configuration store (public flags dictate read visibility).
   - **RLS**: Public `SELECT` allowed ONLY IF `is_public = true`.

7. **`testimonials`**
   - Stores student and client feedback.
   - Fields: `id`, `locale`, `quote`, `name`, `context`, `exam_code`, `active`, `verified`, `featured`, `display_order`, timestamps.
   - **RLS**: Public `SELECT` allowed ONLY IF `active = true AND verified = true`.

8. **`audit_logs`**
   - Immutable audit trail for administrative actions.
   - Fields: `id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `metadata`, `created_at`.
   - **RLS**: Admin `SELECT` only.

---

## 4. Auth & Authorization Strategy

### Public Visitors vs Admin Users

- **Public Visitors**: Do NOT create Supabase accounts. No public customer registration or login UI exists.
- **Admin Users**: Supabase Auth is strictly reserved for administrators and staff. Authenticated via Email + Password.

### Authorization Source

Authorization is derived **exclusively** from JWT `app_metadata`:

```json
{
  "role": "admin"
}
```

The SQL helper function `public.is_admin()` safely validates this claim:

```sql
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;
```

---

## 5. Row Level Security (RLS) Philosophy

1. **Default Deny**: RLS is explicitly enabled on 100% of tables. Without a matching policy, all access is rejected.
2. **Zero Public Access to PII**: `bookings`, `contact_requests`, `admin_profiles`, and `audit_logs` have NO public `SELECT`, `INSERT`, `UPDATE`, or `DELETE` policies.
3. **Public Read Filters**:
   - `pricing_packages`: Public can read `active = true` rows.
   - `testimonials`: Public can read `active = true AND verified = true` rows.
   - `site_settings`: Public can read `is_public = true` rows.
4. **Admin Privileges**: Users for whom `public.is_admin()` evaluates to `true` have explicit full access to manage records across all tables.

---

## 6. Migration & Local Workflow

All database modifications must be defined as SQL files under `supabase/migrations/`.

### Local Commands

- **Check CLI Version**: `npx supabase --version`
- **Initialize Local Config**: `npx supabase init`
- **Link Remote Project**: `npx supabase link --project-ref <PROJECT_REF>`
- **Push Migrations**: `npx supabase db push`
- **Generate TypeScript Types**: `npx supabase gen types typescript --project-id <PROJECT_REF> > src/types/database.types.ts`

---

## 7. Future Edge Function Architecture (Phase 2 Preview)

In Phase 2, public submission endpoints for Bookings and Contact requests will be deployed as Supabase Edge Functions:

1. **Client Submission**: Frontend submits form data via `POST` to Edge Function.
2. **Verification**: Edge Function verifies Cloudflare Turnstile CAPTCHA.
3. **Database Write**: Edge Function uses service_role key to insert record into `bookings` or `contact_requests`.
4. **Notifications**: Edge Function triggers emails via Resend and sends administrative alerts to Telegram.
