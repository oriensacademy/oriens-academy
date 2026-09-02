-- ==============================================================================
-- Migration: 20260902230000_payment_preload_dedup_and_admin_filter.sql
-- Description:
-- 1. Add is_preload boolean column and index on payment_transactions
-- 2. Add checkout_idempotency_key column and partial unique index on payment_transactions
-- 3. Archive identified synthetic QA duplicate preload rows for test user otp3
-- ==============================================================================

-- 1. Add is_preload column to payment_transactions
alter table public.payment_transactions
  add column if not exists is_preload boolean not null default false;

create index if not exists idx_payment_transactions_is_preload
  on public.payment_transactions(is_preload)
  where is_preload = true;

-- 2. Add checkout_idempotency_key column
alter table public.payment_transactions
  add column if not exists checkout_idempotency_key text;

-- Partial unique index ensuring at most ONE active pending preload exists for a given checkout context
create unique index if not exists idx_payment_transactions_active_preload
  on public.payment_transactions(checkout_idempotency_key)
  where status = 'pending' and is_archived = false and checkout_idempotency_key is not null;

-- 3. Archive the 3 synthetic QA duplicate preload rows from user otp3
update public.payment_transactions
set is_archived = true,
    archived_at = coalesce(archived_at, now()),
    archive_reason = 'qa_duplicate_preload_cleanup'
where id in (
  '38cbf363-b018-4e5a-8f4d-8f7bca87589b',
  'ec981036-8009-4527-97a6-7aa585fdb273',
  '98e4dee5-e3c1-4b5c-8635-1f6878813532'
) and status = 'pending';
