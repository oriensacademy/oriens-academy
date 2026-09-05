-- Migration: 20260905110000_mail040_producer_fix.sql
-- MAIL-040 (Ders Sonrası Kalan Ders Hakkı Bildirimi) root cause fix.
--
-- The MAIL-040 enqueue logic (guardian resolution via guardian_accounts.email_verified_at,
-- send_at = max(lesson_end_at + 1h, completion_time), live remaining-rights recalculation
-- at delivery time) already exists, but only inside public.internal_apply_lesson_completion
-- (20260904240000_email_change_and_lesson_remaining_rights.sql) -- a function nothing calls.
-- The actual canonical completion path is public.admin_record_completed_lesson (called
-- directly, or via admin_complete_student_lesson), so MAIL-040 has never fired.
--
-- Fix: re-create admin_record_completed_lesson identical to its current definition
-- (20260904280000_lesson_completion_bypass_protection.sql, including the completion-bypass
-- guard flag and the p_send_email opt-in for MAIL-027), adding the MAIL-040 enqueue block
-- ported verbatim from internal_apply_lesson_completion. MAIL-040 is NOT gated by
-- p_send_email -- it remains an automatic lifecycle notification per business rule,
-- separate from the manual MAIL-027 completion/feedback email.

create or replace function public.admin_record_completed_lesson(
  p_student_id uuid,
  p_lesson_date timestamptz,
  p_duration_minutes integer,
  p_title text,
  p_subject text,
  p_teacher_note text default null,
  p_package_purchase_id uuid default null,
  p_existing_lesson_id uuid default null,
  p_completion_source text default 'past',
  p_idempotency_key text default null,
  p_send_email boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lesson public.student_lessons%rowtype;
  v_purchase public.student_package_purchases%rowtype;
  v_key text;
  v_ledger_id uuid;
  v_previous_remaining integer;
  v_remaining integer;
  v_guardian record;
  v_total_usable_remaining integer;
  v_target_send_at timestamptz;
  v_scheduled_email_at timestamptz;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.student_profiles where id=p_student_id and active) then return jsonb_build_object('success',false,'error_code','LEARNER_NOT_FOUND'); end if;
  if p_duration_minutes not between 1 and 600 then return jsonb_build_object('success',false,'error_code','INVALID_DURATION'); end if;
  if char_length(btrim(coalesce(p_title,''))) not between 1 and 160 or char_length(btrim(coalesce(p_subject,''))) not between 1 and 160 then
    return jsonb_build_object('success',false,'error_code','INVALID_LESSON_DETAILS');
  end if;
  if p_completion_source not in ('scheduled','past') then return jsonb_build_object('success',false,'error_code','INVALID_COMPLETION_SOURCE'); end if;

  v_key := case when p_existing_lesson_id is not null then 'scheduled:'||p_existing_lesson_id else nullif(btrim(p_idempotency_key),'') end;
  if v_key is null then return jsonb_build_object('success',false,'error_code','IDEMPOTENCY_KEY_REQUIRED'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_key,0));

  if p_existing_lesson_id is not null then
    select * into v_lesson from public.student_lessons where id=p_existing_lesson_id for update;
    if v_lesson.id is null then return jsonb_build_object('success',false,'error_code','LESSON_NOT_FOUND'); end if;
    if v_lesson.student_user_id<>p_student_id then return jsonb_build_object('success',false,'error_code','LEARNER_MISMATCH'); end if;
    if v_lesson.status='completed' then
      select * into v_purchase from public.student_package_purchases where id=v_lesson.package_purchase_id;
      return jsonb_build_object('success',true,'already_completed',true,'lesson_id',v_lesson.id,
        'package_purchase_id',v_purchase.id,'used',v_purchase.lessons_used,
        'remaining',greatest(0,v_purchase.lesson_count-v_purchase.lessons_used),'total',v_purchase.lesson_count);
    end if;
  end if;

  if p_package_purchase_id is not null then
    select * into v_purchase from public.student_package_purchases
      where id=p_package_purchase_id and student_user_id=p_student_id and status='active'
      for update;
  else
    select * into v_purchase from public.student_package_purchases
      where student_user_id=p_student_id and status='active' and lesson_count>lessons_used
      order by created_at asc,id asc for update limit 1;
  end if;
  if v_purchase.id is null then return jsonb_build_object('success',false,'error_code','NO_ACTIVE_PACKAGE'); end if;
  v_previous_remaining := v_purchase.lesson_count-v_purchase.lessons_used;
  if v_previous_remaining<=0 then return jsonb_build_object('success',false,'error_code','NO_LESSON_RIGHT'); end if;

  update public.student_package_purchases set
    lessons_used=lessons_used+1,
    status=case when lessons_used+1>=lesson_count then 'completed' else 'active' end,
    updated_at=now()
  where id=v_purchase.id returning * into v_purchase;
  v_remaining := greatest(0,v_purchase.lesson_count-v_purchase.lessons_used);

  -- Transaction-local only (is_local = true): the guard trigger sees this
  -- flag only for the remainder of this transaction, never leaking into any
  -- other session/transaction.
  perform set_config('oriens.completing_lesson', 'true', true);

  if p_existing_lesson_id is not null then
    update public.student_lessons set
      status='completed',package_purchase_id=v_purchase.id,
      teacher_note=coalesce(nullif(btrim(p_teacher_note),''),teacher_note),
      completion_key=v_key,completion_source='scheduled',completion_previous_remaining=v_previous_remaining,updated_at=now()
    where id=p_existing_lesson_id returning * into v_lesson;
  else
    insert into public.student_lessons(
      student_user_id,package_purchase_id,title,subject,lesson_date,duration_minutes,
      status,teacher_note,completion_key,completion_source,completion_previous_remaining
    ) values (
      p_student_id,v_purchase.id,left(btrim(p_title),160),left(btrim(p_subject),160),p_lesson_date,p_duration_minutes,
      'completed',left(nullif(btrim(p_teacher_note),''),2000),v_key,'past',v_previous_remaining
    ) returning * into v_lesson;
  end if;

  insert into public.student_package_adjustments(
    student_user_id,package_purchase_id,adjustment_type,lesson_delta,price_amount,
    currency,payment_status,notes,created_by,linked_lesson_id
  ) values (
    p_student_id,v_purchase.id,
    case when p_completion_source='past' then 'past_lesson_added' else 'lesson_completed' end,
    -1,null,v_purchase.currency,'waived',nullif(btrim(p_teacher_note),''),auth.uid(),v_lesson.id
  ) returning id into v_ledger_id;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'lesson.completed','student_lesson',v_lesson.id::text,jsonb_build_object(
    'student_id',p_student_id,'package_purchase_id',v_purchase.id,'ledger_id',v_ledger_id,
    'completion_source',p_completion_source,'previous_remaining',v_previous_remaining,
    'used',v_purchase.lessons_used,'remaining',v_remaining,'idempotency_key',v_key,
    'email_requested',p_send_email));

  -- MAIL-027 (manual completion/feedback email): explicit opt-in ONLY.
  if p_send_email then
    perform public.enqueue_completed_lesson_notifications(v_lesson.id);
  end if;

  -- MAIL-040 (automatic lifecycle notification): always enqueued, independent of p_send_email.
  -- Recipient resolution: verified primary account holder (guardian) only -- never falls back
  -- to auth.users.email_confirmed_at. Silently skipped (no row enqueued) if no verified
  -- account holder exists, matching the deterministic-but-safe resolution the audit required.
  select ga.user_id, ga.email, ga.full_name, ga.preferred_language
    into v_guardian
  from public.guardian_students gs
  join public.guardian_accounts ga on ga.user_id = gs.guardian_user_id
  where gs.student_id = p_student_id and gs.active and ga.active
    and ga.email_verified_at is not null
  order by gs.is_primary desc, gs.created_at asc
  limit 1;

  if v_guardian.email is not null then
    v_total_usable_remaining := public.calculate_student_usable_remaining_lessons(p_student_id);

    -- send_at = max(lesson_end_at + 1 hour, completion_time):
    -- on-time/early completion -> scheduled for lesson_end + 1h;
    -- late completion or a past lesson entered after the fact -> queue immediately.
    v_target_send_at := v_lesson.lesson_date + (coalesce(v_lesson.duration_minutes, 60) || ' minutes')::interval + interval '1 hour';
    if p_completion_source = 'past' or v_target_send_at <= now() then
      v_scheduled_email_at := now();
    else
      v_scheduled_email_at := v_target_send_at;
    end if;

    perform public.enqueue_email_notification(
      'lesson.remaining_rights',
      'student_lesson',
      v_lesson.id::text,
      v_guardian.email,
      'lesson_remaining_rights_account_holder',
      jsonb_build_object(
        'lesson_id', v_lesson.id,
        'lesson_title', v_lesson.title,
        'lesson_date', v_lesson.lesson_date,
        'duration_minutes', coalesce(v_lesson.duration_minutes, 60),
        'student_name', v_guardian.full_name,
        'student_user_id', p_student_id,
        'total_remaining_lessons', v_total_usable_remaining,
        'completion_source', p_completion_source,
        'locale', coalesce(v_guardian.preferred_language, 'tr')
      ),
      'lesson_remaining_rights:' || v_lesson.id::text,
      v_scheduled_email_at
    );
  end if;

  return jsonb_build_object('success',true,'already_completed',false,'lesson_id',v_lesson.id,
    'package_purchase_id',v_purchase.id,'used',v_purchase.lessons_used,'remaining',v_remaining,
    'total',v_purchase.lesson_count,'ledger_id',v_ledger_id,'email_queued',p_send_email);
end;
$$;

revoke all on function public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text,boolean) from public,anon;
grant execute on function public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text,boolean) to authenticated,service_role;

-- internal_apply_lesson_completion (20260904240000) is now fully superseded by this fix
-- and was never called from anywhere in the codebase (verified: no caller in supabase/
-- or src/). Drop it rather than leave a second, now-redundant copy of the same MAIL-040
-- logic to drift out of sync with the canonical path.
drop function if exists public.internal_apply_lesson_completion(uuid, uuid, uuid, text, text, timestamptz, integer, text, text, text, boolean);
