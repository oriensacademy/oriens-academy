# Supabase Dashboard Setup Guide - Oriens Academy

This guide outlines the step-by-step human actions required in the Supabase Dashboard to complete project setup for Phase 1.

---

## Step 1: Obtain Project Credentials

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your **Oriens Academy** project.
3. Go to **Project Settings** -> **API & Connect**.
4. Copy the following values:
   - **Project URL**: (e.g., `https://xyzcompany.supabase.co`)
   - **Publishable / Anon Key**: (e.g., `eyJhbGciOi...`)
5. Paste these values into your local `.env.local` (or production hosting environment variables):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

---

## Step 2: Configure Authentication Settings

1. In the Supabase Dashboard, go to **Authentication** -> **Providers**.
2. Ensure **Email** provider is **Enabled**.
3. Under **Authentication** -> **URL Configuration**:
   - Set **Site URL** to your production domain (`https://oriens-academy.com`).
4. Under **Authentication** -> **User Management / Sign Up**:
   - **CRITICAL**: After creating your initial administrator account (Step 3), **DISABLE** `"Allow new users to sign up"`.
   - Public users must NOT be able to self-register.

---

## Step 3: Create Initial Administrator Account

1. Go to **Authentication** -> **Users**.
2. Click **Add User** -> **Create User**.
3. Enter the administrator email address and a strong password.
4. Confirm creation.

---

## Step 4: Assign Administrative Authorization (`app_metadata`)

> [!IMPORTANT]
> Authorization in Oriens Academy relies strictly on `app_metadata.role = "admin"`.
> Editing `user_metadata` is user-modifiable and will NOT grant admin privileges.

To set `app_metadata.role = "admin"` for your administrator user:

### Option A: Via Supabase SQL Editor (Recommended)

1. Open **SQL Editor** in your Supabase Dashboard.
2. Run the following query (replace `<ADMIN_EMAIL>` with the admin email created in Step 3):

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = '<ADMIN_EMAIL>';
```

3. Verify by querying:

```sql
select id, email, raw_app_meta_data
from auth.users
where email = '<ADMIN_EMAIL>';
```

Ensure the output contains `"role": "admin"` inside `raw_app_meta_data`.

---

## Step 5: Execute Database Migrations

If CLI project linking is configured:

```bash
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```

Alternatively, if running manually:
1. Copy the contents of `supabase/migrations/20260811000000_init_schema.sql`.
2. Open **SQL Editor** in the Supabase Dashboard.
3. Paste and click **Run**.

---

## Step 6: Security Verification Checklist

- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set in env.
- [ ] No secret keys placed in client code or `.env.example`.
- [ ] Initial admin user created and verified.
- [ ] `raw_app_meta_data` role set to `"admin"`.
- [ ] "Allow new users to sign up" disabled in Auth settings.
- [ ] Database migration applied successfully with RLS enabled on all 8 tables.
