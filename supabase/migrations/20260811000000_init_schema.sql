-- Oriens Academy Database Migration: Foundation Schema, Auth Helpers & RLS Policies
-- Migration ID: 20260811000000_init_schema.sql

-- ============================================================================
-- 1. HELPER FUNCTIONS
-- ============================================================================

-- Function: Check whether current user is an authenticated administrator
-- Uses JWT app_metadata (auth.jwt() -> app_metadata -> role = 'admin').
-- SECURITY DEFINER with set search_path = '' to prevent privilege escalation / search_path attacks.
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

-- Function: Reusable trigger for automatic updated_at timestamp updates
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================================
-- 2. TABLES & CONSTRAINTS
-- ============================================================================

-- 2.1 ADMIN PROFILES
create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'admin',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.2 PRICING PACKAGES
create table if not exists public.pricing_packages (
  id text primary key,
  price_amount numeric check (price_amount is null or price_amount >= 0),
  currency text not null default 'EUR',
  billing_basis text not null check (billing_basis in ('session', 'month', 'custom')),
  active boolean not null default true,
  featured boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- 2.3 AVAILABILITY SLOTS
create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'available' check (status in ('available', 'booked', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint check_valid_slot_range check (ends_at > starts_at),
  constraint unique_slot_time unique (starts_at, ends_at)
);

-- 2.4 BOOKINGS
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  exam_code text,
  custom_exam text,
  locale text not null default 'en',
  notes text,
  slot_id uuid references public.availability_slots(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  source text default 'website',
  privacy_consent boolean not null default false,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.5 CONTACT REQUESTS
create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  locale text not null default 'en',
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved', 'spam')),
  privacy_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.6 SITE SETTINGS
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- 2.7 TESTIMONIALS
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  locale text not null default 'en',
  quote text not null,
  name text not null,
  context text,
  exam_code text,
  active boolean not null default false,
  verified boolean not null default false,
  featured boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- 2.8 AUDIT LOGS
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);


-- ============================================================================
-- 3. TRIGGERS
-- ============================================================================

create trigger trg_admin_profiles_updated_at
  before update on public.admin_profiles
  for each row execute function public.set_updated_at();

create trigger trg_pricing_packages_updated_at
  before update on public.pricing_packages
  for each row execute function public.set_updated_at();

create trigger trg_availability_slots_updated_at
  before update on public.availability_slots
  for each row execute function public.set_updated_at();

create trigger trg_bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

create trigger trg_contact_requests_updated_at
  before update on public.contact_requests
  for each row execute function public.set_updated_at();

create trigger trg_site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

create trigger trg_testimonials_updated_at
  before update on public.testimonials
  for each row execute function public.set_updated_at();


-- ============================================================================
-- 4. INDEXES
-- ============================================================================

create index if not exists idx_availability_slots_starts_at on public.availability_slots (starts_at);
create index if not exists idx_availability_slots_status on public.availability_slots (status);

create index if not exists idx_bookings_status on public.bookings (status);
create index if not exists idx_bookings_created_at on public.bookings (created_at);
create index if not exists idx_bookings_slot_id on public.bookings (slot_id);

create index if not exists idx_contact_requests_status on public.contact_requests (status);
create index if not exists idx_contact_requests_created_at on public.contact_requests (created_at);

create index if not exists idx_testimonials_active_verified on public.testimonials (active, verified);
create index if not exists idx_pricing_packages_active_display_order on public.pricing_packages (active, display_order);


-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on ALL public tables without exception
alter table public.admin_profiles enable row level security;
alter table public.pricing_packages enable row level security;
alter table public.availability_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.contact_requests enable row level security;
alter table public.site_settings enable row level security;
alter table public.testimonials enable row level security;
alter table public.audit_logs enable row level security;

-- ----------------------------------------------------------------------------
-- 5.1 PUBLIC / ANONYMOUS POLICIES (Extremely Restricted)
-- ----------------------------------------------------------------------------

-- Pricing packages: Public can SELECT active packages only
create policy "Public active pricing packages policy"
  on public.pricing_packages for select
  using (active = true);

-- Testimonials: Public can SELECT active AND verified testimonials only
create policy "Public active and verified testimonials policy"
  on public.testimonials for select
  using (active = true and verified = true);

-- Site settings: Public can SELECT public settings only
create policy "Public site settings policy"
  on public.site_settings for select
  using (is_public = true);

-- NOTE: bookings, contact_requests, admin_profiles, availability_slots, audit_logs
-- have ZERO public policies (No public SELECT, INSERT, UPDATE, DELETE).

-- ----------------------------------------------------------------------------
-- 5.2 ADMIN POLICIES (Full Access for is_admin() = true)
-- ----------------------------------------------------------------------------

-- admin_profiles policies
create policy "Admin profiles policy"
  on public.admin_profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- pricing_packages policies
create policy "Admin pricing packages policy"
  on public.pricing_packages for all
  using (public.is_admin())
  with check (public.is_admin());

-- availability_slots policies
create policy "Admin availability slots policy"
  on public.availability_slots for all
  using (public.is_admin())
  with check (public.is_admin());

-- bookings policies
create policy "Admin bookings policy"
  on public.bookings for all
  using (public.is_admin())
  with check (public.is_admin());

-- contact_requests policies
create policy "Admin contact requests policy"
  on public.contact_requests for all
  using (public.is_admin())
  with check (public.is_admin());

-- site_settings policies
create policy "Admin site settings policy"
  on public.site_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- testimonials policies
create policy "Admin testimonials policy"
  on public.testimonials for all
  using (public.is_admin())
  with check (public.is_admin());

-- audit_logs policies
create policy "Admin audit logs policy"
  on public.audit_logs for all
  using (public.is_admin())
  with check (public.is_admin());

