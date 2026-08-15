-- Minimal structured context for consultation leads (for example, selected pricing package).
-- Existing admin-only contact RLS policies continue to govern this column.
alter table public.contact_requests
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.contact_requests
  drop constraint if exists contact_requests_metadata_object_check;

alter table public.contact_requests
  add constraint contact_requests_metadata_object_check
  check (jsonb_typeof(metadata) = 'object');

