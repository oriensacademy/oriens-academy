-- Oriens Academy Database Migration: Testimonials Grants & RLS Policy Fix
-- Migration ID: 20260812220000_testimonials_grants.sql

-- 1. Grant table SELECT permission to public anon and authenticated roles
GRANT SELECT ON TABLE public.testimonials TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.testimonials TO service_role;

-- 2. Ensure RLS policy for public active & verified testimonials
DROP POLICY IF EXISTS "Public active and verified testimonials policy" ON public.testimonials;
CREATE POLICY "Public active and verified testimonials policy"
  ON public.testimonials FOR SELECT
  USING (active = true AND verified = true);

-- 3. Ensure RLS policy for admin management
DROP POLICY IF EXISTS "Admin testimonials policy" ON public.testimonials;
CREATE POLICY "Admin testimonials policy"
  ON public.testimonials FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
