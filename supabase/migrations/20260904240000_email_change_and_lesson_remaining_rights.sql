-- Migration: 20260904240000_email_change_and_lesson_remaining_rights.sql
-- Description:
-- 1. Table email_change_challenges for secure OTP verification of email changes.
-- 2. Drop automatic package activation trigger (MAIL-015 decommissioned).
-- 3. Remove manual lesson rights adjustment notifications (MAIL-018 decommissioned).
-- 4. Replace enqueue_package_lifecycle_reminder as safe no-op (MAIL-016 & 017 merged into MAIL-040).
-- 5. Add calculate_student_usable_remaining_lessons function (sums active, non-expired packages).
-- 6. Add overloaded enqueue_email_notification with p_next_attempt_at.
-- 7. Automatically enqueue MAIL-040 (lesson_remaining_rights_account_holder) on lesson completion:
--    - Past lessons: immediately (next_attempt_at = now()).
--    - Future/live lessons: at lesson_end_time + 1 hour.
--    - Dedupe key: lesson_remaining_rights:{lesson_id}.

-- 1. Email Change Challenges Table
create table if not exists public.email_change_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  old_email text not null,
  new_email text not null,
  code_hash text not null,
  attempt_count integer not null default 0,
  resend_available_at timestamptz not null default (now() + interval '60 seconds'),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_change_challenges enable row level security;
revoke all on public.email_change_challenges from public, anon, authenticated;
grant all on public.email_change_challenges to service_role;

create index if not exists idx_email_change_challenges_user
  on public.email_change_challenges(user_id, expires_at)
  where verified_at is null;

create index if not exists idx_email_change_challenges_new_email
  on public.email_change_challenges(new_email, expires_at)
  where verified_at is null;

-- 2. Multi-Package Usable Remaining Lessons Calculation
create or replace function public.calculate_student_usable_remaining_lessons(p_student_id uuid)
returns integer
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(sum(greatest(0, lesson_count - lessons_used)), 0)::integer
  from public.student_package_purchases
  where student_user_id = p_student_id
    and status = 'active'
    and (end_date is null or end_date > now());
$$;
grant execute on function public.calculate_student_usable_remaining_lessons(uuid) to service_role, authenticated;

-- 3. Drop trg_queue_manual_package_activation_email (MAIL-015 decommissioned)
drop trigger if exists trg_queue_manual_package_activation_email on public.student_package_purchases;
create or replace function public.queue_manual_package_activation_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- MAIL-015 decommissioned: no-op
  return new;
end;
$$;

-- 4. Overloaded enqueue_email_notification with p_next_attempt_at
create or replace function public.enqueue_email_notification(
  p_event_type text, p_entity_type text, p_entity_id text, p_recipient text,
  p_template text, p_payload jsonb, p_dedupe_key text,
  p_next_attempt_at timestamptz default now()
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if nullif(btrim(p_recipient),'') is null or nullif(btrim(p_dedupe_key),'') is null then return null; end if;
  insert into public.notification_deliveries(
    event_type, entity_type, entity_id, recipient, provider, status, attempt_count,
    template, payload, next_attempt_at, dedupe_key
  ) values (
    p_event_type, p_entity_type, p_entity_id, lower(btrim(p_recipient)),
    'google_workspace', 'pending', 0, p_template, coalesce(p_payload,'{}'::jsonb),
    coalesce(p_next_attempt_at, now()), p_dedupe_key
  ) on conflict(dedupe_key) where dedupe_key is not null do update set dedupe_key=excluded.dedupe_key
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.enqueue_email_notification(text,text,text,text,text,jsonb,text,timestamptz) to service_role;

-- 5. enqueue_package_lifecycle_reminder as safe no-op (MAIL-016 & 017 merged into MAIL-040)
create or replace function public.enqueue_package_lifecycle_reminder(
  p_purchase_id uuid,
  p_old_remaining integer,
  p_new_remaining integer
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Merged into MAIL-040 post-lesson remaining rights automation: no-op
  return;
end;
$$;
grant execute on function public.enqueue_package_lifecycle_reminder(uuid,integer,integer) to service_role;

-- 6. Update admin_adjust_package_lesson_rights: Remove MAIL-018 notification
create or replace function public.admin_adjust_package_lesson_rights(
  p_purchase_id uuid,
  p_lesson_delta integer,
  p_reason text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.student_package_purchases%rowtype;
  v_old_lesson_count integer;
  v_new_lesson_count integer;
  v_old_remaining integer;
  v_new_remaining integer;
  v_old_status text;
  v_new_status text;
  v_adjustment_id uuid;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'admin_adjustment');
  v_notes text := nullif(btrim(p_notes), '');
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if p_lesson_delta is null or p_lesson_delta = 0 then
    return jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_LESSON_DELTA',
      'message', 'Ders degisimi 0 olamaz.'
    );
  end if;

  select * into v_purchase
  from public.student_package_purchases
  where id = p_purchase_id
  for update;

  if v_purchase.id is null then
    return jsonb_build_object(
      'success', false,
      'error_code', 'PACKAGE_PURCHASE_NOT_FOUND',
      'message', 'Paket satin alimi bulunamadi.'
    );
  end if;

  v_old_lesson_count := coalesce(v_purchase.lesson_count, 0);
  v_new_lesson_count := v_old_lesson_count + p_lesson_delta;
  v_old_remaining := greatest(0, v_old_lesson_count - coalesce(v_purchase.lessons_used, 0));
  v_new_remaining := v_old_remaining + p_lesson_delta;

  if v_new_remaining < 0 then
    return jsonb_build_object(
      'success', false,
      'error_code', 'INSUFFICIENT_LESSON_RIGHTS',
      'message', 'Kalan ders hakki sifirin altina dusemez.'
    );
  end if;

  v_old_status := v_purchase.status;
  if v_new_remaining = 0 then
    v_new_status := 'completed';
  elsif v_old_status = 'completed' and v_new_remaining > 0 then
    v_new_status := 'active';
  else
    v_new_status := v_old_status;
  end if;

  update public.student_package_purchases
  set
    lesson_count = v_new_lesson_count,
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
    case when p_lesson_delta > 0 then 'manual_increase' else 'manual_decrease' end,
    p_lesson_delta,
    0,
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

  -- MAIL-018 decommissioned: zero notifications sent on manual rights adjustment.
  return jsonb_build_object(
    'success', true,
    'purchase_id', p_purchase_id,
    'adjustment_id', v_adjustment_id,
    'old_remaining', v_old_remaining,
    'new_remaining', v_new_remaining,
    'new_status', v_new_status
  );
end;
$$;

-- 7. Update admin_record_completed_lesson and admin_complete_student_lesson to enqueue MAIL-040
create or replace function public.internal_apply_lesson_completion(
  p_student_id uuid,
  p_existing_lesson_id uuid default null,
  p_package_purchase_id uuid default null,
  p_title text default 'Tamamlanan Birebir Ders',
  p_subject text default 'Birebir Ders',
  p_lesson_date timestamptz default now(),
  p_duration_minutes integer default 60,
  p_teacher_note text default null,
  p_completion_source text default 'scheduled',
  p_idempotency_key text default null,
  p_send_email boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.student_package_purchases%rowtype;
  v_lesson public.student_lessons%rowtype;
  v_key text;
  v_previous_remaining integer;
  v_remaining integer;
  v_ledger_id uuid;
  v_total_usable_remaining integer;
  v_guardian record;
  v_target_send_at timestamptz;
  v_scheduled_email_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  v_key := coalesce(nullif(btrim(p_idempotency_key),''), 'cmp:'||p_student_id||':'||coalesce(p_existing_lesson_id::text, md5(p_lesson_date::text||p_title)));

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

  -- 1. Optional Explicit Admin Send for MAIL-027 (Instructor feedback/lesson detail):
  if p_send_email then
    perform public.enqueue_completed_lesson_notifications(v_lesson.id);
  end if;

  -- 2. AUTOMATIC MAIL-040: Lesson Completed Remaining Rights Notification
  -- Find account holder (guardian)
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

    -- MAIL-040 Scheduling Rule:
    -- TARGET_SEND_AT = lesson_end_at + 1 hour.
    -- If TARGET_SEND_AT > now() (completion on time / early), schedule at TARGET_SEND_AT.
    -- If TARGET_SEND_AT <= now() (late completion or past lesson), queue immediately at now().
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
    'total_usable_remaining', public.calculate_student_usable_remaining_lessons(p_student_id),
    'total',v_purchase.lesson_count);
end;
$$;

-- 8. Strip package information from manual MAIL-027 enqueue_completed_lesson_notifications
create or replace function public.enqueue_completed_lesson_notifications(p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lesson public.student_lessons%rowtype;
  v_holder record;
  v_learner_name text;
begin
  select * into v_lesson from public.student_lessons where id=p_lesson_id and status='completed';
  if v_lesson.id is null then return; end if;
  select ga.user_id,ga.email,ga.full_name,ga.preferred_language,gs.relationship_role
    into v_holder
  from public.guardian_students gs
  join public.guardian_accounts ga on ga.user_id=gs.guardian_user_id
  where gs.student_id=v_lesson.student_user_id and gs.active and ga.active
    and ga.email_verified_at is not null
  order by gs.is_primary desc,gs.created_at asc limit 1;
  if v_holder.email is null then return; end if;

  select full_name into v_learner_name from public.student_profiles where id=v_lesson.student_user_id;

  perform public.enqueue_email_notification(
    'lesson.completed','student_lesson',v_lesson.id::text,v_holder.email,
    'lesson_completed_account_holder',jsonb_build_object(
      'lesson_id',v_lesson.id,'account_holder_id',v_holder.user_id,
      'account_holder_name',v_holder.full_name,'learner_name',v_learner_name,
      'relationship_role',coalesce(v_holder.relationship_role,'other'),
      'lesson_title',v_lesson.title,'lesson_date',v_lesson.lesson_date,
      'teacher_note',v_lesson.teacher_note,
      'locale',coalesce(v_holder.preferred_language,'tr')
    ),'lesson.completed:'||v_lesson.id||':account_holder'
  );
end;
$$;
revoke all on function public.enqueue_completed_lesson_notifications(uuid) from public,anon,authenticated;
grant execute on function public.enqueue_completed_lesson_notifications(uuid) to service_role;
