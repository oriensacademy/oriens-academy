-- Distinguish the full public contact form from the compact quick-contact lead.
alter table public.contact_requests
  drop constraint if exists contact_requests_source_check;

alter table public.contact_requests
  add constraint contact_requests_source_check
  check (source in ('website', 'contact_form', 'quick_contact', 'consultation'));
