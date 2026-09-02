-- ==============================================================================
-- Migration: Harden purchase_email_verification_challenges RLS & Client Isolation
-- ==============================================================================

-- 1. Ensure Row Level Security is strictly enabled
alter table public.purchase_email_verification_challenges enable row level security;
alter table public.purchase_email_verification_challenges force row level security;

-- 2. Drop any legacy/client policies so no direct access exists for anon or authenticated
drop policy if exists "Users can view their own challenges" on public.purchase_email_verification_challenges;
drop policy if exists "Users can insert their own challenges" on public.purchase_email_verification_challenges;
drop policy if exists "Users can update their own challenges" on public.purchase_email_verification_challenges;
drop policy if exists "Users can delete their own challenges" on public.purchase_email_verification_challenges;
drop policy if exists "challenges_select_policy" on public.purchase_email_verification_challenges;
drop policy if exists "challenges_insert_policy" on public.purchase_email_verification_challenges;
drop policy if exists "challenges_update_policy" on public.purchase_email_verification_challenges;
drop policy if exists "challenges_delete_policy" on public.purchase_email_verification_challenges;

-- 3. Revoke all CRUD and metadata permissions from public, anon, and authenticated roles
revoke all on table public.purchase_email_verification_challenges from public, anon, authenticated;

-- 4. Grant explicit backend CRUD permissions solely to service_role (used by Edge Functions)
grant select, insert, update, delete on table public.purchase_email_verification_challenges to service_role;

-- 5. Comment on table documenting strict server-side only access
comment on table public.purchase_email_verification_challenges is
  'Purchase-only email verification OTP challenges. Direct client/browser access is strictly prohibited. Managed exclusively via Edge Functions.';
