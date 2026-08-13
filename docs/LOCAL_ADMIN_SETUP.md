# Oriens Academy Local Admin Setup

This workflow is strictly local. The bootstrap script aborts unless Supabase reports `http://127.0.0.1:54321` (or equivalent loopback) on port `54321`.

## Start or rebuild

```powershell
npm run local:supabase:start
npm run local:admin:setup
npm run dev
```

To rebuild the local database from migrations and recreate the administrator:

```powershell
npm run local:reset
```

## Local endpoints

- API: `http://127.0.0.1:54321`
- Database: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Studio: `http://127.0.0.1:54323`
- Mailpit: `http://127.0.0.1:54324`
- Application: `http://localhost:3000`

## Test administrator

- Email: `admin@oriens.local`
- Password: `OriensAdmin#2026`
- JWT app role: `admin`
- Profile role: `admin`
- Profile active: `true`

The script uses the local Auth Admin API, then upserts the profile directly in the local Docker database. It finally signs in through the public Auth endpoint and reads the profile through its normal authenticated RLS policy. No development authorization bypass is used.

The former hosted `.env.local` was preserved outside the repository at `C:\Users\merto\Desktop\.oriens-academy-production-env.backup`. Do not copy it back while performing local admin tests.
