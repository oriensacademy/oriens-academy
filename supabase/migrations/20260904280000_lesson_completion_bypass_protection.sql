-- Migration: 20260904280000_lesson_completion_bypass_protection.sql
-- Forensic audit item 2 (DIRECT DB LESSON COMPLETION BYPASS).
--
-- A direct `UPDATE student_lessons SET status = 'completed'` (or an INSERT
-- with status='completed', e.g. via admin_upsert_student_lesson, which is a
-- second RPC that can also write that status) skips the ledger entirely:
-- lessons_used is never incremented, no student_package_adjustments row is
-- written, no audit log entry is created. Only admin_record_completed_lesson
-- (called directly, or via admin_complete_student_lesson) performs that
-- accounting.
--
-- Fix: a transaction-local guard flag. admin_record_completed_lesson sets
-- `oriens.completing_lesson = true` (via set_config with is_local = true,
-- so it can never leak past the current transaction/statement) immediately
-- before its own INSERT/UPDATE that writes status = 'completed'. A trigger
-- on student_lessons rejects any INSERT/UPDATE that transitions a row's
-- status to 'completed' unless that flag is set for the current transaction
-- -- so the canonical RPC's own write always succeeds, and every other path
-- (raw SQL, admin_upsert_student_lesson, any future direct write) is
-- rejected instead of silently corrupting the ledger.

create or replace function public.guard_student_lesson_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from 'completed')
     and coalesce(current_setting('oriens.completing_lesson', true), '') <> 'true'
  then
    raise exception 'LESSON_COMPLETION_BYPASS_BLOCKED: status can only transition to completed via admin_record_completed_lesson / admin_complete_student_lesson' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_student_lesson_completion on public.student_lessons;
create trigger trg_guard_student_lesson_completion
  before insert or update on public.student_lessons
  for each row execute function public.guard_student_lesson_completion();

-- Re-create admin_record_completed_lesson identical to its current
-- definition (20260904230000_email_cleanup_and_manual_lesson_decoupling.sql,
-- including the p_send_email opt-in), adding only the guard flag around its
-- own status='completed' write.
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

comment on function public.guard_student_lesson_completion() is
  'Rejects any INSERT/UPDATE transitioning student_lessons.status to completed unless the current transaction was set by admin_record_completed_lesson (oriens.completing_lesson=true, transaction-local). Prevents ledger-bypassing direct writes -- see forensic audit item 2.';
