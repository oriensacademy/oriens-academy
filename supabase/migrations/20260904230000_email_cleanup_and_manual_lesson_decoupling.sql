-- Migration: 20260904230000_email_cleanup_and_manual_lesson_decoupling.sql
-- 1. Decouple lesson completion and past lesson entry from automatic email side-effects.
-- 2. Drop automatic DB trigger trg_queue_lesson_completed_email.
-- 3. Update admin_record_completed_lesson and admin_complete_student_lesson with p_send_email (default false).
-- 4. Provide explicit admin RPC admin_send_lesson_completed_email for on-demand dispatch.
-- 5. Remove payment reminder RPC (admin_send_payment_reminder).

-- 1. Drop the automatic completion email trigger
drop trigger if exists trg_queue_lesson_completed_email on public.student_lessons;
drop function if exists public.queue_lesson_completed_email();

-- 2. Update admin_record_completed_lesson to support explicit p_send_email (default false)
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

  -- Explicit email opt-in ONLY:
  if p_send_email then
    perform public.enqueue_completed_lesson_notifications(v_lesson.id);
  end if;

  return jsonb_build_object('success',true,'already_completed',false,'lesson_id',v_lesson.id,
    'package_purchase_id',v_purchase.id,'used',v_purchase.lessons_used,'remaining',v_remaining,
    'total',v_purchase.lesson_count,'ledger_id',v_ledger_id,'email_queued',p_send_email);
end;
$$;

revoke all on function public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text,boolean) from public,anon;
grant execute on function public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text,boolean) to authenticated,service_role;

-- 3. Update admin_complete_student_lesson to accept p_send_email (default false)
create or replace function public.admin_complete_student_lesson(
  p_lesson_id uuid,
  p_package_purchase_id uuid default null,
  p_teacher_note text default null,
  p_send_email boolean default false
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_lesson public.student_lessons%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select * into v_lesson from public.student_lessons where id=p_lesson_id;
  if v_lesson.id is null then return jsonb_build_object('success',false,'error_code','LESSON_NOT_FOUND'); end if;
  return public.admin_record_completed_lesson(
    v_lesson.student_user_id,v_lesson.lesson_date,v_lesson.duration_minutes,v_lesson.title,v_lesson.subject,
    p_teacher_note,p_package_purchase_id,v_lesson.id,'scheduled','scheduled:'||v_lesson.id,p_send_email
  );
end;
$$;

revoke all on function public.admin_complete_student_lesson(uuid,uuid,text,boolean) from public,anon;
grant execute on function public.admin_complete_student_lesson(uuid,uuid,text,boolean) to authenticated,service_role;

-- 4. Explicit on-demand lesson completion email dispatcher RPC
create or replace function public.admin_send_lesson_completed_email(
  p_lesson_id uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_lesson public.student_lessons%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select * into v_lesson from public.student_lessons where id=p_lesson_id;
  if v_lesson.id is null then return jsonb_build_object('success',false,'error_code','LESSON_NOT_FOUND'); end if;
  if v_lesson.status <> 'completed' then return jsonb_build_object('success',false,'error_code','LESSON_NOT_COMPLETED'); end if;

  perform public.enqueue_completed_lesson_notifications(v_lesson.id);

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), 'lesson.completion_email_manually_sent', 'student_lesson', v_lesson.id::text,
    jsonb_build_object('lesson_id', v_lesson.id, 'student_user_id', v_lesson.student_user_id));

  return jsonb_build_object('success', true, 'lesson_id', v_lesson.id);
end;
$$;

revoke all on function public.admin_send_lesson_completed_email(uuid) from public,anon;
grant execute on function public.admin_send_lesson_completed_email(uuid) to authenticated,service_role;

-- 5. Drop payment reminder RPC (Feature permanently removed per user instruction)
drop function if exists public.admin_send_payment_reminder(uuid);
