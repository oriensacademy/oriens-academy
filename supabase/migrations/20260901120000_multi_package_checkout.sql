-- Multi-package checkout entitlements and explicit zero-payment completion.
-- The legacy payment_transactions.package_id remains the first item for backwards compatibility;
-- canonical order items are stored in the server-authored metadata.checkout_items snapshot.

alter table public.student_package_purchases
  drop constraint if exists student_package_purchases_payment_transaction_id_key;

create unique index if not exists uq_student_package_purchase_payment_package
  on public.student_package_purchases(payment_transaction_id, package_id)
  where payment_transaction_id is not null;

create or replace function public.activate_paid_package(p_payment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.payment_transactions%rowtype;
  v_item jsonb;
  v_items jsonb;
  v_purchase_id uuid;
  v_first_purchase_id uuid;
  v_student_id uuid;
  v_package_id text;
  v_lesson_count integer;
  v_price_amount numeric;
begin
  select * into v_tx from public.payment_transactions
  where id = p_payment_id and status = 'paid'
  for update;
  if not found then raise exception 'Verified paid transaction not found for payment_id %', p_payment_id; end if;

  v_student_id := coalesce(v_tx.package_owner_student_id, v_tx.student_user_id);
  if v_student_id is null and nullif(btrim(v_tx.payer_email), '') is not null then
    select id into v_student_id from public.student_profiles
    where lower(email) = lower(btrim(v_tx.payer_email)) and active limit 1;
    if v_student_id is not null then
      update public.payment_transactions
      set student_user_id = v_student_id, package_owner_student_id = v_student_id
      where id = p_payment_id;
    end if;
  end if;
  if v_student_id is null then return null; end if;

  v_items := v_tx.metadata->'checkout_items';
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    v_items := jsonb_build_array(jsonb_build_object(
      'package_id', v_tx.package_id,
      'lesson_count', v_tx.metadata->>'lesson_count',
      'final_amount', v_tx.amount
    ));
  end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    v_package_id := nullif(v_item->>'package_id', '');
    if v_package_id is null then raise exception 'Checkout item package_id is missing'; end if;
    select coalesce(
      nullif(v_item->>'lesson_count', '')::integer,
      lesson_count,
      case v_package_id when 'single' then 1 when 'package5' then 5 when 'package10' then 10 when 'package20' then 20 when 'package30' then 30 else null end
    ) into v_lesson_count from public.pricing_packages where id = v_package_id;
    if v_lesson_count is null or v_lesson_count <= 0 then raise exception 'Package lesson count is invalid for %', v_package_id; end if;
    v_price_amount := greatest(0, coalesce(nullif(v_item->>'final_amount', '')::numeric, 0));

    insert into public.student_package_purchases(
      student_user_id, package_id, payment_transaction_id, lesson_count,
      price_amount, currency, payment_status, assignment_source
    ) values (
      v_student_id, v_package_id, v_tx.id, v_lesson_count,
      v_price_amount, v_tx.currency, 'paid', 'payment'
    )
    on conflict (payment_transaction_id, package_id) where payment_transaction_id is not null
    do update set payment_status = 'paid', price_amount = excluded.price_amount, currency = excluded.currency
    returning id into v_purchase_id;

    if v_first_purchase_id is null then v_first_purchase_id := v_purchase_id; end if;
  end loop;

  return v_first_purchase_id;
end;
$$;

revoke all on function public.activate_paid_package(uuid) from public, anon, authenticated;
grant execute on function public.activate_paid_package(uuid) to service_role;

create or replace function public.finalize_zero_payment_order(p_payment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.payment_transactions%rowtype;
  v_purchase_id uuid;
  v_coupon_id uuid;
begin
  select * into v_tx from public.payment_transactions where id = p_payment_id for update;
  if not found or v_tx.status not in ('pending', 'paid') or v_tx.amount <> 0 or v_tx.provider <> 'coupon' then
    raise exception 'Valid zero-payment order not found';
  end if;

  if v_tx.status = 'pending' then
    update public.payment_transactions
    set status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now()
    where id = v_tx.id;
    v_tx.status := 'paid';
  end if;

  v_purchase_id := public.activate_paid_package(v_tx.id);
  if coalesce((v_tx.metadata->>'coupon_counted')::boolean, false) = false and nullif(v_tx.metadata->>'coupon_id', '') is not null then
    v_coupon_id := (v_tx.metadata->>'coupon_id')::uuid;
    update public.discount_coupon_redemptions set package_purchase_id = v_purchase_id where payment_transaction_id = v_tx.id;
    update public.discount_coupons set used_count = used_count + 1 where id = v_coupon_id;
    update public.payment_transactions set metadata = metadata || jsonb_build_object('coupon_counted', true, 'zero_payment_finalized_at', now()) where id = v_tx.id;
  end if;
  return v_purchase_id;
end;
$$;

revoke all on function public.finalize_zero_payment_order(uuid) from public, anon, authenticated;
grant execute on function public.finalize_zero_payment_order(uuid) to service_role;
