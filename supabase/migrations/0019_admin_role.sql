-- =============================================================================
-- Migration: 0019_admin_role.sql
-- Description: Add user_role enum, profiles.role column, is_admin() function,
--              protect_profile_role trigger, and admin RLS policies.
-- Version: 0019
-- Depends on: 0001_profiles_and_trades.sql (profiles table must exist)
--             0018_trade_psychology.sql (applies after migration 0018)
-- Author: EdgeJournal
-- Date: 2026-10-06
-- Rollback: See supabase/rollback/0019_admin_role_rollback.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: Create the user_role enum type
-- ---------------------------------------------------------------------------
-- Using DO block so the migration is idempotent (safe to re-run).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'user_role'
  ) THEN
    CREATE TYPE public.user_role AS ENUM ('user', 'admin');
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- STEP 2: Add `role` column to profiles
-- ---------------------------------------------------------------------------
-- Column has a NOT NULL constraint with a default of 'user' so:
--   a) Every existing row is immediately backfilled to 'user' (Postgres
--      evaluates the DEFAULT for all existing rows on ADD COLUMN ... DEFAULT).
--   b) Every new signup auto-gets 'user' without any trigger change.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'user';

-- ---------------------------------------------------------------------------
-- STEP 3: Idempotent backfill guard
-- ---------------------------------------------------------------------------
-- Postgres ADD COLUMN ... DEFAULT already backfills all existing rows, but
-- this UPDATE is kept as an explicit safety net for any partial-run edge case.
UPDATE public.profiles
  SET role = 'user'
  WHERE role IS NULL;

-- ---------------------------------------------------------------------------
-- STEP 4: Create the is_admin() helper function
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so the function runs as its owner (postgres/service role)
-- to read profiles.role without circular RLS evaluation.
-- SET search_path = '' prevents search_path injection attacks (Supabase lint).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- Revoke default public execution privilege, grant strictly to authenticated
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- STEP 5: Partial index on admin role
-- ---------------------------------------------------------------------------
-- Admins are a tiny subset of users; a partial index on just admin rows keeps
-- is_admin() lookups O(log n_admins) rather than O(log n_all_users).
CREATE INDEX IF NOT EXISTS idx_profiles_role_admin
  ON public.profiles (id)
  WHERE role = 'admin';

-- ---------------------------------------------------------------------------
-- STEP 6: Privilege escalation protection trigger
-- ---------------------------------------------------------------------------
-- Normal users must NOT be able to change their own role from 'user' to 'admin'.
-- Database trigger runs before INSERT or UPDATE and enforces that only
-- existing administrators (or service role) can set or change the role column.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Database superusers (SQL Editor) and service_role can always assign/modify roles
  IF current_user IN ('postgres', 'supabase_admin') OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS NOT NULL AND NEW.role != 'user'::public.user_role THEN
      IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only administrators can assign elevated roles';
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only administrators can change user roles';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_role() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- STEP 7: RLS policies — Admin Panel read/write access
-- ---------------------------------------------------------------------------
-- Existing policies from 0001 (users can view/update their own profile) are
-- unchanged. The two new policies below extend access only for admins.

-- Policy 7a: admins can SELECT any profile row (Admin Panel user list).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'Admins can view all profiles'
  ) THEN
    CREATE POLICY "Admins can view all profiles"
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (public.is_admin());
  END IF;
END
$$;

-- Policy 7b: admins can UPDATE any profile row (promote/demote users).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'Admins can update all profiles'
  ) THEN
    CREATE POLICY "Admins can update all profiles"
      ON public.profiles
      FOR UPDATE
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END
$$;

-- =============================================================================
-- Post-migration checklist:
--   1. Verify: SELECT column_name, data_type FROM information_schema.columns
--              WHERE table_name = 'profiles' AND column_name = 'role';
--   2. Verify: SELECT * FROM pg_policies WHERE tablename = 'profiles';
--   3. Verify: SELECT proname FROM pg_proc WHERE proname IN ('is_admin', 'protect_profile_role');
--   4. Promote a test admin: UPDATE public.profiles SET role = 'admin'
--              WHERE id = '<test-user-uuid>';
--   5. Confirm is_admin() returns true for that user in a test Supabase session.
--   6. Confirm a normal user's is_admin() returns false.
--   7. Confirm a normal user cannot UPDATE profiles SET role = 'admin'.
--   8. Rollback procedure: supabase/rollback/0019_admin_role_rollback.sql
-- =============================================================================
