-- Canonical application mailboxes. Incoming Workspace routing remains an external admin setting.
insert into public.site_settings (key, value, is_public)
values
  ('notification.booking_email', '{"email":"info@oriens-academy.com"}'::jsonb, false),
  ('notification.support_email', '{"email":"info@oriens-academy.com"}'::jsonb, false),
  ('notification.payment_email', '{"email":"payments@oriens-academy.com"}'::jsonb, false),
  ('notification.zoom_email', '{"email":"zoom@oriens-academy.com"}'::jsonb, false),
  ('notification.admin_email', '{"email":"admin@oriens-academy.com"}'::jsonb, false)
on conflict (key) do update
set value = excluded.value,
    is_public = false,
    updated_at = now();
