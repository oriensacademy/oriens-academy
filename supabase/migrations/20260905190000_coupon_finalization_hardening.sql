-- Migration: 20260905190000_coupon_finalization_hardening.sql
-- Description: Authoritative coupon usage finalization and PayTR callback consistency hardening.
-- Guarantees:
-- 1. Coupons are only consumed upon verified successful payment callback or zero-payment finalization.
-- 2. Abandoned or failed sessions never block student quota (package_purchase_id is not null or status = 'paid').
-- 3. Integer kuruş rounding consistency across SQL calculation.

-- 1. Hardened validate_checkout_coupon RPC
create or replace function public.validate_checkout_coupon(
  p_code text,
  p_package_id text,
  p_student_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_code text;
  v_coupon public.discount_coupons%rowtype;
  v_pkg public.pricing_packages%rowtype;
  v_package_price numeric;
  v_package_price_kurus bigint;
  v_package_count integer;
  v_student_uses integer;
  v_has_previous_purchase boolean;
  v_discount_kurus bigint;
  v_max_discount_kurus bigint;
  v_discount numeric;
  v_final_amount numeric;
  v_target_user_id uuid;
begin
  v_target_user_id := coalesce(p_student_user_id, auth.uid());
  v_clean_code := upper(trim(coalesce(p_code, '')));
  
  if v_clean_code = '' then
    return jsonb_build_object('valid', false, 'error_code', 'EMPTY_CODE', 'message', 'Lütfen bir kupon kodu girin.');
  end if;

  -- 1. Get package
  select * into v_pkg from public.pricing_packages where id = p_package_id;
  if not found or not v_pkg.active then
    return jsonb_build_object('valid', false, 'error_code', 'INVALID_PACKAGE', 'message', 'Geçersiz eğitim paketi.');
  end if;
  v_package_price := coalesce(v_pkg.current_total, v_pkg.price_amount, 0);
  v_package_price_kurus := round(v_package_price * 100)::bigint;

  -- 2. Find coupon
  select * into v_coupon from public.discount_coupons where upper(code) = v_clean_code;
  if not found then
    return jsonb_build_object('valid', false, 'error_code', 'COUPON_NOT_FOUND', 'message', 'Kupon kodu geçersiz.');
  end if;

  -- 3. Check active
  if not v_coupon.active then
    return jsonb_build_object('valid', false, 'error_code', 'COUPON_INACTIVE', 'message', 'Bu kupon şu anda aktif değil.');
  end if;

  -- 4. Check date window
  if v_coupon.valid_from is not null and now() < v_coupon.valid_from then
    return jsonb_build_object('valid', false, 'error_code', 'COUPON_NOT_STARTED', 'message', 'Bu kuponun geçerlilik tarihi henüz başlamadı.');
  end if;
  if v_coupon.valid_until is not null and now() > v_coupon.valid_until then
    return jsonb_build_object('valid', false, 'error_code', 'COUPON_EXPIRED', 'message', 'Bu kuponun kullanım süresi dolmuş.');
  end if;

  -- 5. Check global usage limit
  if v_coupon.max_total_uses is not null and v_coupon.used_count >= v_coupon.max_total_uses then
    return jsonb_build_object('valid', false, 'error_code', 'USAGE_LIMIT_REACHED', 'message', 'Bu kuponun kullanım limiti dolmuş.');
  end if;

  -- 6. Check package targeting
  select count(*) into v_package_count from public.discount_coupon_packages where coupon_id = v_coupon.id;
  if v_package_count > 0 then
    if not exists (select 1 from public.discount_coupon_packages where coupon_id = v_coupon.id and package_id = p_package_id) then
      return jsonb_build_object('valid', false, 'error_code', 'PACKAGE_NOT_ELIGIBLE', 'message', 'Bu kupon bu paket için kullanılamaz.');
    end if;
  end if;

  -- 7. Check minimum order amount
  if v_coupon.minimum_order_amount is not null and v_package_price < v_coupon.minimum_order_amount then
    return jsonb_build_object('valid', false, 'error_code', 'MINIMUM_AMOUNT_NOT_MET', 'message', 'Bu kupon için minimum sepet tutarı sağlanamadı.');
  end if;

  -- 8. Check student constraints (only count verified paid redemptions)
  if v_target_user_id is not null then
    -- Check student usage limit: only count redemptions where package_purchase_id is linked or transaction is paid
    if v_coupon.max_uses_per_student is not null then
      select count(*) into v_student_uses
      from public.discount_coupon_redemptions r
      left join public.payment_transactions pt on pt.id = r.payment_transaction_id
      where r.coupon_id = v_coupon.id
        and r.student_user_id = v_target_user_id
        and (r.package_purchase_id is not null or pt.status = 'paid');

      if v_student_uses >= v_coupon.max_uses_per_student then
        return jsonb_build_object('valid', false, 'error_code', 'STUDENT_LIMIT_REACHED', 'message', 'Bu kuponu daha önce kullandınız.');
      end if;
    end if;

    -- Check first purchase only: only paid package purchases count
    if v_coupon.first_purchase_only then
      select exists (
        select 1 from public.student_package_purchases
        where student_user_id = v_target_user_id and payment_status = 'paid'
      ) into v_has_previous_purchase;

      if v_has_previous_purchase then
        return jsonb_build_object('valid', false, 'error_code', 'FIRST_PURCHASE_ONLY', 'message', 'Bu kupon yalnızca ilk paket alımında geçerlidir.');
      end if;
    end if;
  end if;

  -- 9. Calculate discount strictly in integer kuruş
  if v_coupon.discount_type = 'percentage' then
    v_discount_kurus := round((v_package_price_kurus * v_coupon.discount_value) / 100.0)::bigint;
    if v_coupon.maximum_discount_amount is not null and v_coupon.maximum_discount_amount > 0 then
      v_max_discount_kurus := round(v_coupon.maximum_discount_amount * 100)::bigint;
      v_discount_kurus := least(v_discount_kurus, v_max_discount_kurus);
    end if;
  else
    v_discount_kurus := round(v_coupon.discount_value * 100)::bigint;
  end if;

  v_discount_kurus := least(v_discount_kurus, v_package_price_kurus);
  v_discount := (v_discount_kurus::numeric) / 100.0;
  v_final_amount := ((v_package_price_kurus - v_discount_kurus)::numeric) / 100.0;

  return jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'name', v_coupon.name,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_amount', v_discount,
    'base_amount', v_package_price,
    'final_amount', v_final_amount,
    'currency', coalesce(v_pkg.currency, 'TRY')
  );
end;
$$;

revoke all on function public.validate_checkout_coupon(text, text, uuid) from public;
grant execute on function public.validate_checkout_coupon(text, text, uuid) to anon, authenticated, service_role;


-- 2. Enhanced finalize_paytr_payment with strict coupon finalization
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

  -- 2. Official PayTR Amount Verification against stored authoritative amount:
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
      if p_total_amount < (v_tx.amount - 0.05) then
        return jsonb_build_object(
          'success', false,
          'error_code', 'AMOUNT_MISMATCH',
          'message', 'Callback total_amount (' || p_total_amount || ') is lower than transaction amount (' || v_tx.amount || ')'
        );
      end if;
    end if;
  end if;

  -- 3. Idempotency check: If already paid, return existing state safely
  if v_tx.status = 'paid' then
    if p_status = 'success' then
      select id into v_purchase_id
      from public.student_package_purchases
      where payment_transaction_id = v_tx.id;

      if v_purchase_id is null then
        v_purchase_id := public.activate_paid_package(v_tx.id);
      end if;

      return jsonb_build_object(
        'success', true,
        'already_paid', true,
        'status', 'paid',
        'transaction_id', v_tx.id,
        'public_reference', v_tx.public_reference,
        'purchase_id', v_purchase_id,
        'package_id', v_tx.package_id,
        'amount', v_tx.amount,
        'currency', v_tx.currency,
        'payer_name', v_tx.payer_name,
        'payer_email', v_tx.payer_email,
        'payer_phone', v_tx.payer_phone,
        'locale', coalesce(v_tx.metadata->>'locale', 'tr')
      );
    else
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

    -- Activate student package entitlement
    v_purchase_id := public.activate_paid_package(v_tx.id);

    -- Handle discount coupon redemption finalization
    if v_tx.metadata->>'coupon_id' is not null and (v_tx.metadata->>'coupon_id') <> '' then
      v_coupon_id := (v_tx.metadata->>'coupon_id')::uuid;

      -- Upsert redemption linked to package_purchase_id
      insert into public.discount_coupon_redemptions (
        coupon_id,
        student_user_id,
        payment_transaction_id,
        package_purchase_id,
        discount_amount
      ) values (
        v_coupon_id,
        coalesce(v_tx.student_user_id, v_tx.package_owner_student_id),
        v_tx.id,
        v_purchase_id,
        coalesce((v_tx.metadata->>'discount_amount')::numeric, 0)
      )
      on conflict (payment_transaction_id) do update set
        package_purchase_id = v_purchase_id,
        discount_amount = excluded.discount_amount;

      -- Increment global used_count
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

    -- Clean up unfinalized coupon redemption so user quota is never wasted
    delete from public.discount_coupon_redemptions
    where payment_transaction_id = v_tx.id and package_purchase_id is null;

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
