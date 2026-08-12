-- Oriens Academy Database Migration: Phase 3 Notification Outbox, Private Settings & Availability Direct Access Revocation
-- Migration ID: 20260811220000_phase3_contact_and_notifications.sql

-- ============================================================================
-- 1. SECURITY CLEANUP: REVOKE DIRECT PUBLIC SELECT ON AVAILABILITY SLOTS
-- ============================================================================

-- Drop the temporary direct public SELECT policy added in Phase 2
drop policy if exists "Public active available slots policy" on public.availability_slots;

-- Revoke direct SELECT table privileges from public and anon roles
revoke select on table public.availability_slots from public, anon;

-- Ensure service_role retains full access for Edge Function invocation
grant select on table public.availability_slots to service_role;


-- ============================================================================
-- 2. NOTIFICATION DELIVERIES OUTBOX TABLE
-- ============================================================================

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'email' check (channel in ('email')),
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  recipient text not null,
  provider text not null default 'resend',
  provider_message_id text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempt_count integer not null default 1,
  last_error_code text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- Enable RLS on notification_deliveries
alter table public.notification_deliveries enable row level security;

-- Admin Policy: Authenticated staff can SELECT notification delivery logs
create policy "Admin notification deliveries policy"
  on public.notification_deliveries for select
  using (public.is_admin());

-- Service Role permissions
grant all on table public.notification_deliveries to service_role;


-- ============================================================================
-- 3. PRIVATE NOTIFICATION SITE SETTINGS SEED DATA
-- ============================================================================

-- Default private administrative notification configurations (is_public = false)
-- These settings are NEVER exposed to public queries and can be managed via Admin Panel.
insert into public.site_settings (key, value, is_public)
values
  ('notification.booking_email', '{"email": "notifications@oriens-academy.com"}'::jsonb, false),
  ('notification.contact_email', '{"email": "notifications@oriens-academy.com"}'::jsonb, false),
  ('notification.admin_locale', '{"locale": "tr"}'::jsonb, false)
on conflict (key) do update set
  value = excluded.value,
  is_public = excluded.is_public;
