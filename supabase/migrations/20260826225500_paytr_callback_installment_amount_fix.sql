-- Migration: 20260826225500_paytr_callback_installment_amount_fix.sql
-- Align finalize_paytr_payment amount verification with PayTR iFrame specification
-- (Verifies payment_amount against original order amount while safely accepting installment total_amount >= order amount)

-- Drop overloaded legacy 4-arg signature to avoid ambiguous function call resolution
drop function if exists public.finalize_paytr_payment(text, text, numeric, jsonb);

create or replace function public.finalize_paytr_payment(
  p_merchant_oid text,
  p_status text,
  p_total_amount numeric default null,
  p_paytr_payload jsonb default '{}'::jsonb,
  p_payment_amount numeric default null
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
  v_effective_payment_amount numeric;
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

  -- Determine payment_amount: check explicit parameter or parse from payload
  v_effective_payment_amount := p_payment_amount;
  if v_effective_payment_amount is null and p_paytr_payload->>'payment_amount' is not null and (p_paytr_payload->>'payment_amount') <> '' then
    v_effective_payment_amount := (p_paytr_payload->>'payment_amount')::numeric / 100;
  end if;

  -- 2. Official PayTR Amount Verification:
  -- When payment_amount is provided by PayTR, it corresponds to the original Step 1 package amount.
  -- total_amount may be higher in case of installments or payment method fees.
  if p_status = 'success' then
    if v_effective_payment_amount is not null then
      if abs(v_tx.amount - v_effective_payment_amount) > 0.05 then
        return jsonb_build_object(
          'success', false,
          'error_code', 'AMOUNT_MISMATCH',
          'message', 'Callback payment_amount (' || v_effective_payment_amount || ') does not match transaction amount (' || v_tx.amount || ')'
        );
      end if;
    elsif p_total_amount is not null then
      -- If payment_amount is absent, total_amount must be at least the base transaction amount
      if p_total_amount < (v_tx.amount - 0.05) then
        return jsonb_build_object(
          'success', false,
          'error_code', 'AMOUNT_MISMATCH',
          'message', 'Callback total_amount (' || p_total_amount || ') is lower than transaction amount (' || v_tx.amount || ')'
        );
      end if;
    end if;
  end if;

  -- 3. Idempotency check: If already paid
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

  -- 4. If callback status is success
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
        'provider_collected_total', coalesce(p_total_amount, v_tx.amount),
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
    -- 5. If callback status is failure
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

revoke all on function public.finalize_paytr_payment(text, text, numeric, jsonb, numeric) from public, anon, authenticated;
grant execute on function public.finalize_paytr_payment(text, text, numeric, jsonb, numeric) to service_role;
