-- Retire the legacy contact mailbox from the remaining notification setting.
insert into public.site_settings (key, value, is_public)
values ('notification.contact_email', '{"email":"info@oriens-academy.com"}'::jsonb, false)
on conflict (key) do update
set value = excluded.value,
    is_public = false,
    updated_at = now();
