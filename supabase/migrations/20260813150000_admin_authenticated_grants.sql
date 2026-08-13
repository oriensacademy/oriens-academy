-- Browser-based administrators use the `authenticated` Postgres role.
-- These grants expose only the operations used by the admin UI; existing
-- RLS policies still require immutable JWT app_metadata.role = 'admin'.

grant select on table public.admin_profiles to authenticated;

grant select, update on table public.bookings to authenticated;
grant select, update on table public.contact_requests to authenticated;
grant select, insert, delete on table public.availability_slots to authenticated;

grant select, insert, update, delete on table public.pricing_packages to authenticated;
grant select, insert, update, delete on table public.testimonials to authenticated;

grant select, update on table public.site_settings to authenticated;
grant select on table public.notification_deliveries to authenticated;
grant select, insert on table public.audit_logs to authenticated;

grant usage, select on sequence public.audit_logs_id_seq to authenticated;
