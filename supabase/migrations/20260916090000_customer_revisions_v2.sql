-- Customer revisions V2: unified observability, academic profile fields,
-- managed lesson references, and invariant-safe completed lesson editing.

alter table public.audit_logs
  add column if not exists severity text not null default 'info',
  add column if not exists category text not null default 'system',
  add column if not exists correlation_id text;

alter table public.audit_logs drop constraint if exists audit_logs_severity_check;
alter table public.audit_logs add constraint audit_logs_severity_check
  check (severity in ('info','warning','error','critical'));
alter table public.audit_logs drop constraint if exists audit_logs_category_check;
alter table public.audit_logs add constraint audit_logs_category_check
  check (category in ('auth','admin','student','lesson','package','payment','email','blog','contact','database','edge','system'));

create index if not exists audit_logs_created_at_desc_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_category_created_at_idx on public.audit_logs(category,created_at desc);
create index if not exists audit_logs_severity_created_at_idx on public.audit_logs(severity,created_at desc);
create index if not exists audit_logs_correlation_id_idx on public.audit_logs(correlation_id) where correlation_id is not null;

create or replace function public.write_audit_event(
  p_action text, p_category text default 'system', p_severity text default 'info',
  p_entity_type text default null, p_entity_id text default null,
  p_correlation_id text default null, p_metadata jsonb default '{}'::jsonb,
  p_actor_user_id uuid default auth.uid()
) returns bigint language plpgsql security definer set search_path='' as $fn$
declare v_id bigint;
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  if auth.role() <> 'service_role' then p_actor_user_id := auth.uid(); end if;
  if p_action is null or p_action !~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$' then
    raise exception 'INVALID_AUDIT_ACTION';
  end if;
  if p_category not in ('auth','admin','student','lesson','package','payment','email','blog','contact','database','edge','system') then
    raise exception 'INVALID_AUDIT_CATEGORY';
  end if;
  if p_severity not in ('info','warning','error','critical') then raise exception 'INVALID_AUDIT_SEVERITY'; end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata,severity,category,correlation_id)
  values(p_actor_user_id,left(p_action,160),left(p_entity_type,100),left(p_entity_id,200),coalesce(p_metadata,'{}'::jsonb),p_severity,p_category,left(p_correlation_id,200))
  returning id into v_id;
  return v_id;
end;
$fn$;
revoke all on function public.write_audit_event(text,text,text,text,text,text,jsonb,uuid) from public,anon;
grant execute on function public.write_audit_event(text,text,text,text,text,text,jsonb,uuid) to authenticated,service_role;

-- Outbox remains canonical. This best-effort trigger mirrors state without
-- recipient/body data and deliberately cannot fail the delivery transaction.
create or replace function public.mirror_notification_delivery_audit()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare v_action text; v_severity text := 'info'; v_retry boolean := false;
begin
  if tg_op='INSERT' then v_action := 'email.queued';
  elsif new.status is not distinct from old.status and new.attempt_count is not distinct from old.attempt_count then return new;
  elsif new.status='sent' then v_action := 'email.sent';
  elsif new.status='cancelled' then v_action := 'email.skipped'; v_severity := 'warning';
  elsif new.status='failed' and coalesce(new.last_error_code,'') ~* '(render|template)' then v_action := 'email.render_failed'; v_severity := 'error';
  elsif new.status='failed' then v_action := 'email.failed'; v_severity := 'error';
  else return new;
  end if;
  v_retry := new.status='failed' and coalesce(new.next_attempt_at,now()-interval '1 second')>now();
  begin
    perform public.write_audit_event(v_action,'email',v_severity,new.entity_type,new.entity_id,
      coalesce(new.dedupe_key,new.id::text),jsonb_strip_nulls(jsonb_build_object(
        'mail_template',new.template,'delivery_id',new.id,'status',new.status,
        'attempt_number',new.attempt_count,'safe_error_code',left(new.last_error_code,80))),null);
    if v_retry then
      perform public.write_audit_event('email.retry_scheduled','email','warning',new.entity_type,new.entity_id,
        coalesce(new.dedupe_key,new.id::text),jsonb_strip_nulls(jsonb_build_object(
          'mail_template',new.template,'delivery_id',new.id,'status',new.status,
          'attempt_number',new.attempt_count,'safe_error_code',left(new.last_error_code,80))),null);
    end if;
  exception when others then null;
  end;
  return new;
end;
$fn$;
drop trigger if exists trg_notification_delivery_audit on public.notification_deliveries;
create trigger trg_notification_delivery_audit after insert or update of status,attempt_count on public.notification_deliveries
for each row execute function public.mirror_notification_delivery_audit();

alter table public.student_profiles
  add column if not exists education_program text,
  add column if not exists exams_taken text[] not null default '{}';

-- Remove both historical overloads and expose one canonical contract.
drop function if exists public.admin_update_student_profile(uuid,text,text,text,text);
drop function if exists public.admin_update_student_profile(uuid,text,text,text,text,text,text,text,boolean);
create function public.admin_update_student_profile(
  p_student_id uuid, p_full_name text, p_phone text default null,
  p_school text default null, p_education_program text default null,
  p_exams_taken text[] default '{}', p_target_countries text[] default '{}',
  p_target_university text default null, p_preferred_language text default 'tr',
  p_active boolean default true
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_old public.student_profiles%rowtype; v_changed text[] := '{}'; v_name text:=left(btrim(coalesce(p_full_name,'')),100); v_phone text:=left(nullif(btrim(p_phone),''),30);
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if char_length(v_name)<2 or p_preferred_language not in ('tr','en') then return jsonb_build_object('success',false,'error_code','INVALID_INPUT'); end if;
  select * into v_old from public.student_profiles where id=p_student_id for update;
  if v_old.id is null then return jsonb_build_object('success',false,'error_code','NOT_FOUND'); end if;
  -- The academic modal does not edit phone. A null argument therefore means
  -- "preserve current identity data", not "erase the phone number".
  v_phone:=coalesce(v_phone,v_old.phone);
  if v_old.full_name is distinct from v_name then v_changed:=array_append(v_changed,'full_name'); end if;
  if v_old.phone is distinct from v_phone then v_changed:=array_append(v_changed,'phone'); end if;
  if v_old.school is distinct from left(nullif(btrim(p_school),''),160) then v_changed:=array_append(v_changed,'school'); end if;
  if v_old.education_program is distinct from left(nullif(btrim(p_education_program),''),160) then v_changed:=array_append(v_changed,'education_program'); end if;
  if v_old.exams_taken is distinct from coalesce((select array_agg(left(x,80)) from (select distinct btrim(e) x from unnest(coalesce(p_exams_taken,'{}')) e where nullif(btrim(e),'') is not null) q),'{}') then v_changed:=array_append(v_changed,'exams_taken'); end if;
  if v_old.target_countries is distinct from coalesce((select array_agg(left(x,120)) from (select distinct btrim(e) x from unnest(coalesce(p_target_countries,'{}')) e where nullif(btrim(e),'') is not null) q),'{}') then v_changed:=array_append(v_changed,'target_countries'); end if;
  if v_old.target_university is distinct from left(nullif(btrim(p_target_university),''),160) then v_changed:=array_append(v_changed,'target_university'); end if;
  if v_old.preferred_language is distinct from p_preferred_language then v_changed:=array_append(v_changed,'preferred_language'); end if;
  if v_old.active is distinct from p_active then v_changed:=array_append(v_changed,'active'); end if;
  update public.student_profiles set full_name=v_name,phone=v_phone,school=left(nullif(btrim(p_school),''),160),
    education_program=left(nullif(btrim(p_education_program),''),160),
    exams_taken=coalesce((select array_agg(left(x,80)) from (select distinct btrim(e) x from unnest(coalesce(p_exams_taken,'{}')) e where nullif(btrim(e),'') is not null) q),'{}'),
    target_countries=coalesce((select array_agg(left(x,120)) from (select distinct btrim(e) x from unnest(coalesce(p_target_countries,'{}')) e where nullif(btrim(e),'') is not null) q),'{}'),
    target_university=left(nullif(btrim(p_target_university),''),160),preferred_language=p_preferred_language,active=p_active,updated_at=now()
  where id=p_student_id;
  -- Only explicit identity changes touch auth metadata. Academic-only edits do not.
  if v_old.full_name is distinct from v_name or v_old.phone is distinct from v_phone then
    update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('full_name',v_name,'phone',v_phone) where id=p_student_id;
  end if;
  perform public.write_audit_event(case when v_old.full_name is distinct from v_name or v_old.phone is distinct from v_phone then 'student.identity.updated' else 'student.profile.updated' end,
    'student','info','student_profile',p_student_id::text,null,jsonb_build_object('changed_fields',v_changed),auth.uid());
  return jsonb_build_object('success',true,'student_id',p_student_id,'changed_fields',v_changed);
end;
$fn$;
revoke all on function public.admin_update_student_profile(uuid,text,text,text,text,text[],text[],text,text,boolean) from public,anon;
grant execute on function public.admin_update_student_profile(uuid,text,text,text,text,text[],text[],text,text,boolean) to authenticated,service_role;

create table if not exists public.lesson_topics(
  id uuid primary key default gen_random_uuid(), label text not null check(char_length(btrim(label)) between 1 and 160),
  active boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists lesson_topics_label_unique on public.lesson_topics(lower(btrim(label)));
create index if not exists lesson_topics_order_idx on public.lesson_topics(active desc,sort_order,id);
alter table public.lesson_topics enable row level security;
create policy "Admin lesson topics" on public.lesson_topics for all using(public.is_admin()) with check(public.is_admin());
grant select,insert,update on public.lesson_topics to authenticated,service_role;

insert into public.lesson_topics(label,sort_order) values
('IB Math HL',1),('IB Physics HL',2),('SAT Math',3),('ESAT Math',4),('ESAT Physics',5)
on conflict ((lower(btrim(label)))) do update set sort_order=excluded.sort_order;

create table if not exists public.instructors(
  id uuid primary key default gen_random_uuid(), name text not null check(char_length(btrim(name)) between 1 and 160),
  active boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists instructors_name_unique on public.instructors(lower(btrim(name)));
create index if not exists instructors_order_idx on public.instructors(active desc,sort_order,id);
alter table public.instructors enable row level security;
create policy "Admin instructors" on public.instructors for all using(public.is_admin()) with check(public.is_admin());
grant select,insert,update on public.instructors to authenticated,service_role;

alter table public.student_lessons
  add column if not exists topic_id uuid references public.lesson_topics(id) on delete restrict,
  add column if not exists instructor_id uuid references public.instructors(id) on delete restrict;
create index if not exists student_lessons_topic_idx on public.student_lessons(topic_id) where topic_id is not null;
create index if not exists student_lessons_instructor_idx on public.student_lessons(instructor_id) where instructor_id is not null;

create or replace function public.prevent_lesson_reference_delete() returns trigger language plpgsql set search_path='' as $fn$
begin raise exception 'LESSON_REFERENCE_DELETE_FORBIDDEN' using errcode='23503'; end;$fn$;
drop trigger if exists trg_prevent_lesson_topic_delete on public.lesson_topics;
create trigger trg_prevent_lesson_topic_delete before delete on public.lesson_topics for each row execute function public.prevent_lesson_reference_delete();
drop trigger if exists trg_prevent_instructor_delete on public.instructors;
create trigger trg_prevent_instructor_delete before delete on public.instructors for each row execute function public.prevent_lesson_reference_delete();

create or replace function public.admin_manage_lesson_reference(
  p_kind text,p_action text,p_id uuid default null,p_label text default null,p_sort_order integer default null
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_id uuid; v_action text; v_order integer;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_kind not in ('topic','instructor') or p_action not in ('create','rename','activate','deactivate','reorder') then return jsonb_build_object('success',false,'error_code','INVALID_ACTION'); end if;
  if p_action in ('create','rename') and char_length(btrim(coalesce(p_label,''))) not between 1 and 160 then return jsonb_build_object('success',false,'error_code','INVALID_LABEL'); end if;
  if p_kind='topic' then
    if p_action='create' then select coalesce(max(sort_order),0)+1 into v_order from public.lesson_topics; insert into public.lesson_topics(label,sort_order) values(left(btrim(p_label),160),coalesce(p_sort_order,v_order)) returning id into v_id;
    elsif p_action='rename' then update public.lesson_topics set label=left(btrim(p_label),160),updated_at=now() where id=p_id returning id into v_id;
    elsif p_action in ('activate','deactivate') then update public.lesson_topics set active=(p_action='activate'),updated_at=now() where id=p_id returning id into v_id;
    else update public.lesson_topics set sort_order=p_sort_order,updated_at=now() where id=p_id returning id into v_id; end if;
    v_action:='lesson.topic_'||case when p_action='create' then 'created' when p_action='rename' then 'updated' when p_action='deactivate' then 'deactivated' when p_action='activate' then 'updated' else 'reordered' end;
  else
    if p_action='create' then select coalesce(max(sort_order),0)+1 into v_order from public.instructors; insert into public.instructors(name,sort_order) values(left(btrim(p_label),160),coalesce(p_sort_order,v_order)) returning id into v_id;
    elsif p_action='rename' then update public.instructors set name=left(btrim(p_label),160),updated_at=now() where id=p_id returning id into v_id;
    elsif p_action in ('activate','deactivate') then update public.instructors set active=(p_action='activate'),updated_at=now() where id=p_id returning id into v_id;
    else update public.instructors set sort_order=p_sort_order,updated_at=now() where id=p_id returning id into v_id; end if;
    v_action:='instructor.'||case when p_action='create' then 'created' when p_action='rename' then 'updated' when p_action='deactivate' then 'deactivated' when p_action='activate' then 'updated' else 'reordered' end;
  end if;
  if v_id is null then return jsonb_build_object('success',false,'error_code','NOT_FOUND'); end if;
  perform public.write_audit_event(v_action,'lesson','info',p_kind,v_id::text,null,jsonb_strip_nulls(jsonb_build_object('reference_id',v_id,'sort_order',p_sort_order)),auth.uid());
  return jsonb_build_object('success',true,'id',v_id);
exception when unique_violation then return jsonb_build_object('success',false,'error_code','DUPLICATE_LABEL');
end;
$fn$;
revoke all on function public.admin_manage_lesson_reference(text,text,uuid,text,integer) from public,anon;
grant execute on function public.admin_manage_lesson_reference(text,text,uuid,text,integer) to authenticated,service_role;

-- Replace current lesson upsert signature with reference-aware optional fields.
drop function if exists public.admin_upsert_student_lesson(uuid,uuid,uuid,text,text,text,timestamptz,integer,text,text,text,text,text);
create function public.admin_upsert_student_lesson(
  p_student_id uuid,p_lesson_id uuid default null,p_package_purchase_id uuid default null,
  p_title text default 'Birebir Ders',p_subject text default 'Birebir Ders',p_exam_code text default null,
  p_lesson_date timestamptz default now(),p_duration_minutes integer default 60,
  p_live_meeting_url text default null,p_teacher_note text default null,p_status text default 'scheduled',
  p_lesson_timezone text default 'Europe/Istanbul',p_lesson_timezone_label text default 'TR',
  p_topic_id uuid default null,p_instructor_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_lesson_id uuid; v_subject text:=left(btrim(coalesce(p_subject,'')),160); v_topic_label text; v_url text:=nullif(btrim(p_live_meeting_url),''); v_action text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_duration_minutes not between 1 and 600 or p_status not in ('scheduled','cancelled','no_show') then return jsonb_build_object('success',false,'error_code','INVALID_INPUT'); end if;
  if not (
    (p_lesson_timezone_label='TR' and p_lesson_timezone='Europe/Istanbul') or (p_lesson_timezone_label='UK' and p_lesson_timezone='Europe/London') or
    (p_lesson_timezone_label='NL' and p_lesson_timezone='Europe/Amsterdam') or (p_lesson_timezone_label='DE' and p_lesson_timezone='Europe/Berlin') or
    (p_lesson_timezone_label='US-ET' and p_lesson_timezone='America/New_York') or (p_lesson_timezone_label='US-CT' and p_lesson_timezone='America/Chicago') or
    (p_lesson_timezone_label='US-MT' and p_lesson_timezone='America/Denver') or (p_lesson_timezone_label='US-PT' and p_lesson_timezone='America/Los_Angeles')
  ) then return jsonb_build_object('success',false,'error_code','INVALID_LESSON_TIMEZONE'); end if;
  if p_topic_id is not null then select label into v_topic_label from public.lesson_topics where id=p_topic_id and (active or p_lesson_id is not null); if v_topic_label is null then return jsonb_build_object('success',false,'error_code','TOPIC_UNAVAILABLE'); end if; v_subject:=v_topic_label; end if;
  if nullif(v_subject,'') is null then v_subject:='Birebir Ders'; end if;
  if p_instructor_id is not null and not exists(select 1 from public.instructors where id=p_instructor_id and (active or p_lesson_id is not null)) then return jsonb_build_object('success',false,'error_code','INSTRUCTOR_UNAVAILABLE'); end if;
  if v_url is not null and v_url !~* '^https?://' then return jsonb_build_object('success',false,'error_code','INVALID_URL_SCHEME'); end if;
  if not exists(select 1 from public.student_profiles where id=p_student_id) then return jsonb_build_object('success',false,'error_code','STUDENT_NOT_FOUND'); end if;
  if p_package_purchase_id is not null and not exists(select 1 from public.student_package_purchases where id=p_package_purchase_id and student_user_id=p_student_id and (p_lesson_id is not null or (status='active' and lesson_count>lessons_used))) then return jsonb_build_object('success',false,'error_code','PACKAGE_INACTIVE_OR_EXHAUSTED'); end if;
  begin
    if p_lesson_id is null then
      insert into public.student_lessons(student_user_id,package_purchase_id,title,subject,exam_code,lesson_date,lesson_timezone,lesson_timezone_label,duration_minutes,live_meeting_url,teacher_note,status,topic_id,instructor_id)
      values(p_student_id,p_package_purchase_id,coalesce(nullif(v_subject,''),'Birebir Ders'),v_subject,left(nullif(btrim(p_exam_code),''),80),p_lesson_date,p_lesson_timezone,p_lesson_timezone_label,p_duration_minutes,v_url,nullif(btrim(p_teacher_note),''),p_status,p_topic_id,p_instructor_id) returning id into v_lesson_id;
      v_action:='lesson.created';
    else
      update public.student_lessons set package_purchase_id=p_package_purchase_id,title=coalesce(nullif(v_subject,''),title),subject=v_subject,exam_code=left(nullif(btrim(p_exam_code),''),80),lesson_date=p_lesson_date,lesson_timezone=p_lesson_timezone,lesson_timezone_label=p_lesson_timezone_label,duration_minutes=p_duration_minutes,live_meeting_url=v_url,teacher_note=nullif(btrim(p_teacher_note),''),status=p_status,topic_id=p_topic_id,instructor_id=p_instructor_id,updated_at=now()
      where id=p_lesson_id and student_user_id=p_student_id and status<>'completed' returning id into v_lesson_id; v_action:='lesson.updated';
    end if;
  exception when exclusion_violation then return jsonb_build_object('success',false,'error_code','LESSON_TIME_OVERLAP'); end;
  if v_lesson_id is null then return jsonb_build_object('success',false,'error_code','LESSON_NOT_FOUND'); end if;
  perform public.write_audit_event(v_action,'lesson','info','student_lesson',v_lesson_id::text,null,jsonb_build_object('student_id',p_student_id,'topic_id',p_topic_id,'instructor_id',p_instructor_id,'status',p_status),auth.uid());
  return jsonb_build_object('success',true,'lesson_id',v_lesson_id,'action',v_action);
end;$fn$;
revoke all on function public.admin_upsert_student_lesson(uuid,uuid,uuid,text,text,text,timestamptz,integer,text,text,text,text,text,uuid,uuid) from public,anon;
grant execute on function public.admin_upsert_student_lesson(uuid,uuid,uuid,text,text,text,timestamptz,integer,text,text,text,text,text,uuid,uuid) to authenticated,service_role;

-- Stable replay and explicit MAIL-044 opt-in are part of the same transaction.
drop function if exists public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text,text,text);
create function public.admin_record_completed_lesson(
  p_student_id uuid,p_lesson_date timestamptz,p_duration_minutes integer,p_title text,p_subject text,
  p_teacher_note text default null,p_package_purchase_id uuid default null,p_existing_lesson_id uuid default null,
  p_completion_source text default 'past',p_idempotency_key text default null,p_lesson_timezone text default 'Europe/Istanbul',
  p_lesson_timezone_label text default 'TR',p_topic_id uuid default null,p_instructor_id uuid default null,p_send_email boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_lesson public.student_lessons%rowtype; v_purchase public.student_package_purchases%rowtype; v_key text; v_ledger_id uuid; v_prev integer; v_remaining integer; v_topic text; v_holder record; v_student_name text; v_instructor text; v_delivery uuid;
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
  if p_topic_id is not null then select label into v_topic from public.lesson_topics where id=p_topic_id and active; if v_topic is null then return jsonb_build_object('success',false,'error_code','TOPIC_UNAVAILABLE'); end if; else v_topic:=left(nullif(btrim(p_subject),''),160); end if;
  v_topic:=coalesce(v_topic,'Birebir Ders');
  if p_instructor_id is not null and not exists(select 1 from public.instructors where id=p_instructor_id and active) then return jsonb_build_object('success',false,'error_code','INSTRUCTOR_UNAVAILABLE'); end if;
  v_key:=case when p_existing_lesson_id is not null then 'scheduled:'||p_existing_lesson_id else nullif(btrim(p_idempotency_key),'') end;
  if v_key is null then return jsonb_build_object('success',false,'error_code','IDEMPOTENCY_KEY_REQUIRED'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_key,0));
  select * into v_lesson from public.student_lessons where completion_key=v_key for update;
  if v_lesson.id is not null then select * into v_purchase from public.student_package_purchases where id=v_lesson.package_purchase_id; select id into v_delivery from public.notification_deliveries where dedupe_key='past_lesson_confirmation_manual:'||v_lesson.id limit 1; return jsonb_build_object('success',true,'already_completed',true,'lesson_id',v_lesson.id,'package_purchase_id',v_purchase.id,'used',v_purchase.lessons_used,'remaining',greatest(0,v_purchase.lesson_count-v_purchase.lessons_used),'total',v_purchase.lesson_count,'notification_delivery_id',v_delivery); end if;
  if p_existing_lesson_id is not null then select * into v_lesson from public.student_lessons where id=p_existing_lesson_id and student_user_id=p_student_id for update; if v_lesson.id is null then return jsonb_build_object('success',false,'error_code','LESSON_NOT_FOUND'); end if; if v_lesson.status='completed' then return jsonb_build_object('success',true,'already_completed',true,'lesson_id',v_lesson.id); end if; end if;
  if p_package_purchase_id is not null then select * into v_purchase from public.student_package_purchases where id=p_package_purchase_id and student_user_id=p_student_id and status='active' and lesson_count>lessons_used for update; else select * into v_purchase from public.student_package_purchases where student_user_id=p_student_id and status='active' and lesson_count>lessons_used order by created_at,id for update limit 1; end if;
  if v_purchase.id is null then return jsonb_build_object('success',false,'error_code','NO_ACTIVE_PACKAGE'); end if;
  v_prev:=v_purchase.lesson_count-v_purchase.lessons_used;
  update public.student_package_purchases set lessons_used=lessons_used+1,status=case when lessons_used+1>=lesson_count then 'completed' else 'active' end,updated_at=now() where id=v_purchase.id returning * into v_purchase;
  v_remaining:=greatest(0,v_purchase.lesson_count-v_purchase.lessons_used); perform set_config('oriens.completing_lesson','true',true);
  if p_existing_lesson_id is null then insert into public.student_lessons(student_user_id,package_purchase_id,title,subject,lesson_date,lesson_timezone,lesson_timezone_label,duration_minutes,status,teacher_note,completion_key,completion_source,completion_previous_remaining,topic_id,instructor_id) values(p_student_id,v_purchase.id,v_topic,v_topic,p_lesson_date,p_lesson_timezone,p_lesson_timezone_label,p_duration_minutes,'completed',left(nullif(btrim(p_teacher_note),''),2000),v_key,'past',v_prev,p_topic_id,p_instructor_id) returning * into v_lesson;
  else update public.student_lessons set status='completed',package_purchase_id=v_purchase.id,completion_key=v_key,completion_source='scheduled',completion_previous_remaining=v_prev,topic_id=coalesce(p_topic_id,topic_id),instructor_id=coalesce(p_instructor_id,instructor_id),updated_at=now() where id=p_existing_lesson_id returning * into v_lesson; end if;
  insert into public.student_package_adjustments(student_user_id,package_purchase_id,adjustment_type,lesson_delta,price_amount,currency,payment_status,notes,created_by,linked_lesson_id) values(p_student_id,v_purchase.id,case when p_completion_source='past' then 'past_lesson_added' else 'lesson_completed' end,-1,null,v_purchase.currency,'waived',nullif(btrim(p_teacher_note),''),auth.uid(),v_lesson.id) returning id into v_ledger_id;
  perform public.write_audit_event(case when p_completion_source='past' then 'lesson.created_past' else 'lesson.completed' end,'lesson','info','student_lesson',v_lesson.id::text,v_key,jsonb_build_object('package_purchase_id',v_purchase.id,'topic_id',p_topic_id,'instructor_id',p_instructor_id,'previous_remaining',v_prev,'remaining',v_remaining),auth.uid());
  if p_send_email and p_completion_source='past' then
    select ga.user_id,ga.email,ga.full_name,ga.preferred_language into v_holder from public.guardian_students gs join public.guardian_accounts ga on ga.user_id=gs.guardian_user_id where gs.student_id=p_student_id and gs.active and ga.active and ga.email_verified_at is not null and nullif(btrim(ga.email),'') is not null order by gs.is_primary desc,gs.created_at limit 1;
    if v_holder.email is null then raise exception 'NO_VERIFIED_ACCOUNT_HOLDER'; end if;
    select full_name into v_student_name from public.student_profiles where id=p_student_id; select name into v_instructor from public.instructors where id=p_instructor_id;
    v_delivery:=public.enqueue_email_notification('lesson.past_confirmation.manual','student_lesson',v_lesson.id::text,v_holder.email,'past_lesson_confirmation_manual',jsonb_strip_nulls(jsonb_build_object('lesson_id',v_lesson.id,'student_name',v_student_name,'account_holder_name',v_holder.full_name,'guardian_name',v_holder.full_name,'subject',v_lesson.subject,'lesson_date',v_lesson.lesson_date,'lesson_timezone',v_lesson.lesson_timezone,'lesson_timezone_label',v_lesson.lesson_timezone_label,'duration_minutes',v_lesson.duration_minutes,'instructor_name',v_instructor,'total_remaining_lessons',public.calculate_student_usable_remaining_lessons(p_student_id),'locale',coalesce(v_holder.preferred_language,'tr'))),'past_lesson_confirmation_manual:'||v_lesson.id,now());
  end if;
  return jsonb_build_object('success',true,'already_completed',false,'lesson_id',v_lesson.id,'package_purchase_id',v_purchase.id,'used',v_purchase.lessons_used,'remaining',v_remaining,'total',v_purchase.lesson_count,'ledger_id',v_ledger_id,'notification_delivery_id',v_delivery);
end;$fn$;
revoke all on function public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text,text,text,uuid,uuid,boolean) from public,anon;
grant execute on function public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text,text,text,uuid,uuid,boolean) to authenticated,service_role;

create or replace function public.admin_update_completed_lesson(
 p_lesson_id uuid,p_topic_id uuid,p_subject text,p_lesson_date timestamptz,p_lesson_timezone text,p_lesson_timezone_label text,
 p_duration_minutes integer,p_instructor_id uuid default null,p_package_purchase_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_lesson public.student_lessons%rowtype; v_old public.student_package_purchases%rowtype; v_new public.student_package_purchases%rowtype; v_adj public.student_package_adjustments%rowtype; v_subject text; v_changed text[]:='{}'; v_package_changed boolean:=false;
begin
 if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_duration_minutes not between 1 and 600 then return jsonb_build_object('success',false,'error_code','INVALID_DURATION'); end if;
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
 if p_topic_id is not null then select label into v_subject from public.lesson_topics where id=p_topic_id; if v_subject is null then return jsonb_build_object('success',false,'error_code','TOPIC_NOT_FOUND'); end if; else v_subject:=coalesce(nullif(btrim(p_subject),''),v_lesson.subject,'Birebir Ders'); end if;
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
 if v_lesson.subject is distinct from v_subject then v_changed:=array_append(v_changed,'subject'); end if;
 if v_lesson.lesson_date is distinct from p_lesson_date then v_changed:=array_append(v_changed,'lesson_date'); end if;
 if v_lesson.lesson_timezone is distinct from p_lesson_timezone then v_changed:=array_append(v_changed,'lesson_timezone'); end if;
 if v_lesson.duration_minutes is distinct from p_duration_minutes then v_changed:=array_append(v_changed,'duration_minutes'); end if;
 if v_lesson.instructor_id is distinct from p_instructor_id then v_changed:=array_append(v_changed,'instructor_id'); end if;
 update public.student_lessons set topic_id=p_topic_id,subject=left(v_subject,160),title=coalesce(nullif(left(v_subject,160),''),title,'Birebir Ders'),lesson_date=p_lesson_date,lesson_timezone=p_lesson_timezone,lesson_timezone_label=p_lesson_timezone_label,duration_minutes=p_duration_minutes,instructor_id=p_instructor_id,package_purchase_id=coalesce(p_package_purchase_id,package_purchase_id),updated_at=now() where id=p_lesson_id;
 if cardinality(v_changed)>0 then perform public.write_audit_event('lesson.updated','lesson','info','student_lesson',p_lesson_id::text,null,jsonb_build_object('changed_fields',v_changed),auth.uid()); end if;
 if v_package_changed then perform public.write_audit_event('lesson.package_changed','lesson','info','student_lesson',p_lesson_id::text,'lesson_package_transfer:'||p_lesson_id||':'||p_package_purchase_id,jsonb_build_object('old_package_id',v_old.id,'new_package_id',v_new.id,'old_remaining_before',v_old.lesson_count-v_old.lessons_used,'old_remaining_after',v_old.lesson_count-v_old.lessons_used+1,'new_remaining_before',v_new.lesson_count-v_new.lessons_used,'new_remaining_after',v_new.lesson_count-v_new.lessons_used-1),auth.uid()); end if;
 return jsonb_build_object('success',true,'lesson_id',p_lesson_id,'changed_fields',v_changed,'package_changed',v_package_changed);
end;$fn$;
revoke all on function public.admin_update_completed_lesson(uuid,uuid,text,timestamptz,text,text,integer,uuid,uuid) from public,anon;
grant execute on function public.admin_update_completed_lesson(uuid,uuid,text,timestamptz,text,text,integer,uuid,uuid) to authenticated,service_role;
