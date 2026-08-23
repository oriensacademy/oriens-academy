-- Migration: 20260823100000_student_package_adjustments_and_extra_lessons.sql
-- Description: Student package adjustments, extra lessons support, and transactional RPCs

-- 1. Ensure 'custom' package exists in pricing_packages for flexible admin custom packages
insert into public.pricing_packages (
  id, price_amount, currency, billing_basis, active, featured, display_order,
  name_tr, name_en, description_tr, description_en, lesson_count, purchase_mode
) values (
  'custom', 0, 'TRY', 'custom', true, false, 999,
  'Özel Paket', 'Custom Package', 'Öğrenciye özel tanımlanan eğitim paketi', 'Custom tailored education package', null, 'consultation_only'
) on conflict (id) do update set
  name_tr = excluded.name_tr,
  name_en = excluded.name_en;

-- 2. Add columns to student_package_purchases for custom packages and notes
alter table public.student_package_purchases
  add column if not exists custom_package_name text,
  add column if not exists admin_notes text;

-- 3. Create student_package_adjustments table for audit history
create table if not exists public.student_package_adjustments (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  package_purchase_id uuid not null references public.student_package_purchases(id) on delete cascade,
  adjustment_type text not null check (adjustment_type in ('extra_lessons', 'manual_adjustment', 'package_assigned', 'package_reactivated')),
  lesson_delta integer not null check (lesson_delta > 0),
  price_amount numeric check (price_amount is null or price_amount >= 0),
  currency text not null default 'TRY' check (char_length(currency) = 3),
  payment_status text not null default 'waived' check (payment_status in ('pending', 'paid', 'waived', 'refunded')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pkg_adj_purchase on public.student_package_adjustments(package_purchase_id, created_at desc);
create index if not exists idx_pkg_adj_student on public.student_package_adjustments(student_user_id, created_at desc);

alter table public.student_package_adjustments enable row level security;

create policy "Admin read adjustments policy" on public.student_package_adjustments
  for select using (public.is_admin());
create policy "Student own read adjustments policy" on public.student_package_adjustments
  for select using (student_user_id = auth.uid());
create policy "Admin mutate adjustments policy" on public.student_package_adjustments
  for all using (public.is_admin()) with check (public.is_admin());

grant select on table public.student_package_adjustments to authenticated;
grant select, insert, update on table public.student_package_adjustments to service_role;

-- 4. Transactional RPC for adding extra lessons
create or replace function public.admin_add_extra_lessons(
  p_purchase_id uuid,
  p_lesson_delta integer,
  p_price_amount numeric default null,
  p_currency text default 'TRY',
  p_payment_status text default 'waived',
  p_notes text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_purchase public.student_package_purchases%rowtype;
  v_adj_id uuid;
  v_new_lesson_count integer;
  v_reactivated boolean := false;
  v_new_status text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if p_lesson_delta is null or p_lesson_delta < 1 or p_lesson_delta > 500 then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_LESSON_DELTA');
  end if;
  if p_price_amount is not null and p_price_amount < 0 then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_PRICE');
  end if;
  if p_payment_status not in ('pending', 'paid', 'waived') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_PAYMENT_STATUS');
  end if;

  select * into v_purchase from public.student_package_purchases
  where id = p_purchase_id for update;

  if v_purchase.id is null then
    return jsonb_build_object('success', false, 'error_code', 'PACKAGE_NOT_FOUND');
  end if;

  v_new_lesson_count := v_purchase.lesson_count + p_lesson_delta;
  v_new_status := v_purchase.status;

  -- If completed or expired and extra lessons added, reactivate to 'active'
  if (v_purchase.status in ('completed', 'expired')) and (v_purchase.lessons_used < v_new_lesson_count) then
    v_new_status := 'active';
    v_reactivated := true;
  end if;

  update public.student_package_purchases set
    lesson_count = v_new_lesson_count,
    status = v_new_status,
    updated_at = now()
  where id = p_purchase_id;

  insert into public.student_package_adjustments(
    student_user_id,
    package_purchase_id,
    adjustment_type,
    lesson_delta,
    price_amount,
    currency,
    payment_status,
    notes,
    created_by
  ) values (
    v_purchase.student_user_id,
    p_purchase_id,
    'extra_lessons',
    p_lesson_delta,
    p_price_amount,
    upper(coalesce(nullif(btrim(p_currency), ''), 'TRY')),
    p_payment_status,
    nullif(btrim(p_notes), ''),
    auth.uid()
  ) returning id into v_adj_id;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'package.extra_lessons_added',
    'student_package_purchase',
    p_purchase_id::text,
    jsonb_build_object(
      'student_user_id', v_purchase.student_user_id,
      'lesson_delta', p_lesson_delta,
      'new_lesson_count', v_new_lesson_count,
      'lessons_used', v_purchase.lessons_used,
      'remaining', v_new_lesson_count - v_purchase.lessons_used,
      'reactivated', v_reactivated,
      'adjustment_id', v_adj_id
    )
  );

  if v_reactivated then
    insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'package.reactivated_by_extra_lessons',
      'student_package_purchase',
      p_purchase_id::text,
      jsonb_build_object('student_user_id', v_purchase.student_user_id, 'package_id', v_purchase.package_id)
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'purchase_id', p_purchase_id,
    'adjustment_id', v_adj_id,
    'lesson_count', v_new_lesson_count,
    'lessons_used', v_purchase.lessons_used,
    'remaining', v_new_lesson_count - v_purchase.lessons_used,
    'status', v_new_status,
    'reactivated', v_reactivated
  );
end;
$$;

-- 5. Transactional RPC for package assignment supporting custom packages
create or replace function public.admin_assign_student_package_v2(
  p_student_id uuid,
  p_package_id text default null,
  p_custom_package_name text default null,
  p_start_date date default current_date,
  p_end_date date default null,
  p_lesson_count integer default 1,
  p_price_amount numeric default 0,
  p_currency text default 'TRY',
  p_payment_status text default 'pending',
  p_admin_notes text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_pkg_id text;
  v_title text;
  v_adj_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if p_lesson_count < 1 or p_lesson_count > 1000 or p_price_amount < 0 or
     upper(p_currency) !~ '^[A-Z]{3}$' or p_payment_status not in ('pending','paid','waived') or
     (p_end_date is not null and p_end_date < p_start_date) then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_INPUT');
  end if;
  perform 1 from public.student_profiles where id = p_student_id and active;
  if not found then return jsonb_build_object('success', false, 'error_code', 'STUDENT_NOT_FOUND'); end if;

  if p_package_id is not null and nullif(btrim(p_package_id), '') is not null and p_package_id <> 'custom' then
    perform 1 from public.pricing_packages where id = p_package_id;
    if not found then return jsonb_build_object('success', false, 'error_code', 'PACKAGE_NOT_FOUND'); end if;
    v_pkg_id := p_package_id;
    v_title := coalesce(nullif(btrim(p_custom_package_name), ''), (select name_tr from public.pricing_packages where id = p_package_id));
  else
    if nullif(btrim(p_custom_package_name), '') is null then
      return jsonb_build_object('success', false, 'error_code', 'PACKAGE_NAME_REQUIRED');
    end if;
    v_pkg_id := 'custom';
    v_title := btrim(p_custom_package_name);
  end if;

  insert into public.student_package_purchases(
    student_user_id,
    package_id,
    custom_package_name,
    payment_transaction_id,
    lesson_count,
    start_date,
    end_date,
    price_amount,
    currency,
    payment_status,
    assignment_source,
    assigned_by,
    admin_notes,
    status
  ) values (
    p_student_id,
    v_pkg_id,
    nullif(btrim(p_custom_package_name), ''),
    null,
    p_lesson_count,
    p_start_date,
    p_end_date,
    p_price_amount,
    upper(p_currency),
    p_payment_status,
    'admin_manual',
    auth.uid(),
    nullif(btrim(p_admin_notes), ''),
    'active'
  ) returning id into v_id;

  insert into public.student_package_adjustments(
    student_user_id,
    package_purchase_id,
    adjustment_type,
    lesson_delta,
    price_amount,
    currency,
    payment_status,
    notes,
    created_by
  ) values (
    p_student_id,
    v_id,
    'package_assigned',
    p_lesson_count,
    p_price_amount,
    upper(p_currency),
    p_payment_status,
    coalesce(nullif(btrim(p_admin_notes), ''), 'İlk paket tanımlaması'),
    auth.uid()
  ) returning id into v_adj_id;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'package.assigned',
    'student_package_purchase',
    v_id::text,
    jsonb_build_object(
      'student_user_id', p_student_id,
      'package_id', v_pkg_id,
      'custom_package_name', p_custom_package_name,
      'lesson_count', p_lesson_count,
      'payment_status', p_payment_status,
      'price_amount', p_price_amount,
      'currency', p_currency
    )
  );

  return jsonb_build_object(
    'success', true,
    'purchase_id', v_id,
    'adjustment_id', v_adj_id
  );
end;
$$;

revoke all on function public.admin_add_extra_lessons(uuid, integer, numeric, text, text, text) from public, anon;
revoke all on function public.admin_assign_student_package_v2(uuid, text, text, date, date, integer, numeric, text, text, text) from public, anon;

grant execute on function public.admin_add_extra_lessons(uuid, integer, numeric, text, text, text) to authenticated;
grant execute on function public.admin_assign_student_package_v2(uuid, text, text, date, date, integer, numeric, text, text, text) to authenticated;
