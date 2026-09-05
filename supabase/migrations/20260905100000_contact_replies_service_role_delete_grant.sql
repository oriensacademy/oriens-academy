-- Migration: 20260905100000_contact_replies_service_role_delete_grant.sql
-- contact_replies only ever granted service_role select/insert/update
-- (20260901130000_contact_reply_history.sql), unlike its parent
-- contact_requests which already has a dedicated delete grant for
-- one-time maintenance cleanup (20260827150000_verified_production_cleanup_rpc.sql)
-- and unlike support_threads/support_messages (both `grant all ... to service_role`).
-- Adds the missing, symmetric delete grant so service-role-driven maintenance
-- cleanup can remove reply history the same way it already can for the
-- parent request and the support tables. No RLS/policy change; anon/authenticated
-- privileges are untouched.

grant delete on table public.contact_replies to service_role;
