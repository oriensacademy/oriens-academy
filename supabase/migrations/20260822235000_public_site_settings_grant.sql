-- RLS already limits anonymous reads to rows where is_public = true.
-- Restore the table privilege required for that public policy to take effect.
grant select on table public.site_settings to anon;
