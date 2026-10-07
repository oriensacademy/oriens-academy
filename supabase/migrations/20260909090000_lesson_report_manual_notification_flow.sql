-- Canonical lesson completion report and manual MAIL-027 notification flow.
-- Forward-only: do not rewrite the completion migrations that are already applied.

alter table public.student_lessons
  add column if not exists completion_report text,
  add column if not exists report_updated_at timestamptz,
  add column if not exists report_author_id uuid references auth.users(id) on delete set null,
  add column if not exists report_email_sent_at timestamptz,
  add column if not exists report_version integer not null default 0;

alter table public.student_lessons
  drop constraint if exists student_lessons_completion_report_length_check;
alter table public.student_lessons
  add constraint student_lessons_completion_report_length_check
  check (
    completion_report is null
    or char_length(btrim(completion_report)) between 5 and 10000
  );

-- Keep all completion accounting, bypass protection, ledger, audit, duration and
-- idempotency behaviour intact. The only removed side effect is MAIL-040.
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

  return jsonb_build_object('success',true,'already_completed',false,'lesson_id',v_lesson.id,
    'package_purchase_id',v_purchase.id,'used',v_purchase.lessons_used,'remaining',v_remaining,
    'total',v_purchase.lesson_count,'ledger_id',v_ledger_id);
end;
$fn$;

revoke all on function public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text) from public,anon;
grant execute on function public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text) to authenticated,service_role;

create or replace function public.admin_save_lesson_completion_report(
  p_lesson_id uuid,
  p_report text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_lesson public.student_lessons%rowtype;
  v_report text := btrim(coalesce(p_report, ''));
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select * into v_lesson from public.student_lessons where id=p_lesson_id for update;
  if v_lesson.id is null then return jsonb_build_object('success',false,'error_code','LESSON_NOT_FOUND'); end if;
  if v_lesson.status<>'completed' then return jsonb_build_object('success',false,'error_code','LESSON_NOT_COMPLETED'); end if;
  if char_length(v_report)<5 then return jsonb_build_object('success',false,'error_code','REPORT_REQUIRED'); end if;
  if char_length(v_report)>10000 then return jsonb_build_object('success',false,'error_code','REPORT_TOO_LONG'); end if;

  update public.student_lessons set
    completion_report=v_report,
    report_updated_at=now(),
    report_author_id=auth.uid(),
    report_version=report_version+1,
    updated_at=now()
  where id=p_lesson_id
  returning * into v_lesson;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'lesson.report_saved','student_lesson',v_lesson.id::text,jsonb_build_object(
    'lesson_id',v_lesson.id,'student_id',v_lesson.student_user_id,
    'report_version',v_lesson.report_version,'report_length',char_length(v_report)));

  return jsonb_build_object('success',true,'lesson_id',v_lesson.id,'report_version',v_lesson.report_version,
    'report_updated_at',v_lesson.report_updated_at);
end;
$fn$;

revoke all on function public.admin_save_lesson_completion_report(uuid,text) from public,anon;
grant execute on function public.admin_save_lesson_completion_report(uuid,text) to authenticated,service_role;

create or replace function public.admin_save_and_send_lesson_report(
  p_lesson_id uuid,
  p_report text,
  p_resend boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_lesson public.student_lessons%rowtype;
  v_report text := btrim(coalesce(p_report, ''));
  v_holder record;
  v_student_name text;
  v_instructor_name text;
  v_remaining integer;
  v_delivery_id uuid;
  v_existing_delivery public.notification_deliveries%rowtype;
  v_dedupe_key text;
  v_action text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('lesson_report:'||p_lesson_id::text,0));

  select * into v_lesson from public.student_lessons where id=p_lesson_id for update;
  if v_lesson.id is null then return jsonb_build_object('success',false,'error_code','LESSON_NOT_FOUND','report_saved',false); end if;
  if v_lesson.status<>'completed' then return jsonb_build_object('success',false,'error_code','LESSON_NOT_COMPLETED','report_saved',false); end if;
  if char_length(v_report)<5 then return jsonb_build_object('success',false,'error_code','REPORT_REQUIRED','report_saved',false); end if;
  if char_length(v_report)>10000 then return jsonb_build_object('success',false,'error_code','REPORT_TOO_LONG','report_saved',false); end if;

  -- The UI saves in a separate committed RPC first. This idempotent update also
  -- makes the RPC safe for direct callers without incrementing the same text twice.
  if v_lesson.completion_report is distinct from v_report then
    update public.student_lessons set
      completion_report=v_report,report_updated_at=now(),report_author_id=auth.uid(),
      report_version=report_version+1,updated_at=now()
    where id=p_lesson_id returning * into v_lesson;
    insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'lesson.report_saved','student_lesson',v_lesson.id::text,jsonb_build_object(
      'lesson_id',v_lesson.id,'student_id',v_lesson.student_user_id,
      'report_version',v_lesson.report_version,'report_length',char_length(v_report)));
  end if;

  select ga.user_id,ga.email,ga.full_name,ga.preferred_language,gs.relationship_role
    into v_holder
  from public.guardian_students gs
  join public.guardian_accounts ga on ga.user_id=gs.guardian_user_id
  where gs.student_id=v_lesson.student_user_id and gs.active and ga.active
    and ga.email_verified_at is not null and nullif(btrim(ga.email),'') is not null
  order by gs.is_primary desc,gs.created_at asc
  limit 1;
  if v_holder.email is null then
    return jsonb_build_object('success',false,'error_code','NO_VERIFIED_ACCOUNT_HOLDER',
      'report_saved',true,'report_version',v_lesson.report_version);
  end if;

  select full_name into v_student_name from public.student_profiles where id=v_lesson.student_user_id;
  select display_name into v_instructor_name from public.admin_profiles where user_id=auth.uid();
  v_remaining := public.calculate_student_usable_remaining_lessons(v_lesson.student_user_id);
  v_dedupe_key := 'lesson_report:'||v_lesson.id::text||':v'||v_lesson.report_version::text;

  select * into v_existing_delivery from public.notification_deliveries
  where dedupe_key=v_dedupe_key limit 1;
  if v_existing_delivery.id is not null then
    return jsonb_build_object('success',true,'suppressed',true,'report_saved',true,
      'lesson_id',v_lesson.id,'report_version',v_lesson.report_version,
      'notification_delivery_id',v_existing_delivery.id,'status',v_existing_delivery.status,
      'remaining_lessons',v_remaining);
  end if;

  begin
    v_delivery_id := public.enqueue_email_notification(
      'lesson.report_email','student_lesson',v_lesson.id::text,v_holder.email,
      'lesson_completed_account_holder',jsonb_build_object(
        'lesson_id',v_lesson.id,'student_id',v_lesson.student_user_id,
        'student_name',coalesce(v_student_name,'Öğrenci'),
        'account_holder_id',v_holder.user_id,'account_holder_name',v_holder.full_name,
        'recipient_email',lower(btrim(v_holder.email)),
        'relationship_role',coalesce(v_holder.relationship_role,'other'),
        'lesson_title',v_lesson.title,'subject',v_lesson.subject,
        'lesson_date',v_lesson.lesson_date,'duration_minutes',v_lesson.duration_minutes,
        'instructor_name',coalesce(v_instructor_name,'Oriens Academy'),
        'completion_report',v_report,'total_remaining_lessons',v_remaining,
        'locale',coalesce(v_holder.preferred_language,'tr'),
        'report_version',v_lesson.report_version
      ),v_dedupe_key,now()
    );
  exception when others then
    return jsonb_build_object('success',false,'error_code','EMAIL_ENQUEUE_FAILED',
      'report_saved',true,'report_version',v_lesson.report_version);
  end;

  if v_delivery_id is null then
    return jsonb_build_object('success',false,'error_code','EMAIL_ENQUEUE_FAILED',
      'report_saved',true,'report_version',v_lesson.report_version);
  end if;

  update public.student_lessons set report_email_sent_at=now(),updated_at=now()
  where id=v_lesson.id returning * into v_lesson;

  v_action := case when p_resend then 'lesson.report_email_manually_resent' else 'lesson.report_email_manually_sent' end;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),v_action,'student_lesson',v_lesson.id::text,jsonb_build_object(
    'lesson_id',v_lesson.id,'student_id',v_lesson.student_user_id,
    'remaining_lessons',v_remaining,'report_version',v_lesson.report_version,
    'report_length',char_length(v_report),'notification_delivery_id',v_delivery_id));

  return jsonb_build_object('success',true,'suppressed',false,'report_saved',true,
    'lesson_id',v_lesson.id,'report_version',v_lesson.report_version,
    'notification_delivery_id',v_delivery_id,'status','pending','remaining_lessons',v_remaining);
end;
$fn$;

revoke all on function public.admin_save_and_send_lesson_report(uuid,text,boolean) from public,anon;
grant execute on function public.admin_save_and_send_lesson_report(uuid,text,boolean) to authenticated,service_role;

-- Retire the legacy manual function so there is only one canonical MAIL-027 entry point.
revoke all on function public.admin_send_lesson_completed_email(uuid) from public,anon,authenticated;
grant execute on function public.admin_send_lesson_completed_email(uuid) to service_role;

-- Cancel only unsent legacy MAIL-040 rows; sent and failed history is preserved.
update public.notification_deliveries
set status='cancelled',last_error_code='TEMPLATE_DECOMMISSIONED',
    last_error='MAIL-040 retired: lesson reports are now sent manually with MAIL-027.',updated_at=now()
where event_type='lesson.remaining_rights'
  and template='lesson_remaining_rights_account_holder'
  and status in ('pending','queued');
