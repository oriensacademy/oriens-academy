-- Deterministic source identity for testimonial reconciliation.
-- Existing content is preserved; only provenance and immutability controls are added.

alter table public.testimonials
  add column if not exists source_hash text,
  add column if not exists source_author text,
  add column if not exists source_date date,
  add column if not exists source_import_id text,
  add column if not exists imported_from_source boolean not null default false;

create unique index if not exists idx_testimonials_source_hash_unique
  on public.testimonials (source_hash) where source_hash is not null;
create index if not exists idx_testimonials_import_source
  on public.testimonials (source_import_id, imported_from_source);

create or replace function public.protect_imported_testimonial_source_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.source_hash is not null and (
    new.name is distinct from old.name
    or new.quote is distinct from old.quote
    or new.context is distinct from old.context
    or new.source_topic is distinct from old.source_topic
    or new.source_author is distinct from old.source_author
    or new.source_date is distinct from old.source_date
    or new.source_hash is distinct from old.source_hash
  ) then
    raise exception 'Imported testimonial source fields are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_imported_testimonial_source_text on public.testimonials;
create trigger trg_protect_imported_testimonial_source_text
  before update on public.testimonials
  for each row execute function public.protect_imported_testimonial_source_text();

comment on column public.testimonials.source_hash is
  'SHA-256 of normalized author, source date, topic, and full original body.';

