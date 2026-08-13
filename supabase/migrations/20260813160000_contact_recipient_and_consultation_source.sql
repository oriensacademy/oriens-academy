-- Keep consultation leads explicit and route current admin notifications to the
-- verified owner inbox. This migration is applied locally until deployment is
-- separately authorized.
alter table public.contact_requests
  drop constraint if exists contact_requests_source_check;

alter table public.contact_requests
  add constraint contact_requests_source_check
  check (source in ('website', 'quick_contact', 'consultation'));

insert into public.site_settings (key, value, is_public)
values
  ('notification.booking_email', '{"email":"oriensacademy@gmail.com"}'::jsonb, false),
  ('notification.contact_email', '{"email":"oriensacademy@gmail.com"}'::jsonb, false)
on conflict (key) do update
set value = excluded.value,
    is_public = false,
    updated_at = now();
