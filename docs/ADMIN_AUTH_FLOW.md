# Oriens Academy administrator authentication

## Single administrator model

The administration area authorizes a user only when both conditions are true:

1. Supabase Auth `app_metadata.role` is `admin`.
2. The matching `public.admin_profiles` row has `role = 'admin'` and `active = true`.

The recovery identity is configured with the server-only `ADMIN_AUTH_EMAIL` Supabase Edge Function secret. It must match the intended Auth user and is never accepted from frontend role data. The service-role key remains exclusively in the Edge Function runtime.

## Sign-in

The login form starts blank and uses Supabase `signInWithPassword`. Successful credentials are still rejected from the admin UI when either authorization check above fails.

## Temporary-password recovery

`/admin/forgot-password` submits the normalized email, locale, and a Cloudflare Turnstile token to the `admin-password-reset` Edge Function. The public response is deliberately neutral so it does not disclose whether an account exists.

The function:

1. validates origin, method, payload, and Turnstile action;
2. compares the email with the server-only configured administrator email;
3. atomically claims separate 10-minute DB-backed cooldowns keyed by SHA-256(email) and SHA-256(IP);
4. verifies exactly one matching Auth user with the admin role and an active admin profile;
5. creates a 16-character password with `crypto.getRandomValues`, including uppercase, lowercase, number, and symbol characters;
6. changes that same Auth user's password with the Supabase Admin API;
7. sends the credential only to the configured administrator address through Resend;
8. stores sanitized audit and delivery status records without the password.

The temporary password exists only in the function's memory, Supabase Auth's password update request, and the outgoing Resend payload. It is never returned to browser JavaScript and is never stored in application tables, console messages, audit metadata, local storage, or session storage.

## Delivery limitation

Supabase Auth and Resend are separate systems, so the password rotation and email delivery cannot be one atomic transaction. The function verifies configuration before rotating the password. If Resend still fails after rotation, it records only a sanitized failure, returns a generic temporary failure rather than success, and shortens both cooldowns to one minute so the administrator can request another generated password. The previous password cannot be restored because its plaintext value is intentionally unavailable.

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
