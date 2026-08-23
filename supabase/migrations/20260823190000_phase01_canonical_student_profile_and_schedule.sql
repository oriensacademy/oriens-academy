-- Phase 01: canonical student profile preferences and unified schedule metadata.

alter table public.student_profiles
  add column if not exists target_exams text[] not null default '{}',
  add column if not exists target_countries text[] not null default '{}',
  add column if not exists onboarding_completed boolean not null default false;

-- Preserve every legacy value before student_profiles becomes the only app-facing source.
-- The existing protection trigger intentionally rejects auth.uid() = null. Migration
-- sessions have no JWT, so pause only that field-protection trigger for this backfill;
-- RLS remains enabled and every other trigger remains active.
alter table public.student_profiles disable trigger trg_protect_student_profile_fields;
update public.student_profiles p
set target_exams = coalesce(
      nullif(p.target_exams, '{}'),
      (select array_agg(distinct e.exam_code order by e.exam_code)
         from public.student_exam_preferences e where e.student_user_id = p.id),
      case when p.target_exam is null then '{}'::text[] else array[p.target_exam] end
    ),
    target_countries = coalesce(
      nullif(p.target_countries, '{}'),
      (select array_agg(distinct d.destination_code order by d.destination_code)
         from public.student_destination_preferences d where d.student_user_id = p.id),
      case when p.target_country is null then '{}'::text[] else array[p.target_country] end
    );
alter table public.student_profiles enable trigger trg_protect_student_profile_fields;

create or replace function public.save_student_preferences(
  p_student_id uuid,
  p_exams text[],
  p_countries text[],
  p_mark_onboarding_completed boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.student_profiles%rowtype;
  v_exams text[];
  v_countries text[];
begin
  if auth.uid() is null or (auth.uid() <> p_student_id and not public.is_admin()) then
    raise exception 'STUDENT_PROFILE_FORBIDDEN' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct btrim(value) order by btrim(value)), '{}')
    into v_exams from unnest(coalesce(p_exams, '{}')) as item(value) where btrim(value) <> '';
  select coalesce(array_agg(distinct btrim(value) order by btrim(value)), '{}')
    into v_countries from unnest(coalesce(p_countries, '{}')) as item(value) where btrim(value) <> '';

  update public.student_profiles
  set target_exams = v_exams,
      target_countries = v_countries,
      target_exam = v_exams[1],
      target_country = v_countries[1],
      onboarding_completed = case when p_mark_onboarding_completed then true else onboarding_completed end,
      updated_at = now()
  where id = p_student_id
  returning * into v_profile;

  if v_profile.id is null then
    return jsonb_build_object('success', false, 'error_code', 'PROFILE_NOT_FOUND');
  end if;
  return jsonb_build_object('success', true, 'profile', to_jsonb(v_profile));
end;
$$;

revoke all on function public.save_student_preferences(uuid,text[],text[],boolean) from public, anon;
grant execute on function public.save_student_preferences(uuid,text[],text[],boolean) to authenticated;

-- A booking is the canonical scheduled event. student_lessons remains delivery/history.
alter table public.bookings
  add column if not exists event_type text not null default 'other'
    check (event_type in ('lesson', 'discovery', 'consultation', 'other'));

update public.bookings
set event_type = case
  when appointment_subject like '[Ders]%' then 'lesson'
  when appointment_subject like '[Ön Görüşme]%' then 'discovery'
  when appointment_subject like '[Danışmanlık]%' then 'consultation'
  else event_type
end;

-- Catalog assignments derive commercial values from pricing_packages. The legacy
-- arguments remain in the signature for a non-breaking local rollout, but are
-- honored only for the explicit custom package.
create or replace function public.admin_assign_student_package_v2(
  p_student_id uuid, p_package_id text default null, p_custom_package_name text default null,
  p_start_date date default current_date, p_end_date date default null,
  p_lesson_count integer default 1, p_price_amount numeric default 0,
  p_currency text default 'TRY', p_payment_status text default 'pending',
  p_admin_notes text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_adj_id uuid; v_pkg public.pricing_packages%rowtype;
  v_package_id text; v_name text; v_lessons integer; v_price numeric; v_currency text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_payment_status not in ('pending','paid','waived') then return jsonb_build_object('success',false,'error_code','INVALID_INPUT'); end if;
  perform 1 from public.student_profiles where id=p_student_id and active;
  if not found then return jsonb_build_object('success',false,'error_code','STUDENT_NOT_FOUND'); end if;

  if p_package_id is not null and p_package_id <> 'custom' then
    select * into v_pkg from public.pricing_packages where id=p_package_id and active;
    if v_pkg.id is null or v_pkg.lesson_count is null then return jsonb_build_object('success',false,'error_code','PACKAGE_NOT_FOUND'); end if;
    v_package_id := v_pkg.id; v_name := null; v_lessons := v_pkg.lesson_count;
    v_price := coalesce(v_pkg.current_total, v_pkg.price_amount, 0); v_currency := v_pkg.currency;
  else
    if nullif(btrim(p_custom_package_name),'') is null or p_lesson_count < 1 or p_price_amount < 0 then
      return jsonb_build_object('success',false,'error_code','INVALID_CUSTOM_PACKAGE');
    end if;
    v_package_id := 'custom'; v_name := btrim(p_custom_package_name);
    v_lessons := p_lesson_count; v_price := p_price_amount; v_currency := 'TRY';
  end if;

  insert into public.student_package_purchases(
    student_user_id,package_id,custom_package_name,lesson_count,start_date,end_date,
    price_amount,currency,payment_status,assignment_source,assigned_by,admin_notes,status
  ) values (p_student_id,v_package_id,v_name,v_lessons,current_date,null,v_price,v_currency,
    p_payment_status,'admin_manual',auth.uid(),nullif(btrim(p_admin_notes),''),'active') returning id into v_id;

  insert into public.student_package_adjustments(
    student_user_id,package_purchase_id,adjustment_type,lesson_delta,price_amount,currency,payment_status,notes,created_by
  ) values (p_student_id,v_id,'package_assigned',v_lessons,v_price,v_currency,p_payment_status,
    coalesce(nullif(btrim(p_admin_notes),''),'İlk paket tanımlaması'),auth.uid()) returning id into v_adj_id;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'package.assigned','student_package_purchase',v_id::text,
    jsonb_build_object('student_user_id',p_student_id,'package_id',v_package_id,'lesson_count',v_lessons,'price_amount',v_price,'currency',v_currency));
  return jsonb_build_object('success',true,'purchase_id',v_id,'adjustment_id',v_adj_id);
end;
$$;
