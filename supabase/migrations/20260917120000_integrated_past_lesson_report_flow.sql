-- Integrated past-lesson creation: independent course/topic values, one rights
-- mutation, optional initial report, and optional MAIL-027 in one transaction.
-- No historical rows are rewritten by this migration.

create or replace function public.admin_upsert_student_lesson(
  p_student_id uuid,p_lesson_id uuid default null,p_package_purchase_id uuid default null,
  p_title text default 'Birebir Ders',p_subject text default 'Birebir Ders',p_exam_code text default null,
  p_lesson_date timestamptz default now(),p_duration_minutes integer default 60,
  p_live_meeting_url text default null,p_teacher_note text default null,p_status text default 'scheduled',
  p_lesson_timezone text default 'Europe/Istanbul',p_lesson_timezone_label text default 'TR',
  p_topic_id uuid default null,p_instructor_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  v_lesson_id uuid;
  v_title text:=left(btrim(coalesce(p_title,'')),160);
  v_subject text:=left(btrim(coalesce(p_subject,'')),160);
  v_topic_label text;
  v_url text:=nullif(btrim(p_live_meeting_url),'');
  v_action text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_duration_minutes not between 1 and 600 or p_status not in ('scheduled','cancelled','no_show') then return jsonb_build_object('success',false,'error_code','INVALID_INPUT'); end if;
  if not (
    (p_lesson_timezone_label='TR' and p_lesson_timezone='Europe/Istanbul') or (p_lesson_timezone_label='UK' and p_lesson_timezone='Europe/London') or
    (p_lesson_timezone_label='NL' and p_lesson_timezone='Europe/Amsterdam') or (p_lesson_timezone_label='DE' and p_lesson_timezone='Europe/Berlin') or
    (p_lesson_timezone_label='US-ET' and p_lesson_timezone='America/New_York') or (p_lesson_timezone_label='US-CT' and p_lesson_timezone='America/Chicago') or
    (p_lesson_timezone_label='US-MT' and p_lesson_timezone='America/Denver') or (p_lesson_timezone_label='US-PT' and p_lesson_timezone='America/Los_Angeles')
  ) then return jsonb_build_object('success',false,'error_code','INVALID_LESSON_TIMEZONE'); end if;
  if p_topic_id is not null then
    select label into v_topic_label from public.lesson_topics where id=p_topic_id and (active or p_lesson_id is not null);
    if v_topic_label is null then return jsonb_build_object('success',false,'error_code','TOPIC_UNAVAILABLE'); end if;
    v_title:=left(v_topic_label,160);
  end if;
  if nullif(v_title,'') is null then return jsonb_build_object('success',false,'error_code','TITLE_REQUIRED'); end if;
  if nullif(v_subject,'') is null then return jsonb_build_object('success',false,'error_code','SUBJECT_REQUIRED'); end if;
  if p_instructor_id is not null and not exists(select 1 from public.instructors where id=p_instructor_id and (active or p_lesson_id is not null)) then return jsonb_build_object('success',false,'error_code','INSTRUCTOR_UNAVAILABLE'); end if;
  if v_url is not null and v_url !~* '^https?://' then return jsonb_build_object('success',false,'error_code','INVALID_URL_SCHEME'); end if;
  if not exists(select 1 from public.student_profiles where id=p_student_id) then return jsonb_build_object('success',false,'error_code','STUDENT_NOT_FOUND'); end if;
  if p_package_purchase_id is not null and not exists(select 1 from public.student_package_purchases where id=p_package_purchase_id and student_user_id=p_student_id and (p_lesson_id is not null or (status='active' and lesson_count>lessons_used))) then return jsonb_build_object('success',false,'error_code','PACKAGE_INACTIVE_OR_EXHAUSTED'); end if;
  begin
    if p_lesson_id is null then
      insert into public.student_lessons(student_user_id,package_purchase_id,title,subject,exam_code,lesson_date,lesson_timezone,lesson_timezone_label,duration_minutes,live_meeting_url,teacher_note,status,topic_id,instructor_id)
      values(p_student_id,p_package_purchase_id,v_title,v_subject,left(nullif(btrim(p_exam_code),''),80),p_lesson_date,p_lesson_timezone,p_lesson_timezone_label,p_duration_minutes,v_url,nullif(btrim(p_teacher_note),''),p_status,p_topic_id,p_instructor_id) returning id into v_lesson_id;
      v_action:='lesson.created';
    else
      update public.student_lessons set package_purchase_id=p_package_purchase_id,title=v_title,subject=v_subject,exam_code=left(nullif(btrim(p_exam_code),''),80),lesson_date=p_lesson_date,lesson_timezone=p_lesson_timezone,lesson_timezone_label=p_lesson_timezone_label,duration_minutes=p_duration_minutes,live_meeting_url=v_url,teacher_note=nullif(btrim(p_teacher_note),''),status=p_status,topic_id=p_topic_id,instructor_id=p_instructor_id,updated_at=now()
      where id=p_lesson_id and student_user_id=p_student_id and status<>'completed' returning id into v_lesson_id;
      v_action:='lesson.updated';
    end if;
  exception when exclusion_violation then return jsonb_build_object('success',false,'error_code','LESSON_TIME_OVERLAP'); end;
  if v_lesson_id is null then return jsonb_build_object('success',false,'error_code','LESSON_NOT_FOUND'); end if;
  perform public.write_audit_event(v_action,'lesson','info','student_lesson',v_lesson_id::text,null,jsonb_build_object('student_id',p_student_id,'topic_id',p_topic_id,'instructor_id',p_instructor_id,'status',p_status),auth.uid());
  return jsonb_build_object('success',true,'lesson_id',v_lesson_id,'action',v_action);
end;$fn$;

revoke all on function public.admin_upsert_student_lesson(uuid,uuid,uuid,text,text,text,timestamptz,integer,text,text,text,text,text,uuid,uuid) from public,anon;
grant execute on function public.admin_upsert_student_lesson(uuid,uuid,uuid,text,text,text,timestamptz,integer,text,text,text,text,text,uuid,uuid) to authenticated,service_role;

drop function if exists public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text,text,text,uuid,uuid,boolean);
create function public.admin_record_completed_lesson(
  p_student_id uuid,p_lesson_date timestamptz,p_duration_minutes integer,p_title text,p_subject text,
  p_teacher_note text default null,p_package_purchase_id uuid default null,p_existing_lesson_id uuid default null,
  p_completion_source text default 'past',p_idempotency_key text default null,p_lesson_timezone text default 'Europe/Istanbul',
  p_lesson_timezone_label text default 'TR',p_topic_id uuid default null,p_instructor_id uuid default null,
  p_send_email boolean default false,p_completion_report text default null,p_send_report_email boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  v_lesson public.student_lessons%rowtype;
  v_purchase public.student_package_purchases%rowtype;
  v_key text; v_ledger_id uuid; v_prev integer; v_remaining integer;
  v_title text:=left(btrim(coalesce(p_title,'')),160);
  v_subject text:=left(btrim(coalesce(p_subject,'')),160);
  v_report text:=nullif(btrim(coalesce(p_completion_report,'')),'');
  v_topic_label text; v_holder record; v_student_name text; v_instructor text; v_delivery uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.student_profiles where id=p_student_id and active) then return jsonb_build_object('success',false,'error_code','LEARNER_NOT_FOUND'); end if;
  if p_duration_minutes not between 1 and 600 or p_completion_source not in ('scheduled','past') then return jsonb_build_object('success',false,'error_code','INVALID_INPUT'); end if;
  if not (
    (p_lesson_timezone_label='TR' and p_lesson_timezone='Europe/Istanbul') or (p_lesson_timezone_label='UK' and p_lesson_timezone='Europe/London') or
    (p_lesson_timezone_label='NL' and p_lesson_timezone='Europe/Amsterdam') or (p_lesson_timezone_label='DE' and p_lesson_timezone='Europe/Berlin') or
    (p_lesson_timezone_label='US-ET' and p_lesson_timezone='America/New_York') or (p_lesson_timezone_label='US-CT' and p_lesson_timezone='America/Chicago') or
    (p_lesson_timezone_label='US-MT' and p_lesson_timezone='America/Denver') or (p_lesson_timezone_label='US-PT' and p_lesson_timezone='America/Los_Angeles')
  ) then return jsonb_build_object('success',false,'error_code','INVALID_LESSON_TIMEZONE'); end if;
  if p_completion_source='past' and p_lesson_date>now()+interval '5 minutes' then return jsonb_build_object('success',false,'error_code','PAST_LESSON_IN_FUTURE'); end if;
  if p_topic_id is not null then
    select label into v_topic_label from public.lesson_topics where id=p_topic_id and active;
    if v_topic_label is null then return jsonb_build_object('success',false,'error_code','TOPIC_UNAVAILABLE'); end if;
    v_title:=left(v_topic_label,160);
  end if;
  if nullif(v_title,'') is null then return jsonb_build_object('success',false,'error_code','TITLE_REQUIRED'); end if;
  if nullif(v_subject,'') is null then return jsonb_build_object('success',false,'error_code','SUBJECT_REQUIRED'); end if;
  if v_report is not null and char_length(v_report)<5 then return jsonb_build_object('success',false,'error_code','REPORT_REQUIRED'); end if;
  if v_report is not null and char_length(v_report)>10000 then return jsonb_build_object('success',false,'error_code','REPORT_TOO_LONG'); end if;
  if p_send_report_email and v_report is null then return jsonb_build_object('success',false,'error_code','REPORT_REQUIRED_FOR_EMAIL'); end if;
  if p_instructor_id is not null and not exists(select 1 from public.instructors where id=p_instructor_id and active) then return jsonb_build_object('success',false,'error_code','INSTRUCTOR_UNAVAILABLE'); end if;

  -- Resolve the MAIL-027 recipient before touching package or lesson state.
  if p_send_report_email then
    select ga.user_id,ga.email,ga.full_name,ga.preferred_language,gs.relationship_role into v_holder
    from public.guardian_students gs join public.guardian_accounts ga on ga.user_id=gs.guardian_user_id
    where gs.student_id=p_student_id and gs.active and ga.active and ga.email_verified_at is not null and nullif(btrim(ga.email),'') is not null
    order by gs.is_primary desc,gs.created_at limit 1;
    if v_holder.email is null then return jsonb_build_object('success',false,'error_code','NO_VERIFIED_ACCOUNT_HOLDER'); end if;
  end if;

  v_key:=case when p_existing_lesson_id is not null then 'scheduled:'||p_existing_lesson_id else nullif(btrim(p_idempotency_key),'') end;
  if v_key is null then return jsonb_build_object('success',false,'error_code','IDEMPOTENCY_KEY_REQUIRED'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_key,0));
  select * into v_lesson from public.student_lessons where completion_key=v_key for update;
  if v_lesson.id is not null then
    select * into v_purchase from public.student_package_purchases where id=v_lesson.package_purchase_id;
    if v_lesson.report_version>0 then select id into v_delivery from public.notification_deliveries where dedupe_key='lesson_report:'||v_lesson.id::text||':v'||v_lesson.report_version::text limit 1; end if;
    return jsonb_build_object('success',true,'already_completed',true,'lesson_id',v_lesson.id,'package_purchase_id',v_purchase.id,'used',v_purchase.lessons_used,'remaining',greatest(0,v_purchase.lesson_count-v_purchase.lessons_used),'total',v_purchase.lesson_count,'report_version',v_lesson.report_version,'notification_delivery_id',v_delivery);
  end if;
  if p_existing_lesson_id is not null then
    select * into v_lesson from public.student_lessons where id=p_existing_lesson_id and student_user_id=p_student_id for update;
    if v_lesson.id is null then return jsonb_build_object('success',false,'error_code','LESSON_NOT_FOUND'); end if;
    if v_lesson.status='completed' then return jsonb_build_object('success',true,'already_completed',true,'lesson_id',v_lesson.id); end if;
  end if;
  if p_package_purchase_id is not null then
    select * into v_purchase from public.student_package_purchases where id=p_package_purchase_id and student_user_id=p_student_id and status='active' and lesson_count>lessons_used for update;
  else
    select * into v_purchase from public.student_package_purchases where student_user_id=p_student_id and status='active' and lesson_count>lessons_used order by created_at,id for update limit 1;
  end if;
  if v_purchase.id is null then return jsonb_build_object('success',false,'error_code','NO_ACTIVE_PACKAGE'); end if;
  v_prev:=v_purchase.lesson_count-v_purchase.lessons_used;
  update public.student_package_purchases set lessons_used=lessons_used+1,status=case when lessons_used+1>=lesson_count then 'completed' else 'active' end,updated_at=now() where id=v_purchase.id returning * into v_purchase;
  v_remaining:=greatest(0,v_purchase.lesson_count-v_purchase.lessons_used);
  perform set_config('oriens.completing_lesson','true',true);
  if p_existing_lesson_id is null then
    insert into public.student_lessons(student_user_id,package_purchase_id,title,subject,lesson_date,lesson_timezone,lesson_timezone_label,duration_minutes,status,teacher_note,completion_key,completion_source,completion_previous_remaining,topic_id,instructor_id,completion_report,report_updated_at,report_author_id,report_version)
    values(p_student_id,v_purchase.id,v_title,v_subject,p_lesson_date,p_lesson_timezone,p_lesson_timezone_label,p_duration_minutes,'completed',left(nullif(btrim(p_teacher_note),''),2000),v_key,'past',v_prev,p_topic_id,p_instructor_id,v_report,case when v_report is null then null else now() end,case when v_report is null then null else auth.uid() end,case when v_report is null then 0 else 1 end) returning * into v_lesson;
  else
    update public.student_lessons set status='completed',package_purchase_id=v_purchase.id,completion_key=v_key,completion_source='scheduled',completion_previous_remaining=v_prev,topic_id=coalesce(p_topic_id,topic_id),instructor_id=coalesce(p_instructor_id,instructor_id),completion_report=coalesce(v_report,completion_report),report_updated_at=case when v_report is null then report_updated_at else now() end,report_author_id=case when v_report is null then report_author_id else auth.uid() end,report_version=case when v_report is null then report_version else 1 end,updated_at=now() where id=p_existing_lesson_id returning * into v_lesson;
  end if;
  insert into public.student_package_adjustments(student_user_id,package_purchase_id,adjustment_type,lesson_delta,price_amount,currency,payment_status,notes,created_by,linked_lesson_id)
  values(p_student_id,v_purchase.id,case when p_completion_source='past' then 'past_lesson_added' else 'lesson_completed' end,-1,null,v_purchase.currency,'waived',nullif(btrim(p_teacher_note),''),auth.uid(),v_lesson.id) returning id into v_ledger_id;
  perform public.write_audit_event(case when p_completion_source='past' then 'lesson.created_past' else 'lesson.completed' end,'lesson','info','student_lesson',v_lesson.id::text,v_key,jsonb_build_object('package_id',v_purchase.id,'remaining_after',v_remaining,'report_included',v_report is not null,'email_requested',p_send_report_email,'instructor_id',p_instructor_id),auth.uid());

  if p_send_report_email then
    select full_name into v_student_name from public.student_profiles where id=p_student_id;
    select name into v_instructor from public.instructors where id=p_instructor_id;
    v_delivery:=public.enqueue_email_notification(
      'lesson.report_email','student_lesson',v_lesson.id::text,v_holder.email,'lesson_completed_account_holder',
      jsonb_strip_nulls(jsonb_build_object('lesson_id',v_lesson.id,'student_id',p_student_id,'student_name',v_student_name,'account_holder_id',v_holder.user_id,'account_holder_name',v_holder.full_name,'recipient_email',lower(btrim(v_holder.email)),'relationship_role',coalesce(v_holder.relationship_role,'other'),'lesson_title',v_lesson.title,'subject',v_lesson.subject,'lesson_date',v_lesson.lesson_date,'lesson_timezone',v_lesson.lesson_timezone,'lesson_timezone_label',v_lesson.lesson_timezone_label,'duration_minutes',v_lesson.duration_minutes,'instructor_name',v_instructor,'completion_report',v_report,'total_remaining_lessons',public.calculate_student_usable_remaining_lessons(p_student_id),'locale',coalesce(v_holder.preferred_language,'tr'),'report_version',v_lesson.report_version)),
      'lesson_report:'||v_lesson.id::text||':v'||v_lesson.report_version::text,now());
    if v_delivery is null then raise exception 'EMAIL_ENQUEUE_FAILED'; end if;
    update public.student_lessons set report_email_sent_at=now(),updated_at=now() where id=v_lesson.id returning * into v_lesson;
    perform public.write_audit_event('lesson.report_email_manually_sent','lesson','info','student_lesson',v_lesson.id::text,'lesson_report:'||v_lesson.id::text||':v'||v_lesson.report_version::text,jsonb_build_object('report_version',v_lesson.report_version,'notification_delivery_id',v_delivery,'remaining_lessons',v_remaining),auth.uid());
  end if;
  return jsonb_build_object('success',true,'already_completed',false,'lesson_id',v_lesson.id,'package_purchase_id',v_purchase.id,'used',v_purchase.lessons_used,'remaining',v_remaining,'total',v_purchase.lesson_count,'ledger_id',v_ledger_id,'report_version',v_lesson.report_version,'notification_delivery_id',v_delivery);
end;$fn$;

revoke all on function public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text,text,text,uuid,uuid,boolean,text,boolean) from public,anon;
grant execute on function public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text,text,text,uuid,uuid,boolean,text,boolean) to authenticated,service_role;

-- V2 keeps the previous edit RPC available to already-open clients while the
-- current UI gains an independent title field.
create function public.admin_update_completed_lesson_v2(
 p_lesson_id uuid,p_topic_id uuid,p_title text,p_subject text,p_lesson_date timestamptz,p_lesson_timezone text,p_lesson_timezone_label text,
 p_duration_minutes integer,p_instructor_id uuid default null,p_package_purchase_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
 v_lesson public.student_lessons%rowtype; v_old public.student_package_purchases%rowtype; v_new public.student_package_purchases%rowtype; v_adj public.student_package_adjustments%rowtype;
 v_title text:=left(btrim(coalesce(p_title,'')),160); v_subject text:=left(btrim(coalesce(p_subject,'')),160); v_topic_label text; v_changed text[]:='{}'; v_package_changed boolean:=false;
begin
 if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_duration_minutes not between 1 and 600 then return jsonb_build_object('success',false,'error_code','INVALID_DURATION'); end if;
 if nullif(v_title,'') is null then return jsonb_build_object('success',false,'error_code','TITLE_REQUIRED'); end if;
 if nullif(v_subject,'') is null then return jsonb_build_object('success',false,'error_code','SUBJECT_REQUIRED'); end if;
 if not (
   (p_lesson_timezone_label='TR' and p_lesson_timezone='Europe/Istanbul') or (p_lesson_timezone_label='UK' and p_lesson_timezone='Europe/London') or
   (p_lesson_timezone_label='NL' and p_lesson_timezone='Europe/Amsterdam') or (p_lesson_timezone_label='DE' and p_lesson_timezone='Europe/Berlin') or
   (p_lesson_timezone_label='US-ET' and p_lesson_timezone='America/New_York') or (p_lesson_timezone_label='US-CT' and p_lesson_timezone='America/Chicago') or
   (p_lesson_timezone_label='US-MT' and p_lesson_timezone='America/Denver') or (p_lesson_timezone_label='US-PT' and p_lesson_timezone='America/Los_Angeles')
 ) then return jsonb_build_object('success',false,'error_code','INVALID_LESSON_TIMEZONE'); end if;
 perform pg_advisory_xact_lock(hashtextextended('completed_lesson_edit:'||p_lesson_id,0));
 select * into v_lesson from public.student_lessons where id=p_lesson_id for update;
 if v_lesson.id is null or v_lesson.status<>'completed' then return jsonb_build_object('success',false,'error_code','COMPLETED_LESSON_NOT_FOUND'); end if;
 select * into v_adj from public.student_package_adjustments where linked_lesson_id=p_lesson_id for update;
 if v_adj.id is null or v_adj.lesson_delta<>-1 or v_adj.adjustment_type not in ('lesson_completed','past_lesson_added') then raise exception 'LESSON_LEDGER_INVARIANT_FAILED'; end if;
 if (select count(*) from public.student_package_adjustments where linked_lesson_id=p_lesson_id)<>1 then raise exception 'LESSON_LEDGER_INVARIANT_FAILED'; end if;
 if p_topic_id is not null then select label into v_topic_label from public.lesson_topics where id=p_topic_id; if v_topic_label is null then return jsonb_build_object('success',false,'error_code','TOPIC_NOT_FOUND'); end if; v_title:=left(v_topic_label,160); end if;
 if p_instructor_id is not null and not exists(select 1 from public.instructors where id=p_instructor_id) then return jsonb_build_object('success',false,'error_code','INSTRUCTOR_NOT_FOUND'); end if;
 if p_package_purchase_id is distinct from v_lesson.package_purchase_id then
   if p_package_purchase_id is null then return jsonb_build_object('success',false,'error_code','PACKAGE_REQUIRED'); end if;
   perform 1 from public.student_package_purchases where id in (v_lesson.package_purchase_id,p_package_purchase_id) order by id::text for update;
   select * into v_old from public.student_package_purchases where id=v_lesson.package_purchase_id;
   select * into v_new from public.student_package_purchases where id=p_package_purchase_id;
   if v_old.id is null or v_new.id is null or v_old.student_user_id<>v_lesson.student_user_id or v_new.student_user_id<>v_lesson.student_user_id or v_old.lessons_used<1 or v_new.lessons_used>=v_new.lesson_count or v_new.status not in ('active','completed') then raise exception 'PACKAGE_TRANSFER_INVARIANT_FAILED'; end if;
   update public.student_package_purchases set lessons_used=lessons_used-1,status=case when status='completed' and lessons_used-1<lesson_count then 'active' else status end,updated_at=now() where id=v_old.id;
   update public.student_package_purchases set lessons_used=lessons_used+1,status=case when lessons_used+1>=lesson_count then 'completed' else 'active' end,updated_at=now() where id=v_new.id;
   update public.student_package_adjustments set package_purchase_id=v_new.id where id=v_adj.id;
   v_package_changed:=true;
 end if;
 if v_lesson.topic_id is distinct from p_topic_id then v_changed:=array_append(v_changed,'topic_id'); end if;
 if v_lesson.title is distinct from v_title then v_changed:=array_append(v_changed,'title'); end if;
 if v_lesson.subject is distinct from v_subject then v_changed:=array_append(v_changed,'subject'); end if;
 if v_lesson.lesson_date is distinct from p_lesson_date then v_changed:=array_append(v_changed,'lesson_date'); end if;
 if v_lesson.lesson_timezone is distinct from p_lesson_timezone then v_changed:=array_append(v_changed,'lesson_timezone'); end if;
 if v_lesson.duration_minutes is distinct from p_duration_minutes then v_changed:=array_append(v_changed,'duration_minutes'); end if;
 if v_lesson.instructor_id is distinct from p_instructor_id then v_changed:=array_append(v_changed,'instructor_id'); end if;
 update public.student_lessons set topic_id=p_topic_id,title=v_title,subject=v_subject,lesson_date=p_lesson_date,lesson_timezone=p_lesson_timezone,lesson_timezone_label=p_lesson_timezone_label,duration_minutes=p_duration_minutes,instructor_id=p_instructor_id,package_purchase_id=coalesce(p_package_purchase_id,package_purchase_id),updated_at=now() where id=p_lesson_id;
 if cardinality(v_changed)>0 then perform public.write_audit_event('lesson.updated','lesson','info','student_lesson',p_lesson_id::text,null,jsonb_build_object('changed_fields',v_changed),auth.uid()); end if;
 if v_package_changed then perform public.write_audit_event('lesson.package_changed','lesson','info','student_lesson',p_lesson_id::text,'lesson_package_transfer:'||p_lesson_id||':'||p_package_purchase_id,jsonb_build_object('old_package_id',v_old.id,'new_package_id',v_new.id,'old_remaining_before',v_old.lesson_count-v_old.lessons_used,'old_remaining_after',v_old.lesson_count-v_old.lessons_used+1,'new_remaining_before',v_new.lesson_count-v_new.lessons_used,'new_remaining_after',v_new.lesson_count-v_new.lessons_used-1),auth.uid()); end if;
 return jsonb_build_object('success',true,'lesson_id',p_lesson_id,'changed_fields',v_changed,'package_changed',v_package_changed);
end;$fn$;

revoke all on function public.admin_update_completed_lesson_v2(uuid,uuid,text,text,timestamptz,text,text,integer,uuid,uuid) from public,anon;
grant execute on function public.admin_update_completed_lesson_v2(uuid,uuid,text,text,timestamptz,text,text,integer,uuid,uuid) to authenticated,service_role;
