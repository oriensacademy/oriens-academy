-- Migration: 20260905120000_remove_zoom_outbound_alias.sql
-- Business rule: zoom@oriens-academy.com may never be an outbound email sender.
-- The `notification.zoom_email` row seeded by 20260831090000_canonical_operational_mailboxes.sql
-- is never read by any function (verified: no getPrivateSiteSetting("notification.zoom_email")
-- caller anywhere in supabase/functions) -- it is dead configuration, not an active sender
-- source, but is removed here so no stale zoom@ operational alias remains in site_settings.

delete from public.site_settings where key = 'notification.zoom_email';
