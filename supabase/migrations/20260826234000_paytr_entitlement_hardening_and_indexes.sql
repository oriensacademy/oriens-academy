-- Migration: 20260826234000_paytr_entitlement_hardening_and_indexes.sql
-- Description: P0 PayTR Package Entitlement hardening, automatic registration reconciliation,
-- atomic idempotency repair, and performance indexes for admin payment filters.

-- 1. Enhanced activate_paid_package with robust student resolution, snapshot fallback, and idempotent safety
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
  v_lesson_count integer;
begin
  -- 1. Check if entitlement already exists for this payment (idempotent shortcut)
  select id into purchase_id
  from public.student_package_purchases
  where payment_transaction_id = p_payment_id;

  if purchase_id is not null then
    return purchase_id;
  end if;

  -- 2. Lock payment transaction row
  select * into transaction_row
  from public.payment_transactions
  where id = p_payment_id and status = 'paid'
  for update;

  if not found then
    raise exception 'Verified paid transaction not found for payment_id %', p_payment_id;
  end if;

  -- 3. Resolve student profile / auth user mapping
  if transaction_row.student_user_id is not null then
    -- Verify student profile exists
    select id into v_student_id
    from public.student_profiles
    where id = transaction_row.student_user_id;

    if v_student_id is null then
      -- Student profile missing but auth user may exist
      select id into v_student_id
      from auth.users
      where id = transaction_row.student_user_id;

      if v_student_id is not null then
        -- Ensure minimal student profile is created
        insert into public.student_profiles (id, full_name, email, active)
        select v_student_id, coalesce(transaction_row.payer_name, 'Student'), lower(coalesce(transaction_row.payer_email, u.email)), true
        from auth.users u where u.id = v_student_id
        on conflict (id) do update set active = true;
      end if;
    end if;
  elsif transaction_row.payer_email is not null and trim(transaction_row.payer_email) <> '' then
    -- Attempt resolution by payer email in student_profiles
    select id into v_student_id
    from public.student_profiles
    where lower(email) = lower(trim(transaction_row.payer_email)) and active
    limit 1;

    if v_student_id is null then
      -- Check auth.users by email
      select id into v_student_id
      from auth.users
      where lower(email) = lower(trim(transaction_row.payer_email))
      limit 1;

      if v_student_id is not null then
        -- Ensure student_profiles row
        insert into public.student_profiles (id, full_name, email, active)
        values (v_student_id, coalesce(transaction_row.payer_name, 'Student'), lower(trim(transaction_row.payer_email)), true)
        on conflict (id) do update set active = true;
      end if;
    end if;

    if v_student_id is not null then
      update public.payment_transactions
      set student_user_id = v_student_id
      where id = p_payment_id;
      transaction_row.student_user_id := v_student_id;
    end if;
  end if;

  if transaction_row.student_user_id is null then
    -- Student account does not exist yet (guest checkout scenario).
    -- Transaction is marked paid and package will be automatically activated when student registers.
    return null;
  end if;

  -- 4. Resolve Lesson Count: pricing_packages -> metadata snapshot -> canonical fallback
  select * into package_row
  from public.pricing_packages
  where id = transaction_row.package_id;

  v_lesson_count := coalesce(
    package_row.lesson_count,
    (transaction_row.metadata->>'lesson_count')::integer,
    case transaction_row.package_id
      when 'single' then 1
      when 'package5' then 5
      when 'package10' then 10
      when 'package20' then 20
      when 'package30' then 30
      else 1
    end
  );

  if v_lesson_count is null or v_lesson_count <= 0 then
    v_lesson_count := 1;
  end if;

  -- 5. Insert atomic student_package_purchases record
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
    v_lesson_count,
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


-- 2. Enhanced finalize_paytr_payment with guaranteed entitlement verification on idempotency
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

  -- 3. Idempotency check: If already paid, verify & ensure package entitlement exists
  if v_tx.status = 'paid' then
    if p_status = 'success' then
      -- Ensure package is activated if it was missed previously
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

    -- Activate student package atomically
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


-- 3. Registration Trigger: Automatically activate any paid transactions upon student signup
create or replace function public.create_student_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_paid_tx record;
begin
  if new.email is null then return new; end if;
  if coalesce(new.raw_app_meta_data ->> 'role', '') = 'admin' then return new; end if;

  v_name := left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)), 100);
  if char_length(v_name) < 2 then v_name := 'Student'; end if;

  insert into public.student_profiles (
    id, full_name, email, phone, preferred_language, school, target_country, target_university, target_exam
  ) values (
    new.id,
    v_name,
    lower(new.email),
    left(nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''), 30),
    case when new.raw_user_meta_data ->> 'preferred_language' = 'en' then 'en' else 'tr' end,
    left(nullif(btrim(new.raw_user_meta_data ->> 'school'), ''), 160),
    left(nullif(btrim(new.raw_user_meta_data ->> 'target_country'), ''), 120),
    left(nullif(btrim(new.raw_user_meta_data ->> 'target_university'), ''), 160),
    left(nullif(btrim(new.raw_user_meta_data ->> 'target_exam'), ''), 80)
  ) on conflict (id) do update set
    email = lower(new.email),
    updated_at = now();

  -- Link historical bookings
  update public.bookings
  set student_user_id = new.id
  where student_user_id is null and lower(email) = lower(new.email);

  -- Link historical payment transactions
  update public.payment_transactions
  set student_user_id = new.id
  where (student_user_id is null or student_user_id <> new.id)
    and lower(payer_email) = lower(new.email);

  -- Automatically activate package for all paid transactions that lack an entitlement record
  for v_paid_tx in
    select id from public.payment_transactions
    where student_user_id = new.id
      and status = 'paid'
      and id not in (select payment_transaction_id from public.student_package_purchases where payment_transaction_id is not null)
  loop
    perform public.activate_paid_package(v_paid_tx.id);
  end loop;

  return new;
end;
$$;


-- 4. Reconciliation RPC: Idempotently repair any historically paid transactions with missing entitlements
create or replace function public.reconcile_missing_package_entitlements()
returns table (
  payment_transaction_id uuid,
  public_reference text,
  payer_email text,
  package_id text,
  purchase_id uuid,
  reconciliation_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_res_purchase_id uuid;
begin
  for r in
    select pt.id, pt.public_reference, pt.payer_email, pt.package_id, pt.student_user_id
    from public.payment_transactions pt
    where pt.status = 'paid'
      and pt.id not in (
        select spp.payment_transaction_id
        from public.student_package_purchases spp
        where spp.payment_transaction_id is not null
      )
    order by pt.created_at asc
  loop
    begin
      v_res_purchase_id := public.activate_paid_package(r.id);

      payment_transaction_id := r.id;
      public_reference := r.public_reference;
      payer_email := r.payer_email;
      package_id := r.package_id;
      purchase_id := v_res_purchase_id;

      if v_res_purchase_id is not null then
        reconciliation_status := 'ACTIVATED';
      else
        reconciliation_status := 'STUDENT_ACCOUNT_PENDING';
      end if;

      return next;
    exception when others then
      payment_transaction_id := r.id;
      public_reference := r.public_reference;
      payer_email := r.payer_email;
      package_id := r.package_id;
      purchase_id := null;
      reconciliation_status := 'ERROR: ' || sqlerrm;
      return next;
    end;
  end loop;
end;
$$;

revoke all on function public.reconcile_missing_package_entitlements() from public, anon, authenticated;
grant execute on function public.reconcile_missing_package_entitlements() to service_role;


-- 5. Performance indexes for admin payment and financial flow queries
create index if not exists idx_payment_transactions_provider_created
  on public.payment_transactions(provider, created_at desc);

create index if not exists idx_payment_transactions_payer_email
  on public.payment_transactions(lower(payer_email));

create index if not exists idx_payment_transactions_method_status
  on public.payment_transactions(payment_method, status);

create index if not exists idx_payment_transactions_package_id
  on public.payment_transactions(package_id);


-- 6. Execute reconciliation automatically
select * from public.reconcile_missing_package_entitlements();
