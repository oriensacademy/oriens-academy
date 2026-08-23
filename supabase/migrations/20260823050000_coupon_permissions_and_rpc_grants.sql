-- Migration: Coupon Permissions and RPC Security Grants
-- Migration ID: 20260823050000_coupon_permissions_and_rpc_grants.sql

-- 1. Ensure Table Privileges for Authenticated Admin Role (RLS still strictly enforces is_admin())
grant select, insert, update, delete on public.discount_coupons to authenticated;
grant select, insert, update, delete on public.discount_coupon_packages to authenticated;
grant select, insert, update, delete on public.discount_coupon_redemptions to authenticated;
grant all on public.discount_coupons, public.discount_coupon_packages, public.discount_coupon_redemptions to service_role;

-- 2. Ensure validate_checkout_coupon RPC is available to all callers (public/anon/authenticated) as SECURITY DEFINER
grant execute on function public.validate_checkout_coupon(text, text, uuid) to anon, authenticated, service_role;
grant execute on function public.create_student_checkout(text, text, text, text, text, text) to anon, authenticated, service_role;
