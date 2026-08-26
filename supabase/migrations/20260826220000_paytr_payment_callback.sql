-- Migration: 20260826220000_paytr_payment_callback.sql
-- PayTR iFrame API Callback & Finalization RPC

-- Enhanced activate_paid_package with automatic student profile matching by email
create or replace function public.activate_paid_package(p_payment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  transaction_row public.payment_transactions%rowtype;
  package_row public.pricing_packages%rowtype;
  purchase_id uuid;
  v_student_id uuid;
begin
  select * into transaction_row from public.payment_transactions where id = p_payment_id and status = 'paid' for update;
  if not found then raise exception 'Verified paid transaction not found'; end if;

  -- If student is not linked directly, attempt linking by payer email
  if transaction_row.student_user_id is null and transaction_row.payer_email is not null and transaction_row.payer_email <> '' then
    select id into v_student_id from public.student_profiles where lower(email) = lower(trim(transaction_row.payer_email)) and active limit 1;
    if v_student_id is not null then
      update public.payment_transactions set student_user_id = v_student_id where id = p_payment_id;
      transaction_row.student_user_id := v_student_id;
    end if;
  end if;

  if transaction_row.student_user_id is null then
    -- Transaction is marked paid, but student account does not exist yet.
    -- Package will be linked upon student registration.
    return null;
  end if;

  select * into package_row from public.pricing_packages where id = transaction_row.package_id;
  if package_row.lesson_count is null then raise exception 'Package lesson count is not configured'; end if;

  insert into public.student_package_purchases(
    student_user_id,
    package_id,
    payment_transaction_id,
    lesson_count,
    price_amount,
    currency,
    payment_status,
    assignment_source
  )
  values(
    transaction_row.student_user_id,
    transaction_row.package_id,
    transaction_row.id,
    package_row.lesson_count,
    transaction_row.amount,
    transaction_row.currency,
    'paid',
    'payment'
  )
  on conflict(payment_transaction_id) do update set
    payment_status = 'paid',
    price_amount = excluded.price_amount,
    currency = excluded.currency
  returning id into purchase_id;

  return purchase_id;
end;
$$;

revoke all on function public.activate_paid_package(uuid) from public, anon, authenticated;
grant execute on function public.activate_paid_package(uuid) to service_role;

-- Canonical PayTR Payment Finalization RPC
create or replace function public.finalize_paytr_payment(
  p_merchant_oid text,
  p_status text,
  p_total_amount numeric default null,
  p_paytr_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.payment_transactions%rowtype;
  v_purchase_id uuid;
  v_coupon_id uuid;
  v_is_uuid boolean;
begin
  -- 1. Locate payment transaction by public_reference, id, or provider_transaction_id
  select (p_merchant_oid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') into v_is_uuid;

  if v_is_uuid then
    select * into v_tx
    from public.payment_transactions
    where public_reference = p_merchant_oid or id = p_merchant_oid::uuid or provider_transaction_id = p_merchant_oid
    for update;
  else
    select * into v_tx
    from public.payment_transactions
    where public_reference = p_merchant_oid or provider_transaction_id = p_merchant_oid
    for update;
  end if;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error_code', 'TRANSACTION_NOT_FOUND',
      'message', 'Transaction not found for merchant_oid'
    );
  end if;

  -- 2. Idempotency check: If already paid
  if v_tx.status = 'paid' then
    if p_status = 'success' then
      return jsonb_build_object(
        'success', true,
        'already_paid', true,
        'status', 'paid',
        'transaction_id', v_tx.id,
        'public_reference', v_tx.public_reference,
        'package_id', v_tx.package_id
      );
    else
      -- Cannot downgrade a verified paid transaction to failed
      return jsonb_build_object(
        'success', false,
        'error_code', 'CANNOT_DOWNGRADE_PAID_TRANSACTION',
        'message', 'A paid transaction cannot be downgraded by a later failed callback'
      );
    end if;
  end if;

  -- 3. If callback status is success
  if p_status = 'success' then
    update public.payment_transactions
    set
      status = 'paid',
      provider = 'paytr',
      provider_transaction_id = coalesce(v_tx.provider_transaction_id, p_merchant_oid),
      paid_at = coalesce(v_tx.paid_at, now()),
      updated_at = now(),
      metadata = v_tx.metadata || jsonb_build_object(
        'paytr_callback', p_paytr_payload,
        'paytr_finalized_at', now()
      )
    where id = v_tx.id;

    -- Activate student package (idempotent ON CONFLICT)
    v_purchase_id := public.activate_paid_package(v_tx.id);

    -- Handle discount coupon redemption if applied
    if v_tx.metadata->>'coupon_id' is not null and (v_tx.metadata->>'coupon_id') <> '' then
      v_coupon_id := (v_tx.metadata->>'coupon_id')::uuid;
      update public.discount_coupon_redemptions
      set package_purchase_id = v_purchase_id
      where payment_transaction_id = v_tx.id;

      update public.discount_coupons
      set used_count = used_count + 1
      where id = v_coupon_id;
    end if;

    return jsonb_build_object(
      'success', true,
      'already_paid', false,
      'status', 'paid',
      'transaction_id', v_tx.id,
      'public_reference', v_tx.public_reference,
      'purchase_id', v_purchase_id,
      'package_id', v_tx.package_id,
      'amount', v_tx.amount,
      'currency', v_tx.currency,
      'payment_method', v_tx.payment_method,
      'payer_name', v_tx.payer_name,
      'payer_email', v_tx.payer_email,
      'payer_phone', v_tx.payer_phone,
      'locale', coalesce(v_tx.metadata->>'locale', 'tr')
    );
  else
    -- 4. If callback status is failure
    update public.payment_transactions
    set
      status = 'failed',
      provider = 'paytr',
      updated_at = now(),
      metadata = v_tx.metadata || jsonb_build_object(
        'paytr_callback', p_paytr_payload,
        'failed_reason_code', p_paytr_payload->>'failed_reason_code',
        'failed_reason_msg', p_paytr_payload->>'failed_reason_msg',
        'paytr_failed_at', now()
      )
    where id = v_tx.id;

    return jsonb_build_object(
      'success', true,
      'already_paid', false,
      'status', 'failed',
      'transaction_id', v_tx.id,
      'public_reference', v_tx.public_reference,
      'package_id', v_tx.package_id
    );
  end if;
end;
$$;

revoke all on function public.finalize_paytr_payment(text, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_paytr_payment(text, text, numeric, jsonb) to service_role;
