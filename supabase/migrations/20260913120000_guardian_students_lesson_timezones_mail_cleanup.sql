-- September customer revisions: guardian-managed learners, canonical lesson
-- timezones and authoritative MAIL-027 / MAIL-041 payloads.

alter table public.student_lessons
  add column if not exists lesson_timezone text,
  add column if not exists lesson_timezone_label text;

update public.student_lessons
set lesson_timezone = 'Europe/Istanbul', lesson_timezone_label = 'TR'
where lesson_timezone is null or lesson_timezone_label is null;

alter table public.student_lessons
  alter column lesson_timezone set default 'Europe/Istanbul',
  alter column lesson_timezone_label set default 'TR',
  alter column lesson_timezone set not null,
  alter column lesson_timezone_label set not null;

alter table public.student_lessons drop constraint if exists student_lessons_timezone_pair_check;
alter table public.student_lessons add constraint student_lessons_timezone_pair_check check (
  (lesson_timezone_label = 'TR' and lesson_timezone = 'Europe/Istanbul') or
  (lesson_timezone_label = 'UK' and lesson_timezone = 'Europe/London') or
  (lesson_timezone_label = 'NL' and lesson_timezone = 'Europe/Amsterdam') or
  (lesson_timezone_label = 'DE' and lesson_timezone = 'Europe/Berlin') or
  (lesson_timezone_label = 'US-ET' and lesson_timezone = 'America/New_York') or
  (lesson_timezone_label = 'US-CT' and lesson_timezone = 'America/Chicago') or
  (lesson_timezone_label = 'US-MT' and lesson_timezone = 'America/Denver') or
  (lesson_timezone_label = 'US-PT' and lesson_timezone = 'America/Los_Angeles')
);

comment on column public.student_lessons.lesson_timezone is 'Canonical IANA timezone used to interpret and display the lesson wall-clock time.';
comment on column public.student_lessons.lesson_timezone_label is 'Customer-facing timezone code (TR, UK, NL, DE, US-ET, US-CT, US-MT, US-PT).';

-- Replace the previous canonical signatures rather than leaving ambiguous
-- overloads. Default values on the new trailing parameters keep old callers
-- compatible while ensuring every new row receives TR metadata.
drop function if exists public.admin_upsert_student_lesson(uuid,uuid,uuid,text,text,text,timestamptz,integer,text,text,text);
drop function if exists public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text);

create or replace function public.admin_create_or_link_student_for_guardian(
  p_guardian_user_id uuid,
  p_student_full_name text,
  p_relationship_role text default 'parent',
  p_existing_student_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_guardian public.guardian_accounts%rowtype;
  v_student public.student_profiles%rowtype;
  v_name text := regexp_replace(btrim(coalesce(p_student_full_name, '')), '\s+', ' ', 'g');
  v_is_primary boolean;
  v_created boolean := false;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if char_length(v_name) not between 2 and 100 then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_STUDENT_NAME');
  end if;
  if p_relationship_role not in ('parent', 'guardian', 'self', 'other') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_RELATIONSHIP_ROLE');
  end if;

  select * into v_guardian from public.guardian_accounts
  where user_id = p_guardian_user_id and active for update;
  if v_guardian.user_id is null then
    return jsonb_build_object('success', false, 'error_code', 'GUARDIAN_NOT_FOUND');
  end if;

  v_is_primary := not exists (
    select 1 from public.guardian_students
    where guardian_user_id = p_guardian_user_id and active
  );

  if p_existing_student_id is null then
    insert into public.student_profiles(
      id, full_name, email, preferred_language, active, migration_source
    ) values (
      gen_random_uuid(), v_name, lower(v_guardian.email),
      coalesce(v_guardian.preferred_language, 'tr'), true, 'admin_created_under_guardian_v1'
    ) returning * into v_student;
    v_created := true;
  else
    select * into v_student from public.student_profiles
    where id = p_existing_student_id and active for update;
    if v_student.id is null then
      return jsonb_build_object('success', false, 'error_code', 'STUDENT_NOT_FOUND');
    end if;
    if v_student.full_name is distinct from v_name then
      return jsonb_build_object('success', false, 'error_code', 'STUDENT_NAME_MISMATCH');
    end if;
  end if;

  insert into public.guardian_students(
    guardian_user_id, student_id, relationship_role, is_primary, active, source
  ) values (
    p_guardian_user_id, v_student.id, p_relationship_role, v_is_primary, true, 'admin_guardian_link_v1'
  ) on conflict (guardian_user_id, student_id) do update set
    relationship_role = excluded.relationship_role,
    active = true,
    updated_at = now();

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    case when v_created then 'student.created_under_guardian' else 'guardian.student_linked' end,
    'student_profile', v_student.id::text,
    jsonb_build_object('student_id', v_student.id, 'guardian_user_id', p_guardian_user_id,
      'relationship_role', p_relationship_role, 'created', v_created)
  );

  return jsonb_build_object('success', true, 'student_id', v_student.id,
    'guardian_user_id', p_guardian_user_id, 'created', v_created);
end;
$fn$;

revoke all on function public.admin_create_or_link_student_for_guardian(uuid,text,text,uuid) from public, anon;
grant execute on function public.admin_create_or_link_student_for_guardian(uuid,text,text,uuid) to authenticated, service_role;

create or replace function public.admin_upsert_student_lesson(
  p_student_id uuid,
  p_lesson_id uuid default null,
  p_package_purchase_id uuid default null,
  p_title text default 'Birebir Canlı Ders',
  p_subject text default 'Akademik Danışmanlık',
  p_exam_code text default null,
  p_lesson_date timestamptz default now(),
  p_duration_minutes integer default 60,
  p_live_meeting_url text default null,
  p_teacher_note text default null,
  p_status text default 'scheduled',
  p_lesson_timezone text default 'Europe/Istanbul',
  p_lesson_timezone_label text default 'TR'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_lesson_id uuid; v_action text; v_url text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if nullif(btrim(p_title), '') is null or nullif(btrim(p_subject), '') is null then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_TITLE_OR_SUBJECT');
  end if;
  if p_duration_minutes not between 1 and 600 then return jsonb_build_object('success', false, 'error_code', 'INVALID_DURATION'); end if;
  if p_status not in ('scheduled','completed','cancelled','no_show') then return jsonb_build_object('success', false, 'error_code', 'INVALID_STATUS'); end if;
  if not (
    (p_lesson_timezone_label = 'TR' and p_lesson_timezone = 'Europe/Istanbul') or
    (p_lesson_timezone_label = 'UK' and p_lesson_timezone = 'Europe/London') or
    (p_lesson_timezone_label = 'NL' and p_lesson_timezone = 'Europe/Amsterdam') or
    (p_lesson_timezone_label = 'DE' and p_lesson_timezone = 'Europe/Berlin') or
    (p_lesson_timezone_label = 'US-ET' and p_lesson_timezone = 'America/New_York') or
    (p_lesson_timezone_label = 'US-CT' and p_lesson_timezone = 'America/Chicago') or
    (p_lesson_timezone_label = 'US-MT' and p_lesson_timezone = 'America/Denver') or
    (p_lesson_timezone_label = 'US-PT' and p_lesson_timezone = 'America/Los_Angeles')
  ) then return jsonb_build_object('success', false, 'error_code', 'INVALID_LESSON_TIMEZONE'); end if;
  v_url := nullif(btrim(p_live_meeting_url), '');
  if v_url is not null and v_url !~* '^https?://' then return jsonb_build_object('success', false, 'error_code', 'INVALID_URL_SCHEME'); end if;
  if not exists(select 1 from public.student_profiles where id = p_student_id) then return jsonb_build_object('success', false, 'error_code', 'STUDENT_NOT_FOUND'); end if;
  if p_package_purchase_id is not null and not exists(select 1 from public.student_package_purchases where id=p_package_purchase_id and student_user_id=p_student_id) then
    return jsonb_build_object('success', false, 'error_code', 'PACKAGE_NOT_FOUND');
  end if;
  if p_package_purchase_id is not null and p_status='scheduled' and not exists(
    select 1 from public.student_package_purchases where id=p_package_purchase_id and student_user_id=p_student_id and status='active' and lesson_count>lessons_used
  ) then return jsonb_build_object('success', false, 'error_code', 'PACKAGE_INACTIVE_OR_EXHAUSTED'); end if;

  begin
    if p_lesson_id is not null then
      update public.student_lessons set package_purchase_id=p_package_purchase_id,
        title=left(btrim(p_title),160), subject=left(btrim(p_subject),160), exam_code=left(nullif(btrim(p_exam_code),''),80),
        lesson_date=p_lesson_date, lesson_timezone=p_lesson_timezone, lesson_timezone_label=p_lesson_timezone_label,
        duration_minutes=p_duration_minutes, live_meeting_url=v_url, teacher_note=nullif(btrim(p_teacher_note),''), status=p_status,
        completed_at=case when p_status='completed' and completed_at is null then now() else completed_at end
      where id=p_lesson_id and student_user_id=p_student_id returning id into v_lesson_id;
      if v_lesson_id is null then return jsonb_build_object('success', false, 'error_code', 'LESSON_NOT_FOUND'); end if;
      v_action := 'lesson.updated';
    else
      insert into public.student_lessons(student_user_id,package_purchase_id,title,subject,exam_code,lesson_date,
        lesson_timezone,lesson_timezone_label,duration_minutes,live_meeting_url,teacher_note,status,completed_at)
      values(p_student_id,p_package_purchase_id,left(btrim(p_title),160),left(btrim(p_subject),160),left(nullif(btrim(p_exam_code),''),80),p_lesson_date,
        p_lesson_timezone,p_lesson_timezone_label,p_duration_minutes,v_url,nullif(btrim(p_teacher_note),''),p_status,
        case when p_status='completed' then now() else null end) returning id into v_lesson_id;
      v_action := 'lesson.created';
    end if;
  exception when exclusion_violation then return jsonb_build_object('success', false, 'error_code', 'LESSON_TIME_OVERLAP'); end;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),v_action,'student_lesson',v_lesson_id::text,jsonb_build_object(
    'student_user_id',p_student_id,'lesson_date',p_lesson_date,'lesson_timezone',p_lesson_timezone,
    'lesson_timezone_label',p_lesson_timezone_label,'has_meeting_url',v_url is not null,'status',p_status));
  return jsonb_build_object('success',true,'lesson_id',v_lesson_id,'action',v_action);
end;
$fn$;

revoke all on function public.admin_upsert_student_lesson(uuid,uuid,uuid,text,text,text,timestamptz,integer,text,text,text,text,text) from public,anon;
grant execute on function public.admin_upsert_student_lesson(uuid,uuid,uuid,text,text,text,timestamptz,integer,text,text,text,text,text) to authenticated,service_role;

-- Add timezone parameters to past-lesson creation while preserving the exact
-- canonical deduction, ledger and idempotency sequence.
create or replace function public.admin_record_completed_lesson(
  p_student_id uuid, p_lesson_date timestamptz, p_duration_minutes integer,
  p_title text, p_subject text, p_teacher_note text default null,
  p_package_purchase_id uuid default null, p_existing_lesson_id uuid default null,
  p_completion_source text default 'past', p_idempotency_key text default null,
  p_lesson_timezone text default 'Europe/Istanbul', p_lesson_timezone_label text default 'TR'
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  v_lesson public.student_lessons%rowtype; v_purchase public.student_package_purchases%rowtype;
  v_key text; v_ledger_id uuid; v_previous_remaining integer; v_remaining integer;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.student_profiles where id=p_student_id and active) then return jsonb_build_object('success',false,'error_code','LEARNER_NOT_FOUND'); end if;
  if p_duration_minutes not between 1 and 600 then return jsonb_build_object('success',false,'error_code','INVALID_DURATION'); end if;
  if char_length(btrim(coalesce(p_title,''))) not between 1 and 160 or char_length(btrim(coalesce(p_subject,''))) not between 1 and 160 then return jsonb_build_object('success',false,'error_code','INVALID_LESSON_DETAILS'); end if;
  if p_completion_source not in ('scheduled','past') then return jsonb_build_object('success',false,'error_code','INVALID_COMPLETION_SOURCE'); end if;
  if not (
    (p_lesson_timezone_label='TR' and p_lesson_timezone='Europe/Istanbul') or (p_lesson_timezone_label='UK' and p_lesson_timezone='Europe/London') or
    (p_lesson_timezone_label='NL' and p_lesson_timezone='Europe/Amsterdam') or (p_lesson_timezone_label='DE' and p_lesson_timezone='Europe/Berlin') or
    (p_lesson_timezone_label='US-ET' and p_lesson_timezone='America/New_York') or (p_lesson_timezone_label='US-CT' and p_lesson_timezone='America/Chicago') or
    (p_lesson_timezone_label='US-MT' and p_lesson_timezone='America/Denver') or (p_lesson_timezone_label='US-PT' and p_lesson_timezone='America/Los_Angeles')
  ) then return jsonb_build_object('success',false,'error_code','INVALID_LESSON_TIMEZONE'); end if;
  v_key := case when p_existing_lesson_id is not null then 'scheduled:'||p_existing_lesson_id else nullif(btrim(p_idempotency_key),'') end;
  if v_key is null then return jsonb_build_object('success',false,'error_code','IDEMPOTENCY_KEY_REQUIRED'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_key,0));
  if p_existing_lesson_id is not null then
    select * into v_lesson from public.student_lessons where id=p_existing_lesson_id for update;
    if v_lesson.id is null then return jsonb_build_object('success',false,'error_code','LESSON_NOT_FOUND'); end if;
    if v_lesson.student_user_id<>p_student_id then return jsonb_build_object('success',false,'error_code','LEARNER_MISMATCH'); end if;
    if v_lesson.status='completed' then
      select * into v_purchase from public.student_package_purchases where id=v_lesson.package_purchase_id;
      return jsonb_build_object('success',true,'already_completed',true,'lesson_id',v_lesson.id,'package_purchase_id',v_purchase.id,'used',v_purchase.lessons_used,'remaining',greatest(0,v_purchase.lesson_count-v_purchase.lessons_used),'total',v_purchase.lesson_count);
    end if;
  end if;
  if p_package_purchase_id is not null then
    select * into v_purchase from public.student_package_purchases where id=p_package_purchase_id and student_user_id=p_student_id and status='active' for update;
  else
    select * into v_purchase from public.student_package_purchases where student_user_id=p_student_id and status='active' and lesson_count>lessons_used order by created_at asc,id asc for update limit 1;
  end if;
  if v_purchase.id is null then return jsonb_build_object('success',false,'error_code','NO_ACTIVE_PACKAGE'); end if;
  v_previous_remaining := v_purchase.lesson_count-v_purchase.lessons_used;
  if v_previous_remaining<=0 then return jsonb_build_object('success',false,'error_code','NO_LESSON_RIGHT'); end if;
  update public.student_package_purchases set lessons_used=lessons_used+1,status=case when lessons_used+1>=lesson_count then 'completed' else 'active' end,updated_at=now() where id=v_purchase.id returning * into v_purchase;
  v_remaining := greatest(0,v_purchase.lesson_count-v_purchase.lessons_used);
  perform set_config('oriens.completing_lesson','true',true);
  if p_existing_lesson_id is not null then
    update public.student_lessons set status='completed',package_purchase_id=v_purchase.id,teacher_note=coalesce(nullif(btrim(p_teacher_note),''),teacher_note),
      completion_key=v_key,completion_source='scheduled',completion_previous_remaining=v_previous_remaining,updated_at=now()
    where id=p_existing_lesson_id returning * into v_lesson;
  else
    insert into public.student_lessons(student_user_id,package_purchase_id,title,subject,lesson_date,lesson_timezone,lesson_timezone_label,duration_minutes,status,teacher_note,completion_key,completion_source,completion_previous_remaining)
    values(p_student_id,v_purchase.id,left(btrim(p_title),160),left(btrim(p_subject),160),p_lesson_date,p_lesson_timezone,p_lesson_timezone_label,p_duration_minutes,'completed',left(nullif(btrim(p_teacher_note),''),2000),v_key,'past',v_previous_remaining) returning * into v_lesson;
  end if;
  insert into public.student_package_adjustments(student_user_id,package_purchase_id,adjustment_type,lesson_delta,price_amount,currency,payment_status,notes,created_by,linked_lesson_id)
  values(p_student_id,v_purchase.id,case when p_completion_source='past' then 'past_lesson_added' else 'lesson_completed' end,-1,null,v_purchase.currency,'waived',nullif(btrim(p_teacher_note),''),auth.uid(),v_lesson.id) returning id into v_ledger_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'lesson.completed','student_lesson',v_lesson.id::text,jsonb_build_object('student_id',p_student_id,'package_purchase_id',v_purchase.id,'ledger_id',v_ledger_id,'completion_source',p_completion_source,'previous_remaining',v_previous_remaining,'used',v_purchase.lessons_used,'remaining',v_remaining,'idempotency_key',v_key,'lesson_timezone',v_lesson.lesson_timezone,'lesson_timezone_label',v_lesson.lesson_timezone_label));
  return jsonb_build_object('success',true,'already_completed',false,'lesson_id',v_lesson.id,'package_purchase_id',v_purchase.id,'used',v_purchase.lessons_used,'remaining',v_remaining,'total',v_purchase.lesson_count,'ledger_id',v_ledger_id);
end;
$fn$;

revoke all on function public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text,text,text) to authenticated,service_role;

create or replace function public.admin_save_and_send_lesson_report(
  p_lesson_id uuid, p_report text, p_resend boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  v_lesson public.student_lessons%rowtype; v_report text:=btrim(coalesce(p_report,'')); v_holder record;
  v_student_name text; v_remaining integer; v_delivery_id uuid; v_existing_delivery public.notification_deliveries%rowtype;
  v_dedupe_key text; v_action text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('lesson_report:'||p_lesson_id::text,0));
  select * into v_lesson from public.student_lessons where id=p_lesson_id for update;
  if v_lesson.id is null then return jsonb_build_object('success',false,'error_code','LESSON_NOT_FOUND','report_saved',false); end if;
  if v_lesson.status<>'completed' then return jsonb_build_object('success',false,'error_code','LESSON_NOT_COMPLETED','report_saved',false); end if;
  if char_length(v_report)<5 then return jsonb_build_object('success',false,'error_code','REPORT_REQUIRED','report_saved',false); end if;
  if char_length(v_report)>10000 then return jsonb_build_object('success',false,'error_code','REPORT_TOO_LONG','report_saved',false); end if;
  if v_lesson.completion_report is distinct from v_report then
    update public.student_lessons set completion_report=v_report,report_updated_at=now(),report_author_id=auth.uid(),report_version=report_version+1,updated_at=now() where id=p_lesson_id returning * into v_lesson;
    insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(auth.uid(),'lesson.report_saved','student_lesson',v_lesson.id::text,jsonb_build_object('lesson_id',v_lesson.id,'student_id',v_lesson.student_user_id,'report_version',v_lesson.report_version,'report_length',char_length(v_report)));
  end if;
  select ga.user_id,ga.email,ga.full_name,ga.preferred_language,gs.relationship_role into v_holder
  from public.guardian_students gs join public.guardian_accounts ga on ga.user_id=gs.guardian_user_id
  where gs.student_id=v_lesson.student_user_id and gs.active and ga.active and ga.email_verified_at is not null and nullif(btrim(ga.email),'') is not null
  order by gs.is_primary desc,gs.created_at asc limit 1;
  if v_holder.email is null then return jsonb_build_object('success',false,'error_code','NO_VERIFIED_ACCOUNT_HOLDER','report_saved',true,'report_version',v_lesson.report_version); end if;
  select nullif(btrim(full_name),'') into v_student_name from public.student_profiles where id=v_lesson.student_user_id;
  v_remaining := public.calculate_student_usable_remaining_lessons(v_lesson.student_user_id);
  v_dedupe_key := 'lesson_report:'||v_lesson.id::text||':v'||v_lesson.report_version::text;
  select * into v_existing_delivery from public.notification_deliveries where dedupe_key=v_dedupe_key limit 1;
  if v_existing_delivery.id is not null then return jsonb_build_object('success',true,'suppressed',true,'report_saved',true,'lesson_id',v_lesson.id,'report_version',v_lesson.report_version,'notification_delivery_id',v_existing_delivery.id,'status',v_existing_delivery.status,'remaining_lessons',v_remaining); end if;
  begin
    v_delivery_id := public.enqueue_email_notification('lesson.report_email','student_lesson',v_lesson.id::text,v_holder.email,'lesson_completed_account_holder',jsonb_build_object(
      'lesson_id',v_lesson.id,'student_id',v_lesson.student_user_id,'student_name',v_student_name,
      'account_holder_id',v_holder.user_id,'account_holder_name',v_holder.full_name,'guardian_name',v_holder.full_name,
      'recipient_email',lower(btrim(v_holder.email)),'relationship_role',coalesce(v_holder.relationship_role,'other'),
      'lesson_title',v_lesson.title,'subject',v_lesson.subject,'lesson_date',v_lesson.lesson_date,
      'lesson_timezone',v_lesson.lesson_timezone,'lesson_timezone_label',v_lesson.lesson_timezone_label,
      'duration_minutes',v_lesson.duration_minutes,'completion_report',v_report,'total_remaining_lessons',v_remaining,
      'locale',coalesce(v_holder.preferred_language,'tr'),'report_version',v_lesson.report_version
    ),v_dedupe_key,now());
  exception when others then return jsonb_build_object('success',false,'error_code','EMAIL_ENQUEUE_FAILED','report_saved',true,'report_version',v_lesson.report_version); end;
  if v_delivery_id is null then return jsonb_build_object('success',false,'error_code','EMAIL_ENQUEUE_FAILED','report_saved',true,'report_version',v_lesson.report_version); end if;
  update public.student_lessons set report_email_sent_at=now(),updated_at=now() where id=v_lesson.id returning * into v_lesson;
  v_action := case when p_resend then 'lesson.report_email_manually_resent' else 'lesson.report_email_manually_sent' end;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(auth.uid(),v_action,'student_lesson',v_lesson.id::text,jsonb_build_object('lesson_id',v_lesson.id,'student_id',v_lesson.student_user_id,'remaining_lessons',v_remaining,'report_version',v_lesson.report_version,'report_length',char_length(v_report),'notification_delivery_id',v_delivery_id));
  return jsonb_build_object('success',true,'suppressed',false,'report_saved',true,'lesson_id',v_lesson.id,'report_version',v_lesson.report_version,'notification_delivery_id',v_delivery_id,'status','pending','remaining_lessons',v_remaining);
end;
$fn$;

revoke all on function public.admin_save_and_send_lesson_report(uuid,text,boolean) from public,anon;
grant execute on function public.admin_save_and_send_lesson_report(uuid,text,boolean) to authenticated,service_role;

create or replace function public.admin_send_package_notification(p_purchase_id uuid,p_kind text default 'package_assigned')
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  v_purchase public.student_package_purchases%rowtype; v_holder record; v_student_name text; v_package_name text;
  v_remaining integer; v_total_remaining integer; v_sends integer; v_action text; v_template text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_kind not in ('package_assigned','lesson_rights') then return jsonb_build_object('success',false,'error_code','INVALID_KIND'); end if;
  v_action:='package.'||p_kind||'_email_manually_sent'; v_template:=case when p_kind='package_assigned' then 'package_assigned_manual' else 'lesson_rights_manual' end;
  select * into v_purchase from public.student_package_purchases where id=p_purchase_id;
  if v_purchase.id is null then return jsonb_build_object('success',false,'error_code','PACKAGE_NOT_FOUND'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_template||':'||p_purchase_id::text,0));
  if exists(select 1 from public.audit_logs where action=v_action and entity_id=p_purchase_id::text and created_at>now()-interval '60 seconds') then return jsonb_build_object('success',true,'suppressed',true,'error_code','DUPLICATE_SUPPRESSED'); end if;
  select ga.user_id,ga.email,ga.full_name,ga.preferred_language into v_holder from public.guardian_students gs join public.guardian_accounts ga on ga.user_id=gs.guardian_user_id
  where gs.student_id=v_purchase.student_user_id and gs.active and ga.active and ga.email_verified_at is not null order by gs.is_primary desc,gs.created_at asc limit 1;
  if v_holder.email is null then return jsonb_build_object('success',false,'error_code','NO_VERIFIED_ACCOUNT_HOLDER'); end if;
  select nullif(btrim(full_name),'') into v_student_name from public.student_profiles where id=v_purchase.student_user_id;
  select case when v_holder.preferred_language='en' then name_en else name_tr end into v_package_name from public.pricing_packages where id=v_purchase.package_id;
  v_package_name:=coalesce(nullif(btrim(v_purchase.custom_package_name),''),v_package_name,nullif(v_purchase.package_id,'custom'));
  if v_package_name is null or lower(btrim(v_package_name)) in ('custom','özel paket','custom package') or btrim(v_package_name)~'^[0-9]+$' then
    v_package_name:=case when v_holder.preferred_language='en' then v_purchase.lesson_count::text||'-Lesson Package' else v_purchase.lesson_count::text||' Derslik Paket' end;
  end if;
  v_remaining:=greatest(0,v_purchase.lesson_count-v_purchase.lessons_used); v_total_remaining:=public.calculate_student_usable_remaining_lessons(v_purchase.student_user_id);
  select count(*) into v_sends from public.audit_logs where action=v_action and entity_id=p_purchase_id::text;
  perform public.enqueue_email_notification('package.'||p_kind||'.manual','student_package_purchase',v_purchase.id::text,v_holder.email,v_template,jsonb_build_object(
    'purchase_id',v_purchase.id,'account_holder_name',v_holder.full_name,'guardian_name',v_holder.full_name,
    'learner_name',v_student_name,'student_name',v_student_name,'package_name',v_package_name,'lesson_count',v_purchase.lesson_count,
    'lessons_used',v_purchase.lessons_used,'remaining_lessons',v_remaining,'total_remaining_lessons',v_total_remaining,
    'start_date',v_purchase.start_date,'end_date',v_purchase.end_date,'locale',coalesce(v_holder.preferred_language,'tr')
  ),v_template||':'||v_purchase.id::text||case when v_sends>0 then ':resend'||v_sends::text else '' end,now());
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(auth.uid(),v_action,'student_package_purchase',v_purchase.id::text,jsonb_build_object('resend_index',v_sends,'remaining',v_remaining,'package_name',v_package_name,'student_id',v_purchase.student_user_id));
  return jsonb_build_object('success',true,'suppressed',false,'resend_index',v_sends,'remaining',v_remaining,'total_remaining',v_total_remaining,'package_name',v_package_name);
end;
$fn$;

revoke all on function public.admin_send_package_notification(uuid,text) from public,anon;
grant execute on function public.admin_send_package_notification(uuid,text) to authenticated,service_role;
