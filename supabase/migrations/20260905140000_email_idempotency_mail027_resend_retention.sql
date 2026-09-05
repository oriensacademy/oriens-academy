-- Migration: 20260905140000_email_idempotency_mail027_resend_retention.sql
--
-- 1. notification_deliveries.status gains 'cancelled'. process-notification-outbox
--    already writes 'cancelled' for decommissioned templates and for MAIL-040 rows
--    whose lesson is no longer completed, but the CHECK constraint
--    (20260831150000) only allowed pending/processing/sent/failed -- so those
--    updates were rejected and the rows stayed stuck in 'processing' forever.
--
-- 2. claim_manual_email_dispatch(): one atomic claim for every explicit,
--    admin-triggered manual send (MAIL-021/023/024/025/026/027). A double click,
--    a network retry or a replayed request inside the window claims nothing and
--    sends nothing; a deliberate "Tekrar Gonder" past the window re-claims the
--    same row and sends again. Replaces the previous read-then-write
--    wasRecentlyDispatched() check in _shared/email/service.ts, which was not
--    atomic and could let two concurrent requests through.
--
-- 3. MAIL-027 manual resend: enqueue_completed_lesson_notifications() gains a
--    dedupe suffix so an intentional resend is possible at all -- the permanent
--    dedupe key 'lesson.completed:<id>:account_holder' previously made every
--    send after the first a silent no-op.
--
-- 4. notification_deliveries retention: terminal rows older than 90 days are
--    purged daily. Deliberately separate from audit_logs / payment ledger
--    retention, and independent of the account-deletion audit rule.

-- ==============================================================================
-- 1. ALLOW 'cancelled' DELIVERY STATUS
-- ==============================================================================

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_status_check;
alter table public.notification_deliveries
  add constraint notification_deliveries_status_check
  check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled'));

-- ==============================================================================
-- 2. ATOMIC MANUAL-SEND IDEMPOTENCY CLAIM
-- ==============================================================================

create or replace function public.claim_manual_email_dispatch(
  p_event_type text,
  p_entity_type text,
  p_entity_id text,
  p_recipient text,
  p_window_seconds integer default 60
) returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_id uuid;
  v_key text;
  v_window integer := greatest(1, least(coalesce(p_window_seconds, 60), 3600));
begin
  if nullif(btrim(coalesce(p_recipient, '')), '') is null then return null; end if;
  v_key := 'manual:' || coalesce(p_event_type, '') || ':' || coalesce(p_entity_id, '') ||
           ':' || lower(btrim(p_recipient));

  insert into public.notification_deliveries as nd (
    channel, event_type, entity_type, entity_id, recipient, provider,
    status, attempt_count, next_attempt_at, dedupe_key
  ) values (
    'email', p_event_type, p_entity_type, p_entity_id, lower(btrim(p_recipient)),
    'google_workspace', 'processing', 1, now(), v_key
  )
  on conflict (dedupe_key) where dedupe_key is not null do update
    set status = 'processing',
        attempt_count = nd.attempt_count + 1,
        last_error = null,
        last_error_code = null,
        sent_at = null,
        next_attempt_at = now(),
        updated_at = now()
    where nd.updated_at < now() - make_interval(secs => v_window)
  returning nd.id into v_id;

  return v_id;
end;
$fn$;

revoke all on function public.claim_manual_email_dispatch(text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_manual_email_dispatch(text, text, text, text, integer) to service_role;

-- ==============================================================================
-- 3. MAIL-027: MANUAL RESEND SUPPORT
-- ==============================================================================

-- The single-argument form is replaced by a two-argument form with a default, so
-- every existing plpgsql caller (admin_record_completed_lesson,
-- admin_complete_student_lesson) keeps resolving unchanged.
drop function if exists public.enqueue_completed_lesson_notifications(uuid);

create or replace function public.enqueue_completed_lesson_notifications(
  p_lesson_id uuid,
  p_dedupe_suffix text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_lesson public.student_lessons%rowtype;
  v_purchase public.student_package_purchases%rowtype;
  v_holder record;
  v_learner_name text;
  v_package_name text;
  v_remaining integer;
  v_suffix text := nullif(btrim(coalesce(p_dedupe_suffix, '')), '');
begin
  select * into v_lesson from public.student_lessons where id = p_lesson_id and status = 'completed';
  if v_lesson.id is null then return; end if;

  select ga.user_id, ga.email, ga.full_name, ga.preferred_language, gs.relationship_role
    into v_holder
  from public.guardian_students gs
  join public.guardian_accounts ga on ga.user_id = gs.guardian_user_id
  where gs.student_id = v_lesson.student_user_id and gs.active and ga.active
    and ga.email_verified_at is not null
  order by gs.is_primary desc, gs.created_at asc limit 1;
  if v_holder.email is null then return; end if;

  select full_name into v_learner_name from public.student_profiles where id = v_lesson.student_user_id;
  select * into v_purchase from public.student_package_purchases where id = v_lesson.package_purchase_id;
  if v_purchase.id is not null then
    v_remaining := greatest(0, v_purchase.lesson_count - v_purchase.lessons_used);
    select case when v_holder.preferred_language = 'en' then name_en else name_tr end
      into v_package_name from public.pricing_packages where id = v_purchase.package_id;
  end if;

  perform public.enqueue_email_notification(
    'lesson.completed', 'student_lesson', v_lesson.id::text, v_holder.email,
    'lesson_completed_account_holder', jsonb_build_object(
      'lesson_id', v_lesson.id, 'account_holder_id', v_holder.user_id,
      'account_holder_name', v_holder.full_name, 'learner_name', v_learner_name,
      'relationship_role', coalesce(v_holder.relationship_role, 'other'),
      'lesson_title', v_lesson.title, 'lesson_date', v_lesson.lesson_date,
      'teacher_note', v_lesson.teacher_note,
      'package_name', coalesce(v_package_name, v_purchase.custom_package_name, v_purchase.package_id),
      'remaining_lessons', v_remaining, 'total_lessons', v_purchase.lesson_count,
      'locale', coalesce(v_holder.preferred_language, 'tr')
    ),
    'lesson.completed:' || v_lesson.id || ':account_holder' || coalesce(':' || v_suffix, '')
  );

  if v_purchase.id is not null then
    perform public.enqueue_package_lifecycle_reminder(v_purchase.id, v_lesson.completion_previous_remaining, v_remaining);
  end if;
end;
$fn$;

revoke all on function public.enqueue_completed_lesson_notifications(uuid, text) from public, anon, authenticated;
grant execute on function public.enqueue_completed_lesson_notifications(uuid, text) to service_role;

-- MAIL-027 explicit admin dispatch: accidental retries inside 60 seconds are
-- collapsed; a later deliberate resend enqueues a genuinely new delivery.
create or replace function public.admin_send_lesson_completed_email(p_lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_lesson public.student_lessons%rowtype;
  v_sends integer;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  select * into v_lesson from public.student_lessons where id = p_lesson_id;
  if v_lesson.id is null then return jsonb_build_object('success', false, 'error_code', 'LESSON_NOT_FOUND'); end if;
  if v_lesson.status <> 'completed' then return jsonb_build_object('success', false, 'error_code', 'LESSON_NOT_COMPLETED'); end if;

  perform pg_advisory_xact_lock(hashtextextended('mail027:' || p_lesson_id::text, 0));

  select count(*) into v_sends from public.audit_logs
  where action = 'lesson.completion_email_manually_sent' and entity_id = p_lesson_id::text;

  if exists (
    select 1 from public.audit_logs
    where action = 'lesson.completion_email_manually_sent'
      and entity_id = p_lesson_id::text
      and created_at > now() - interval '60 seconds'
  ) then
    return jsonb_build_object('success', true, 'lesson_id', v_lesson.id, 'suppressed', true,
      'error_code', 'DUPLICATE_SUPPRESSED');
  end if;

  perform public.enqueue_completed_lesson_notifications(
    v_lesson.id,
    case when v_sends > 0 then 'resend' || v_sends::text else null end
  );

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'lesson.completion_email_manually_sent', 'student_lesson', v_lesson.id::text,
    jsonb_build_object('lesson_id', v_lesson.id, 'resend_index', v_sends));

  return jsonb_build_object('success', true, 'lesson_id', v_lesson.id, 'suppressed', false,
    'resend_index', v_sends);
end;
$fn$;

revoke all on function public.admin_send_lesson_completed_email(uuid) from public, anon;
grant execute on function public.admin_send_lesson_completed_email(uuid) to authenticated, service_role;

-- ==============================================================================
-- 4. NOTIFICATION DELIVERY RETENTION (90 DAYS, TERMINAL ROWS ONLY)
-- ==============================================================================

create or replace function public.purge_expired_notification_deliveries(p_retention_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_days integer := greatest(7, least(coalesce(p_retention_days, 90), 3650));
  v_deleted integer := 0;
begin
  delete from public.notification_deliveries
  where status in ('sent', 'failed', 'cancelled')
    and coalesce(updated_at, created_at) < now() - make_interval(days => v_days);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$fn$;

revoke all on function public.purge_expired_notification_deliveries(integer) from public, anon, authenticated;
grant execute on function public.purge_expired_notification_deliveries(integer) to service_role;

do $cron$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'purge-notification-deliveries-daily';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'purge-notification-deliveries-daily',
    '15 3 * * *',
    'select public.purge_expired_notification_deliveries(90);'
  );
end;
$cron$;
