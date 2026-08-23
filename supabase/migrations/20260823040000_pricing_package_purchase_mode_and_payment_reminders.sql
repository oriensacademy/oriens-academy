-- Migration: Pricing Package Purchase Mode & Payment Reminders
-- Migration ID: 20260823040000_pricing_package_purchase_mode_and_payment_reminders.sql

-- 1. Ensure core student pricing packages are active and purchasable
update public.pricing_packages
set purchase_mode = 'purchasable',
    active = true
where id in ('single', 'package5', 'package10', 'package20', 'package30');

-- 2. Create admin_send_payment_reminder RPC function
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
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error_code', 'FORBIDDEN');
  end if;

  select * into v_tx
  from public.payment_transactions
  where id = p_payment_id;

  if not found then
    return jsonb_build_object('success', false, 'error_code', 'PAYMENT_NOT_FOUND');
  end if;

  if v_tx.status not in ('pending', 'processing', 'requires_action') then
    return jsonb_build_object('success', false, 'error_code', 'PAYMENT_NOT_PENDING');
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

  -- Insert audit log
  insert into public.crm_audit_logs (
    actor_id,
    action,
    entity_table,
    entity_id,
    details
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

  -- Insert notification log
  if v_tx.payer_email is not null and v_tx.payer_email != '' then
    insert into public.notification_logs (
      event_type,
      recipient,
      subject,
      status,
      provider,
      metadata
    ) values (
      'payment_reminder',
      v_tx.payer_email,
      'Oriens Academy — Ödeme Hatırlatması / Payment Reminder (' || v_tx.public_reference || ')',
      'sent',
      'google_workspace',
      jsonb_build_object(
        'payment_id', p_payment_id,
        'public_reference', v_tx.public_reference,
        'reminder_count', v_count
      )
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'reminder_count', v_count,
    'last_reminder_sent_at', v_now
  );
end;
$$;

grant execute on function public.admin_send_payment_reminder(uuid) to authenticated, service_role;
