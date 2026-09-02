-- Bounded public testimonial selection without widening direct table RLS.
create or replace function public.get_public_testimonials_v2(
  p_locale text default null,
  p_limit integer default 16
)
returns table (
  id uuid,
  name text,
  quote text,
  context text,
  exam_code text,
  locale text,
  profile_image_url text,
  created_at timestamptz,
  featured boolean,
  pinned_at timestamptz,
  pin_order integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id,
    t.name,
    t.quote,
    t.context,
    t.exam_code,
    t.locale,
    t.profile_image_url,
    t.created_at,
    t.featured,
    t.pinned_at,
    t.pin_order
  from public.testimonials as t
  where t.active = true
    and t.verified = true
    and t.archived_at is null
    and (p_locale is null or t.locale = p_locale)
  order by
    t.featured desc,
    t.pin_order asc nulls last,
    t.pinned_at desc nulls last,
    t.display_order asc,
    t.created_at desc,
    t.id asc
  limit least(greatest(coalesce(p_limit, 16), 1), 16);
$$;

revoke all on function public.get_public_testimonials_v2(text, integer) from public;
grant execute on function public.get_public_testimonials_v2(text, integer) to anon, authenticated;

comment on function public.get_public_testimonials_v2(text, integer) is
  'Returns at most 16 active, verified, non-archived testimonials with editorial priority; direct table RLS remains unchanged.';
