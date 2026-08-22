-- Public navigation preference. The explicit default preserves the current
-- production behaviour when this migration is first applied.
insert into public.site_settings (key, value, is_public)
values ('navigation.show_pricing', '{"visible": true}'::jsonb, true)
on conflict (key) do nothing;

