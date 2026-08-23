-- Oriens Academy Database Migration: Centralized Email Routing by Workspace Aliases
-- Migration ID: 20260823080000_centralized_email_workspace_aliases.sql

-- Seed and update private site_settings for centralized Google Workspace email aliases
-- These settings are non-secret configuration and are NEVER exposed to public queries (is_public = false)

insert into public.site_settings (key, value, is_public)
values
  ('notification.contact_email', '{"email": "contact@oriens-academy.com"}'::jsonb, false),
  ('notification.booking_email', '{"email": "support@oriens-academy.com"}'::jsonb, false),
  ('notification.support_email', '{"email": "support@oriens-academy.com"}'::jsonb, false),
  ('notification.payment_email', '{"email": "payments@oriens-academy.com"}'::jsonb, false),
  ('notification.admin_email', '{"email": "admin@oriens-academy.com"}'::jsonb, false)
on conflict (key) do update
set value = excluded.value,
    is_public = false,
    updated_at = now();
