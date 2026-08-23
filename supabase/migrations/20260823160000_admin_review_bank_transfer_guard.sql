-- Ensure admin_review_bank_transfer only permits manual review on bank_transfer payment methods and logs payment.reviewed
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

  -- Card and external gateway payments cannot be manually approved by bank review RPC
  if v_tx.payment_method <> 'bank_transfer' then
    return jsonb_build_object('success', false, 'error_code', 'MANUAL_REVIEW_NOT_ALLOWED');
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
      'payment.reviewed',
      'payment_transaction',
      p_payment_id::text,
      jsonb_build_object('decision', p_decision, 'amount', v_tx.amount, 'purchase_id', v_purchase_id, 'package_id', v_tx.package_id)
    );

    perform public.log_admin_action(
      'bank_transfer.approved',
      'payment_transaction',
      p_payment_id::text,
      jsonb_build_object('decision', p_decision, 'amount', v_tx.amount, 'purchase_id', v_purchase_id, 'package_id', v_tx.package_id)
    );

    return jsonb_build_object('success', true, 'status', 'paid', 'purchase_id', v_purchase_id);
  else
    update public.payment_transactions
    set status = 'cancelled', updated_at = now()
    where id = p_payment_id;

    perform public.log_admin_action(
      'payment.reviewed',
      'payment_transaction',
      p_payment_id::text,
      jsonb_build_object('decision', p_decision, 'amount', v_tx.amount, 'package_id', v_tx.package_id)
    );

    perform public.log_admin_action(
      'bank_transfer.rejected',
      'payment_transaction',
      p_payment_id::text,
      jsonb_build_object('decision', p_decision, 'amount', v_tx.amount, 'package_id', v_tx.package_id)
    );

    return jsonb_build_object('success', true, 'status', 'cancelled');
  end if;
end;
$$;

revoke all on function public.admin_review_bank_transfer(uuid, text) from public, anon;
grant execute on function public.admin_review_bank_transfer(uuid, text) to authenticated, service_role;
