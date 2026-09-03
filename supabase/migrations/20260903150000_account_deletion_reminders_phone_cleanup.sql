-- Migration: 20260903150000_account_deletion_reminders_phone_cleanup.sql
-- Description:
-- 1. Self-service account deletion/anonymization RPC (delete_or_anonymize_own_account).
-- 2. Shared package lifecycle reminder function (1-remaining + package-finished), wired
--    into all three lesson-consumption call sites that currently diverge, and gated on
--    guardian_accounts.email_verified_at like every other post-signup transactional mail.
-- 3. Guardian profile phone made optional (update_guardian_profile).
-- 4. Bounded, audited cleanup of existing phone data outside the payment boundary.

-- ==============================================================================
-- 1. GUARDIAN PROFILE: PHONE NO LONGER REQUIRED
-- ==============================================================================

-- Parameter names/order change (p_phone moves and becomes optional), so Postgres
-- requires an explicit drop rather than a same-signature CREATE OR REPLACE.
drop function if exists public.update_guardian_profile(text,text,text,text);

create or replace function public.update_guardian_profile(
  p_full_name text,
  p_contact_address text,
  p_preferred_language text default 'tr',
  p_phone text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_phone text := nullif(regexp_replace(btrim(coalesce(p_phone, '')), '[\s().-]+', '', 'g'), '');
  v_address text := regexp_replace(btrim(coalesce(p_contact_address, '')), '\s+', ' ', 'g');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if char_length(v_name) not between 2 and 100 then raise exception 'INVALID_FULL_NAME'; end if;
  if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{6,14}$' then raise exception 'INVALID_PHONE'; end if;
  if char_length(v_address) not between 10 and 300 then raise exception 'INVALID_CONTACT_ADDRESS'; end if;
  if p_preferred_language not in ('tr','en') then raise exception 'INVALID_LANGUAGE'; end if;
  if (select count(*) from public.audit_logs
      where actor_user_id = auth.uid() and action = 'guardian.profile_updated'
        and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'PROFILE_UPDATE_RATE_LIMIT';
  end if;

  -- Phone is intentionally no longer collected in this form. When not supplied,
  -- the existing stored value (if any) is left untouched rather than cleared.
  update public.guardian_accounts
  set full_name = v_name, phone = coalesce(v_phone, phone), contact_address = v_address,
      preferred_language = p_preferred_language, updated_at = now()
  where user_id = auth.uid() and active;
  if not found then raise exception 'GUARDIAN_ACCOUNT_NOT_FOUND'; end if;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), 'guardian.profile_updated', 'guardian_account', auth.uid()::text,
    jsonb_build_object('fields', jsonb_build_array('full_name','contact_address','preferred_language')));
  return jsonb_build_object('success', true);
end;
$$;
revoke all on function public.update_guardian_profile(text,text,text,text) from public, anon;
grant execute on function public.update_guardian_profile(text,text,text,text) to authenticated;

-- ==============================================================================
-- 2. SHARED PACKAGE LIFECYCLE REMINDER (1-remaining + package-finished/renewal)
-- ==============================================================================

create or replace function public.enqueue_package_lifecycle_reminder(
  p_purchase_id uuid,
  p_old_remaining integer,
  p_new_remaining integer
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.student_package_purchases%rowtype;
  v_holder record;
  v_learner_name text;
  v_package_name text;
  v_other_active_count integer;
begin
  if p_old_remaining is null or p_new_remaining is null or p_old_remaining = p_new_remaining then return; end if;

  select * into v_purchase from public.student_package_purchases where id = p_purchase_id;
  if v_purchase.id is null then return; end if;

  -- Same account-holder resolution as every other post-signup transactional mail,
  -- gated on guardian_accounts.email_verified_at (P0 rule extended per this prompt).
  select ga.user_id, ga.email, ga.full_name, ga.preferred_language, gs.relationship_role
    into v_holder
  from public.guardian_students gs
  join public.guardian_accounts ga on ga.user_id = gs.guardian_user_id
  where gs.student_id = v_purchase.student_user_id and gs.active and ga.active
    and ga.email_verified_at is not null
  order by gs.is_primary desc, gs.created_at asc
  limit 1;
  if v_holder.email is null then return; end if;

  select full_name into v_learner_name from public.student_profiles where id = v_purchase.student_user_id;
  select case when v_holder.preferred_language = 'en' then name_en else name_tr end
    into v_package_name from public.pricing_packages where id = v_purchase.package_id;

  if p_old_remaining > 1 and p_new_remaining = 1 then
    perform public.enqueue_email_notification(
      'package.low_balance', 'student_package_purchase', v_purchase.id::text, v_holder.email,
      'package_low_balance_account_holder', jsonb_build_object(
        'package_purchase_id', v_purchase.id, 'account_holder_id', v_holder.user_id,
        'account_holder_name', v_holder.full_name, 'learner_name', v_learner_name,
        'relationship_role', coalesce(v_holder.relationship_role, 'other'),
        'package_name', coalesce(v_package_name, v_purchase.custom_package_name, v_purchase.package_id),
        'remaining_lessons', 1, 'locale', coalesce(v_holder.preferred_language, 'tr')
      ), 'package.low_balance:'||v_purchase.id||':remaining:1:account_holder'
    );
  elsif p_old_remaining > 0 and p_new_remaining = 0 then
    -- Suppress the renewal nudge if another active package with remaining lessons exists.
    select count(*) into v_other_active_count
    from public.student_package_purchases
    where student_user_id = v_purchase.student_user_id
      and id <> v_purchase.id
      and status = 'active'
      and lesson_count > lessons_used;
    if v_other_active_count = 0 then
      perform public.enqueue_email_notification(
        'package.completed_renewal', 'student_package_purchase', v_purchase.id::text, v_holder.email,
        'package_completed_renewal_account_holder', jsonb_build_object(
          'package_purchase_id', v_purchase.id, 'account_holder_id', v_holder.user_id,
          'account_holder_name', v_holder.full_name, 'learner_name', v_learner_name,
          'relationship_role', coalesce(v_holder.relationship_role, 'other'),
          'package_name', coalesce(v_package_name, v_purchase.custom_package_name, v_purchase.package_id),
          'locale', coalesce(v_holder.preferred_language, 'tr')
        ), 'package.completed_renewal:'||v_purchase.id||':account_holder'
      );
    end if;
  end if;
end;
$$;
revoke all on function public.enqueue_package_lifecycle_reminder(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.enqueue_package_lifecycle_reminder(uuid,integer,integer) to service_role;

-- ==============================================================================
-- 3. WIRE THE SHARED REMINDER INTO ALL THREE LESSON-CONSUMPTION CALL SITES
-- ==============================================================================

-- 3a. Automatic completion path (admin_record_completed_lesson's downstream trigger).
-- Now also covers the 0-remaining case, and gates the lesson.completed mail itself on
-- email_verified_at (it previously did not).
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
    and ga.email_verified_at is not null
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

  if v_purchase.id is not null then
    perform public.enqueue_package_lifecycle_reminder(v_purchase.id, v_lesson.completion_previous_remaining, v_remaining);
  end if;
end;
$$;
revoke all on function public.enqueue_completed_lesson_notifications(uuid) from public,anon,authenticated;
grant execute on function public.enqueue_completed_lesson_notifications(uuid) to service_role;

-- 3b. Manual adjustment path. Bypasses student_lessons entirely, so the trigger above
-- never fires for it -- call the shared function directly with the values it already
-- computes. The existing per-decrement lesson_rights_decreased notice is unchanged.
create or replace function public.admin_adjust_package_lessons(
  p_purchase_id uuid,
  p_lesson_delta integer,
  p_reason text,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.student_package_purchases%rowtype;
  v_adjustment_id uuid;
  v_old_lesson_count integer;
  v_new_lesson_count integer;
  v_old_remaining integer;
  v_new_remaining integer;
  v_new_status text;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_lesson_delta is null or p_lesson_delta = 0 or p_lesson_delta < -500 or p_lesson_delta > 500 then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_LESSON_DELTA');
  end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 200 then
    return jsonb_build_object('success', false, 'error_code', 'ADJUSTMENT_REASON_REQUIRED');
  end if;
  if v_notes is not null and char_length(v_notes) > 1000 then
    return jsonb_build_object('success', false, 'error_code', 'ADJUSTMENT_NOTES_TOO_LONG');
  end if;

  select * into v_purchase
  from public.student_package_purchases
  where id = p_purchase_id
  for update;

  if v_purchase.id is null then
    return jsonb_build_object('success', false, 'error_code', 'PACKAGE_NOT_FOUND');
  end if;

  v_old_lesson_count := v_purchase.lesson_count;
  v_old_remaining := v_old_lesson_count - v_purchase.lessons_used;
  v_new_lesson_count := v_old_lesson_count + p_lesson_delta;
  v_new_remaining := v_new_lesson_count - v_purchase.lessons_used;

  if v_new_lesson_count < 0 or v_new_remaining < 0 then
    return jsonb_build_object(
      'success', false,
      'error_code', 'INSUFFICIENT_UNUSED_LESSONS',
      'available_remaining', greatest(0, v_old_remaining)
    );
  end if;

  v_new_status := v_purchase.status;
  if p_lesson_delta > 0 and v_new_remaining > 0 and v_purchase.status in ('completed', 'expired') then
    v_new_status := 'active';
  elsif v_new_remaining = 0 and v_purchase.status = 'active' then
    v_new_status := 'completed';
  end if;

  update public.student_package_purchases
  set lesson_count = v_new_lesson_count,
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
    'manual_adjustment',
    p_lesson_delta,
    null,
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

  -- Only enqueue notification when lesson rights are decreased and an email recipient exists
  if p_lesson_delta < 0 then
    insert into public.notification_deliveries (
      channel,
      event_type,
      entity_type,
      entity_id,
      recipient,
      subject,
      status,
      provider,
      template,
      payload
    )
    select
      'email',
      'lesson_rights_decreased',
      'student_package_purchase',
      p_purchase_id::text,
      lower(btrim(sp.email)),
      'Ders hakkınız güncellendi',
      'pending',
      'google_workspace',
      'lesson_rights_decreased',
      jsonb_build_object(
        'subject', 'Ders hakkınız güncellendi',
        'title', 'Ders hakkınız güncellendi',
        'message', 'Ders hakkınız yönetici tarafından güncellendi. Kalan ders hakkınız: ' || v_new_remaining,
        'remaining_lessons', v_new_remaining,
        'lesson_delta', p_lesson_delta,
        'student_name', sp.full_name
      )
    from public.student_profiles sp
    where sp.id = v_purchase.student_user_id
      and sp.email is not null
      and btrim(sp.email) <> '';
  end if;

  perform public.enqueue_package_lifecycle_reminder(p_purchase_id, v_old_remaining, v_new_remaining);

  return jsonb_build_object(
    'success', true,
    'purchase_id', p_purchase_id,
    'old_lesson_count', v_old_lesson_count,
    'new_lesson_count', v_new_lesson_count,
    'lessons_used', v_purchase.lessons_used,
    'old_remaining', v_old_remaining,
    'new_remaining', v_new_remaining,
    'adjustment_id', v_adjustment_id
  );
end;
$$;
revoke all on function public.admin_adjust_package_lessons(uuid, integer, text, text) from public, anon;
grant execute on function public.admin_adjust_package_lessons(uuid, integer, text, text) to authenticated, service_role;

-- 3c. Scheduled-event/appointment completion path. This is the actual bug: both branches
-- previously deducted lessons_used without ever capturing the "before" remaining count, so
-- the low-balance reminder silently never fired for lessons completed this way.
create or replace function public.admin_complete_scheduled_event(
  p_event_id uuid,
  p_package_purchase_id uuid default null,
  p_teacher_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lesson public.student_lessons%rowtype;
  v_booking public.bookings%rowtype;
  v_purchase public.student_package_purchases%rowtype;
  v_target_purchase_id uuid;
  v_event_type text := 'lesson';
  v_consumed boolean := false;
  v_old_remaining integer;
  v_new_remaining integer;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  -- Check if event exists in student_lessons
  select * into v_lesson from public.student_lessons where id = p_event_id for update;

  if v_lesson.id is not null then
    -- Already completed? Idempotent return without double deduction
    if v_lesson.status = 'completed' then
      return jsonb_build_object(
        'success', true,
        'already_completed', true,
        'lesson_id', v_lesson.id,
        'message', 'Event was already completed.'
      );
    end if;

    -- Determine package to deduct from using FIFO (oldest active purchase first)
    v_target_purchase_id := coalesce(p_package_purchase_id, v_lesson.package_purchase_id);
    if v_target_purchase_id is null then
      select id into v_target_purchase_id
      from public.student_package_purchases
      where student_user_id = v_lesson.student_user_id
        and status = 'active'
        and (lesson_count - lessons_used) > 0
      order by created_at asc, id asc
      for update
      limit 1;
    else
      select * into v_purchase
      from public.student_package_purchases
      where id = v_target_purchase_id and (lesson_count - lessons_used) > 0
      for update;
    end if;

    if v_target_purchase_id is not null then
      select (lesson_count - lessons_used) into v_old_remaining
      from public.student_package_purchases where id = v_target_purchase_id;
    end if;

    -- Update lesson status & permanently link the package purchase
    update public.student_lessons
    set status = 'completed',
        package_purchase_id = coalesce(v_target_purchase_id, package_purchase_id),
        teacher_note = coalesce(nullif(btrim(p_teacher_note), ''), teacher_note),
        updated_at = now()
    where id = v_lesson.id;

    -- Deduct exactly 1 lesson if valid active package found
    if v_target_purchase_id is not null then
      update public.student_package_purchases
      set lessons_used = lessons_used + 1,
          status = case when lessons_used + 1 >= lesson_count then 'completed' else 'active' end,
          updated_at = now()
      where id = v_target_purchase_id
      returning * into v_purchase;

      v_consumed := true;
      v_new_remaining := greatest(0, v_purchase.lesson_count - v_purchase.lessons_used);
      perform public.enqueue_package_lifecycle_reminder(v_target_purchase_id, v_old_remaining, v_new_remaining);
    end if;

    return jsonb_build_object(
      'success', true,
      'already_completed', false,
      'lesson_id', v_lesson.id,
      'package_consumed', v_consumed,
      'package_purchase_id', v_target_purchase_id,
      'lessons_remaining', case when v_purchase.id is not null then greatest(0, v_purchase.lesson_count - v_purchase.lessons_used) else null end
    );
  end if;

  -- If not in student_lessons, check bookings table
  select * into v_booking from public.bookings where id = p_event_id for update;
  if v_booking.id is null then
    return jsonb_build_object('success', false, 'error_code', 'EVENT_NOT_FOUND');
  end if;

  if v_booking.status = 'completed' then
    return jsonb_build_object(
      'success', true,
      'already_completed', true,
      'booking_id', v_booking.id,
      'message', 'Booking was already completed.'
    );
  end if;

  -- Mark booking completed
  update public.bookings
  set status = 'completed',
      updated_at = now()
  where id = v_booking.id;

  v_event_type := coalesce(v_booking.event_type, 'other');

  -- ONLY event_type = 'lesson' consumes from package
  if v_event_type = 'lesson' and v_booking.student_user_id is not null then
    v_target_purchase_id := p_package_purchase_id;
    if v_target_purchase_id is null then
      select id into v_target_purchase_id
      from public.student_package_purchases
      where student_user_id = v_booking.student_user_id
        and status = 'active'
        and (lesson_count - lessons_used) > 0
      order by created_at asc, id asc
      for update
      limit 1;
    else
      select * into v_purchase
      from public.student_package_purchases
      where id = v_target_purchase_id and (lesson_count - lessons_used) > 0
      for update;
    end if;

    if v_target_purchase_id is not null then
      select (lesson_count - lessons_used) into v_old_remaining
      from public.student_package_purchases where id = v_target_purchase_id;
    end if;

    if v_target_purchase_id is not null then
      update public.student_package_purchases
      set lessons_used = lessons_used + 1,
          status = case when lessons_used + 1 >= lesson_count then 'completed' else 'active' end,
          updated_at = now()
      where id = v_target_purchase_id
      returning * into v_purchase;

      v_consumed := true;
      v_new_remaining := greatest(0, v_purchase.lesson_count - v_purchase.lessons_used);
      perform public.enqueue_package_lifecycle_reminder(v_target_purchase_id, v_old_remaining, v_new_remaining);
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'already_completed', false,
    'booking_id', v_booking.id,
    'event_type', v_event_type,
    'package_consumed', v_consumed,
    'package_purchase_id', v_target_purchase_id,
    'lessons_remaining', case when v_purchase.id is not null then greatest(0, v_purchase.lesson_count - v_purchase.lessons_used) else null end
  );
end;
$$;
revoke all on function public.admin_complete_scheduled_event(uuid, uuid, text) from public, anon;
grant execute on function public.admin_complete_scheduled_event(uuid, uuid, text) to authenticated, service_role;

-- 3d. package.activated mail: add the same email_verified_at gate (§13).
create or replace function public.queue_manual_package_activation_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_guardian record; v_student_name text; v_package_name text;
begin
  if coalesce(new.assignment_source,'') not in ('admin_manual','manual_bank_transfer','bank_transfer') then return new; end if;
  select ga.user_id,ga.email,ga.full_name,ga.preferred_language into v_guardian
  from public.guardian_students gs join public.guardian_accounts ga on ga.user_id=gs.guardian_user_id
  where gs.student_id=new.student_user_id and gs.active and ga.active
    and ga.email_verified_at is not null
  order by gs.is_primary desc,gs.created_at asc limit 1;
  if v_guardian.email is null then return new; end if;
  select full_name into v_student_name from public.student_profiles where id=new.student_user_id;
  select coalesce(case when v_guardian.preferred_language='en' then name_en else name_tr end,new.package_id)
    into v_package_name from public.pricing_packages where id=new.package_id;
  perform public.enqueue_email_notification('package.activated','student_package_purchase',new.id::text,
    v_guardian.email,'package_activated_guardian',jsonb_build_object(
      'purchase_id',new.id,'guardian_name',v_guardian.full_name,'learner_name',v_student_name,
      'package_name',coalesce(v_package_name,new.custom_package_name,new.package_id),
      'granted_lessons',new.lesson_count,'remaining_lessons',greatest(0,new.lesson_count-new.lessons_used),
      'activation_date',new.start_date,'source',new.assignment_source,'locale',v_guardian.preferred_language
    ),'package.activated:'||new.id||':guardian');
  return new;
end;
$$;

-- ==============================================================================
-- 4. SELF-SERVICE ACCOUNT DELETION / ANONYMIZATION
-- ==============================================================================

create or replace function public.delete_or_anonymize_own_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guardian public.guardian_accounts%rowtype;
  v_learner_ids uuid[];
  v_active_entitlement boolean;
  v_has_history boolean;
  v_mode text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;

  select * into v_guardian from public.guardian_accounts where user_id = auth.uid();
  if v_guardian.user_id is null then
    return jsonb_build_object('success', false, 'error_code', 'GUARDIAN_ACCOUNT_NOT_FOUND');
  end if;

  select coalesce(array_agg(student_id), array[]::uuid[]) into v_learner_ids
  from public.guardian_students
  where guardian_user_id = auth.uid() and active;

  -- Safety gate: never silently destroy active paid rights, upcoming lessons, or
  -- in-flight money movement. No refund logic is invented here.
  select exists(
    select 1 from public.student_package_purchases
    where student_user_id = any(v_learner_ids) and status = 'active' and lesson_count > lessons_used
  ) or exists(
    select 1 from public.student_lessons
    where student_user_id = any(v_learner_ids) and status = 'scheduled' and lesson_date > now()
  ) or exists(
    select 1 from public.bookings
    where student_user_id = any(v_learner_ids) and status in ('pending','confirmed')
  ) or exists(
    select 1 from public.payment_transactions
    where purchaser_guardian_user_id = auth.uid() and status = 'pending'
  ) or exists(
    select 1 from public.payment_refunds pr
    join public.payment_transactions pt on pt.id = pr.payment_transaction_id
    where pt.purchaser_guardian_user_id = auth.uid()
      and pr.status not in ('refund_succeeded','refund_failed')
  ) into v_active_entitlement;

  if v_active_entitlement then
    return jsonb_build_object('success', false, 'error_code', 'ACTIVE_ENTITLEMENT_EXISTS');
  end if;

  -- Path decision: any purchase/payment history at all -> anonymize in place
  -- (guardian_accounts/student_package_purchases are ON DELETE RESTRICT from
  -- auth.users specifically so this history can never be silently destroyed).
  -- No history -> safe to fully remove the public-schema rows.
  select exists(
    select 1 from public.student_package_purchases where student_user_id = any(v_learner_ids)
  ) or exists(
    select 1 from public.payment_transactions where purchaser_guardian_user_id = auth.uid()
  ) into v_has_history;

  if v_has_history then
    v_mode := 'anonymized';

    insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
    values(auth.uid(), 'account.self_anonymized', 'guardian_account', auth.uid()::text,
      jsonb_build_object('learner_count', coalesce(array_length(v_learner_ids,1),0)));

    update public.guardian_accounts
    set full_name = 'Deleted User', email = 'deleted+'||user_id||'@deleted.oriens-academy.invalid',
        phone = null, contact_address = null, active = false, updated_at = now()
    where user_id = auth.uid();

    update public.student_profiles
    set full_name = 'Deleted User', email = 'deleted+'||id||'@deleted.oriens-academy.invalid',
        phone = null, school = null, target_country = null, target_university = null, target_exam = null,
        active = false, updated_at = now()
    where id = any(v_learner_ids);

    update public.guardian_students set active = false where guardian_user_id = auth.uid();
  else
    v_mode := 'deleted';

    insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
    values(auth.uid(), 'account.self_deleted', 'guardian_account', auth.uid()::text,
      jsonb_build_object('learner_count', coalesce(array_length(v_learner_ids,1),0)));

    delete from public.guardian_students where guardian_user_id = auth.uid();
    delete from public.guardian_accounts where user_id = auth.uid();
    -- student_profiles cascades automatically once the caller deletes the auth.users row.
  end if;

  return jsonb_build_object('success', true, 'mode', v_mode);
end;
$$;
revoke all on function public.delete_or_anonymize_own_account() from public, anon;
grant execute on function public.delete_or_anonymize_own_account() to authenticated;

-- ==============================================================================
-- 5. BOUNDED, AUDITED CLEANUP OF EXISTING PHONE DATA (outside the payment boundary)
-- ==============================================================================

do $$
declare
  v_students_before integer;
  v_students_updated integer;
  v_contacts_before integer;
  v_contacts_updated integer;
  v_bookings_before integer;
  v_bookings_updated integer;
  v_guardians_before integer;
  v_guardians_updated integer;
  v_auth_meta_updated integer;
begin
  select count(*) into v_students_before from public.student_profiles where phone is not null;
  update public.student_profiles set phone = null, updated_at = now() where phone is not null;
  get diagnostics v_students_updated = row_count;

  select count(*) into v_contacts_before from public.contact_requests where phone is not null;
  update public.contact_requests set phone = null, updated_at = now() where phone is not null;
  get diagnostics v_contacts_updated = row_count;

  select count(*) into v_bookings_before from public.bookings where phone is not null;
  update public.bookings set phone = null, updated_at = now() where phone is not null;
  get diagnostics v_bookings_updated = row_count;

  -- Safe now: paytr-create-token (P0) reads a transient checkout-only payload phone,
  -- never guardian_accounts.phone.
  select count(*) into v_guardians_before from public.guardian_accounts where phone is not null;
  update public.guardian_accounts set phone = null, updated_at = now() where phone is not null;
  get diagnostics v_guardians_updated = row_count;

  update auth.users set raw_user_meta_data = raw_user_meta_data - 'phone'
  where raw_user_meta_data ? 'phone';
  get diagnostics v_auth_meta_updated = row_count;

  raise notice 'Phone cleanup (no raw values logged): student_profiles % of % nulled, contact_requests % of % nulled, bookings % of % nulled, guardian_accounts % of % nulled, auth raw_user_meta_data phone key removed from % users',
    v_students_updated, v_students_before, v_contacts_updated, v_contacts_before,
    v_bookings_updated, v_bookings_before, v_guardians_updated, v_guardians_before, v_auth_meta_updated;
end;
$$;
