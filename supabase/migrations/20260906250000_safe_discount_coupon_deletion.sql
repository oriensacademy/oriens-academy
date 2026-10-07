-- Preserve coupon redemption history while allowing admins to remove coupons
-- from the active management list.

alter table public.discount_coupons
  add column if not exists archived_at timestamptz;

create index if not exists idx_discount_coupons_not_archived
  on public.discount_coupons(created_at desc)
  where archived_at is null;

create or replace function public.admin_delete_discount_coupon(p_coupon_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_has_redemptions boolean;
begin
  if not public.is_admin() then
    raise exception using
      errcode = '42501',
      message = 'Bu işlem için yönetici yetkisi gerekiyor.';
  end if;

  perform 1
  from public.discount_coupons
  where id = p_coupon_id
  for update;

  if not found then
    return 'not_found';
  end if;

  select exists (
    select 1
    from public.discount_coupon_redemptions
    where coupon_id = p_coupon_id
  ) into v_has_redemptions;

  if v_has_redemptions then
    update public.discount_coupons
    set active = false,
        archived_at = coalesce(archived_at, now())
    where id = p_coupon_id;

    return 'archived';
  end if;

  delete from public.discount_coupons
  where id = p_coupon_id;

  return 'deleted';
end;
$$;

revoke all on function public.admin_delete_discount_coupon(uuid) from public;
grant execute on function public.admin_delete_discount_coupon(uuid) to authenticated;
grant execute on function public.admin_delete_discount_coupon(uuid) to service_role;

comment on function public.admin_delete_discount_coupon(uuid) is
  'Deletes unused coupons and archives used coupons so redemption/payment history remains intact.';
