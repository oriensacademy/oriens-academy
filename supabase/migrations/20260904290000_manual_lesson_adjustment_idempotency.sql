-- Migration: 20260904290000_manual_lesson_adjustment_idempotency.sql
-- Forensic audit item 3 (MANUAL LESSON +/- IDEMPOTENCY).
--
-- admin_add_extra_lessons and admin_adjust_package_lessons have no
-- idempotency protection: a double-click or a client retry resends the same
-- request and applies the delta twice (+2 becomes +4, a -2 deduction is
-- applied twice). Client-side button disable/loading is not a safety layer
-- on its own -- this adds a client-generated idempotency key, persisted on
-- the resulting student_package_adjustments row under a unique index, and
-- both RPCs replay the first result instead of re-applying the delta when
-- the same key is seen again. Same advisory-lock-then-check pattern already
-- used by admin_record_completed_lesson, for consistency.

alter table public.student_package_adjustments
  add column if not exists idempotency_key text;

create unique index if not exists idx_pkg_adj_idempotency_key
  on public.student_package_adjustments(idempotency_key)
  where idempotency_key is not null;

-- admin_add_extra_lessons: add p_idempotency_key (default null keeps existing
-- callers working; the RPC still functions without one, just without replay
-- protection -- callers should pass one going forward).
create or replace function public.admin_add_extra_lessons(
  p_purchase_id uuid,
  p_lesson_delta integer,
  p_price_amount numeric default null,
  p_currency text default 'TRY',
  p_payment_status text default 'waived',
  p_notes text default null,
  p_idempotency_key text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_purchase public.student_package_purchases%rowtype;
  v_adj_id uuid;
  v_new_lesson_count integer;
  v_reactivated boolean := false;
  v_new_status text;
  v_key text := nullif(btrim(p_idempotency_key), '');
  v_existing record;
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

  if v_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
    select id, package_purchase_id into v_existing from public.student_package_adjustments where idempotency_key = v_key;
    if found then
      select * into v_purchase from public.student_package_purchases where id = v_existing.package_purchase_id;
      return jsonb_build_object(
        'success', true, 'purchase_id', v_existing.package_purchase_id, 'adjustment_id', v_existing.id,
        'lesson_count', v_purchase.lesson_count, 'lessons_used', v_purchase.lessons_used,
        'remaining', greatest(0, v_purchase.lesson_count - v_purchase.lessons_used),
        'status', v_purchase.status, 'reactivated', false, 'replayed', true
      );
    end if;
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
    created_by,
    idempotency_key
  ) values (
    v_purchase.student_user_id,
    p_purchase_id,
    'extra_lessons',
    p_lesson_delta,
    p_price_amount,
    upper(coalesce(nullif(btrim(p_currency), ''), 'TRY')),
    p_payment_status,
    nullif(btrim(p_notes), ''),
    auth.uid(),
    v_key
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
    'reactivated', v_reactivated,
    'replayed', false
  );
end;
$$;

revoke all on function public.admin_add_extra_lessons(uuid, integer, numeric, text, text, text, text) from public, anon;
grant execute on function public.admin_add_extra_lessons(uuid, integer, numeric, text, text, text, text) to authenticated;

-- admin_adjust_package_lessons: add p_idempotency_key (same replay pattern).
create or replace function public.admin_adjust_package_lessons(
  p_purchase_id uuid,
  p_lesson_delta integer,
  p_reason text,
  p_notes text default null,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.student_package_purchases%rowtype;
  v_adjustment_id uuid;
  v_old_lesson_count integer;
  v_new_lesson_count integer;
  v_old_remaining integer;
  v_new_remaining integer;
  v_new_status text;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_key text := nullif(btrim(p_idempotency_key), '');
  v_existing record;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_lesson_delta is null or p_lesson_delta = 0 or p_lesson_delta < -500 or p_lesson_delta > 500 then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_LESSON_DELTA');
  end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 200 then
    return jsonb_build_object('success', false, 'error_code', 'ADJUSTMENT_REASON_REQUIRED');
  end if;
  if v_notes is not null and char_length(v_notes) > 1000 then
    return jsonb_build_object('success', false, 'error_code', 'ADJUSTMENT_NOTES_TOO_LONG');
  end if;

  if v_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
    select id, package_purchase_id into v_existing from public.student_package_adjustments where idempotency_key = v_key;
    if found then
      select * into v_purchase from public.student_package_purchases where id = v_existing.package_purchase_id;
      return jsonb_build_object(
        'success', true, 'purchase_id', v_existing.package_purchase_id, 'adjustment_id', v_existing.id,
        'old_lesson_count', v_purchase.lesson_count, 'new_lesson_count', v_purchase.lesson_count,
        'lessons_used', v_purchase.lessons_used,
        'old_remaining', greatest(0, v_purchase.lesson_count - v_purchase.lessons_used),
        'new_remaining', greatest(0, v_purchase.lesson_count - v_purchase.lessons_used),
        'replayed', true
      );
    end if;
  end if;

  select * into v_purchase
  from public.student_package_purchases
  where id = p_purchase_id
  for update;

  if v_purchase.id is null then
    return jsonb_build_object('success', false, 'error_code', 'PACKAGE_NOT_FOUND');
  end if;

  v_old_lesson_count := v_purchase.lesson_count;
  v_old_remaining := v_old_lesson_count - v_purchase.lessons_used;
  v_new_lesson_count := v_old_lesson_count + p_lesson_delta;
  v_new_remaining := v_new_lesson_count - v_purchase.lessons_used;

  if v_new_lesson_count < 0 or v_new_remaining < 0 then
    return jsonb_build_object(
      'success', false,
      'error_code', 'INSUFFICIENT_UNUSED_LESSONS',
      'available_remaining', greatest(0, v_old_remaining)
    );
  end if;

  v_new_status := v_purchase.status;
  if p_lesson_delta > 0 and v_new_remaining > 0 and v_purchase.status in ('completed', 'expired') then
    v_new_status := 'active';
  elsif v_new_remaining = 0 and v_purchase.status = 'active' then
    v_new_status := 'completed';
  end if;

  update public.student_package_purchases
  set lesson_count = v_new_lesson_count,
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
    reason,
    notes,
    created_by,
    idempotency_key
  ) values (
    v_purchase.student_user_id,
    p_purchase_id,
    'manual_adjustment',
    p_lesson_delta,
    null,
    v_purchase.currency,
    'waived',
    v_reason,
    v_notes,
    auth.uid(),
    v_key
  ) returning id into v_adjustment_id;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'package.lesson_rights_adjusted',
    'student_package_purchase',
    p_purchase_id::text,
    jsonb_build_object(
      'student_user_id', v_purchase.student_user_id,
      'lesson_delta', p_lesson_delta,
      'reason', v_reason,
      'notes', v_notes,
      'old_lesson_count', v_old_lesson_count,
      'new_lesson_count', v_new_lesson_count,
      'lessons_used', v_purchase.lessons_used,
      'old_remaining', v_old_remaining,
      'new_remaining', v_new_remaining,
      'old_status', v_purchase.status,
      'new_status', v_new_status,
      'adjustment_id', v_adjustment_id
    )
  );

  -- Only enqueue notification when lesson rights are decreased and an email recipient exists
  if p_lesson_delta < 0 then
    insert into public.notification_deliveries (
      channel,
      event_type,
      entity_type,
      entity_id,
      recipient,
      subject,
      status,
      provider,
      template,
      payload
    )
    select
      'email',
      'lesson_rights_decreased',
      'student_package_purchase',
      p_purchase_id::text,
      lower(btrim(sp.email)),
      'Ders hakkınız güncellendi',
      'pending',
      'google_workspace',
      'lesson_rights_decreased',
      jsonb_build_object(
        'subject', 'Ders hakkınız güncellendi',
        'title', 'Ders hakkınız güncellendi',
        'message', 'Ders hakkınız yönetici tarafından güncellendi. Kalan ders hakkınız: ' || v_new_remaining,
        'remaining_lessons', v_new_remaining,
        'lesson_delta', p_lesson_delta,
        'student_name', sp.full_name
      )
    from public.student_profiles sp
    where sp.id = v_purchase.student_user_id
      and sp.email is not null
      and btrim(sp.email) <> '';
  end if;

  perform public.enqueue_package_lifecycle_reminder(p_purchase_id, v_old_remaining, v_new_remaining);

  return jsonb_build_object(
    'success', true,
    'purchase_id', p_purchase_id,
    'old_lesson_count', v_old_lesson_count,
    'new_lesson_count', v_new_lesson_count,
    'lessons_used', v_purchase.lessons_used,
    'old_remaining', v_old_remaining,
    'new_remaining', v_new_remaining,
    'adjustment_id', v_adjustment_id,
    'replayed', false
  );
end;
$$;

revoke all on function public.admin_adjust_package_lessons(uuid, integer, text, text, text) from public, anon;
grant execute on function public.admin_adjust_package_lessons(uuid, integer, text, text, text) to authenticated, service_role;
