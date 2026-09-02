-- Payment/auth/outbox/lesson-right operational hardening.
-- University search objects are intentionally untouched.

alter table public.student_package_adjustments
  add column if not exists reason text;

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

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'process-notification-outbox-every-minute';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'process-notification-outbox-every-minute',
    '* * * * *',
    $cron$
      select net.http_post(
        url := 'https://mwbrlfmdpbkmdjroxhcc.supabase.co/functions/v1/process-notification-outbox',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13YnJsZm1kcGJrbWRqcm94aGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjQ1ODgsImV4cCI6MjEwMjA0MDU4OH0.qD_AdaLnBoUxrgmjefszlenWVKfHqQPMbbJbHOB_8-0'
        ),
        body := '{"source":"scheduled"}'::jsonb,
        timeout_milliseconds := 15000
      );
    $cron$
  );
end;
$$;
