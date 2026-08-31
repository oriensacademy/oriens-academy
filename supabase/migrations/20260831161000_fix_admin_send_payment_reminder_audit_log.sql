-- Fix audit log and notification table references in admin_send_payment_reminder

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

  -- Insert into notification_deliveries if recipient email exists
  if v_tx.payer_email is not null and v_tx.payer_email != '' then
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
    ) values (
      'email',
      'payment_reminder',
      'payment_transactions',
      p_payment_id::text,
      v_tx.payer_email,
      'Oriens Academy — Ödeme Hatırlatması / Payment Reminder (' || v_tx.public_reference || ')',
      'pending',
      'resend',
      'payment_reminder',
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
