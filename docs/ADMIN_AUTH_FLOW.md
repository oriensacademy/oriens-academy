# Oriens Academy administrator authentication

## Single administrator model

The administration area authorizes a user only when both conditions are true:

1. Supabase Auth `app_metadata.role` is `admin`.
2. The matching `public.admin_profiles` row has `role = 'admin'` and `active = true`.

The recovery identity is configured with the server-only `ADMIN_AUTH_EMAIL` Supabase Edge Function secret. It must match the intended Auth user and is never accepted from frontend role data. The service-role key remains exclusively in the Edge Function runtime.

## Sign-in

The login form starts blank and uses Supabase `signInWithPassword`. Successful credentials are still rejected from the admin UI when either authorization check above fails.

## Password recovery (current)

`/admin/forgot-password` is a redirect stub to the unified `/tr/sifremi-unuttum` (`/en/forgot-password`) page, which is shared by admin and student accounts. It submits the normalized email, locale, and a Cloudflare Turnstile token to the `request-password-recovery` Edge Function, which:

1. verifies the Turnstile token server-side;
2. atomically claims a DB-backed cooldown via the `check_and_claim_recovery_rate_limit` RPC;
3. calls `supabaseAdmin.auth.admin.generateLink({ type: "recovery" })` to produce a Supabase Auth recovery action link (no password is generated or handled by this function -- the admin/student sets their own new password);
4. emails that link via the Google Workspace-backed `dispatchPasswordResetEmail` (`_shared/email/service.ts`), not Resend;
5. the link redirects to `/tr/sifre-yenile` or `/en/reset-password`, where the user sets a new password directly through Supabase Auth.

The response is deliberately neutral so it does not disclose whether an account exists. See "Legacy `admin-password-reset`" below for the older, unused, temporary-password mechanism this replaced.

## Legacy `admin-password-reset` (unused)

An older Edge Function, `admin-password-reset`, generated a random temporary password server-side and emailed it via Resend to a single server-configured administrator address. Nothing in the frontend or any other Edge Function calls it anymore (verified by repository-wide search) -- password recovery for both admin and student accounts now goes exclusively through `request-password-recovery` above. The function has not been undeployed; it is a candidate for removal from the Supabase project. Do not reintroduce a caller for it without first reconciling it with the current recovery-link flow.

## Authenticated password change

Admin Settings asks for the current password, reauthenticates with `signInWithPassword`, then uses `supabase.auth.updateUser` for the new password. New passwords require at least eight characters plus uppercase, lowercase, number, and symbol characters. Admin email changes are intentionally unavailable in the UI because changing the recovery identity also requires a coordinated server-secret and profile change.

## Required server configuration

Configure these as Supabase Edge Function secrets, never as `NEXT_PUBLIC_` variables:

- `ADMIN_AUTH_EMAIL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `TURNSTILE_SECRET_KEY`

The browser needs only the public Supabase URL/publishable key and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

## Operations

Apply `20260813130000_admin_password_reset_rate_limit.sql` before deploying the function. Deploying the migration or function and setting the production secret are explicit production operations and are not performed during localhost-only work.

Do not test the endpoint against the live administrator account unless the mailbox owner is present. A successful invocation immediately invalidates the previous password.
