-- Account-holder setup, canonical completed-lesson recording, lesson ledger,
-- relationship-aware completion mail, and one-right package reminders.

alter table public.student_lessons
  add column if not exists completion_key text,
  add column if not exists completion_source text,
  add column if not exists completion_previous_remaining integer;

alter table public.student_lessons
  drop constraint if exists student_lessons_completion_source_check;
alter table public.student_lessons
  add constraint student_lessons_completion_source_check
  check (completion_source is null or completion_source in ('scheduled', 'past'));

create unique index if not exists student_lessons_completion_key_unique
  on public.student_lessons (completion_key) where completion_key is not null;

alter table public.student_package_adjustments
  add column if not exists linked_lesson_id uuid references public.student_lessons(id) on delete restrict;

alter table public.student_package_adjustments
  drop constraint if exists student_package_adjustments_lesson_delta_check;
alter table public.student_package_adjustments
  add constraint student_package_adjustments_lesson_delta_check check (lesson_delta <> 0);

alter table public.student_package_adjustments
  drop constraint if exists student_package_adjustments_adjustment_type_check;
alter table public.student_package_adjustments
  add constraint student_package_adjustments_adjustment_type_check
  check (adjustment_type in (
    'extra_lessons', 'manual_adjustment', 'package_assigned', 'package_reactivated',
    'lesson_completed', 'past_lesson_added'
  ));

create unique index if not exists student_package_adjustments_lesson_unique
  on public.student_package_adjustments (linked_lesson_id) where linked_lesson_id is not null;

-- New signups create only the account holder. Learner information is deliberately
-- separate and is added from the account setup state. Existing links are untouched.
create or replace function public.create_student_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_name text;
begin
  if new.email is null or coalesce(new.raw_app_meta_data->>'role', '') = 'admin' then return new; end if;
  v_name := left(regexp_replace(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email,'@',1)), '\s+', ' ', 'g'), 100);
  if char_length(v_name) < 2 then v_name := 'Account Holder'; end if;

  insert into public.guardian_accounts(
    user_id, full_name, email, phone, contact_address, preferred_language,
    email_verified_at, active, migration_source
  ) values (
    new.id, v_name, lower(new.email), left(nullif(btrim(new.raw_user_meta_data->>'phone'),''),30),
    left(nullif(btrim(new.raw_user_meta_data->>'contact_address'),''),300),
    case when new.raw_user_meta_data->>'preferred_language'='en' then 'en' else 'tr' end,
    new.email_confirmed_at, (new.email_confirmed_at is not null), 'native_account_holder_v2'
  ) on conflict(user_id) do nothing;
  return new;
end;
$$;

create or replace function public.setup_account_learner(
  p_full_name text,
  p_email text,
  p_phone text default null,
  p_school text default null,
  p_preferred_language text default 'tr'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := gen_random_uuid();
  v_name text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.guardian_accounts where user_id=auth.uid() and active) then
    raise exception 'ACCOUNT_HOLDER_REQUIRED' using errcode='42501';
  end if;
  if exists(select 1 from public.guardian_students where guardian_user_id=auth.uid() and active) then
    return jsonb_build_object('success',false,'error_code','LEARNER_ALREADY_DEFINED');
  end if;
  if char_length(v_name) not between 2 and 100 then return jsonb_build_object('success',false,'error_code','INVALID_LEARNER_NAME'); end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('success',false,'error_code','INVALID_LEARNER_EMAIL'); end if;
  if p_preferred_language not in ('tr','en') then return jsonb_build_object('success',false,'error_code','INVALID_LANGUAGE'); end if;

  insert into public.student_profiles(
    id, full_name, email, phone, school, preferred_language, active, migration_source
  ) values (
    v_student_id, v_name, v_email, left(nullif(btrim(p_phone),''),30),
    left(nullif(btrim(p_school),''),160), p_preferred_language, true, 'account_setup_v2'
  );
  insert into public.guardian_students(
    guardian_user_id, student_id, relationship_role, is_primary, active, source
  ) values (auth.uid(), v_student_id, 'other', true, true, 'account_setup_v2');
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'account.learner_defined','student_profile',v_student_id::text,
    jsonb_build_object('relationship_role','other'));
  return jsonb_build_object('success',true,'student_id',v_student_id);
end;
$$;
revoke all on function public.setup_account_learner(text,text,text,text,text) from public,anon;
grant execute on function public.setup_account_learner(text,text,text,text,text) to authenticated;

create or replace function public.enqueue_completed_lesson_notifications(p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lesson public.student_lessons%rowtype;
  v_purchase public.student_package_purchases%rowtype;
  v_holder record;
  v_learner_name text;
  v_package_name text;
  v_remaining integer;
begin
  select * into v_lesson from public.student_lessons where id=p_lesson_id and status='completed';
  if v_lesson.id is null then return; end if;
  select ga.user_id,ga.email,ga.full_name,ga.preferred_language,gs.relationship_role
    into v_holder
  from public.guardian_students gs
  join public.guardian_accounts ga on ga.user_id=gs.guardian_user_id
  where gs.student_id=v_lesson.student_user_id and gs.active and ga.active
  order by gs.is_primary desc,gs.created_at asc limit 1;
  if v_holder.email is null then return; end if;

  select full_name into v_learner_name from public.student_profiles where id=v_lesson.student_user_id;
  select * into v_purchase from public.student_package_purchases where id=v_lesson.package_purchase_id;
  if v_purchase.id is not null then
    v_remaining := greatest(0,v_purchase.lesson_count-v_purchase.lessons_used);
    select case when v_holder.preferred_language='en' then name_en else name_tr end
      into v_package_name from public.pricing_packages where id=v_purchase.package_id;
  end if;

  perform public.enqueue_email_notification(
    'lesson.completed','student_lesson',v_lesson.id::text,v_holder.email,
    'lesson_completed_account_holder',jsonb_build_object(
      'lesson_id',v_lesson.id,'account_holder_id',v_holder.user_id,
      'account_holder_name',v_holder.full_name,'learner_name',v_learner_name,
      'relationship_role',coalesce(v_holder.relationship_role,'other'),
      'lesson_title',v_lesson.title,'lesson_date',v_lesson.lesson_date,
      'teacher_note',v_lesson.teacher_note,'package_name',coalesce(v_package_name,v_purchase.custom_package_name,v_purchase.package_id),
      'remaining_lessons',v_remaining,'total_lessons',v_purchase.lesson_count,
      'locale',coalesce(v_holder.preferred_language,'tr')
    ),'lesson.completed:'||v_lesson.id||':account_holder'
  );

  if v_purchase.id is not null and v_lesson.completion_previous_remaining>1 and v_remaining=1 then
    perform public.enqueue_email_notification(
      'package.low_balance','student_package_purchase',v_purchase.id::text,v_holder.email,
      'package_low_balance_account_holder',jsonb_build_object(
        'package_purchase_id',v_purchase.id,'account_holder_id',v_holder.user_id,
        'account_holder_name',v_holder.full_name,'learner_name',v_learner_name,
        'relationship_role',coalesce(v_holder.relationship_role,'other'),
        'package_name',coalesce(v_package_name,v_purchase.custom_package_name,v_purchase.package_id),
        'remaining_lessons',1,'locale',coalesce(v_holder.preferred_language,'tr')
      ),'package.low_balance:'||v_purchase.id||':remaining:1:account_holder'
    );
  end if;
end;
$$;
revoke all on function public.enqueue_completed_lesson_notifications(uuid) from public,anon,authenticated;
grant execute on function public.enqueue_completed_lesson_notifications(uuid) to service_role;

create or replace function public.queue_lesson_completed_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op='INSERT' and new.status='completed' then
    perform public.enqueue_completed_lesson_notifications(new.id);
  elsif tg_op='UPDATE' and new.status='completed' and old.status is distinct from 'completed' then
    perform public.enqueue_completed_lesson_notifications(new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_queue_lesson_completed_email on public.student_lessons;
create trigger trg_queue_lesson_completed_email
  after insert or update of status on public.student_lessons
  for each row execute function public.queue_lesson_completed_email();

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
        'remaining',case when v_purchase.id is null then null else greatest(0,v_purchase.lesson_count-v_purchase.lessons_used) end);
    end if;
    if v_lesson.status<>'scheduled' then return jsonb_build_object('success',false,'error_code','LESSON_NOT_COMPLETABLE'); end if;
  else
    select * into v_lesson from public.student_lessons where completion_key=v_key for update;
    if v_lesson.id is not null then
      select * into v_purchase from public.student_package_purchases where id=v_lesson.package_purchase_id;
      return jsonb_build_object('success',true,'already_completed',true,'lesson_id',v_lesson.id,
        'package_purchase_id',v_purchase.id,'used',v_purchase.lessons_used,
        'remaining',greatest(0,v_purchase.lesson_count-v_purchase.lessons_used));
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
    'used',v_purchase.lessons_used,'remaining',v_remaining,'idempotency_key',v_key));

  return jsonb_build_object('success',true,'already_completed',false,'lesson_id',v_lesson.id,
    'package_purchase_id',v_purchase.id,'used',v_purchase.lessons_used,'remaining',v_remaining,
    'total',v_purchase.lesson_count,'ledger_id',v_ledger_id);
end;
$$;
revoke all on function public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text) from public,anon;
grant execute on function public.admin_record_completed_lesson(uuid,timestamptz,integer,text,text,text,uuid,uuid,text,text) to authenticated,service_role;

create or replace function public.admin_complete_student_lesson(
  p_lesson_id uuid,
  p_package_purchase_id uuid default null,
  p_teacher_note text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_lesson public.student_lessons%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select * into v_lesson from public.student_lessons where id=p_lesson_id;
  if v_lesson.id is null then return jsonb_build_object('success',false,'error_code','LESSON_NOT_FOUND'); end if;
  return public.admin_record_completed_lesson(
    v_lesson.student_user_id,v_lesson.lesson_date,v_lesson.duration_minutes,v_lesson.title,v_lesson.subject,
    p_teacher_note,p_package_purchase_id,v_lesson.id,'scheduled','scheduled:'||v_lesson.id
  );
end;
$$;
revoke all on function public.admin_complete_student_lesson(uuid,uuid,text) from public,anon;
grant execute on function public.admin_complete_student_lesson(uuid,uuid,text) to authenticated,service_role;

-- Preserve both existing scheduled-event entry points while routing actual lessons
-- through the same canonical completion mutation and event.
create or replace function public.admin_complete_scheduled_event(
  p_event_id uuid,
  p_package_purchase_id uuid default null,
  p_teacher_note text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_lesson public.student_lessons%rowtype;
  v_booking public.bookings%rowtype;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_result jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select * into v_lesson from public.student_lessons where id=p_event_id;
  if v_lesson.id is not null then
    return public.admin_complete_student_lesson(p_event_id,p_package_purchase_id,p_teacher_note);
  end if;

  select * into v_booking from public.bookings where id=p_event_id for update;
  if v_booking.id is null then return jsonb_build_object('success',false,'error_code','EVENT_NOT_FOUND'); end if;
  if v_booking.status='completed' then return jsonb_build_object('success',true,'already_completed',true,'booking_id',v_booking.id); end if;
  if coalesce(v_booking.event_type,'other')<>'lesson' then
    update public.bookings set status='completed',updated_at=now() where id=v_booking.id;
    return jsonb_build_object('success',true,'already_completed',false,'booking_id',v_booking.id,'event_type',v_booking.event_type,'package_consumed',false);
  end if;
  if v_booking.student_user_id is null then return jsonb_build_object('success',false,'error_code','LEARNER_NOT_LINKED'); end if;
  select starts_at,ends_at into v_starts_at,v_ends_at from public.availability_slots where id=v_booking.slot_id;

  v_result := public.admin_record_completed_lesson(
    v_booking.student_user_id,coalesce(v_starts_at,v_booking.created_at),
    greatest(1,least(600,coalesce((extract(epoch from (v_ends_at-v_starts_at))/60)::integer,60))),
    coalesce(nullif(btrim(v_booking.appointment_subject),''),nullif(btrim(v_booking.exam_code),''),'Birebir Ders'),
    coalesce(nullif(btrim(v_booking.exam_code),''),'Genel Ders'),p_teacher_note,p_package_purchase_id,
    null,'scheduled','booking:'||v_booking.id
  );
  if coalesce((v_result->>'success')::boolean,false) then
    update public.bookings set status='completed',updated_at=now() where id=v_booking.id;
    v_result := v_result || jsonb_build_object('booking_id',v_booking.id,'event_type','lesson');
  end if;
  return v_result;
end;
$$;
revoke all on function public.admin_complete_scheduled_event(uuid,uuid,text) from public,anon;
grant execute on function public.admin_complete_scheduled_event(uuid,uuid,text) to authenticated,service_role;
