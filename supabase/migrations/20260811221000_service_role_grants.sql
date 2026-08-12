-- Oriens Academy Database Migration: Explicit Service Role Table Grants
-- Migration ID: 20260811221000_service_role_grants.sql

grant all on table public.contact_requests to service_role;
grant all on table public.bookings to service_role;
grant all on table public.availability_slots to service_role;
grant all on table public.admin_profiles to service_role;
grant all on table public.site_settings to service_role;
grant all on table public.testimonials to service_role;
grant all on table public.audit_logs to service_role;
grant all on table public.notification_deliveries to service_role;
