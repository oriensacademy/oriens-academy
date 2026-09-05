-- Migration: 20260906120000_canonical_completion_and_manual_package_mail.sql
--
-- 1. PRODUCTION BLOCKER: admin_record_completed_lesson had two overloads, so
--    PostgREST could not resolve the RPC:
--
--      Could not choose the best candidate function between:
--        admin_record_completed_lesson(..., p_idempotency_key => text),
--        admin_record_completed_lesson(..., p_idempotency_key => text, p_send_email => boolean)
--
--    Same class of defect as the enqueue_email_notification ambiguity fixed in
--    20260906100000: a later migration added a parameter without dropping the
--    previous signature.
--
-- 2. Business rule: data mutation is NOT an email trigger. Package assignment
--    and manual lesson-right adjustments must never send mail on their own; the
--    admin sends it afterwards with an explicit button.
--
--    MAIL-027 (lesson information / instructor feedback) => MANUAL
--    MAIL-040 (post-lesson remaining rights)             => AUTOMATIC (unchanged)
--
--    p_send_email is therefore removed from the canonical completion RPC
--    entirely: completion never sends MAIL-027, and MAIL-040 is enqueued
--    unconditionally as before.

-- ==============================================================================
-- 0. DIAGNOSTIC: surface any remaining overloaded RPC
-- ==============================================================================
-- Two overloads of the same public function is an outage waiting to happen for
-- every PostgREST caller. This makes the condition queryable instead of only
-- discoverable in production.

create or replace function public.admin_list_duplicate_functions()
returns table (function_name text, overload_count bigint, signatures text)
language sql
security definer
set search_path = ''
as $fn$
  select p.proname::text,
         count(*) as overload_count,
         string_agg(pg_get_function_identity_arguments(p.oid), ' || ' order by p.oid) as signatures
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
  group by p.proname
  having count(*) > 1
  order by p.proname;
$fn$;

revoke all on function public.admin_list_duplicate_functions() from public, anon, authenticated;
grant execute on function public.admin_list_duplicate_functions() to service_role;

-- ==============================================================================
-- 1. CANONICAL LESSON COMPLETION -- ONE SIGNATURE, NO p_send_email
-- ==============================================================================

-- Drop BOTH known signatures, then recreate exactly one. Dropping by exact
-- signature (rather than `drop function name`) is required precisely because
-- the name is currently ambiguous.
drop function if exists public.admin_record_completed_lesson(uuid, timestamptz, integer, text, text, text, uuid, uuid, text, text, boolean);
drop function if exists public.admin_record_completed_lesson(uuid, timestamptz, integer, text, text, text, uuid, uuid, text, text);

create function public.admin_record_completed_lesson(
  p_student_id uuid,
  p_lesson_date timestamptz,
  p_duration_minutes integer,
  p_title text,
  p_subject text,
  p_teacher_note text default null,
  p_package_purchase_id uuid default null,
  p_existing_lesson_id uuid default null,
  p_completion_source text default 'past',
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
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

  -- Only a usable package may be consumed: refunded / refund_pending / expired /
  -- cancelled / completed packages are never silently drawn down.
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
    'used',v_purchase.lessons_used,'remaining',v_remaining,'idempotency_key',v_key));

  -- MAIL-027 is NOT sent here. It is an explicit admin action
  -- (admin_send_lesson_completed_email), never a side effect of completion.

  -- MAIL-040 (automatic lifecycle): always enqueued.
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
    v_target_send_at := v_lesson.lesson_date + (coalesce(v_lesson.duration_minutes, 60) || ' minutes')::interval + interval '1 hour';
    if p_completion_source = 'past' or v_target_send_at <= now() then
      v_scheduled_email_at := now();
    else
      v_scheduled_email_at := v_target_send_at;
    end if;

    perform public.enqueue_email_notification(
      'lesson.remaining_rights', 'student_lesson', v_lesson.id::text, v_guardian.email,
      'lesson_remaining_rights_account_holder',
      jsonb_build_object(
        'lesson_id', v_lesson.id, 'lesson_title', v_lesson.title, 'lesson_date', v_lesson.lesson_date,
        'duration_minutes', coalesce(v_lesson.duration_minutes, 60),
        'student_name', v_guardian.full_name, 'student_user_id', p_student_id,
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
    'total',v_purchase.lesson_count,'ledger_id',v_ledger_id);
end;
$fn$;

revoke all on function public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text) from public,anon;
grant execute on function public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text) to authenticated,service_role;

-- ==============================================================================
-- 2. admin_complete_student_lesson -- ONE SIGNATURE, NO p_send_email
-- ==============================================================================

drop function if exists public.admin_complete_student_lesson(uuid, uuid, text, boolean);
drop function if exists public.admin_complete_student_lesson(uuid, uuid, text);

create function public.admin_complete_student_lesson(
  p_lesson_id uuid,
  p_package_purchase_id uuid default null,
  p_teacher_note text default null
) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare v_lesson public.student_lessons%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select * into v_lesson from public.student_lessons where id=p_lesson_id;
  if v_lesson.id is null then return jsonb_build_object('success',false,'error_code','LESSON_NOT_FOUND'); end if;
  return public.admin_record_completed_lesson(
    v_lesson.student_user_id, v_lesson.lesson_date, v_lesson.duration_minutes, v_lesson.title, v_lesson.subject,
    p_teacher_note, p_package_purchase_id, v_lesson.id, 'scheduled', 'scheduled:'||v_lesson.id
  );
end;
$fn$;

revoke all on function public.admin_complete_student_lesson(uuid,uuid,text) from public,anon;
grant execute on function public.admin_complete_student_lesson(uuid,uuid,text) to authenticated,service_role;

-- ==============================================================================
-- 3. APPOINTMENT COMPLETION -- keep delegating, drop the p_send_email argument
-- ==============================================================================

create or replace function public.admin_complete_scheduled_event(
  p_event_id uuid,
  p_package_purchase_id uuid default null,
  p_teacher_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;

  if exists (select 1 from public.student_lessons where id = p_event_id) then
    return public.admin_complete_student_lesson(p_event_id, p_package_purchase_id, p_teacher_note);
  end if;

  if exists (select 1 from public.bookings where id = p_event_id) then
    return public.admin_complete_student_appointment(
      p_event_id, p_package_purchase_id, null, null, null, 60, p_teacher_note);
  end if;

  return jsonb_build_object('success', false, 'error_code', 'EVENT_NOT_FOUND');
end;
$fn$;

revoke all on function public.admin_complete_scheduled_event(uuid, uuid, text) from public, anon;
grant execute on function public.admin_complete_scheduled_event(uuid, uuid, text) to authenticated, service_role;

-- ==============================================================================
-- 4. NEGATIVE-RIGHTS + REFUNDED-PACKAGE PROTECTION ON MANUAL ADJUSTMENTS
-- ==============================================================================

create or replace function public.admin_adjust_package_lesson_rights(
  p_purchase_id uuid,
  p_lesson_delta integer,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_purchase public.student_package_purchases%rowtype;
  v_remaining integer;
  v_new_count integer;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if p_lesson_delta is null or p_lesson_delta = 0 then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_DELTA');
  end if;

  select * into v_purchase from public.student_package_purchases where id = p_purchase_id for update;
  if v_purchase.id is null then
    return jsonb_build_object('success', false, 'error_code', 'PACKAGE_NOT_FOUND');
  end if;

  -- Money-bearing or retired packages are never adjusted by hand.
  if v_purchase.status <> 'active' then
    return jsonb_build_object('success', false, 'error_code', 'PACKAGE_NOT_ADJUSTABLE', 'status', v_purchase.status);
  end if;

  v_remaining := greatest(0, v_purchase.lesson_count - v_purchase.lessons_used);
  v_new_count := v_purchase.lesson_count + p_lesson_delta;

  -- A decrease may never push remaining rights below zero.
  if p_lesson_delta < 0 and (v_remaining + p_lesson_delta) < 0 then
    return jsonb_build_object(
      'success', false, 'error_code', 'INSUFFICIENT_REMAINING_RIGHTS',
      'remaining', v_remaining, 'requested_delta', p_lesson_delta
    );
  end if;
  if v_new_count < v_purchase.lessons_used then
    return jsonb_build_object('success', false, 'error_code', 'INSUFFICIENT_REMAINING_RIGHTS',
      'remaining', v_remaining, 'requested_delta', p_lesson_delta);
  end if;

  update public.student_package_purchases
  set lesson_count = v_new_count,
      status = case when v_new_count <= lessons_used then 'completed' else 'active' end,
      updated_at = now()
  where id = p_purchase_id
  returning * into v_purchase;

  insert into public.student_package_adjustments(
    student_user_id, package_purchase_id, adjustment_type, lesson_delta, price_amount,
    currency, payment_status, notes, created_by
  ) values (
    v_purchase.student_user_id, v_purchase.id,
    case when p_lesson_delta > 0 then 'extra_lessons_added' else 'lesson_rights_reduced' end,
    p_lesson_delta, null, v_purchase.currency, 'waived', nullif(btrim(p_reason), ''), auth.uid()
  );

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'package.rights_adjusted', 'student_package_purchase', v_purchase.id::text,
    jsonb_build_object('delta', p_lesson_delta, 'lesson_count', v_purchase.lesson_count,
                       'lessons_used', v_purchase.lessons_used,
                       'remaining', greatest(0, v_purchase.lesson_count - v_purchase.lessons_used)));

  -- Deliberately NO email here: a data mutation is not a notification. The admin
  -- sends it afterwards via admin_send_lesson_rights_email().
  return jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase.id,
    'lesson_count', v_purchase.lesson_count,
    'lessons_used', v_purchase.lessons_used,
    'remaining', greatest(0, v_purchase.lesson_count - v_purchase.lessons_used)
  );
end;
$fn$;

revoke all on function public.admin_adjust_package_lesson_rights(uuid, integer, text) from public, anon;
grant execute on function public.admin_adjust_package_lesson_rights(uuid, integer, text) to authenticated, service_role;

-- ==============================================================================
-- 5. MANUAL, ADMIN-TRIGGERED PACKAGE / RIGHTS NOTIFICATIONS
-- ==============================================================================
-- MAIL-041 and MAIL-042. Both are explicit admin actions routed through the
-- durable outbox, so they inherit the archive BCC and the info@ sender like
-- every other production mail. A deliberate resend is allowed (suffixed dedupe
-- key); an accidental double click inside 60 seconds is suppressed.

create or replace function public.admin_send_package_notification(
  p_purchase_id uuid,
  p_kind text default 'package_assigned'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_purchase public.student_package_purchases%rowtype;
  v_holder record;
  v_learner_name text;
  v_package_name text;
  v_remaining integer;
  v_total_remaining integer;
  v_sends integer;
  v_action text;
  v_template text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if p_kind not in ('package_assigned', 'lesson_rights') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_KIND');
  end if;
  v_action := 'package.' || p_kind || '_email_manually_sent';
  v_template := case when p_kind = 'package_assigned' then 'package_assigned_manual' else 'lesson_rights_manual' end;

  select * into v_purchase from public.student_package_purchases where id = p_purchase_id;
  if v_purchase.id is null then return jsonb_build_object('success', false, 'error_code', 'PACKAGE_NOT_FOUND'); end if;

  perform pg_advisory_xact_lock(hashtextextended(v_template || ':' || p_purchase_id::text, 0));

  if exists (
    select 1 from public.audit_logs
    where action = v_action and entity_id = p_purchase_id::text and created_at > now() - interval '60 seconds'
  ) then
    return jsonb_build_object('success', true, 'suppressed', true, 'error_code', 'DUPLICATE_SUPPRESSED');
  end if;

  select ga.user_id, ga.email, ga.full_name, ga.preferred_language
    into v_holder
  from public.guardian_students gs
  join public.guardian_accounts ga on ga.user_id = gs.guardian_user_id
  where gs.student_id = v_purchase.student_user_id and gs.active and ga.active
    and ga.email_verified_at is not null
  order by gs.is_primary desc, gs.created_at asc
  limit 1;
  if v_holder.email is null then
    return jsonb_build_object('success', false, 'error_code', 'NO_VERIFIED_ACCOUNT_HOLDER');
  end if;

  select full_name into v_learner_name from public.student_profiles where id = v_purchase.student_user_id;
  select case when v_holder.preferred_language = 'en' then name_en else name_tr end
    into v_package_name from public.pricing_packages where id = v_purchase.package_id;

  v_remaining := greatest(0, v_purchase.lesson_count - v_purchase.lessons_used);
  v_total_remaining := public.calculate_student_usable_remaining_lessons(v_purchase.student_user_id);

  select count(*) into v_sends from public.audit_logs
  where action = v_action and entity_id = p_purchase_id::text;

  perform public.enqueue_email_notification(
    'package.' || p_kind || '.manual',
    'student_package_purchase',
    v_purchase.id::text,
    v_holder.email,
    v_template,
    jsonb_build_object(
      'purchase_id', v_purchase.id,
      'account_holder_name', v_holder.full_name,
      'learner_name', v_learner_name,
      'package_name', coalesce(v_package_name, v_purchase.custom_package_name, v_purchase.package_id),
      'lesson_count', v_purchase.lesson_count,
      'lessons_used', v_purchase.lessons_used,
      'remaining_lessons', v_remaining,
      'total_remaining_lessons', v_total_remaining,
      'start_date', v_purchase.start_date,
      'end_date', v_purchase.end_date,
      'locale', coalesce(v_holder.preferred_language, 'tr')
    ),
    v_template || ':' || v_purchase.id::text || case when v_sends > 0 then ':resend' || v_sends::text else '' end,
    now()
  );

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), v_action, 'student_package_purchase', v_purchase.id::text,
    jsonb_build_object('resend_index', v_sends, 'remaining', v_remaining));

  return jsonb_build_object('success', true, 'suppressed', false, 'resend_index', v_sends,
    'remaining', v_remaining, 'total_remaining', v_total_remaining);
end;
$fn$;

revoke all on function public.admin_send_package_notification(uuid, text) from public, anon;
grant execute on function public.admin_send_package_notification(uuid, text) to authenticated, service_role;
