-- Oriens Academy Database Migration: Least-Privilege Hardening for Service Role
-- Migration ID: 20260811230000_least_privilege_service_role.sql

-- ============================================================================
-- LEAST-PRIVILEGE HARDENING FOR SERVICE ROLE
-- ============================================================================

-- 1. Revoke broad table privileges from service_role
revoke all on table public.admin_profiles from service_role;
revoke all on table public.testimonials from service_role;
revoke all on table public.pricing_packages from service_role;
revoke all on table public.contact_requests from service_role;
revoke all on table public.bookings from service_role;
revoke all on table public.availability_slots from service_role;
revoke all on table public.site_settings from service_role;
revoke all on table public.audit_logs from service_role;
revoke all on table public.notification_deliveries from service_role;

-- 2. Grant explicit least-privilege operations required by Edge Functions & system workflows
grant select, update on table public.availability_slots to service_role;
grant select, insert, update on table public.bookings to service_role;
grant select, insert, update on table public.contact_requests to service_role;
grant select on table public.site_settings to service_role;
grant select, insert, update on table public.notification_deliveries to service_role;
grant select, insert on table public.audit_logs to service_role;

-- 3. Ensure RPC execution permissions
grant execute on function public.reserve_booking_slot to service_role;
