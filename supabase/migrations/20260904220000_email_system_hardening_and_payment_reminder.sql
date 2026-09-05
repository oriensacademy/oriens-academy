-- Migration: 20260904220000_email_system_hardening_and_payment_reminder.sql
-- Hardening of payment reminder RPC, email verification gates, and outbox notification payloads

-- 1. Replace admin_send_payment_reminder RPC with email verification gate, Google Workspace provider tag, and rich payload
create or replace function public.admin_send_payment_reminder(
  p_payment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_tx record;
  v_meta jsonb;
  v_count integer;
  v_now timestamptz := now();
  v_admin_id uuid := auth.uid();
  v_user_id uuid;
  v_confirmed_at timestamptz;
  v_locale text;
  v_package_name text;
  v_student_name text;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error_code', 'FORBIDDEN');
  end if;

  select pt.*, pp.name_tr, pp.name_en, pp.title, pp.title_tr, pp.title_en
  into v_tx
  from public.payment_transactions pt
  left join public.pricing_packages pp on pp.id = pt.pricing_package_id
  where pt.id = p_payment_id;

  if not found then
    return jsonb_build_object('success', false, 'error_code', 'PAYMENT_NOT_FOUND');
  end if;

  if v_tx.status not in ('pending', 'processing', 'requires_action') then
    return jsonb_build_object('success', false, 'error_code', 'PAYMENT_NOT_PENDING');
  end if;

  if v_tx.payer_email is null or btrim(v_tx.payer_email) = '' then
    return jsonb_build_object('success', false, 'error_code', 'MISSING_PAYER_EMAIL');
  end if;

  -- Verification gate: If account exists in auth.users, verify email is confirmed before reminder
  select id, email_confirmed_at into v_user_id, v_confirmed_at
  from auth.users
  where lower(email) = lower(btrim(v_tx.payer_email))
     or (v_tx.package_owner_student_id is not null and id = v_tx.package_owner_student_id)
  limit 1;

  if v_user_id is not null and v_confirmed_at is null then
    return jsonb_build_object(
      'success', false,
      'error_code', 'EMAIL_NOT_VERIFIED',
      'message', 'Payer account email address is not yet verified.'
    );
  end if;

  v_meta := coalesce(v_tx.metadata, '{}'::jsonb);
  v_count := coalesce((v_meta->>'reminder_count')::integer, 0) + 1;
  v_meta := v_meta || jsonb_build_object(
    'reminder_count', v_count,
    'last_reminder_sent_at', v_now
  );

  update public.payment_transactions
  set metadata = v_meta,
      updated_at = v_now
  where id = p_payment_id;

  -- Insert into public.audit_logs
  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_admin_id,
    'payment.reminder_sent',
    'payment_transactions',
    p_payment_id,
    jsonb_build_object(
      'public_reference', v_tx.public_reference,
      'payer_email', v_tx.payer_email,
      'payer_name', v_tx.payer_name,
      'amount', v_tx.amount,
      'currency', v_tx.currency,
      'reminder_count', v_count,
      'sent_at', v_now
    )
  );

  -- Prepare localized details
  v_locale := coalesce(v_tx.metadata->>'locale', 'tr');
  v_package_name := coalesce(
    case when v_locale = 'en' then coalesce(v_tx.name_en, v_tx.title_en)
         else coalesce(v_tx.name_tr, v_tx.title_tr, v_tx.title)
    end,
    v_tx.package_id,
    'Ders Paketi'
  );
  v_student_name := coalesce(v_tx.payer_name, case when v_locale = 'en' then 'Student' else 'Öğrenci' end);

  -- Enqueue via canonical outbox with google_workspace provider and dedupe key
  perform public.enqueue_email_notification(
    'payment.reminder',
    'payment_transactions',
    p_payment_id::text,
    v_tx.payer_email,
    'payment_reminder',
    jsonb_build_object(
      'payment_id', p_payment_id,
      'public_reference', v_tx.public_reference,
      'reference', v_tx.public_reference,
      'reminder_count', v_count,
      'amount', v_tx.amount,
      'currency', coalesce(v_tx.currency, 'TRY'),
      'student_name', v_student_name,
      'payer_name', v_tx.payer_name,
      'package_name', v_package_name,
      'locale', v_locale
    ),
    'payment.reminder:' || p_payment_id::text || ':' || v_count::text
  );

  return jsonb_build_object(
    'success', true,
    'reminder_count', v_count,
    'last_reminder_sent_at', v_now
  );
end;
$$;

grant execute on function public.admin_send_payment_reminder(uuid) to authenticated, service_role;

-- 2. Update queue_guardian_email_verified_welcome with complete greeting and normalized locale
create or replace function public.queue_guardian_email_verified_welcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_verified_at is null and new.email_verified_at is not null then
    perform public.enqueue_email_notification(
      'guardian.welcome',
      'guardian_account',
      new.user_id::text,
      new.email,
      'guardian_welcome',
      jsonb_build_object(
        'guardian_name', new.full_name,
        'recipient_name', new.full_name,
        'locale', coalesce(new.preferred_language, 'tr')
      ),
      'guardian.welcome:' || new.user_id || ':guardian'
    );
  end if;
  return new;
end;
$$;
