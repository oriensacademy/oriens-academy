# Oriens Academy Local Admin Setup

This workflow is strictly local. The bootstrap script aborts unless Supabase reports a loopback API on port `54321`.

## Start or rebuild

Choose local-only credentials in the current shell; do not commit them:

```powershell
$env:ORIENS_LOCAL_ADMIN_EMAIL='your-local-admin@example.test'
$env:ORIENS_LOCAL_ADMIN_PASSWORD='<choose-a-local-only-password>'
npm run local:supabase:start
npm run local:admin:setup
npm run dev
```

To rebuild from migrations and recreate the configured administrator:

```powershell
npm run local:reset
```

`local:reset` invokes the same setup script, so both variables must remain set.

## Local endpoints

- API: `http://127.0.0.1:54321`
- Database: local PostgreSQL on port `54322` (obtain local credentials from `npx supabase status`)
- Studio: `http://127.0.0.1:54323`
- Mailpit: `http://127.0.0.1:54324`
- Application: `http://localhost:3000`

The script uses the local Auth Admin API, upserts the profile in the verified local Docker database, signs in through the public Auth endpoint and confirms the normal authenticated RLS read. It sets JWT app role and profile role to `admin` with an active profile. No development authorization bypass is used.

Never point the setup script at a hosted Supabase URL and never reuse a production administrator password locally.
