-- Optional verified testimonial profile image and contact source attribution.
alter table public.testimonials
  add column if not exists profile_image_url text;

alter table public.contact_requests
  add column if not exists source text not null default 'website';

alter table public.contact_requests
  drop constraint if exists contact_requests_source_check;

alter table public.contact_requests
  add constraint contact_requests_source_check
  check (source in ('website', 'quick_contact'));
