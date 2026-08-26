-- Migration: 20260826221000_paytr_activate_paid_package_enhancement.sql
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
