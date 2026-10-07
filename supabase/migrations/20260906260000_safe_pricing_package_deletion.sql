-- Preserve payment and entitlement history when removing pricing packages.

alter table public.pricing_packages
  add column if not exists archived_at timestamptz;

create index if not exists idx_pricing_packages_not_archived
  on public.pricing_packages(display_order, created_at)
  where archived_at is null;

create or replace function public.admin_delete_pricing_package(p_package_id text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_has_history boolean;
begin
  if not public.is_admin() then
    raise exception using
      errcode = '42501',
      message = 'Bu işlem için yönetici yetkisi gerekiyor.';
  end if;

  perform 1
  from public.pricing_packages
  where id = p_package_id
  for update;

  if not found then
    return 'not_found';
  end if;

  select
    exists (
      select 1 from public.payment_transactions where package_id = p_package_id
    )
    or exists (
      select 1 from public.student_package_purchases where package_id = p_package_id
    )
  into v_has_history;

  if v_has_history then
    update public.pricing_packages
    set active = false,
        featured = false,
        archived_at = coalesce(archived_at, now()),
        updated_at = now()
    where id = p_package_id;

    return 'archived';
  end if;

  delete from public.pricing_packages where id = p_package_id;
  return 'deleted';
end;
$$;

revoke all on function public.admin_delete_pricing_package(text) from public;
grant execute on function public.admin_delete_pricing_package(text) to authenticated;
grant execute on function public.admin_delete_pricing_package(text) to service_role;

comment on function public.admin_delete_pricing_package(text) is
  'Deletes unused packages and archives packages referenced by payment or entitlement history.';
