-- ==============================================================================
-- Migration: 20260902210000_account_payment_cleanup_and_exact_20_testimonials.sql
-- Description:
--   1. Add is_archived, archived_at, archive_reason to payment_transactions
--   2. One-time safe cutover archiving of existing pre-release payment records
--   3. Optional contact_address in update_guardian_profile
--   4. Update get_public_testimonials_v2 to return ONLY featured reviews (cap 20)
--   5. Update set_testimonial_featured with clear 20-limit error
--   6. Feature exactly the 20 user-specified reviews with deterministic sequence
-- ==============================================================================

-- 1. PAYMENT TRANSACTIONS ARCHIVE COLUMNS
alter table public.payment_transactions
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archive_reason text;

create index if not exists idx_payment_transactions_is_archived
  on public.payment_transactions(is_archived)
  where is_archived = false;

-- 2. ONE-TIME SAFE CUTOVER ARCHIVE OF PRE-RELEASE PAYMENT TRANSACTIONS
-- Preserves all physical rows, FK relationships, student_package_purchases, and lesson rights.
update public.payment_transactions
set
  is_archived = true,
  archived_at = now(),
  archive_reason = 'pre_release_payment_history_cleanup'
where is_archived = false;

-- 3. UPDATE GUARDIAN PROFILE RPC (CONTACT ADDRESS OPTIONAL)
create or replace function public.update_guardian_profile(
  p_full_name text,
  p_phone text,
  p_contact_address text default null,
  p_preferred_language text default 'tr'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_phone text := regexp_replace(btrim(coalesce(p_phone, '')), '[\s().-]+', '', 'g');
  v_address text := regexp_replace(btrim(coalesce(p_contact_address, '')), '\s+', ' ', 'g');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if char_length(v_name) not between 2 and 100 then raise exception 'INVALID_FULL_NAME'; end if;
  if v_phone !~ '^\+[1-9][0-9]{6,14}$' then raise exception 'INVALID_PHONE'; end if;
  if v_address <> '' and char_length(v_address) not between 10 and 300 then
    raise exception 'INVALID_CONTACT_ADDRESS';
  end if;
  if p_preferred_language not in ('tr','en') then raise exception 'INVALID_LANGUAGE'; end if;
  if (select count(*) from public.audit_logs
      where actor_user_id = auth.uid() and action = 'guardian.profile_updated'
        and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'PROFILE_UPDATE_RATE_LIMIT';
  end if;

  update public.guardian_accounts
  set full_name = v_name,
      phone = v_phone,
      contact_address = coalesce(nullif(v_address, ''), contact_address, 'İstanbul / Türkiye'),
      preferred_language = p_preferred_language,
      updated_at = now()
  where user_id = auth.uid() and active;
  if not found then raise exception 'GUARDIAN_ACCOUNT_NOT_FOUND'; end if;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), 'guardian.profile_updated', 'guardian_account', auth.uid()::text,
    jsonb_build_object('fields', jsonb_build_array('full_name','phone','preferred_language')));

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.update_guardian_profile(text,text,text,text) from public, anon;
grant execute on function public.update_guardian_profile(text,text,text,text) to authenticated, service_role;

-- 4. TESTIMONIAL FEATURED SELECTION RPC (HOMEPAGE CONTRACT)
create or replace function public.get_public_testimonials_v2(
  p_locale text default null,
  p_limit integer default 20
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
    and t.featured = true
    and t.archived_at is null
  order by
    t.pin_order asc nulls last,
    t.pinned_at desc nulls last,
    t.display_order asc,
    t.created_at desc,
    t.id asc
  limit least(greatest(coalesce(p_limit, 20), 1), 20);
$$;

revoke all on function public.get_public_testimonials_v2(text, integer) from public;
grant execute on function public.get_public_testimonials_v2(text, integer) to anon, authenticated, service_role;

-- 5. SET TESTIMONIAL FEATURED RPC (MAX 20 ENFORCEMENT)
create or replace function public.set_testimonial_featured(p_testimonial_id uuid, p_featured boolean)
returns public.testimonials
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.testimonials;
  v_count integer;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_REQUIRED';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public_testimonial_featured_cap'));

  if p_featured then
    select count(*) into v_count
    from public.testimonials
    where featured = true and active = true and verified = true and archived_at is null
      and id <> p_testimonial_id;
    if v_count >= 20 then
      raise exception using errcode = 'P0001', message = 'En fazla 20 yorum ana sayfada yayınlanabilir. Lütfen önce başka bir yorumu yayından kaldırın.';
    end if;
  end if;

  update public.testimonials
  set featured = p_featured, updated_by = auth.uid(), updated_at = now()
  where id = p_testimonial_id
  returning * into v_row;

  if v_row.id is null then
    raise exception using errcode = 'P0002', message = 'TESTIMONIAL_NOT_FOUND';
  end if;
  return v_row;
end;
$$;

revoke all on function public.set_testimonial_featured(uuid, boolean) from public, anon;
grant execute on function public.set_testimonial_featured(uuid, boolean) to authenticated, service_role;

-- 6. UNFEATURE ALL OTHER TESTIMONIALS (CLEAN SLATE TO HOMEPAGE SELECTION)
update public.testimonials
set featured = false, updated_at = now()
where id not in (
  '8df86137-c516-493e-899e-02e68d8bc0d1',
  '2eeb82ea-90ba-4187-8afc-893f7cbfa8cc',
  '33577235-066c-4a3e-8663-cb3b75eb4617',
  '91f9f6e1-48fa-4efe-884a-1ae31a4ae038',
  '01e4acf2-b0c4-44b1-8d4b-11e915cf989e',
  '2d875dd4-3acd-4eeb-843f-8efbe26babb3',
  '760cd889-792e-45f4-8ca1-12f1dc7dca96',
  '80acba15-6ca4-4bc0-89e8-7f6a58007d53',
  '58f43d04-b032-45d2-88d7-fde3c333e854',
  'e4c869de-c061-4e2b-8972-6627a2f0a16c',
  '4e2f38c1-31c6-4bae-8292-f2652680be5d',
  '5e6a0252-ef3f-429c-882e-734fbcf85536',
  'f7f4cb61-5cc8-4b78-8001-b0eed7a40dbb',
  '21afe297-8b2c-43b6-8d9f-d8e770eac701',
  '76a6d53b-250a-4c7c-81c1-65f4ace4198e',
  'f0fe372a-c03c-409e-81d0-b274c971b6b6',
  'f941e91f-5ba2-4f83-8922-711eee5d5edd',
  '35a3e492-9712-4871-851e-547709c25527',
  'a82ff6f6-027b-458d-8088-e80e6dbfad6c',
  '154f1eed-a994-4cad-8f03-01c47ba9a78b'
);

-- 7. SET EXACT 20 USER-SPECIFIED REVIEWS TO FEATURED = TRUE IN DETERMINISTIC SEQUENCE
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 1, display_order = 1, updated_at = now() where id = '8df86137-c516-493e-899e-02e68d8bc0d1';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 2, display_order = 2, updated_at = now() where id = '2eeb82ea-90ba-4187-8afc-893f7cbfa8cc';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 3, display_order = 3, updated_at = now() where id = '33577235-066c-4a3e-8663-cb3b75eb4617';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 4, display_order = 4, updated_at = now() where id = '91f9f6e1-48fa-4efe-884a-1ae31a4ae038';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 5, display_order = 5, updated_at = now() where id = '01e4acf2-b0c4-44b1-8d4b-11e915cf989e';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 6, display_order = 6, updated_at = now() where id = '2d875dd4-3acd-4eeb-843f-8efbe26babb3';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 7, display_order = 7, updated_at = now() where id = '760cd889-792e-45f4-8ca1-12f1dc7dca96';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 8, display_order = 8, updated_at = now() where id = '80acba15-6ca4-4bc0-89e8-7f6a58007d53';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 9, display_order = 9, updated_at = now() where id = '58f43d04-b032-45d2-88d7-fde3c333e854';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 10, display_order = 10, updated_at = now() where id = 'e4c869de-c061-4e2b-8972-6627a2f0a16c';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 11, display_order = 11, updated_at = now() where id = '4e2f38c1-31c6-4bae-8292-f2652680be5d';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 12, display_order = 12, updated_at = now() where id = '5e6a0252-ef3f-429c-882e-734fbcf85536';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 13, display_order = 13, updated_at = now() where id = 'f7f4cb61-5cc8-4b78-8001-b0eed7a40dbb';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 14, display_order = 14, updated_at = now() where id = '21afe297-8b2c-43b6-8d9f-d8e770eac701';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 15, display_order = 15, updated_at = now() where id = '76a6d53b-250a-4c7c-81c1-65f4ace4198e';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 16, display_order = 16, updated_at = now() where id = 'f0fe372a-c03c-409e-81d0-b274c971b6b6';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 17, display_order = 17, updated_at = now() where id = 'f941e91f-5ba2-4f83-8922-711eee5d5edd';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 18, display_order = 18, updated_at = now() where id = '35a3e492-9712-4871-851e-547709c25527';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 19, display_order = 19, updated_at = now() where id = 'a82ff6f6-027b-458d-8088-e80e6dbfad6c';
update public.testimonials set active = true, verified = true, featured = true, archived_at = null, pin_order = 20, display_order = 20, updated_at = now() where id = '154f1eed-a994-4cad-8f03-01c47ba9a78b';
