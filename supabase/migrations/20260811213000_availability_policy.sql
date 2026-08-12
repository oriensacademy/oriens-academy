-- Oriens Academy Database Migration: Public Availability Policy & Table Grants
-- Migration ID: 20260811213000_availability_policy.sql

-- Grant table SELECT access on availability_slots to anon, authenticated, and service_role
grant select on table public.availability_slots to anon, authenticated, service_role;

-- Public RLS Policy: Anonymous and public users can ONLY view slots that are available and in the future
drop policy if exists "Public active available slots policy" on public.availability_slots;
create policy "Public active available slots policy"
  on public.availability_slots for select
  using (status = 'available' and starts_at > now());
