-- Route the existing payment notification setting through the canonical
-- customer-facing mailbox without changing any other site setting.
update public.site_settings
set value = jsonb_set(value, '{email}', to_jsonb('info@oriens-academy.com'::text), true),
    updated_at = now()
where key = 'notification.payment_email'
  and value ->> 'email' is distinct from 'info@oriens-academy.com';
