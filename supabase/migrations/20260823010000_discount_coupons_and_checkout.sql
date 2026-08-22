-- Migration: Discount Coupons, Package Targeted Rules, and Student Checkout Flow
-- Author: Oriens Academy Engineering
-- Deployment Target: Localhost / Supabase Local (Do not deploy to production)

-- 1. Discount Coupons Table
create table if not exists public.discount_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 2 and 40),
  name text,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric not null check (discount_value > 0),
  currency text default 'TRY' check (currency is null or char_length(currency) = 3),
  minimum_order_amount numeric check (minimum_order_amount is null or minimum_order_amount >= 0),
  maximum_discount_amount numeric check (maximum_discount_amount is null or maximum_discount_amount > 0),
  max_total_uses integer check (max_total_uses is null or max_total_uses > 0),
  max_uses_per_student integer check (max_uses_per_student is null or max_uses_per_student > 0),
  used_count integer not null default 0 check (used_count >= 0),
  valid_from timestamptz,
  valid_until timestamptz,
  active boolean not null default true,
  first_purchase_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- Ensure uppercase index for case-insensitive matching
create index if not exists idx_discount_coupons_upper_code on public.discount_coupons(upper(code));
create index if not exists idx_discount_coupons_active on public.discount_coupons(active);

create trigger trg_discount_coupons_updated_at before update on public.discount_coupons
  for each row execute function public.set_updated_at();

-- 2. Coupon Package Targeting (Optional: empty means applies to all packages)
create table if not exists public.discount_coupon_packages (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.discount_coupons(id) on delete cascade,
  package_id text not null references public.pricing_packages(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint uq_discount_coupon_package unique (coupon_id, package_id)
);

create index if not exists idx_discount_coupon_packages_coupon on public.discount_coupon_packages(coupon_id);
create index if not exists idx_discount_coupon_packages_package on public.discount_coupon_packages(package_id);

-- 3. Discount Coupon Redemptions
create table if not exists public.discount_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.discount_coupons(id) on delete restrict,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  payment_transaction_id uuid not null unique references public.payment_transactions(id) on delete cascade,
  package_purchase_id uuid references public.student_package_purchases(id) on delete set null,
  discount_amount numeric not null check (discount_amount >= 0),
  redeemed_at timestamptz not null default now()
);

create index if not exists idx_discount_coupon_redemptions_student on public.discount_coupon_redemptions(student_user_id, coupon_id);
create index if not exists idx_discount_coupon_redemptions_coupon on public.discount_coupon_redemptions(coupon_id);

-- 4. Enable RLS
alter table public.discount_coupons enable row level security;
alter table public.discount_coupon_packages enable row level security;
alter table public.discount_coupon_redemptions enable row level security;

-- Admin policies
create policy "Admin all discount_coupons" on public.discount_coupons
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Admin all discount_coupon_packages" on public.discount_coupon_packages
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Admin all discount_coupon_redemptions" on public.discount_coupon_redemptions
  for all using (public.is_admin()) with check (public.is_admin());

-- Student policies
create policy "Student read own coupon redemptions" on public.discount_coupon_redemptions
  for select using (student_user_id = auth.uid());

grant select on public.discount_coupon_redemptions to authenticated;
grant all on public.discount_coupons, public.discount_coupon_packages, public.discount_coupon_redemptions to service_role;

-- 5. RPC: Validate Coupon for Checkout
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
  v_package_count integer;
  v_student_uses integer;
  v_has_previous_purchase boolean;
  v_discount numeric;
  v_final_amount numeric;
  v_target_user_id uuid;
begin
  v_target_user_id := coalesce(p_student_user_id, auth.uid());
  v_clean_code := upper(trim(coalesce(p_code, '')));
  
  if v_clean_code = '' then
    return jsonb_build_object('valid', false, 'error_code', 'EMPTY_CODE', 'message', 'Kupon kodu girilmedi.');
  end if;

  -- 1. Get package
  select * into v_pkg from public.pricing_packages where id = p_package_id;
  if not found or not v_pkg.active then
    return jsonb_build_object('valid', false, 'error_code', 'INVALID_PACKAGE', 'message', 'Geçersiz eğitim paketi.');
  end if;
  v_package_price := coalesce(v_pkg.current_total, v_pkg.price_amount, 0);

  -- 2. Find coupon
  select * into v_coupon from public.discount_coupons where upper(code) = v_clean_code;
  if not found then
    return jsonb_build_object('valid', false, 'error_code', 'COUPON_NOT_FOUND', 'message', 'Kupon kodu bulunamadı.');
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
    return jsonb_build_object('valid', false, 'error_code', 'COUPON_EXPIRED', 'message', 'Bu kuponun kullanım süresi doldu.');
  end if;

  -- 5. Check global usage limit
  if v_coupon.max_total_uses is not null and v_coupon.used_count >= v_coupon.max_total_uses then
    return jsonb_build_object('valid', false, 'error_code', 'USAGE_LIMIT_REACHED', 'message', 'Bu kuponun toplam kullanım limiti doldu.');
  end if;

  -- 6. Check package targeting
  select count(*) into v_package_count from public.discount_coupon_packages where coupon_id = v_coupon.id;
  if v_package_count > 0 then
    if not exists (select 1 from public.discount_coupon_packages where coupon_id = v_coupon.id and package_id = p_package_id) then
      return jsonb_build_object('valid', false, 'error_code', 'PACKAGE_NOT_ELIGIBLE', 'message', 'Bu kupon seçilen pakette geçerli değildir.');
    end if;
  end if;

  -- 7. Check minimum order amount
  if v_coupon.minimum_order_amount is not null and v_package_price < v_coupon.minimum_order_amount then
    return jsonb_build_object('valid', false, 'error_code', 'MINIMUM_AMOUNT_NOT_MET', 'message', 'Bu kupon için minimum sepet tutarı sağlanamadı.');
  end if;

  -- 8. Check student constraints if student provided
  if v_target_user_id is not null then
    -- Check student usage limit
    if v_coupon.max_uses_per_student is not null then
      select count(*) into v_student_uses from public.discount_coupon_redemptions
      where coupon_id = v_coupon.id and student_user_id = v_target_user_id;
      if v_student_uses >= v_coupon.max_uses_per_student then
        return jsonb_build_object('valid', false, 'error_code', 'STUDENT_LIMIT_REACHED', 'message', 'Bu kupon için kişisel kullanım limitinize ulaştınız.');
      end if;
    end if;

    -- Check first purchase only
    if v_coupon.first_purchase_only then
      select exists (
        select 1 from public.student_package_purchases where student_user_id = v_target_user_id
      ) into v_has_previous_purchase;
      if v_has_previous_purchase then
        return jsonb_build_object('valid', false, 'error_code', 'FIRST_PURCHASE_ONLY', 'message', 'Bu kupon yalnızca ilk paket alımında geçerlidir.');
      end if;
    end if;
  end if;

  -- 9. Calculate discount
  if v_coupon.discount_type = 'percentage' then
    v_discount := (v_package_price * v_coupon.discount_value) / 100.0;
    if v_coupon.maximum_discount_amount is not null then
      v_discount := least(v_discount, v_coupon.maximum_discount_amount);
    end if;
  else
    v_discount := v_coupon.discount_value;
  end if;

  v_discount := round(least(v_discount, v_package_price), 2);
  v_final_amount := round(greatest(0, v_package_price - v_discount), 2);

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

grant execute on function public.validate_checkout_coupon(text, text, uuid) to anon, authenticated, service_role;

-- 6. RPC: Create Student Checkout Transaction (Atomic & Server-Calculated)
create or replace function public.create_student_checkout(
  p_package_id text,
  p_payment_method text,
  p_coupon_code text default null,
  p_payer_name text default null,
  p_payer_phone text default null,
  p_idempotency_key text default null,
  p_locale text default 'tr'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_student_profile public.student_profiles%rowtype;
  v_pkg public.pricing_packages%rowtype;
  v_validation jsonb;
  v_base_amount numeric;
  v_discount_amount numeric := 0;
  v_final_amount numeric;
  v_currency text;
  v_coupon_id uuid := null;
  v_reference text;
  v_status_hash text;
  v_existing_tx public.payment_transactions%rowtype;
  v_transaction_id uuid;
  v_provider text;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    return jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Oturum açmanız gerekmektedir.');
  end if;

  -- 1. Verify student profile
  select * into v_student_profile from public.student_profiles where id = v_student_id;
  if not found or not v_student_profile.active then
    return jsonb_build_object('success', false, 'error_code', 'STUDENT_PROFILE_INACTIVE', 'message', 'Aktif öğrenci profili bulunamadı.');
  end if;

  -- 2. Verify package
  select * into v_pkg from public.pricing_packages where id = p_package_id;
  if not found or not v_pkg.active or v_pkg.purchase_mode <> 'purchasable' then
    return jsonb_build_object('success', false, 'error_code', 'PACKAGE_NOT_PURCHASABLE', 'message', 'Bu paket çevrim içi satın almaya uygun değil.');
  end if;

  v_base_amount := coalesce(v_pkg.current_total, v_pkg.price_amount, 0);
  v_currency := coalesce(v_pkg.currency, 'TRY');
  v_final_amount := v_base_amount;

  -- 3. Check idempotency: if recent pending transaction exists with same idempotency key for this student
  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select * into v_existing_tx from public.payment_transactions
    where student_user_id = v_student_id
      and metadata->>'idempotency_key' = p_idempotency_key
      and status = 'pending'
      and created_at > now() - interval '10 minutes'
    limit 1;
    
    if found then
      return jsonb_build_object(
        'success', true,
        'transaction_id', v_existing_tx.id,
        'public_reference', v_existing_tx.public_reference,
        'base_amount', coalesce((v_existing_tx.metadata->>'base_amount')::numeric, v_existing_tx.amount),
        'discount_amount', coalesce((v_existing_tx.metadata->>'discount_amount')::numeric, 0),
        'final_amount', v_existing_tx.amount,
        'currency', v_existing_tx.currency,
        'status', v_existing_tx.status,
        'payment_method', v_existing_tx.payment_method,
        'package_id', v_existing_tx.package_id,
        'package_name_tr', v_pkg.name_tr,
        'package_name_en', v_pkg.name_en,
        'lesson_count', v_pkg.lesson_count
      );
    end if;
  end if;

  -- 4. Validate coupon if supplied
  if p_coupon_code is not null and btrim(p_coupon_code) <> '' then
    v_validation := public.validate_checkout_coupon(p_coupon_code, p_package_id, v_student_id);
    if not (v_validation->>'valid')::boolean then
      return jsonb_build_object(
        'success', false,
        'error_code', v_validation->>'error_code',
        'message', v_validation->>'message'
      );
    end if;
    v_coupon_id := (v_validation->>'coupon_id')::uuid;
    v_discount_amount := (v_validation->>'discount_amount')::numeric;
    v_final_amount := (v_validation->>'final_amount')::numeric;
  end if;

  -- 5. Determine provider
  if p_payment_method = 'bank_transfer' then
    v_provider := 'manual_bank_transfer';
  elsif p_payment_method = 'card' then
    v_provider := 'bank_virtual_pos';
  else
    return jsonb_build_object('success', false, 'error_code', 'INVALID_PAYMENT_METHOD', 'message', 'Geçersiz ödeme yöntemi.');
  end if;

  -- Generate public reference
  v_reference := 'ORI-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_status_hash := md5(v_reference || now()::text);

  -- 6. Insert payment_transaction
  insert into public.payment_transactions (
    student_user_id,
    package_id,
    public_reference,
    status_token_hash,
    provider,
    amount,
    currency,
    status,
    payment_method,
    payer_name,
    payer_email,
    payer_phone,
    metadata
  ) values (
    v_student_id,
    p_package_id,
    v_reference,
    v_status_hash,
    v_provider,
    v_final_amount,
    v_currency,
    'pending',
    p_payment_method,
    coalesce(nullif(btrim(p_payer_name), ''), v_student_profile.full_name),
    v_student_profile.email,
    coalesce(nullif(btrim(p_payer_phone), ''), v_student_profile.phone),
    jsonb_build_object(
      'base_amount', v_base_amount,
      'discount_amount', v_discount_amount,
      'coupon_code', upper(trim(coalesce(p_coupon_code, ''))),
      'coupon_id', v_coupon_id,
      'idempotency_key', p_idempotency_key,
      'locale', p_locale
    )
  ) returning id into v_transaction_id;

  -- 7. Insert coupon redemption record if coupon used
  if v_coupon_id is not null then
    insert into public.discount_coupon_redemptions (
      coupon_id,
      student_user_id,
      payment_transaction_id,
      discount_amount
    ) values (
      v_coupon_id,
      v_student_id,
      v_transaction_id,
      v_discount_amount
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'public_reference', v_reference,
    'base_amount', v_base_amount,
    'discount_amount', v_discount_amount,
    'final_amount', v_final_amount,
    'currency', v_currency,
    'status', 'pending',
    'payment_method', p_payment_method,
    'package_id', p_package_id,
    'package_name_tr', v_pkg.name_tr,
    'package_name_en', v_pkg.name_en,
    'lesson_count', v_pkg.lesson_count
  );
end;
$$;

grant execute on function public.create_student_checkout(text, text, text, text, text, text, text) to authenticated;

-- 7. Upgrade admin_review_bank_transfer with coupon usage counter increment & audit
create or replace function public.admin_review_bank_transfer(
  p_payment_id uuid,
  p_decision text
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
begin
  if not public.is_admin() then
    raise exception 'ADMIN_FORBIDDEN' using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_DECISION');
  end if;

  select * into v_tx from public.payment_transactions where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error_code', 'TRANSACTION_NOT_FOUND');
  end if;

  if v_tx.status <> 'pending' and v_tx.status <> 'processing' and v_tx.status <> 'requires_action' then
    return jsonb_build_object('success', true, 'already_reviewed', true, 'status', v_tx.status);
  end if;

  if p_decision = 'approved' then
    update public.payment_transactions
    set status = 'paid', paid_at = now(), updated_at = now()
    where id = p_payment_id;

    -- Activate student package
    v_purchase_id := public.activate_paid_package(p_payment_id);

    -- Update redemption package_purchase_id and increment coupon used_count
    if v_tx.metadata->>'coupon_id' is not null and (v_tx.metadata->>'coupon_id') <> '' then
      v_coupon_id := (v_tx.metadata->>'coupon_id')::uuid;
      update public.discount_coupon_redemptions
      set package_purchase_id = v_purchase_id
      where payment_transaction_id = p_payment_id;

      update public.discount_coupons
      set used_count = used_count + 1
      where id = v_coupon_id;
    end if;

    perform public.log_admin_action(
      'bank_transfer.approved',
      'payment_transaction',
      p_payment_id::text,
      jsonb_build_object('amount', v_tx.amount, 'purchase_id', v_purchase_id, 'package_id', v_tx.package_id)
    );

    return jsonb_build_object('success', true, 'status', 'paid', 'purchase_id', v_purchase_id);
  else
    update public.payment_transactions
    set status = 'cancelled', updated_at = now()
    where id = p_payment_id;

    perform public.log_admin_action(
      'bank_transfer.rejected',
      'payment_transaction',
      p_payment_id::text,
      jsonb_build_object('amount', v_tx.amount, 'package_id', v_tx.package_id)
    );

    return jsonb_build_object('success', true, 'status', 'cancelled');
  end if;
end;
$$;

grant execute on function public.admin_review_bank_transfer(uuid, text) to authenticated;
