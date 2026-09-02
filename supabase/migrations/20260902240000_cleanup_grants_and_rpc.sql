-- Cleanup grants and atomic purge RPC + Lesson decrement notification in adjust RPC

grant delete on public.student_package_adjustments to service_role, authenticated;
grant delete on public.student_admin_notes to service_role, authenticated;
grant delete on public.payment_refunds to service_role, authenticated;
grant delete on public.student_homework to service_role, authenticated;
grant delete on public.student_lessons to service_role, authenticated;
grant delete on public.bookings to service_role, authenticated;
grant delete on public.student_profiles to service_role, authenticated;
grant delete on public.guardian_students to service_role, authenticated;
grant delete on public.guardian_accounts to service_role, authenticated;

-- Atomic student and payment data purge RPC with explicit WHERE clauses
create or replace function public.admin_cleanup_all_students_and_payments()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notes int;
  v_adjustments int;
  v_purchases int;
  v_payments int;
  v_refunds int;
  v_students int;
  v_guardians int;
begin
  if not public.is_admin()
     and current_user not in ('postgres', 'service_role')
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  then
    raise exception 'ADMIN_OR_SERVICE_REQUIRED' using errcode = '42501';
  end if;

  delete from public.student_admin_notes where true;
  get diagnostics v_notes = row_count;

  delete from public.student_package_adjustments where true;
  get diagnostics v_adjustments = row_count;

  delete from public.student_package_purchases where true;
  get diagnostics v_purchases = row_count;

  delete from public.payment_refunds where true;
  get diagnostics v_refunds = row_count;

  delete from public.payment_transactions where true;
  get diagnostics v_payments = row_count;

  delete from public.guardian_students where true;
  delete from public.student_exam_attempts where true;
  delete from public.student_homework where true;
  delete from public.student_lessons where true;
  delete from public.bookings where true;

  delete from public.student_profiles where true;
  get diagnostics v_students = row_count;

  delete from public.guardian_accounts where true;
  get diagnostics v_guardians = row_count;

  return jsonb_build_object(
    'success', true,
    'deleted_notes', v_notes,
    'deleted_adjustments', v_adjustments,
    'deleted_purchases', v_purchases,
    'deleted_refunds', v_refunds,
    'deleted_payments', v_payments,
    'deleted_students', v_students,
    'deleted_guardians', v_guardians
  );
end;
$$;

revoke all on function public.admin_cleanup_all_students_and_payments() from public, anon;
grant execute on function public.admin_cleanup_all_students_and_payments() to service_role, authenticated;

-- Hardened admin_adjust_package_lessons with notification on decrement
create or replace function public.admin_adjust_package_lessons(
  p_purchase_id uuid,
  p_lesson_delta integer,
  p_reason text,
  p_notes text default null
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
    created_by
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
    auth.uid()
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

  return jsonb_build_object(
    'success', true,
    'purchase_id', p_purchase_id,
    'old_lesson_count', v_old_lesson_count,
    'new_lesson_count', v_new_lesson_count,
    'lessons_used', v_purchase.lessons_used,
    'old_remaining', v_old_remaining,
    'new_remaining', v_new_remaining,
    'adjustment_id', v_adjustment_id
  );
end;
$$;

revoke all on function public.admin_adjust_package_lessons(uuid, integer, text, text) from public, anon;
grant execute on function public.admin_adjust_package_lessons(uuid, integer, text, text) to authenticated, service_role;
