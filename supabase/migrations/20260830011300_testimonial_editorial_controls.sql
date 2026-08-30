-- Runtime testimonial curation without destructive source operations.
alter table public.testimonials
  add column if not exists pinned_at timestamptz,
  add column if not exists pin_order integer,
  add column if not exists archived_at timestamptz;

alter table public.testimonials
  drop constraint if exists testimonials_pin_order_nonnegative,
  add constraint testimonials_pin_order_nonnegative check (pin_order is null or pin_order >= 0);

create index if not exists idx_testimonials_public_editorial_order
  on public.testimonials (pin_order, pinned_at desc, featured desc, display_order, id)
  where active = true and verified = true and archived_at is null;

create or replace function public.prevent_testimonial_hard_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Testimonials must be archived, not deleted';
end;
$$;

drop trigger if exists trg_prevent_testimonial_hard_delete on public.testimonials;
create trigger trg_prevent_testimonial_hard_delete
  before delete on public.testimonials
  for each row execute function public.prevent_testimonial_hard_delete();

comment on column public.testimonials.pinned_at is 'Optional editorial pin timestamp; null means not pinned.';
comment on column public.testimonials.pin_order is 'Optional deterministic order among pinned testimonials.';
comment on column public.testimonials.archived_at is 'Non-destructive archive marker; archived records must not be public.';
